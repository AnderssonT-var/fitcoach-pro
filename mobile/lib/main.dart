import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

import 'app.dart';
import 'core/catalog.dart';
import 'core/notify.dart';
import 'core/store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Intl.defaultLocale = 'es';
  await initializeDateFormatting('es');
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  await Catalog.load();
  await Notify.I.init();
  runApp(const VytrafitApp());
  await AppStore.I.init();
}
