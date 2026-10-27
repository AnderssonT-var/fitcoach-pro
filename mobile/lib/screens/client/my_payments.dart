// Pagos del asesorado: mensualidades pagadas, pendientes y vencidas.
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shell.dart';

const payLabel = {'paid': 'Pagado', 'pending': 'Pendiente', 'overdue': 'Vencido'};
const payTone = {'paid': 'ok', 'pending': 'warn', 'overdue': 'bad'};

class MyPayments extends StatelessWidget {
  const MyPayments({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tus pagos')),
      body: Watch(builder: (context) {
        final t = context.tok;
        final me = store.meId!;
        final c = store.myClient ?? {};
        final coach = store.myCoach ?? {};
        final pays = store.payments.where((p) => p.i('clientId') == me).map((p) => {...p, 'st': AppStore.paymentStatus(p)}).toList()
          ..sort((a, b) => b.s('dueDate').compareTo(a.s('dueDate')));
        final overdue = pays.where((p) => p['st'] == 'overdue').toList();
        final pending = pays.where((p) => p['st'] == 'pending').toList()..sort((a, b) => a.s('dueDate').compareTo(b.s('dueDate')));
        return PageList(onRefresh: store.reload, children: [
          Text('Mensualidad de ${money(c.n('fee'))} con ${coach.s('name')}, el día ${c.i('billingDay', 1)} de cada mes.', style: context.tt.bodyMedium),
          if (overdue.isNotEmpty)
            NoteBox(
              icon: Icons.error_outline_rounded,
              tone: 'bad',
              action: TextButton(onPressed: () {
                Navigator.pop(context);
                goTab(context, 'mensajes');
              }, child: const Text('Escribirle')),
              child: Text('Tienes ${overdue.length == 1 ? 'un pago vencido' : '${overdue.length} pagos vencidos'} por ${money(overdue.fold<double>(0, (t, p) => t + p.n('amount')))}. Coordina con tu entrenador.'),
            )
          else if (pending.isNotEmpty)
            NoteBox.text('Tu próximo pago de ${money(pending.first.n('amount'))} vence el ${shortDate(pending.first.d('dueDate'))}.', icon: Icons.schedule_rounded, tone: 'warn')
          else
            NoteBox.text('Estás al día. ¡Gracias!', icon: Icons.check_circle_rounded, tone: 'ok'),
          Panel(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: pays.isEmpty
                ? const EmptyState(icon: Icons.account_balance_wallet_rounded, title: 'Sin pagos registrados')
                : Column(children: [
                    for (final (i, p) in pays.indexed) ...[
                      if (i > 0) const Divider(height: 1),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(p.s('concept'), style: context.tt.titleSmall),
                              Text(_payText(p), style: context.tt.bodySmall),
                            ]),
                          ),
                          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                            Text(money(p.n('amount')), style: context.tt.titleLarge),
                            const Gap(4),
                            Pill(payLabel[p['st']]!, tone: payTone[p['st']]!, small: true),
                          ]),
                        ]),
                      ),
                    ],
                  ]),
          ),
          Text('Los pagos se coordinan directamente con tu entrenador.', textAlign: TextAlign.center, style: TextStyle(color: t.muted, fontSize: 12.5)),
        ]);
      }),
    );
  }

  String _payText(J p) {
    final d = p.d('dueDate');
    if (p['st'] == 'paid') return 'Pagado el ${shortDate(p.d('paidAt'))}${p.s('method').isNotEmpty ? ' · ${p.s('method')}' : ''}';
    if (p['st'] == 'overdue') {
      final n = d == null ? 0 : -daysUntil(d);
      return 'Venció hace $n ${n == 1 ? 'día' : 'días'}';
    }
    return 'Vence el ${shortDate(d)}';
  }
}
