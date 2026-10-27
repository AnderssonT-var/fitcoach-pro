import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

import 'app.dart';
import 'core/api.dart';
import 'core/catalog.dart';
import 'core/notify.dart';
import 'core/store.dart';

/* Errores de la app: se reportan al servidor (el administrador los ve en «Sistema»). */
int _reported = 0;
void reportError(Object error, StackTrace? stack) {
  if (kDebugMode || _reported++ > 10) return;
  final msg = error.toString();
  if (msg.isEmpty) return;
  http
      .post(Uri.parse('$apiBase/api/report-error'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'message': msg.length > 480 ? msg.substring(0, 480) : msg, 'stack': (stack?.toString() ?? '').characters.take(5800).toString(), 'path': 'android'}))
      .timeout(const Duration(seconds: 10))
      .catchError((_) => http.Response('', 0));
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (d) {
    FlutterError.presentError(d);
    reportError(d.exception, d.stack);
  };
  PlatformDispatcher.instance.onError = (e, st) {
    reportError(e, st);
    return true;
  };
  Intl.defaultLocale = 'es';
  await initializeDateFormatting('es');
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  await Catalog.load();
  await Notify.I.init();
  runApp(const VytrafitApp());
  await AppStore.I.init();
}
