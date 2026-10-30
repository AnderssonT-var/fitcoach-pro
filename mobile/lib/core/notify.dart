// Notificaciones en el celular: fin del descanso con la pantalla apagada y
// recordatorios para entrenar. Si algo no está disponible, la app sigue sin avisos.
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import 'json.dart';

class Notify {
  Notify._();
  static final Notify I = Notify._();

  final _p = FlutterLocalNotificationsPlugin();
  bool _ready = false;
  static const _kOn = 'vytrafit.notif';
  static const restId = 1001;

  AndroidFlutterLocalNotificationsPlugin? get _android => _p.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  Future<void> init() async {
    if (_ready || kIsWeb) return;
    try {
      tzdata.initializeTimeZones();
      try {
        final name = (await FlutterTimezone.getLocalTimezone()).identifier;
        tz.setLocalLocation(tz.getLocation(name));
      } catch (_) {
        tz.setLocalLocation(tz.getLocation('America/Guayaquil'));
      }
      await _p.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('ic_stat_vytrafit'),
          iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
        ),
      );
      _ready = true;
    } catch (e) {
      debugPrint('[notify] $e');
    }
  }

  /// 'on' | 'off' | 'denied' | 'unsupported'
  Future<String> status() async {
    if (kIsWeb || !_ready) return 'unsupported';
    final prefs = await SharedPreferences.getInstance();
    final enabled = await _android?.areNotificationsEnabled();
    if (enabled == false) return prefs.getBool(_kOn) == true ? 'denied' : 'off';
    return prefs.getBool(_kOn) == true ? 'on' : 'off';
  }

  Future<String?> enable() async {
    if (kIsWeb || !_ready) return 'Este equipo no permite notificaciones.';
    final ok = await _android?.requestNotificationsPermission() ??
        await _p.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()?.requestPermissions(alert: true, sound: true, badge: true) ??
        true;
    if (!ok) return 'No diste permiso para notificaciones. Actívalo en los ajustes del teléfono.';
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kOn, true);
    return null;
  }

  Future<void> disable() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kOn, false);
    if (_ready) await _p.cancelAll();
  }

  Future<void> test() async {
    if (!_ready) return;
    await _p.show(id: 9000, title: '¡Notificaciones activadas!', body: 'Así te avisaremos del descanso y de tus entrenamientos.', notificationDetails: _details('avisos', 'Avisos'));
  }

  /// Fin del descanso con la app abierta: suena (volumen de alarma) y vibra.
  static const _alarm = MethodChannel('vytrafit/alarm');
  Future<void> ringRest() async {
    if (kIsWeb) return;
    try {
      await _alarm.invokeMethod('ring', {'sound': true, 'vibrate': true});
    } catch (_) {
      HapticFeedback.heavyImpact();
    }
  }

  /// La primera vez que entrena, pide permiso de notificaciones para avisar el fin del
  /// descanso con la pantalla apagada (una sola vez).
  Future<void> ensureRestPermission() async {
    if (kIsWeb || !_ready) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool('vytrafit.restAsked') == true) return;
      await prefs.setBool('vytrafit.restAsked', true);
      if (await _android?.areNotificationsEnabled() == true) return;
      await _android?.requestNotificationsPermission();
    } catch (_) {}
  }

  Future<void> stopRing() async {
    if (kIsWeb) return;
    try {
      await _alarm.invokeMethod('stop');
    } catch (_) {}
  }

  /// Canal propio para el fin del descanso: sonido de alarma de la app y vibración larga.
  NotificationDetails _restDetails() => NotificationDetails(
        android: AndroidNotificationDetails('descanso_alarma', 'Fin de descanso',
            channelDescription: 'Suena y vibra cuando termina el descanso entre series.',
            importance: Importance.max, priority: Priority.max, icon: 'ic_stat_vytrafit', category: AndroidNotificationCategory.alarm,
            sound: const RawResourceAndroidNotificationSound('descanso'), playSound: true, audioAttributesUsage: AudioAttributesUsage.alarm,
            enableVibration: true, vibrationPattern: Int64List.fromList([0, 450, 180, 450, 180, 700]), timeoutAfter: 60000),
        iOS: const DarwinNotificationDetails(presentSound: true),
      );

  NotificationDetails _details(String channel, String name, {bool loud = false}) => NotificationDetails(
        android: AndroidNotificationDetails(channel, name,
            importance: loud ? Importance.max : Importance.high, priority: loud ? Priority.max : Priority.high, icon: 'ic_stat_vytrafit',
            category: loud ? AndroidNotificationCategory.alarm : AndroidNotificationCategory.reminder, enableVibration: true),
        iOS: const DarwinNotificationDetails(presentSound: true),
      );

  Future<AndroidScheduleMode> _mode() async {
    try {
      final exact = await _android?.canScheduleExactNotifications();
      if (exact == true) return AndroidScheduleMode.exactAllowWhileIdle;
    } catch (_) {}
    return AndroidScheduleMode.inexactAllowWhileIdle;
  }

  /// Programa (o cancela con null) el aviso de fin de descanso.
  Future<void> armRestAlarm(DateTime? at) async {
    if (!_ready) return;
    try {
      await _p.cancel(id: restId);
      if (at == null || at.isBefore(DateTime.now().add(const Duration(seconds: 1)))) return;
      await _p.zonedSchedule(
        id: restId,
        title: '¡Descanso terminado!',
        body: 'A por la siguiente serie 💪',
        scheduledDate: tz.TZDateTime.from(at, tz.local),
        notificationDetails: _restDetails(),
        androidScheduleMode: await _mode(),
      );
    } catch (e) {
      debugPrint('[notify] rest $e');
    }
  }

  /// Recordatorio semanal para entrenar: { on, days: [0..6] (0 = domingo), time: "18:00" }.
  Future<void> scheduleReminders(J? rem) async {
    if (!_ready) return;
    try {
      for (var d = 0; d < 7; d++) {
        await _p.cancel(id: 2000 + d);
      }
      if (rem == null || !rem.b('on') || (await status()) != 'on') return;
      final parts = rem.s('time', '18:00').split(':');
      final h = int.tryParse(parts[0]) ?? 18, m = int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0;
      for (final d in rem.l('days').map((e) => intOf(e))) {
        final now = tz.TZDateTime.now(tz.local);
        var at = tz.TZDateTime(tz.local, now.year, now.month, now.day, h, m);
        final weekday = d == 0 ? 7 : d; // Dart: lunes = 1 … domingo = 7
        while (at.weekday != weekday || at.isBefore(now)) {
          at = at.add(const Duration(days: 1));
        }
        await _p.zonedSchedule(
          id: 2000 + d,
          title: 'Hoy toca entrenar 💪',
          body: 'Tu rutina te espera. ¡Vamos!',
          scheduledDate: at,
          notificationDetails: _details('avisos', 'Avisos'),
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
        );
      }
    } catch (e) {
      debugPrint('[notify] reminders $e');
    }
  }

  /// Canal de «Avisos» (lo usan también las notificaciones que llegan del servidor).
  Future<void> ensureChannel() async {
    if (!_ready) return;
    try {
      await _android?.createNotificationChannel(const AndroidNotificationChannel('avisos', 'Avisos',
          description: 'Mensajes de tu entrenador, pagos, reseñas y novedades.', importance: Importance.high));
    } catch (_) {}
  }

  /// Aviso inmediato (mensajes nuevos, etc. mientras la app está abierta en segundo plano).
  Future<void> show(int id, String title, String body) async {
    if (!_ready || (await status()) != 'on') return;
    await _p.show(id: id, title: title, body: body, notificationDetails: _details('avisos', 'Avisos'));
  }
}
