// Inicio del entrenador: cifras, pendientes, cumplimiento y últimos entrenamientos.
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../core/techniques.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shared/account.dart';
import '../shared/messages.dart';
import '../shared/progress_widgets.dart';
import '../shell.dart';
import '../../core/coaching.dart';
import 'client_detail.dart';
import 'coaching.dart';
import 'clients.dart';
import 'page_editor.dart';
import 'subscription.dart';

class CoachHome extends StatelessWidget {
  const CoachHome({super.key});

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final me = store.me!;
      final id = me.i('id');
      final lic = store.coachLicense(id);
      final clients = store.clientsOf(id);
      final active = clients.where((c) => c.b('active')).toList();
      final pays = store.payments.where((p) => p.i('coachId') == id).toList();
      final now = DateTime.now();
      bool thisMonth(DateTime? d) => d != null && d.month == now.month && d.year == now.year;
      final collected = pays.where((p) => thisMonth(p.d('paidAt'))).fold<double>(0, (t, p) => t + p.n('amount'));
      final overdue = pays.where((p) => AppStore.paymentStatus(p) == 'overdue').toList();
      final pending = pays.where((p) => AppStore.paymentStatus(p) != 'paid').toList();
      final weekDone = active.fold<int>(0, (t, c) => t + store.weekCount(c.i('userId')));
      final weekGoal = active.fold<int>(0, (t, c) => t + (c.m('routine')?.i('frequency') ?? 0));

      // Necesitan atención: caídas de cumplimiento, check-ins, pagos, rutinas, mensajes…
      final todo = <(String, IconData, J?, String, String, VoidCallback)>[];
      const icons = {
        'drop': Icons.trending_down_rounded, 'inactive': Icons.hourglass_bottom_rounded, 'checkin': Icons.assignment_turned_in_rounded,
        'routine': Icons.fitness_center_rounded, 'phase': Icons.flag_rounded, 'receipt': Icons.receipt_long_rounded,
        'payment': Icons.account_balance_wallet_rounded, 'message': Icons.chat_bubble_rounded,
      };
      for (final a in needsAttention(clients: clients, workouts: store.workoutsAll, payments: pays, messages: store.messages, coachId: id)) {
        final VoidCallback run = switch (a.kind) {
          'checkin' => () => openClient(context, a.clientId, tab: 'checkins'),
          'routine' => () => openClient(context, a.clientId, tab: 'rutina'),
          'phase' => () => openClient(context, a.clientId, tab: 'programa'),
          'receipt' || 'payment' => () => goTab(context, 'pagos'),
          _ => () => openChat(context, a.clientId),
        };
        todo.add((a.level >= 3 ? 'bad' : a.level == 2 ? 'warn' : 'info', icons[a.kind] ?? Icons.info_rounded, store.userById(a.clientId), a.text, a.action, run));
      }
      for (final c in active) {
        final ti = trialInfo(c);
        if (ti == null) continue;
        if (!ti.running) {
          todo.add(('bad', Icons.schedule_rounded, c.m('user'), 'Terminó su prueba y falta decidir el plan completo', 'Decidir', () => openClient(context, c.i('userId'))));
        } else if (c['planRoutine'] == null && ti.daysLeft <= 5) {
          todo.add(('warn', Icons.schedule_rounded, c.m('user'), 'Su prueba termina en ${plural(ti.daysLeft, 'día', 'días')}: prepara el plan completo', 'Preparar',
              () => openClient(context, c.i('userId'), tab: 'rutina', slot: 'plan')));
        }
      }
      for (final r in store.reviews.where((r) => r.s('status') == 'pending')) {
        final c = clients.where((x) => x.i('userId') == r.i('clientId')).firstOrNull;
        final txt = r.s('text');
        todo.add(('info', Icons.star_rounded, c?.m('user'), 'Te dejó una reseña de ${plural(r.i('rating'), 'estrella', 'estrellas')}: “${txt.length > 60 ? '${txt.substring(0, 60)}…' : txt}”', 'Revisar',
            () => push(context, const PageEditorPage())));
      }

      return TabPage(children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(longDay(now), style: context.tt.labelMedium),
              const Gap(2),
              Text('Hola, ${firstName(me.s('name'))}', style: context.tt.displaySmall),
            ]),
          ),
          FilledButton.icon(onPressed: () => newClientSheet(context), icon: const Icon(Icons.person_add_alt_1_rounded, size: 19), label: const Text('Nuevo')),
        ]),
        const NotifyPrompt(),
        if (lic != null && AppStore.licenseStatus(lic) == 'expiring')
          NoteBox(
            icon: Icons.workspace_premium_rounded,
            tone: 'warn',
            action: TextButton(onPressed: () => push(context, const SubscriptionPage()), child: const Text('Renovar')),
            child: Text('Tu licencia vence en ${plural(daysUntil(lic.d('expiresAt')!), 'día', 'días')} (${shortDate(lic.d('expiresAt'))}). Renuévala para que tus asesorados no pierdan el seguimiento.'),
          ),
        Grid2(children: [
          StatTile(label: 'Asesorados activos', value: '${active.length}', sub: '${clients.length - active.length} en pausa', icon: Icons.groups_rounded, onTap: () => goTab(context, 'clientes')),
          StatTile(label: 'Entrenamientos esta semana', value: '$weekDone/$weekGoal', sub: 'registrados / planificados', icon: Icons.fitness_center_rounded),
          StatTile(label: 'Cobrado en ${monthName()}', value: money(collected), tone: 'ok', icon: Icons.check_circle_rounded, onTap: () => goTab(context, 'pagos')),
          StatTile(
            label: 'Por cobrar',
            value: money(pending.fold<double>(0, (t, p) => t + p.n('amount'))),
            tone: overdue.isNotEmpty ? 'bad' : 'warn',
            sub: overdue.isNotEmpty ? plural(overdue.length, 'pago vencido', 'pagos vencidos') : 'nada vencido',
            icon: Icons.schedule_rounded,
            onTap: () => goTab(context, 'pagos'),
          ),
        ]),
        Section(
          title: 'Necesitan atención',
          trailing: todo.isNotEmpty ? Pill('${todo.length}', tone: 'bad') : null,
          child: todo.isEmpty
              ? Row(children: [Icon(Icons.celebration_rounded, color: t.ok), const SizedBox(width: 10), Text('Todo al día. Buen trabajo.', style: context.tt.bodyMedium)])
              : Column(children: [
                  for (final (i, (tone, icon, who, text, action, run)) in todo.take(12).indexed) ...[
                    if (i > 0) const Divider(height: 1),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(children: [
                        IconBadge(icon, tone: tone, size: 38),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(who?.s('name') ?? '', style: context.tt.titleSmall),
                            Text(text, style: context.tt.bodySmall, maxLines: 3, overflow: TextOverflow.ellipsis),
                          ]),
                        ),
                        TextButton(onPressed: run, child: Text(action)),
                      ]),
                    ),
                  ],
                ]),
        ),
        if (active.isNotEmpty)
          Section(
            title: 'Cumplimiento semanal',
            subtitle: 'A 30 días: ${() { final v = active.map((c) => compliance(c, store.workoutsAll, 30)).whereType<int>().toList(); return v.isEmpty ? '—' : '${(v.reduce((a, b) => a + b) / v.length).round()}%'; }()} en promedio',
            child: Column(children: [
              for (final c in active)
                InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => openClient(context, c.i('userId')),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(children: [
                      Avatar.of(c.m('user'), size: 34),
                      const SizedBox(width: 10),
                      Expanded(child: Text(c.m('user')!.s('name'), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall)),
                      if (compliance(c, store.workoutsAll, 7) != null) ...[
                        Text('${compliance(c, store.workoutsAll, 7)}%', style: context.tt.labelMedium?.copyWith(color: toneColor(context, compliance(c, store.workoutsAll, 7)), fontWeight: FontWeight.w800)),
                        const SizedBox(width: 10),
                      ],
                      if ((c.m('routine')?.i('frequency') ?? 0) > 0) ...[
                        Dots(done: store.weekCount(c.i('userId')), goal: c.m('routine')!.i('frequency')),
                        SizedBox(width: 34, child: Text('${store.weekCount(c.i('userId'))}/${c.m('routine')!.i('frequency')}', textAlign: TextAlign.right, style: context.tt.bodySmall)),
                      ] else
                        Text('sin rutina', style: context.tt.bodySmall),
                    ]),
                  ),
                ),
            ]),
          ),
        Section(
          title: 'Últimos entrenamientos',
          subtitle: 'Toca uno para ver cada serie',
          child: SessionList(sessions: store.workoutsForCoach(id), showClient: true, limit: 6, onReply: (cid) => openChat(context, cid)),
        ),
      ]);
    });
  }
}

void openClient(BuildContext context, int id, {String? tab, String? slot}) => push(context, ClientDetail(clientId: id, tab: tab, slot: slot));
