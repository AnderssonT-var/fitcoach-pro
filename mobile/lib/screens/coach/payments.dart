// Cobros del entrenador: mensualidades, pendientes, vencidos y registro de pagos.
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/catalog.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../client/my_payments.dart' show payLabel, payTone;
import '../shell.dart';

class CoachPayments extends StatefulWidget {
  const CoachPayments({super.key});
  @override
  State<CoachPayments> createState() => _CoachPaymentsState();
}

class _CoachPaymentsState extends State<CoachPayments> {
  String filter = 'open', q = '';

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final id = store.meId!;
      final pays = store.payments.where((p) => p.i('coachId') == id).map((p) => {...p, 'st': AppStore.paymentStatus(p), 'client': store.userById(p.i('clientId'))}).toList();
      final now = DateTime.now();
      bool inMonth(DateTime? d) => d != null && d.month == now.month && d.year == now.year;
      final collected = pays.where((p) => inMonth(p.d('paidAt'))).fold<double>(0, (t, p) => t + p.n('amount'));
      final pending = pays.where((p) => p['st'] == 'pending').toList();
      final overdue = pays.where((p) => p['st'] == 'overdue').toList();
      final expected = pays.where((p) => inMonth(p.d('dueDate'))).fold<double>(0, (t, p) => t + p.n('amount'));
      final f = <String, bool Function(J)>{
        'open': (p) => p['st'] != 'paid', 'overdue': (p) => p['st'] == 'overdue', 'pending': (p) => p['st'] == 'pending', 'paid': (p) => p['st'] == 'paid', 'all': (_) => true,
      };
      const lbl = [('open', 'Por cobrar'), ('overdue', 'Vencidos'), ('pending', 'Pendientes'), ('paid', 'Pagados'), ('all', 'Todos')];
      final nq = normalize(q);
      final shown = pays.where(f[filter]!).where((p) => nq.isEmpty || normalize('${p.m('client')?.s('name')} ${p.s('concept')}').contains(nq)).toList()
        ..sort((a, b) => filter == 'paid' ? b.s('paidAt').compareTo(a.s('paidAt')) : a.s('dueDate').compareTo(b.s('dueDate')));
      final month = monthName();

      return TabPage(children: [
        PageHead('Pagos', subtitle: 'Lo que pasa su fecha sin pagarse se marca como vencido.',
            trailing: IconButton.filled(onPressed: () => paymentSheet(context), icon: const Icon(Icons.add_rounded), tooltip: 'Registrar cobro')),
        Grid2(children: [
          StatTile(label: 'Cobrado en $month', value: money(collected), tone: 'ok', sub: expected > 0 ? '${(collected / expected * 100).round()}% de lo esperado' : null, icon: Icons.check_circle_rounded),
          StatTile(label: 'Pendiente', value: money(pending.fold<double>(0, (t, p) => t + p.n('amount'))), tone: 'warn', sub: '${plural(pending.length, 'cobro', 'cobros')} en fecha', icon: Icons.schedule_rounded),
          StatTile(label: 'Vencido', value: money(overdue.fold<double>(0, (t, p) => t + p.n('amount'))), tone: overdue.isNotEmpty ? 'bad' : '', sub: '${plural(overdue.length, 'cobro', 'cobros')} atrasados', icon: Icons.error_outline_rounded),
          StatTile(label: 'Esperado este mes', value: money(expected), icon: Icons.account_balance_wallet_rounded),
        ]),
        OutlinedButton.icon(
          onPressed: () async {
            final n = await store.generateMonthly();
            if (context.mounted) toast(context, n > 0 ? 'Se crearon $n ${n == 1 ? 'mensualidad' : 'mensualidades'} de $month' : 'Todos tus asesorados ya tienen la mensualidad de $month', icon: Icons.calendar_month_rounded);
          },
          icon: const Icon(Icons.calendar_month_rounded),
          label: Text('Generar mensualidades de $month'),
        ),
        TextField(decoration: const InputDecoration(hintText: 'Buscar asesorado o concepto', prefixIcon: Icon(Icons.search_rounded)), onChanged: (v) => setState(() => q = v)),
        ChoiceRow<String>(scroll: true, options: [for (final (k, l) in lbl) (k, '$l  ${pays.where(f[k]!).length}')], value: filter, onChanged: (v) => setState(() => filter = v)),
        Panel(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: shown.isEmpty
              ? EmptyState(icon: Icons.account_balance_wallet_rounded, title: filter == 'open' ? 'No hay nada por cobrar' : 'Sin cobros en este filtro', text: filter == 'open' ? 'Todos tus asesorados están al día.' : 'Cambia el filtro para ver otros cobros.')
              : Column(children: [
                  for (final (i, p) in shown.indexed) ...[if (i > 0) const Divider(height: 1), PayRow(p: p, showClient: true)],
                ]),
        ),
      ]);
    });
  }
}

class PayRow extends StatelessWidget {
  final J p;
  final bool showClient;
  const PayRow({super.key, required this.p, this.showClient = false});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final st = p.s('st', AppStore.paymentStatus(p));
    final due = p.d('dueDate');
    final d = due == null ? 0 : daysUntil(due);
    final client = p.m('client') ?? store.userById(p.i('clientId'));
    final sub = st == 'paid'
        ? 'Pagado el ${shortDate(p.d('paidAt'))}${p.s('method').isNotEmpty ? ' · ${p.s('method')}' : ''}'
        : st == 'overdue'
            ? 'Venció hace ${-d} ${-d == 1 ? 'día' : 'días'} (${shortDate(due)})'
            : d == 0
                ? 'Vence hoy'
                : 'Vence en $d ${d == 1 ? 'día' : 'días'} (${shortDate(due)})';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          if (showClient && client != null) ...[Avatar.of(client, size: 36), const SizedBox(width: 10)],
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${showClient && client != null ? '${firstName(client.s('name'))} · ' : ''}${p.s('concept')}', maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall),
              Text(sub, style: context.tt.bodySmall?.copyWith(color: st == 'overdue' ? t.bad : null)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(money(p.n('amount')), style: context.tt.titleLarge),
            Pill(payLabel[st]!, tone: payTone[st]!, small: true),
          ]),
        ]),
        const Gap(8),
        Row(children: [
          if (st != 'paid')
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: t.ok, foregroundColor: Colors.white, minimumSize: const Size(0, 38)),
              onPressed: () => _markPaid(context),
              icon: const Icon(Icons.check_rounded, size: 18),
              label: const Text('Marcar pagado'),
            )
          else
            TextButton(onPressed: () => runAct(context, store.markUnpaid(p.s('id')), 'Pago desmarcado', Icons.undo_rounded), child: const Text('Deshacer')),
          const Spacer(),
          IconButton(
            icon: Icon(Icons.delete_outline_rounded, color: t.muted),
            onPressed: () async {
              if (await confirm(context, title: 'Eliminar cobro', confirmLabel: 'Eliminar', text: 'Se elimina “${p.s('concept')}” por ${money(p.n('amount'))}${client != null ? ' de ${client.s('name')}' : ''}.') && context.mounted) {
                runAct(context, store.deletePayment(p.s('id')), 'Cobro eliminado', Icons.delete_rounded);
              }
            },
          ),
        ]),
      ]),
    );
  }

  void _markPaid(BuildContext context) {
    var method = 'Transferencia';
    showSheet(
      context,
      title: 'Registrar pago',
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('${store.userById(p.i('clientId'))?.s('name') ?? ''} · ${p.s('concept')}', style: ctx.tt.bodyMedium),
          const Gap(12),
          Labeled('Método de pago', ChoiceRow<String>(options: [for (final m in payMethods) (m, m)], value: method, onChanged: (v) => setS(() => method = v))),
        ]),
      ),
      footer: (ctx) => FilledButton(
        style: FilledButton.styleFrom(backgroundColor: ctx.tok.ok, foregroundColor: Colors.white),
        onPressed: () {
          Navigator.pop(ctx);
          runAct(context, store.markPaid(p.s('id'), method), '${money(p.n('amount'))} cobrados', Icons.account_balance_wallet_rounded);
        },
        child: Text('Confirmar ${money(p.n('amount'))}'),
      ),
    );
  }
}

/// Registrar un cobro (de un asesorado elegido o fijo).
void paymentSheet(BuildContext context, {int? clientId}) {
  final clients = store.clientsOf(store.meId!).where((c) => c.b('active')).toList();
  if (clients.isEmpty) return toast(context, 'Primero agrega un asesorado activo', error: true);
  var cid = clientId ?? clients.first.i('userId');
  J clientOf(int id) => clients.where((c) => c.i('userId') == id).firstOrNull ?? clients.first;
  final concept = TextEditingController(text: 'Mensualidad ${monthName()}');
  final amount = TextEditingController(text: _num(clientOf(cid).n('fee')));
  var due = DateTime.now();
  var paid = false;
  var method = 'Transferencia';
  showSheet(
    context,
    title: 'Registrar cobro',
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setS) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (clientId == null) ...[
          DropdownButtonFormField<int>(
            initialValue: cid,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Asesorado'),
            items: [for (final c in clients) DropdownMenuItem(value: c.i('userId'), child: Text(c.m('user')!.s('name')))],
            onChanged: (v) => setS(() {
              cid = v ?? cid;
              amount.text = _num(clientOf(cid).n('fee'));
            }),
          ),
          const Gap(12),
        ],
        Field('Concepto', controller: concept),
        const Gap(12),
        Field('Monto', controller: amount, keyboard: const TextInputType.numberWithOptions(decimal: true)),
        const Gap(12),
        OutlinedButton.icon(
          onPressed: () async {
            final d = await showDatePicker(context: ctx, initialDate: due, firstDate: DateTime(2020), lastDate: DateTime(2100));
            if (d != null) setS(() => due = d);
          },
          icon: const Icon(Icons.event_rounded),
          label: Text('Fecha límite: ${fullDate(due)}'),
        ),
        const Gap(8),
        SwitchRow(value: paid, onChanged: (v) => setS(() => paid = v), title: 'Ya lo pagó'),
        if (paid) Labeled('Método', ChoiceRow<String>(options: [for (final m in payMethods) (m, m)], value: method, onChanged: (v) => setS(() => method = v))),
      ]),
    ),
    footer: (ctx) => FilledButton(
      onPressed: () {
        final a = double.tryParse(amount.text.replaceAll(',', '.')) ?? 0;
        if (concept.text.trim().isEmpty || a <= 0) return toast(ctx, 'Escribe el concepto y un monto válido', error: true);
        Navigator.pop(ctx);
        runAct(context, store.addPayment({'clientId': cid, 'concept': concept.text.trim(), 'amount': a, 'dueDate': isoDay(due), 'paid': paid, 'method': paid ? method : ''}),
            paid ? 'Pago registrado' : 'Cobro pendiente registrado', Icons.account_balance_wallet_rounded);
      },
      child: const Text('Registrar'),
    ),
  );
}

String _num(double v) => v == 0 ? '' : (v % 1 == 0 ? v.toInt().toString() : v.toString());

class ClientPayments extends StatelessWidget {
  final int clientId;
  const ClientPayments({super.key, required this.clientId});
  @override
  Widget build(BuildContext context) {
    final c = store.clientById(clientId) ?? {};
    final pays = store.payments.where((p) => p.i('clientId') == clientId).toList()..sort((a, b) => b.s('dueDate').compareTo(a.s('dueDate')));
    final paid = pays.where((p) => p['paidAt'] != null).fold<double>(0, (t, p) => t + p.n('amount'));
    final open = pays.where((p) => p['paidAt'] == null).fold<double>(0, (t, p) => t + p.n('amount'));
    return Section(
      title: 'Pagos',
      subtitle: 'Mensualidad ${money(c.n('fee'))} · día ${c.i('billingDay', 1)} · pagado ${money(paid)} · por cobrar ${money(open)}',
      trailing: IconButton.filledTonal(onPressed: () => paymentSheet(context, clientId: clientId), icon: const Icon(Icons.add_rounded), tooltip: 'Registrar cobro'),
      child: pays.isEmpty
          ? Text('Sin cobros registrados.', style: context.tt.bodyMedium)
          : Column(children: [for (final (i, p) in pays.indexed) ...[if (i > 0) const Divider(height: 1), PayRow(p: p)]]),
    );
  }
}

void goPayments(BuildContext context) => goTab(context, 'pagos');
