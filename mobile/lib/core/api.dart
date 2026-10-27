// Cliente HTTP de la API de VYTRAFIT con renovación automática de la sesión.
import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

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
  const ApiResult({this.data, this.error, this.status = 200, this.code, this.offline = false, this.notModified = false});
  bool get ok => error == null;
  J get json => data is Map ? (data as Map).cast<String, dynamic>() : <String, dynamic>{};
}

class Api {
  Api._();
  static final Api I = Api._();

  static const _rtKey = 'vytrafit.rt';
  final _storage = const FlutterSecureStorage();
  final _client = http.Client();

  String? _access;
  String? _refresh;
  bool _loaded = false;
  String? _stateTag;
  Future<bool?>? _refreshing;
  void Function()? onSessionLost;

  Future<void> init() async {
    if (_loaded) return;
    try {
      _refresh = await _storage.read(key: _rtKey);
    } catch (_) {
      _refresh = null;
    }
    _loaded = true;
  }

  bool get hasSession => _refresh != null && _refresh!.isNotEmpty;
  void resetStateTag() => _stateTag = null;

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

  /// true = renovada · false = la sesión ya no vale · null = sin conexión
  Future<bool?> _doRefresh() {
    if (!hasSession) return Future.value(false);
    final before = _access;
    return _refreshing ??= () async {
      try {
        if (_access != null && _access != before) return true;
        final r = await _client
            .post(Uri.parse('$apiBase/api/auth/refresh'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refreshToken': _refresh}))
            .timeout(const Duration(seconds: 20));
        if (r.statusCode >= 500) return null;
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

  Future<ApiResult> call(String method, String path, [Object? body, bool conditional = false]) async {
    final isAuth = path.startsWith('/api/auth/') || path.startsWith('/api/public/');
    Future<http.Response> go() {
      final req = http.Request(method, Uri.parse('$apiBase$path'));
      if (body != null) {
        req.headers['Content-Type'] = 'application/json';
        req.body = jsonEncode(body);
      }
      if (_access != null) req.headers['Authorization'] = 'Bearer $_access';
      if (conditional && _stateTag != null) req.headers['If-None-Match'] = _stateTag!;
      req.headers['Accept'] = 'application/json';
      return _client.send(req).timeout(const Duration(seconds: 30)).then(http.Response.fromStream);
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
        }
      }
    } catch (_) {
      return const ApiResult(error: 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.', status: 0, offline: true);
    }
    if (conditional && r.statusCode == 304) return const ApiResult(notModified: true, status: 304);
    if (conditional && r.statusCode == 200) _stateTag = r.headers['etag'];
    dynamic data;
    try {
      data = r.body.isEmpty ? null : jsonDecode(utf8.decode(r.bodyBytes));
    } catch (_) {
      data = null;
    }
    if (r.statusCode < 200 || r.statusCode >= 300) {
      final m = data is Map ? data.cast<String, dynamic>() : <String, dynamic>{};
      return ApiResult(error: m.sn('error') ?? 'Algo salió mal. Intenta de nuevo.', status: r.statusCode, code: m.sn('code'), data: data);
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
