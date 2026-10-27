import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/json.dart';
import 'core/store.dart';
import 'screens/auth/gates.dart';
import 'screens/auth/login.dart';
import 'screens/shell.dart';
import 'ui/theme.dart';

/// Color de la marca elegida en la pantalla de acceso (antes de entrar).
final loginBrandColor = ValueNotifier<Color?>(null);

final navKey = GlobalKey<NavigatorState>();
final messengerKey = GlobalKey<ScaffoldMessengerState>();

class VytrafitApp extends StatefulWidget {
  const VytrafitApp({super.key});
  @override
  State<VytrafitApp> createState() => _VytrafitAppState();
}

class _VytrafitAppState extends State<VytrafitApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    store.setForeground(state == AppLifecycleState.resumed);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([store, loginBrandColor]),
      builder: (context, _) {
        final brand = store.status == Status.ready && store.me != null ? parseHex(store.brand()?.sn('color')) : loginBrandColor.value;
        final color = brand ?? vytraBlue;
        return MaterialApp(
          title: 'VYTRAFIT',
          debugShowCheckedModeBanner: false,
          navigatorKey: navKey,
          scaffoldMessengerKey: messengerKey,
          theme: buildTheme(color, Brightness.light),
          darkTheme: buildTheme(color, Brightness.dark),
          themeMode: ThemeMode.system,
          locale: const Locale('es'),
          supportedLocales: const [Locale('es'), Locale('en')],
          localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
          home: const Root(),
        );
      },
    );
  }
}

/// Decide qué pantalla mostrar según la sesión y los pasos obligatorios.
class Root extends StatelessWidget {
  const Root({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final Widget view;
        final me = store.me;
        if (store.status == Status.boot) {
          view = const Splash();
        } else if (store.status == Status.offline) {
          view = OfflineScreen(message: store.bootError);
        } else if (store.status == Status.guest || me == null) {
          view = const LoginScreen();
        } else if (me.s('role') == 'admin') {
          view = const AdminNotice();
        } else if (me.b('mustChangePassword')) {
          view = const ChangePasswordScreen();
        } else if (!me.b('consentCurrent')) {
          view = const ConsentScreen();
        } else if (me.s('role') == 'client' && store.access != null && !store.access!.b('ok')) {
          view = BlockedScreen(message: store.access!.s('message'));
        } else {
          view = Shell(key: ValueKey('shell-${me.i('id')}'));
        }
        return AnimatedSwitcher(duration: const Duration(milliseconds: 250), child: KeyedSubtree(key: ValueKey(view.runtimeType), child: view));
      },
    );
  }
}

/// Reconstruye cuando cambian los datos (para pantallas abiertas encima de otras).
class Watch extends StatelessWidget {
  final WidgetBuilder builder;
  const Watch({super.key, required this.builder});
  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: store, builder: (ctx, _) => builder(ctx));
}

Future<T?> push<T>(BuildContext context, Widget page) => Navigator.of(context).push<T>(MaterialPageRoute(builder: (_) => page));
