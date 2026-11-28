// Pagos del asesorado: mensualidades pagadas, pendientes y vencidas.
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shell.dart';
import '../shared/tracking.dart';
import 'package:url_launcher/url_launcher.dart';

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
              child: Text('Tienes ${overdue.length == 1 ? 'un pago vencido' : '${overdue.length} pagos vencidos'} por ${money(overdue.fold<double>(0, (t, p) => t + p.n('amount')))}. ${coach.m('billing')?.s('payLink').isNotEmpty ?? false ? 'Toca «Pagar» para pagarlo en línea.' : 'Coordina con tu entrenador.'}'),
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
                            if (p['st'] != 'paid' && p['clientPaidAt'] != null) const Pill('Por confirmar', tone: 'info', small: true) else Pill(payLabel[p['st']]!, tone: payTone[p['st']]!, small: true),
                          ]),
                          if (p['st'] != 'paid') ...[
                            const SizedBox(width: 10),
                            FilledButton(
                              style: FilledButton.styleFrom(minimumSize: const Size(0, 38), padding: const EdgeInsets.symmetric(horizontal: 14)),
                              onPressed: () => _paySheet(context, p, coach),
                              child: Text(p['clientPaidAt'] != null ? 'Ver' : 'Pagar'),
                            ),
                          ],
                        ]),
                      ),
                    ],
                  ]),
          ),
          if (coach.m('billing')?.lm('plans').isNotEmpty ?? false)
            Section(
              title: 'Planes de ${firstName(coach.s('name'))}',
              child: Wrap(spacing: 10, runSpacing: 10, children: [
                for (final pl in coach.m('billing')!.lm('plans'))
                  Container(
                    width: 150,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(18), border: Border.all(color: t.line)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(pl.s('name'), style: context.tt.titleSmall),
                      const Gap(4),
                      Text(money(pl.n('price')), style: context.tt.headlineSmall?.copyWith(color: t.accent)),
                      Text(pl.s('period') == 'única' ? 'pago único' : 'por ${pl.s('period')}', style: context.tt.bodySmall),
                    ]),
                  ),
              ]),
            ),
          Text(coach.m('billing')?.s('payLink').isNotEmpty ?? false ? 'Paga en línea y avísale a tu entrenador con tu comprobante.' : 'Los pagos se coordinan directamente con tu entrenador.', textAlign: TextAlign.center, style: TextStyle(color: t.muted, fontSize: 12.5)),
        ]);
      }),
    );
  }

  void _paySheet(BuildContext context, J p, J coach) {
    final bill = coach.m('billing') ?? {};
    final first = firstName(coach.s('name'));
    String? src;
    var busy = false;
    showSheet(context,
        title: 'Pagar ${money(p.n('amount'))}',
        builder: (ctx) => StatefulBuilder(
              builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(p.s('concept'), style: ctx.tt.bodyLarge),
                const Gap(12),
                if (p['clientPaidAt'] != null) ...[NoteBox.text('Ya avisaste que pagaste. $first lo confirmará.', icon: Icons.schedule_rounded), const Gap(12)],
                if (bill.s('payLink').isNotEmpty)
                  FilledButton.icon(
                    onPressed: () => launchUrl(Uri.parse(bill.s('payLink')), mode: LaunchMode.externalApplication),
                    icon: const Icon(Icons.account_balance_wallet_rounded),
                    label: Text('Pagar en línea${bill.s('payLabel').isNotEmpty ? ' con ${bill.s('payLabel')}' : ''}'),
                    style: FilledButton.styleFrom(minimumSize: const Size(48, 54)),
                  )
                else
                  Text('$first aún no tiene pago en línea. Paga por transferencia o en efectivo y avísale aquí.', style: ctx.tt.bodyMedium),
                if (bill.s('instructions').isNotEmpty) ...[const Gap(12), NoteBox.text(bill.s('instructions'), icon: Icons.notes_rounded, tone: 'neutral')],
                const Gap(16),
                Labeled(
                  'Comprobante (opcional)',
                  src != null
                      ? ClipRRect(borderRadius: BorderRadius.circular(14), child: SizedBox(height: 240, child: SmartImage(src, fit: BoxFit.contain)))
                      : OutlinedButton.icon(
                          onPressed: () async {
                            final img = await pickImages(ctx);
                            if (img.isNotEmpty) set(() => src = img.first);
                          },
                          icon: const Icon(Icons.upload_file_rounded),
                          label: const Text('Subir foto del comprobante'),
                        ),
                ),
              ]),
            ),
        footer: (ctx) => StatefulBuilder(
              builder: (ctx, set) => FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        set(() => busy = true);
                        final ok = await runAct(ctx, store.sendReceipt(p.s('id'), src, bill.s('payLabel').isNotEmpty ? bill.s('payLabel') : (src != null ? 'Transferencia' : '')), 'Le avisamos a $first. Lo confirmará en breve');
                        if (ctx.mounted) {
                          set(() => busy = false);
                          if (ok) Navigator.pop(ctx);
                        }
                      },
                child: Text(busy ? 'Enviando…' : p['clientPaidAt'] != null ? 'Volver a avisar' : 'Ya pagué: avisar'),
              ),
            ));
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
