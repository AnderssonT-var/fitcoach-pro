// Asesorados del entrenador: búsqueda, filtros y alta (con plan de prueba opcional).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app.dart';
import '../../core/catalog.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../core/techniques.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shell.dart';
import 'coach_home.dart';

class ClientsPage extends StatefulWidget {
  const ClientsPage({super.key});
  @override
  State<ClientsPage> createState() => _ClientsPageState();
}

class _ClientsPageState extends State<ClientsPage> {
  String q = '', filter = 'all';

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final id = store.meId!;
      final rows = store.clientsOf(id).map((c) {
        final last = store.workoutsOf(c.i('userId')).firstOrNull;
        final pays = store.payments.where((p) => p.i('clientId') == c.i('userId'));
        final pay = pays.any((p) => AppStore.paymentStatus(p) == 'overdue') ? 'overdue' : pays.any((p) => AppStore.paymentStatus(p) == 'pending') ? 'pending' : 'paid';
        final idle = c.m('routine') != null && (last == null || daysSince(last.d('finishedAt')!) >= 7);
        return {...c, 'last': last, 'pay': pay, 'idle': idle, 'week': store.weekCount(c.i('userId'))};
      }).toList();
      final f = <String, bool Function(J)>{
        'all': (_) => true,
        'active': (r) => r.b('active'),
        'trial': (r) => r.b('active') && trialInfo(r) != null,
        'noroutine': (r) => r.b('active') && r['routine'] == null,
        'overdue': (r) => r['pay'] == 'overdue',
        'idle': (r) => r.b('active') && r.b('idle'),
        'paused': (r) => !r.b('active'),
      };
      const labels = [('all', 'Todos'), ('active', 'Activos'), ('trial', 'En prueba'), ('noroutine', 'Sin rutina'), ('overdue', 'Pago vencido'), ('idle', 'Inactivos'), ('paused', 'En pausa')];
      final nq = normalize(q);
      final shown = rows.where(f[filter]!).where((r) => nq.isEmpty || normalize('${r.m('user')!.s('name')} ${r.m('user')!.s('email')} ${r.s('goal')}').contains(nq)).toList()
        ..sort((a, b) => normalize(a.m('user')!.s('name')).compareTo(normalize(b.m('user')!.s('name'))));

      return TabPage(children: [
        PageHead('Asesorados', subtitle: '${rows.where((r) => r.b('active')).length} activos · cada uno con su rutina, historial y pagos.',
            trailing: IconButton.filled(onPressed: () => newClientSheet(context), icon: const Icon(Icons.person_add_alt_1_rounded), tooltip: 'Nuevo asesorado')),
        TextField(decoration: const InputDecoration(hintText: 'Buscar por nombre, correo u objetivo', prefixIcon: Icon(Icons.search_rounded)), onChanged: (v) => setState(() => q = v)),
        ChoiceRow<String>(scroll: true, options: [for (final (k, l) in labels) (k, '$l  ${rows.where(f[k]!).length}')], value: filter, onChanged: (v) => setState(() => filter = v)),
        if (shown.isEmpty)
          Panel(
            child: EmptyState(
              icon: Icons.groups_rounded,
              title: rows.isEmpty ? 'Agrega tu primer asesorado' : 'Nadie coincide con el filtro',
              text: rows.isEmpty ? 'Le crearemos un acceso para que vea su rutina y registre sus entrenamientos. También puedes abrir la inscripción con tu enlace.' : 'Prueba con otro filtro o búsqueda.',
              action: rows.isEmpty ? FilledButton(onPressed: () => newClientSheet(context), child: const Text('Nuevo asesorado')) : null,
            ),
          )
        else
          for (final r in shown)
            Opacity(
              opacity: r.b('active') ? 1 : .6,
              child: Panel(
                onTap: () => openClient(context, r.i('userId')),
                padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
                radius: 20,
                child: Row(children: [
                  Avatar.of(r.m('user'), size: 48),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(r.m('user')!.s('name'), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleMedium),
                      const Gap(2),
                      Text(
                        '${r.s('goal')} · ${r.m('routine') != null ? r.m('routine')!.s('name') : 'sin rutina'} · ${r.m('last') != null ? 'entrenó ${ago(r.m('last')!.d('finishedAt'))}' : 'sin registros'}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: context.tt.bodySmall,
                      ),
                      const Gap(6),
                      Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                        if (r.b('active')) ...[
                          if (trialInfo(r) case final ti?) Pill(ti.running ? 'Prueba · ${ti.daysLeft} d' : 'Prueba terminada', tone: ti.running ? 'info' : 'warn', icon: Icons.schedule_rounded, small: true),
                          if (r['pay'] == 'overdue') const Pill('Vencido', tone: 'bad', small: true) else if (r['pay'] == 'pending') const Pill('Pendiente', tone: 'warn', small: true) else const Pill('Al día', tone: 'ok', small: true),
                          if (r.m('routine') != null) Dots(done: r.i('week'), goal: r.m('routine')!.i('frequency')) else const Pill('Sin rutina', tone: 'warn', small: true),
                        ] else
                          const Pill('En pausa', small: true),
                      ]),
                    ]),
                  ),
                  Icon(Icons.chevron_right_rounded, color: t.muted),
                ]),
              ),
            ),
      ]);
    });
  }
}

/* ------------------------------------------------------------ Nuevo asesorado */
Future<void> newClientSheet(BuildContext context) async {
  final name = TextEditingController(), email = TextEditingController(), phone = TextEditingController(), weight = TextEditingController(), height = TextEditingController();
  final fee = TextEditingController(text: '50');
  final trialFee = TextEditingController(text: '0');
  var goal = 'Hipertrofia';
  var trial = false;
  var trialDays = 30;
  String? error;
  var busy = false;
  final created = await showSheet<J>(
    context,
    title: 'Nuevo asesorado',
    full: true,
    builder: (ctx) => StatefulBuilder(builder: (ctx, setS) {
      Future<void> save() async {
        if (name.text.trim().isEmpty) return setS(() => error = 'Escribe el nombre del asesorado.');
        if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(email.text.trim())) return setS(() => error = 'Escribe un correo válido: lo usará para entrar.');
        setS(() => busy = true);
        final r = await store.addClient({
          'name': name.text.trim(), 'email': email.text.trim(), 'goal': goal, 'phone': phone.text.trim(),
          'height': double.tryParse(height.text.replaceAll(',', '.')), 'weight': double.tryParse(weight.text.replaceAll(',', '.')),
          'fee': double.tryParse(fee.text.replaceAll(',', '.')) ?? 0,
          if (trial) 'trial': {'days': trialDays, 'fee': double.tryParse(trialFee.text.replaceAll(',', '.')) ?? 0},
        });
        setS(() => busy = false);
        if (!r.ok) return setS(() => error = r.error);
        if (ctx.mounted) Navigator.pop(ctx, {...r.json, '_trial': trial, '_fee': double.tryParse(fee.text) ?? 0, '_trialDays': trialDays, '_trialFee': double.tryParse(trialFee.text) ?? 0});
      }

      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Field('Nombre completo', controller: name, caps: TextCapitalization.words),
        const Gap(12),
        Field('Correo', controller: email, keyboard: TextInputType.emailAddress),
        const Gap(12),
        Field('Teléfono', controller: phone, keyboard: TextInputType.phone),
        const Gap(12),
        Labeled('Objetivo', ChoiceRow<String>(options: [for (final g in goals) (g, g)], value: goal, onChanged: (v) => setS(() => goal = v))),
        const Gap(12),
        Row(children: [
          Expanded(child: Field('Peso (kg)', controller: weight, keyboard: const TextInputType.numberWithOptions(decimal: true))),
          const SizedBox(width: 10),
          Expanded(child: Field('Estatura (cm)', controller: height, keyboard: TextInputType.number)),
        ]),
        const Gap(12),
        Field(trial ? 'Mensualidad del plan completo' : 'Mensualidad', controller: fee, keyboard: const TextInputType.numberWithOptions(decimal: true)),
        const Gap(14),
        Container(
          padding: const EdgeInsets.fromLTRB(14, 6, 14, 12),
          decoration: BoxDecoration(color: trial ? ctx.tok.accentSoft : ctx.tok.surface2, borderRadius: BorderRadius.circular(18)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SwitchRow(value: trial, onChanged: (v) => setS(() => trial = v), title: 'Empezar con plan de prueba', subtitle: 'Rutina y precio de prueba; al terminar pasa al plan completo.'),
            if (trial) ...[
              const Gap(8),
              Labeled('Duración de la prueba', ChoiceRow<int>(options: [for (final d in trialOptions) (d, d == 30 ? '1 mes' : '$d días')], value: trialDays, onChanged: (v) => setS(() => trialDays = v))),
              const Gap(10),
              Field('Precio de la prueba', controller: trialFee, keyboard: const TextInputType.numberWithOptions(decimal: true), helper: '0 si es gratis'),
            ],
          ]),
        ),
        if (error != null) Padding(padding: const EdgeInsets.only(top: 10), child: NoteBox.text(error!, icon: Icons.error_outline_rounded, tone: 'bad')),
        const Gap(16),
        FilledButton(onPressed: busy ? null : save, child: Text(busy ? 'Agregando…' : 'Agregar asesorado')),
      ]);
    }),
  );
  if (created == null || !context.mounted) return;
  final u = created.m('user') ?? {};
  final pass = created.s('password');
  final hasTrial = created.b('_trial');
  await showSheet(
    context,
    title: 'Asesorado agregado',
    builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('Comparte estos datos con ${firstName(u.s('name'))} por un medio privado (la contraseña solo se muestra ahora). Al entrar deberá aceptar el aviso de privacidad y crear su propia contraseña.',
          style: ctx.tt.bodyMedium),
      const Gap(14),
      _CopyRow(label: 'Correo', value: u.s('email')),
      const Gap(8),
      _CopyRow(label: 'Contraseña temporal', value: pass),
      const Gap(14),
      if (hasTrial)
        NoteBox.text(
          'Empieza con ${trialName(created.i('_trialDays')).toLowerCase()}${created.n('_trialFee') > 0 ? ' (cobro de ${money(created.n('_trialFee'))} registrado)' : ' gratis'}. Crea su rutina de prueba y deja listo el plan completo: se activa solo al terminar.',
          icon: Icons.schedule_rounded)
      else if (created.n('_fee') > 0)
        NoteBox.text('Se registró la primera mensualidad de ${money(created.n('_fee'))} como pendiente.', icon: Icons.account_balance_wallet_rounded),
    ]),
    footer: (ctx) => Row(children: [
      Expanded(
        child: OutlinedButton.icon(
          onPressed: () => Clipboard.setData(ClipboardData(text: 'Tu acceso a VYTRAFIT\nCorreo: ${u.s('email')}\nContraseña temporal: $pass')).then((_) {
            if (ctx.mounted) toast(ctx, 'Datos copiados');
          }),
          icon: const Icon(Icons.copy_rounded, size: 18),
          label: const Text('Copiar'),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: FilledButton(
          onPressed: () {
            Navigator.pop(ctx);
            openClient(context, u.i('id'), tab: 'rutina');
          },
          child: Text(hasTrial ? 'Crear rutina de prueba' : 'Crear su rutina'),
        ),
      ),
    ]),
  );
}

class _CopyRow extends StatelessWidget {
  final String label, value;
  const _CopyRow({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
        decoration: BoxDecoration(color: context.tok.surface2, borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: context.tt.bodySmall),
              SelectableText(value, style: context.tt.titleMedium),
            ]),
          ),
          IconButton(
            icon: const Icon(Icons.copy_rounded, size: 20),
            onPressed: () => Clipboard.setData(ClipboardData(text: value)).then((_) {
              if (context.mounted) toast(context, '$label copiado');
            }),
          ),
        ]),
      );
}

/// Exponer para otras pantallas (botón «+» del inicio).
void goClients(BuildContext context) => goTab(context, 'clientes');
