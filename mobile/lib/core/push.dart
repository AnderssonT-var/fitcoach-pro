// Notificaciones del servidor (Firebase Cloud Messaging): mensajes, pagos, reseñas, etc.
// llegan aunque la app esté cerrada. Los datos del proyecto Firebase se ponen al compilar
// (--dart-define FCM_*); si no están, la app funciona igual sin estos avisos.
import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api.dart';
import 'notify.dart';

const _apiKey = String.fromEnvironment('FCM_API_KEY');
const _appId = String.fromEnvironment('FCM_APP_ID');
const _sender = String.fromEnvironment('FCM_SENDER_ID');
const _project = String.fromEnvironment('FCM_PROJECT_ID');

class Push {
  Push._();
  static final Push I = Push._();

  /// Pantalla que pidió abrir una notificación tocada (la escucha la barra de pestañas).
  final open = ValueNotifier<(String, int?)?>(null);

  bool _ready = false;
  String? _token;
  StreamSubscription<String>? _refresh;

  static bool get configured => !kIsWeb && _apiKey.isNotEmpty && _appId.isNotEmpty && _sender.isNotEmpty && _project.isNotEmpty;

  Future<void> init() async {
    if (!configured || _ready) return;
    try {
      await Firebase.initializeApp(options: const FirebaseOptions(apiKey: _apiKey, appId: _appId, messagingSenderId: _sender, projectId: _project));
      await Notify.I.ensureChannel();
      // Con la app abierta Android no muestra la notificación: se muestra aquí
      FirebaseMessaging.onMessage.listen((m) {
        final n = m.notification;
        if (n != null) Notify.I.show(m.hashCode & 0x7fffffff, n.title ?? 'VYTRAFIT', n.body ?? '');
      });
      FirebaseMessaging.onMessageOpenedApp.listen(_opened);
      final first = await FirebaseMessaging.instance.getInitialMessage();
      if (first != null) _opened(first);
      _ready = true;
    } catch (e) {
      debugPrint('[push] $e');
    }
  }

  void _opened(RemoteMessage m) {
    final page = m.data['page'] as String? ?? '';
    if (page.isEmpty) return;
    open.value = (page, int.tryParse('${m.data['clientId'] ?? ''}'));
  }

  /// Registra este teléfono en el servidor (después de iniciar sesión y con avisos activados).
  Future<void> register() async {
    if (!_ready) return;
    try {
      if ((await Notify.I.status()) != 'on') return;
      final fm = FirebaseMessaging.instance;
      await fm.requestPermission();
      final t = await fm.getToken();
      if (t == null) return;
      _token = t;
      await Api.I.call('POST', '/api/push/subscribe', {'kind': 'fcm', 'token': t});
      _refresh ??= fm.onTokenRefresh.listen((nt) {
        _token = nt;
        Api.I.call('POST', '/api/push/subscribe', {'kind': 'fcm', 'token': nt});
      });
    } catch (e) {
      debugPrint('[push] register $e');
    }
  }

  /// Deja de recibir avisos en este teléfono (al cerrar sesión o desactivarlos).
  Future<void> unregister() async {
    if (!_ready) return;
    try {
      final t = _token ?? await FirebaseMessaging.instance.getToken();
      if (t != null) await Api.I.call('POST', '/api/push/unsubscribe', {'key': t});
    } catch (_) {/* sin señal: el servidor lo limpia cuando el token deje de servir */}
  }
}
