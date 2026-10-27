// Cliente HTTP de la API de VYTRAFIT con renovación automática de la sesión.
// Envía la identificación del equipo (para el monitor del administrador) y, en las
// acciones guardadas sin conexión, su identificador y la hora real en que se hicieron.
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'json.dart';

const apiBase = String.fromEnvironment('API_URL', defaultValue: 'https://vytra.fit');

/// Convierte rutas del servidor (/api/files/...) en direcciones completas.
String? absUrl(String? u) => u != null && u.startsWith('/api/') ? '$apiBase$u' : u;

class ApiResult {
  final dynamic data;
  final String? error;
  final int status;
  final String? code;
  final bool offline;
  final bool notModified;
  final int retryAfter;
  const ApiResult({this.data, this.error, this.status = 200, this.code, this.offline = false, this.notModified = false, this.retryAfter = 0});
  bool get ok => error == null;
  J get json => data is Map ? (data as Map).cast<String, dynamic>() : <String, dynamic>{};
  bool get queued => data is Map && (data as Map)['queued'] == true;

  /// Error pasajero (sin señal, servidor ocupado): se reintenta solo.
  bool get transient => !ok && (offline || status == 0 || status >= 500 || status == 429 || status == 408 || status == 409 || status == 401);
}

/// JSON grande (el estado de un entrenador) se decodifica fuera del hilo de la pantalla.
dynamic _decode(String s) => jsonDecode(s);
Future<dynamic> decodeJson(String s) => s.length > 150000 ? compute(_decode, s) : Future.value(jsonDecode(s));
String _encode(Object? v) => jsonEncode(v);
Future<String> encodeJson(Object? v) => compute(_encode, v);

class Api {
  Api._();
  static final Api I = Api._();

  static const _rtKey = 'vytrafit.rt';
  final _storage = const FlutterSecureStorage();
  final _client = http.Client();

  String? _access;
  String? _refresh;
  bool _loaded = false;
  String? stateTag;
  Future<bool?>? _refreshing;
  void Function()? onSessionLost;

  /// Segundos entre actualizaciones (lo sugiere el servidor según la carga).
  int pollSeconds = 20;
  String _device = 'flutter';
  String _app = 'android/?';
  ({int pending, int failed}) Function() syncInfo = () => (pending: 0, failed: 0);

  Future<void> init() async {
    if (_loaded) return;
    try {
      _refresh = await _storage.read(key: _rtKey);
    } catch (_) {
      _refresh = null;
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      var id = prefs.getString('vytrafit.device');
      if (id == null) {
        final r = math.Random.secure();
        id = 'a${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${List.generate(8, (_) => r.nextInt(36).toRadixString(36)).join()}';
        await prefs.setString('vytrafit.device', id);
      }
      _device = id;
    } catch (_) {}
    try {
      final info = await PackageInfo.fromPlatform();
      _app = '${kIsWeb ? 'flutter-web' : defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android'}/${info.version}';
    } catch (_) {
      _app = kIsWeb ? 'flutter-web/?' : 'android/?';
    }
    _loaded = true;
  }

  bool get hasSession => _refresh != null && _refresh!.isNotEmpty;
  void resetStateTag() => stateTag = null;

  Future<void> setTokens(J? t) async {
    _access = t?.sn('accessToken');
    _refresh = t?.sn('refreshToken');
    try {
      if (_refresh == null) {
        await _storage.delete(key: _rtKey);
      } else {
        await _storage.write(key: _rtKey, value: _refresh);
      }
    } catch (_) {/* sin almacenamiento seguro */}
  }

  String? get refreshToken => _refresh;

  /// true = renovada · false = la sesión ya no vale · null = sin conexión o servidor ocupado
  Future<bool?> _doRefresh() {
    if (!hasSession) return Future.value(false);
    final before = _access;
    return _refreshing ??= () async {
      try {
        if (_access != null && _access != before) return true;
        final r = await _client
            .post(Uri.parse('$apiBase/api/auth/refresh'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refreshToken': _refresh}))
            .timeout(const Duration(seconds: 20));
        // Servidor caído u ocupado: NO se cierra la sesión, se reintenta luego
        if (r.statusCode >= 500 || r.statusCode == 429) return null;
        if (r.statusCode != 200) {
          await setTokens(null);
          return false;
        }
        await setTokens((jsonDecode(r.body) as Map).cast<String, dynamic>());
        return true;
      } catch (_) {
        return null;
      } finally {
        Future.microtask(() => _refreshing = null);
      }
    }();
  }

  static const _offline = ApiResult(error: 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.', status: 0, offline: true);

  Future<ApiResult> call(String method, String path,
      [Object? body, bool conditional = false, String? opId, String? opAt, String? haveHistory, Duration timeout = const Duration(seconds: 25)]) async {
    final isAuth = path.startsWith('/api/auth/') || path.startsWith('/api/public/');
    Future<http.Response> go() {
      final req = http.Request(method, Uri.parse('$apiBase$path'));
      if (body != null) {
        req.headers['Content-Type'] = 'application/json';
        req.body = jsonEncode(body);
      }
      if (_access != null) req.headers['Authorization'] = 'Bearer $_access';
      if (conditional && stateTag != null) req.headers['If-None-Match'] = stateTag!;
      if (opId != null) req.headers['Idempotency-Key'] = opId;
      if (opAt != null) req.headers['X-Op-At'] = opAt;
      if (haveHistory != null) req.headers['X-Have-History'] = haveHistory;
      final info = syncInfo();
      req.headers['X-App'] = _app;
      req.headers['X-Device'] = _device;
      req.headers['X-Pending'] = '${info.pending}';
      req.headers['X-Sync-Failed'] = '${info.failed}';
      req.headers['Accept'] = 'application/json';
      return _client.send(req).timeout(timeout).then(http.Response.fromStream).timeout(timeout * 2);
    }

    http.Response r;
    try {
      if (_access == null && hasSession && !isAuth) await _doRefresh();
      r = await go();
      if (r.statusCode == 401 && hasSession && !path.startsWith('/api/auth/login')) {
        final ok = await _doRefresh();
        if (ok == true) {
          r = await go();
        } else if (ok == false) {
          onSessionLost?.call();
        } else {
          return _offline;
        }
      }
    } catch (_) {
      return _offline;
    }
    final hint = int.tryParse(r.headers['x-poll-interval'] ?? '');
    if (hint != null && hint >= 10 && hint <= 600) pollSeconds = hint;
    if (conditional && r.statusCode == 304) return const ApiResult(notModified: true, status: 304);
    if (conditional && r.statusCode == 200) stateTag = r.headers['etag'];
    dynamic data;
    try {
      data = r.bodyBytes.isEmpty ? null : await decodeJson(utf8.decode(r.bodyBytes));
    } catch (_) {
      data = null;
    }
    if (r.statusCode < 200 || r.statusCode >= 300) {
      final m = data is Map ? data.cast<String, dynamic>() : <String, dynamic>{};
      return ApiResult(
          error: m.sn('error') ?? 'Algo salió mal. Intenta de nuevo.', status: r.statusCode, code: m.sn('code'), data: data,
          retryAfter: int.tryParse(r.headers['retry-after'] ?? '') ?? 0);
    }
    return ApiResult(data: data, status: r.statusCode);
  }

  Future<bool> health() async {
    try {
      final r = await _client.get(Uri.parse('$apiBase/api/health')).timeout(const Duration(seconds: 10));
      return r.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
