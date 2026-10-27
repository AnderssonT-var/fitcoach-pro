// Estructura principal: barra inferior según el rol, aviso sin conexión y «Más».
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app.dart';
import '../core/format.dart';
import '../core/json.dart';
import '../core/notify.dart';
import '../core/store.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'client/client_home.dart';
import 'client/my_payments.dart';
import 'client/my_routine.dart';
import 'client/client_profile.dart';
import 'client/progress.dart';
import 'coach/clients.dart';
import 'coach/coach_home.dart';
import 'coach/coach_profile.dart';
import 'coach/library.dart';
import 'coach/payments.dart';
import 'coach/subscription.dart';
import 'shared/community.dart';
import 'shared/messages.dart';
import 'workout/session.dart';

class TabDef {
  final String id, label;
  final IconData icon, selected;
  final Widget page;
  const TabDef(this.id, this.label, this.icon, this.selected, this.page);
}

class ShellScope extends InheritedWidget {
  final void Function(String tab) goTab;
  const ShellScope({super.key, required this.goTab, required super.child});
  static ShellScope? of(BuildContext c) => c.dependOnInheritedWidgetOfExactType<ShellScope>();
  @override
  bool updateShouldNotify(ShellScope old) => false;
}

/// Cambia de pestaña desde cualquier pantalla de la barra.
void goTab(BuildContext context, String tab) {
  final scope = ShellScope.of(context);
  if (scope != null) {
    scope.goTab(tab);
  } else {
    _ShellState.current?.go(tab);
  }
}

/// Abre el entrenamiento en curso (o empieza uno nuevo con el día elegido).
Future<void> openWorkout(BuildContext context, [String? dayId]) async {
  final me = store.meId!;
  if (!store.hasActive(me)) store.startWorkout(me, dayId);
  if (!store.hasActive(me)) return;
  HapticFeedback.mediumImpact();
  await Navigator.of(context).push(PageRouteBuilder(
    pageBuilder: (_, __, ___) => WorkoutSession(clientId: me),
    transitionsBuilder: (_, a, __, child) => SlideTransition(position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)), child: child),
    transitionDuration: const Duration(milliseconds: 320),
  ));
}

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  static _ShellState? current;
  int index = 0;
  final _visited = <int>{0};

  @override
  void initState() {
    super.initState();
    current = this;
    // Recordatorios locales del asesorado (sin servidor de notificaciones)
    if (!store.isCoach) Notify.I.scheduleReminders(store.me?.m('notif')?.m('reminder'));
  }

  List<TabDef> get tabs => store.isCoach
      ? const [
          TabDef('inicio', 'Inicio', Icons.space_dashboard_outlined, Icons.space_dashboard_rounded, CoachHome()),
          TabDef('clientes', 'Clientes', Icons.groups_outlined, Icons.groups_rounded, ClientsPage()),
          TabDef('pagos', 'Pagos', Icons.account_balance_wallet_outlined, Icons.account_balance_wallet_rounded, CoachPayments()),
          TabDef('mensajes', 'Mensajes', Icons.chat_bubble_outline_rounded, Icons.chat_bubble_rounded, MessagesPage()),
          TabDef('mas', 'Más', Icons.grid_view_outlined, Icons.grid_view_rounded, MorePage()),
        ]
      : const [
          TabDef('inicio', 'Inicio', Icons.home_outlined, Icons.home_rounded, ClientHome()),
          TabDef('rutina', 'Rutina', Icons.fitness_center_outlined, Icons.fitness_center_rounded, MyRoutine()),
          TabDef('progreso', 'Progreso', Icons.insights_outlined, Icons.insights_rounded, ProgressPage()),
          TabDef('mensajes', 'Coach', Icons.chat_bubble_outline_rounded, Icons.chat_bubble_rounded, MessagesPage()),
          TabDef('mas', 'Más', Icons.grid_view_outlined, Icons.grid_view_rounded, MorePage()),
        ];

  void go(String id) {
    final i = tabs.indexWhere((t) => t.id == id);
    if (i < 0) return;
    setState(() {
      index = i;
      _visited.add(i);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final me = store.me!;
      final unread = store.unreadFor(me.i('id'));
      final locked = store.isCoach && !store.coachCanWork(me.i('id'));
      final ts = tabs;
      return ShellScope(
        goTab: go,
        child: PopScope(
          canPop: index == 0,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) go('inicio');
          },
          child: Scaffold(
            body: Column(children: [
              if (store.offline || store.pendingUploads > 0) _NetBar(offline: store.offline, pending: store.pendingUploads),
              Expanded(
                child: locked
                    ? const LicenseLock()
                    : IndexedStack(index: index, children: [
                        for (var i = 0; i < ts.length; i++) _visited.contains(i) ? TickerMode(enabled: i == index, child: ts[i].page) : const SizedBox.shrink(),
                      ]),
              ),
            ]),
            bottomNavigationBar: locked
                ? null
                : DecoratedBox(
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: t.line))),
                    child: NavigationBar(
                      selectedIndex: index,
                      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
                      onDestinationSelected: (i) {
                        HapticFeedback.selectionClick();
                        setState(() {
                          index = i;
                          _visited.add(i);
                        });
                      },
                      destinations: [
                        for (final tab in ts)
                          NavigationDestination(
                            icon: Badge(isLabelVisible: tab.id == 'mensajes' && unread > 0, label: Text('$unread'), child: Icon(tab.icon)),
                            selectedIcon: Badge(isLabelVisible: tab.id == 'mensajes' && unread > 0, label: Text('$unread'), child: Icon(tab.selected)),
                            label: tab.label,
                            tooltip: '',
                          ),
                      ],
                    ),
                  ),
          ),
        ),
      );
    });
  }
}

class _NetBar extends StatelessWidget {
  final bool offline;
  final int pending;
  const _NetBar({required this.offline, required this.pending});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final text = offline
        ? 'Sin conexión. Puedes entrenar: todo se guarda en tu celular.${pending > 0 ? ' $pending ${pending == 1 ? 'entrenamiento' : 'entrenamientos'} por subir.' : ''}'
        : 'Subiendo $pending ${pending == 1 ? 'entrenamiento guardado' : 'entrenamientos guardados'} sin conexión…';
    return Material(
      color: t.warnSoft,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(children: [
            Icon(offline ? Icons.wifi_off_rounded : Icons.cloud_upload_rounded, size: 18, color: t.warn),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: t.ink, fontWeight: FontWeight.w500))),
            if (!offline) const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
          ]),
        ),
      ),
    );
  }
}

/// Encabezado común de las pestañas (con margen superior seguro).
class TabPage extends StatelessWidget {
  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  const TabPage({super.key, required this.children, this.onRefresh});
  @override
  Widget build(BuildContext context) => SafeArea(
        bottom: false,
        child: PageList(onRefresh: onRefresh ?? store.reload, padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: children),
      );
}

/* ------------------------------------------------------------ Más */
class MorePage extends StatelessWidget {
  const MorePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final me = store.me!;
      final coach = store.isCoach;
      final brand = store.brand();
      final items = coach
          ? [
              (Icons.diversity_3_rounded, 'Comunidad', 'Publicaciones, retos y tabla del mes', () => push(context, const CommunityPage(standalone: true))),
              (Icons.menu_book_rounded, 'Biblioteca', 'Ejercicios y plantillas', () => push(context, const LibraryPage())),
              (Icons.storefront_rounded, 'Perfil y marca', 'Tu foto, logo, color, enlace e inscripción', () => push(context, const CoachProfilePage())),
              (Icons.workspace_premium_rounded, 'Suscripción', 'Tu licencia y pagos', () => push(context, const SubscriptionPage())),
            ]
          : [
              (Icons.diversity_3_rounded, 'Comunidad', 'Comparte tus logros con el grupo', () => push(context, const CommunityPage(standalone: true))),
              (Icons.account_balance_wallet_rounded, 'Pagos', 'Tus mensualidades', () => push(context, const MyPayments())),
              (Icons.person_rounded, 'Mi perfil', 'Tus datos, notificaciones y privacidad', () => push(context, const ClientProfilePage())),
            ];
      return SafeArea(
        bottom: false,
        child: PageList(padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: [
          Panel(
            gradient: LinearGradient(colors: [context.tok.accent, Color.lerp(context.tok.accent, Colors.black, .35)!], begin: Alignment.topLeft, end: Alignment.bottomRight),
            border: Colors.transparent,
            child: Row(children: [
              Avatar.of(me, size: 56),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(me.s('name'), style: context.tt.titleLarge?.copyWith(color: Colors.white)),
                  Text(coach ? 'Entrenador' : 'Asesorado de ${firstName(store.myCoach?.s('name') ?? '')}', style: const TextStyle(color: Colors.white70)),
                ]),
              ),
              if (brand != null) BrandMark(brand: brand, size: 44),
            ]),
          ),
          Panel(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Column(children: [
              for (final (i, (icon, title, sub, onTap)) in items.indexed) ...[
                if (i > 0) const Divider(height: 1),
                RowTile(leading: IconBadge(icon, tone: 'info'), title: title, subtitle: sub, onTap: onTap),
              ],
            ]),
          ),
          Panel(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: RowTile(
              leading: const IconBadge(Icons.logout_rounded, tone: 'bad'),
              title: 'Cerrar sesión',
              subtitle: me.s('email'),
              onTap: () async {
                if (await confirm(context, title: 'Cerrar sesión', text: 'Tendrás que volver a escribir tu correo y contraseña.', confirmLabel: 'Salir', danger: false)) {
                  final b = store.brand();
                  if (b?.sn('slug') != null) store.saveBrand(b!.s('slug'));
                  store.logout();
                }
              },
            ),
          ),
          Center(child: Text('VYTRAFIT · Desarrollado por A.T.', style: context.tt.bodySmall)),
        ]),
      );
    });
  }
}
