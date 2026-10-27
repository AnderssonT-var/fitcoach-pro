// Ficha de un asesorado: resumen, rutina (y plan de prueba), entrenamientos,
// medidas, fotos, notas privadas, pagos y datos de acceso.
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
import '../shared/messages.dart';
import '../shared/progress_widgets.dart';
import '../shared/tracking.dart';
import 'payments.dart';
import 'routine_editor.dart';

const _tabs = [('resumen', 'Resumen'), ('rutina', 'Rutina'), ('historial', 'Entrenamientos'), ('medidas', 'Medidas'), ('fotos', 'Fotos'), ('notas', 'Notas'), ('pagos', 'Pagos'), ('datos', 'Datos')];

class ClientDetail extends StatefulWidget {
  final int clientId;
  final String? tab, slot;
  const ClientDetail({super.key, required this.clientId, this.tab, this.slot});
  @override
  State<ClientDetail> createState() => _ClientDetailState();
}

class _ClientDetailState extends State<ClientDetail> with SingleTickerProviderStateMixin {
  late final TabController tc = TabController(length: _tabs.length, vsync: this, initialIndex: _tabs.indexWhere((t) => t.$1 == (widget.tab ?? 'resumen')).clamp(0, _tabs.length - 1));
  late String slot = widget.slot ?? 'current';

  void openTab(String t, [String? s]) {
    final i = _tabs.indexWhere((x) => x.$1 == t);
    if (i >= 0) tc.animateTo(i);
    if (s != null) setState(() => slot = s);
  }

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final c = store.clientById(widget.clientId);
      final u = store.userById(widget.clientId);
      if (c == null || u == null) return Scaffold(appBar: AppBar(), body: const Center(child: Text('Asesorado no encontrado.')));
      final overdue = store.payments.where((p) => p.i('clientId') == widget.clientId && AppStore.paymentStatus(p) == 'overdue').length;
      final ti = trialInfo(c);
      return Scaffold(
        body: NestedScrollView(
          headerSliverBuilder: (ctx, inner) => [
            SliverAppBar(
              pinned: true,
              expandedHeight: 168,
              actions: [IconButton(onPressed: () => openChat(context, widget.clientId), icon: const Icon(Icons.chat_bubble_outline_rounded), tooltip: 'Enviar mensaje')],
              flexibleSpace: FlexibleSpaceBar(
                collapseMode: CollapseMode.pin,
                background: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 54, 18, 52),
                    child: Row(children: [
                      Avatar.of(u, size: 62),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(u.s('name'), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.headlineMedium),
                          const Gap(4),
                          Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                            Text('${c.s('goal')} · desde ${shortDate(c.d('joinedAt'))}', style: context.tt.bodySmall),
                            if (!c.b('active')) const Pill('En pausa', small: true),
                            if (ti != null) Pill(ti.label, tone: ti.running ? 'info' : 'warn', icon: Icons.schedule_rounded, small: true),
                            if (overdue > 0) const Pill('Pago vencido', tone: 'bad', small: true),
                          ]),
                        ]),
                      ),
                    ]),
                  ),
                ),
              ),
              bottom: TabBar(
                controller: tc,
                isScrollable: true,
                tabs: [for (final (k, l) in _tabs) Tab(child: Row(children: [Text(l), if (k == 'pagos' && overdue > 0) ...[const SizedBox(width: 6), CountBadge(overdue)]]))],
              ),
              backgroundColor: t.bg,
            ),
          ],
          body: TabBarView(controller: tc, children: [
            _Summary(clientId: widget.clientId, onTab: openTab),
            _Pad(child: TrialRoutines(clientId: widget.clientId, slot: slot, onSlot: (s) => setState(() => slot = s))),
            PageList(children: [Section(title: 'Entrenamientos', subtitle: 'Toca una sesión para ver cada serie', child: SessionList(sessions: store.workoutsOf(widget.clientId)))]),
            PageList(children: [Measurements(clientId: widget.clientId, canEdit: true)]),
            PageList(children: [Photos(clientId: widget.clientId, canUpload: true, canDelete: true)]),
            PageList(children: [Notes(clientId: widget.clientId)]),
            PageList(children: [ClientPayments(clientId: widget.clientId)]),
            _ClientData(key: ValueKey('data-${widget.clientId}'), clientId: widget.clientId),
          ]),
        ),
      );
    });
  }
}

class _Pad extends StatelessWidget {
  final Widget child;
  const _Pad({required this.child});
  @override
  Widget build(BuildContext context) => child;
}

/* ------------------------------------------------------------ Resumen */
class _Summary extends StatelessWidget {
  final int clientId;
  final void Function(String tab, [String? slot]) onTab;
  const _Summary({required this.clientId, required this.onTab});
  @override
  Widget build(BuildContext context) {
    final c = store.clientById(clientId) ?? {};
    final u = store.userById(clientId) ?? {};
    final s = QuickStats.of(clientId);
    final streak = store.weekStreak(clientId, s.goal);
    final ws = store.workoutsOf(clientId);
    final lastComment = ws.where((w) => w.s('comment').isNotEmpty).firstOrNull;
    final weights = c.lm('weights');
    final w = weights.isEmpty ? null : weights.last;
    return PageList(children: [
      TrialPanel(clientId: clientId, onTab: onTab),
      Grid2(children: [
        StatTile(label: 'Esta semana', value: s.goal > 0 ? '${s.week}/${s.goal}' : '${s.week}', sub: 'entrenamientos', tone: s.goal > 0 && s.week >= s.goal ? 'ok' : '', icon: Icons.calendar_today_rounded),
        StatTile(label: 'Semanas cumpliendo', value: '$streak', sub: 'seguidas', icon: Icons.local_fire_department_rounded, tone: streak > 0 ? 'warn' : ''),
        StatTile(label: 'Volumen del mes', value: tons(s.monthVolume), sub: '${s.month} sesiones · ${s.avgMin} min', icon: Icons.fitness_center_rounded),
        StatTile(label: 'Peso actual', value: w != null ? '${kg(w.n('kg'))} kg' : '—', sub: w != null ? 'registrado ${ago(w.d('date'))}' : 'sin registro', icon: Icons.monitor_weight_outlined,
            onTap: () => showWeightSheet(context, clientId)),
      ]),
      if (c['routine'] == null)
        NoteBox(icon: Icons.warning_amber_rounded, tone: 'warn', action: TextButton(onPressed: () => onTab('rutina'), child: const Text('Crear')), child: const Text('Este asesorado aún no tiene rutina.')),
      if (u.s('injuries').isNotEmpty)
        NoteBox(icon: Icons.healing_rounded, tone: 'bad', child: Text.rich(TextSpan(children: [const TextSpan(text: 'Lesiones reportadas: ', style: TextStyle(fontWeight: FontWeight.w700)), TextSpan(text: u.s('injuries'))]))),
      for (final n in c.lm('notes').where((n) => n.b('pinned')))
        NoteBox(icon: Icons.push_pin_rounded, tone: 'warn', action: TextButton(onPressed: () => onTab('notas'), child: const Text('Ver')),
            child: Text.rich(TextSpan(children: [TextSpan(text: '${n.s('category')}: ', style: const TextStyle(fontWeight: FontWeight.w700)), TextSpan(text: n.s('text'))]))),
      if (lastComment != null)
        NoteBox(icon: Icons.chat_bubble_outline_rounded, child: Text('Último comentario (${lastComment.s('dayName')}, ${ago(lastComment.d('finishedAt'))}): “${lastComment.s('comment')}”')),
      AdherenceChart(clientId),
      WeightChart(clientId, action: TextButton(onPressed: () => showWeightSheet(context, clientId), child: const Text('Registrar'))),
      MuscleLoadPanel(clientId),
      VolumeChart(clientId),
      Records(clientId),
    ]);
  }
}

/* ------------------------------------------------------------ Plan de prueba */
String _fmt(DateTime d) => shortDate(d);

class TrialPanel extends StatelessWidget {
  final int clientId;
  final void Function(String tab, [String? slot]) onTab;
  const TrialPanel({super.key, required this.clientId, required this.onTab});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final c = store.clientById(clientId) ?? {};
    final ti = trialInfo(c);
    if (ti == null) return const SizedBox.shrink();
    final first = firstName(store.userById(clientId)?.s('name') ?? '');
    final plan = c.m('planRoutine');
    final routine = c.m('routine');
    Widget step(bool ok, IconData icon, String title, String sub, String btn, VoidCallback onTap, {bool primary = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(children: [
            Container(
              width: 34, height: 34,
              decoration: BoxDecoration(color: ok ? t.ok : t.surface3, shape: BoxShape.circle),
              child: Icon(ok ? Icons.check_rounded : icon, size: 18, color: ok ? Colors.white : t.ink2),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: context.tt.titleSmall), Text(sub, style: context.tt.bodySmall)])),
            primary ? FilledButton(onPressed: onTap, child: Text(btn)) : OutlinedButton(onPressed: onTap, child: Text(btn)),
          ]),
        );
    return Panel(
      border: ti.running ? t.accent.withValues(alpha: .4) : t.warn.withValues(alpha: .5),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Icon(Icons.schedule_rounded, color: ti.running ? t.accent : t.warn),
          const SizedBox(width: 8),
          Expanded(child: Text(trialName(ti.days), style: context.tt.titleLarge)),
          Text(ti.running ? plural(ti.daysLeft, 'día', 'días') : 'Terminada', style: context.tt.titleSmall),
        ]),
        const Gap(4),
        Text('${_fmt(ti.start)} → ${_fmt(ti.end)} · ${ti.fee > 0 ? 'cobro de prueba ${money(ti.fee)}' : 'gratis'} · después ${money(c.n('fee'))} al mes', style: context.tt.bodySmall),
        const Gap(12),
        Bar(ti.pct / 100, color: ti.running ? null : t.warn),
        const Gap(8),
        step(routine != null, Icons.fitness_center_rounded, 'Rutina de prueba', routine != null ? '${routine.s('name')} · $first la ve ahora' : 'Aún no la creas', routine != null ? 'Editar' : 'Crear',
            () => onTab('rutina', 'current')),
        step(plan != null, Icons.trending_up_rounded, 'Plan completo', plan != null ? '${plan.s('name')} · se activa solo el ${_fmt(ti.end)}' : 'Prepáralo para que se active solo al terminar la prueba',
            plan != null ? 'Editar' : 'Preparar', () => onTab('rutina', 'plan'), primary: plan == null),
        if (!ti.running && plan == null)
          Padding(padding: const EdgeInsets.only(top: 6), child: NoteBox.text('La prueba terminó y aún no hay plan completo. $first sigue con la rutina de prueba hasta que decidas.', icon: Icons.warning_amber_rounded, tone: 'warn')),
        const Gap(10),
        Wrap(spacing: 8, runSpacing: 8, children: [
          FilledButton.icon(
            onPressed: plan == null && routine == null
                ? null
                : () async {
                    if (await confirm(context, title: 'Pasar al plan completo', danger: false, confirmLabel: 'Activar plan completo',
                            text: '${plan != null ? '$first empezará a ver «${plan.s('name')}».' : '$first seguirá con su rutina actual como plan completo.'} Se quita la etiqueta de prueba${c.n('fee') > 0 ? ' y se registra su primera mensualidad de ${money(c.n('fee'))}' : ''}. Le llegará un mensaje.') &&
                        context.mounted) {
                      runAct(context, store.convertTrial(clientId), '$first ya está en el plan completo');
                    }
                  },
            icon: const Icon(Icons.check_rounded, size: 18),
            label: Text('Pasar al plan completo${ti.running ? ' ahora' : ''}'),
          ),
          OutlinedButton.icon(onPressed: () => _extend(context), icon: const Icon(Icons.add_rounded, size: 18), label: const Text('Extender')),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: t.bad),
            onPressed: () async {
              if (await confirm(context, title: 'Terminar la prueba', confirmLabel: 'Terminar y pausar',
                      text: '$first no continúa: se cierra la prueba y queda en pausa (sin acceso ni mensualidades). Su historial se conserva y puedes reactivarlo cuando quieras.') &&
                  context.mounted) {
                runAct(context, store.cancelTrial(clientId), 'Prueba terminada. Asesorado en pausa', Icons.pause_circle_rounded);
              }
            },
            child: const Text('No continúa'),
          ),
        ]),
      ]),
    );
  }

  void _extend(BuildContext context) {
    var days = 7;
    showSheet(
      context,
      title: 'Extender la prueba',
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ChoiceRow<int>(options: [for (final d in [3, 7, 14, 30]) (d, '+$d días')], value: days, onChanged: (v) => setS(() => days = v)),
          const Gap(10),
          Text('No se genera otro cobro. Si quieres cobrar la extensión, regístralo en Pagos.', style: ctx.tt.bodySmall),
        ]),
      ),
      footer: (ctx) => FilledButton(
        onPressed: () {
          Navigator.pop(ctx);
          runAct(context, store.extendTrial(clientId, days), 'Prueba extendida $days días', Icons.schedule_rounded);
        },
        child: const Text('Extender'),
      ),
    );
  }
}

/// Pestaña Rutina: durante la prueba se elige entre la rutina de prueba y el plan completo.
class TrialRoutines extends StatelessWidget {
  final int clientId;
  final String slot;
  final ValueChanged<String> onSlot;
  const TrialRoutines({super.key, required this.clientId, required this.slot, required this.onSlot});
  @override
  Widget build(BuildContext context) {
    final c = store.clientById(clientId) ?? {};
    final ti = trialInfo(c);
    if (ti == null) return RoutineEditor(key: ValueKey('re-$clientId'), clientId: clientId);
    return RoutineEditor(
      key: ValueKey('re-$clientId-$slot'),
      clientId: clientId,
      slot: slot == 'plan' ? 'plan' : 'current',
      header: SegmentedButton<String>(
        showSelectedIcon: false,
        segments: [
          const ButtonSegment(value: 'current', label: Text('Rutina de prueba')),
          ButtonSegment(value: 'plan', label: Text('Plan completo${c['planRoutine'] != null ? ' ✓' : ''}')),
        ],
        selected: {slot == 'plan' ? 'plan' : 'current'},
        onSelectionChanged: (v) => onSlot(v.first),
      ),
      headerNote: slot == 'plan' ? 'Se activa el ${_fmt(ti.end)}. Mientras tanto no lo ve.' : 'Es la que ve ahora durante la prueba.',
    );
  }
}

/* ------------------------------------------------------------ Datos y acceso */
class _ClientData extends StatefulWidget {
  final int clientId;
  const _ClientData({super.key, required this.clientId});
  @override
  State<_ClientData> createState() => _ClientDataState();
}

class _ClientDataState extends State<_ClientData> {
  late J c = store.clientById(widget.clientId) ?? {};
  late J u = store.userById(widget.clientId) ?? {};
  late final name = TextEditingController(text: u.s('name'));
  late final email = TextEditingController(text: u.s('email'));
  late final phone = TextEditingController(text: c.s('phone'));
  late final height = TextEditingController(text: c.s('heightCm'));
  late final fee = TextEditingController(text: kgRawOf(c.n('fee')));
  late final day = TextEditingController(text: '${c.i('billingDay', 1)}');
  late String goal = c.s('goal', 'Hipertrofia');
  bool dirty = false;
  String? newPass;

  static String kgRawOf(double v) => v % 1 == 0 ? v.toInt().toString() : v.toString();

  Future<void> save() async {
    if (name.text.trim().isEmpty || !RegExp(r'^\S+@\S+\.\S+$').hasMatch(email.text.trim())) return toast(context, 'Revisa el nombre y el correo', error: true);
    final ok = await runAct(context, store.updateClient(widget.clientId, {
      'name': name.text.trim(), 'email': email.text.trim().toLowerCase(), 'phone': phone.text.trim(), 'goal': goal,
      'heightCm': double.tryParse(height.text.replaceAll(',', '.')), 'fee': double.tryParse(fee.text.replaceAll(',', '.')) ?? 0,
      'billingDay': (int.tryParse(day.text) ?? 1).clamp(1, 28),
    }), 'Datos guardados');
    if (ok && mounted) setState(() => dirty = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final live = store.clientById(widget.clientId) ?? c;
    final first = firstName(u.s('name'));
    void mark(_) => setState(() => dirty = true);
    return PageList(children: [
      Section(
        title: 'Datos del asesorado',
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Field('Nombre', controller: name, caps: TextCapitalization.words, onChanged: mark),
          const Gap(12),
          Field('Correo', controller: email, keyboard: TextInputType.emailAddress, onChanged: mark),
          const Gap(12),
          Field('Teléfono', controller: phone, keyboard: TextInputType.phone, onChanged: mark),
          const Gap(12),
          Labeled('Objetivo', ChoiceRow<String>(options: [for (final g in goals) (g, g)], value: goal, onChanged: (v) => setState(() {
                goal = v;
                dirty = true;
              }))),
          const Gap(12),
          Row(children: [
            Expanded(child: Field('Estatura (cm)', controller: height, keyboard: TextInputType.number, onChanged: mark)),
            const SizedBox(width: 10),
            Expanded(child: Field('Mensualidad', controller: fee, keyboard: const TextInputType.numberWithOptions(decimal: true), onChanged: mark)),
          ]),
          const Gap(12),
          Field('Día de cobro', controller: day, keyboard: TextInputType.number, helper: 'Del 1 al 28', onChanged: mark),
          const Gap(14),
          FilledButton(onPressed: dirty ? save : null, child: const Text('Guardar cambios')),
        ]),
      ),
      Section(
        title: 'Acceso a la app',
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          RowTile(title: u.s('email'), subtitle: 'Correo para entrar', bold: true, trailing: IconButton(icon: const Icon(Icons.copy_rounded, size: 20), onPressed: () {
            Clipboard.setData(ClipboardData(text: u.s('email')));
            toast(context, 'Correo copiado');
          })),
          if (newPass != null)
            RowTile(title: newPass!, subtitle: 'Contraseña temporal (deberá cambiarla al entrar)', trailing: IconButton(icon: const Icon(Icons.copy_rounded, size: 20), onPressed: () {
              Clipboard.setData(ClipboardData(text: newPass!));
              toast(context, 'Contraseña copiada');
            })),
          const Gap(8),
          OutlinedButton.icon(
            onPressed: () async {
              final r = await store.resetClientPassword(widget.clientId);
              if (!context.mounted) return;
              if (!r.ok) return toast(context, r.error!, error: true);
              setState(() => newPass = r.json.s('password'));
              toast(context, 'Contraseña temporal creada. Entrégasela por un medio privado.', icon: Icons.key_rounded);
            },
            icon: const Icon(Icons.key_rounded, size: 18),
            label: const Text('Crear contraseña temporal'),
          ),
        ]),
      ),
      if (live.b('active') && trialInfo(live) == null) _OfferTrial(clientId: widget.clientId),
      Panel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(live.b('active') ? 'Pausar asesorado' : 'Reactivar asesorado', style: context.tt.titleMedium),
          const Gap(4),
          Text(live.b('active') ? 'No podrá entrar a la app ni se le generarán mensualidades. Su historial se conserva.' : 'Vuelve a tener acceso con su misma rutina e historial.', style: context.tt.bodySmall),
          const Gap(12),
          live.b('active')
              ? OutlinedButton(
                  style: OutlinedButton.styleFrom(foregroundColor: t.bad),
                  onPressed: () async {
                    if (await confirm(context, title: 'Pausar asesorado', confirmLabel: 'Pausar', text: '$first no podrá entrar a la app hasta que lo reactives.') && context.mounted) {
                      runAct(context, store.updateClient(widget.clientId, {'active': false}), 'Asesorado en pausa', Icons.pause_circle_rounded);
                    }
                  },
                  child: const Text('Pausar asesorado'),
                )
              : FilledButton(onPressed: () => runAct(context, store.updateClient(widget.clientId, {'active': true}), 'Asesorado reactivado'), child: const Text('Reactivar asesorado')),
        ]),
      ),
      Panel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Eliminar asesorado y sus datos', style: context.tt.titleMedium),
          const Gap(4),
          Text('Borra su cuenta, rutina, entrenamientos, medidas, fotos, notas, mensajes y pagos. Úsalo si deja la asesoría o te pide eliminar sus datos.', style: context.tt.bodySmall),
          const Gap(10),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              style: TextButton.styleFrom(foregroundColor: t.bad),
              onPressed: () async {
                if (await confirm(context, title: 'Eliminar asesorado', confirmLabel: 'Eliminar todo', text: 'Se borrará todo lo de ${u.s('name')}. Esta acción no se puede deshacer.') && context.mounted) {
                  final ok = await runAct(context, store.deleteClient(widget.clientId), '$first y sus datos fueron eliminados', Icons.delete_rounded);
                  if (ok && context.mounted) Navigator.pop(context);
                }
              },
              icon: const Icon(Icons.delete_outline_rounded, size: 18),
              label: const Text('Eliminar definitivamente'),
            ),
          ),
        ]),
      ),
    ]);
  }
}

class _OfferTrial extends StatelessWidget {
  final int clientId;
  const _OfferTrial({required this.clientId});
  @override
  Widget build(BuildContext context) => Panel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Plan de prueba', style: context.tt.titleMedium),
          const Gap(4),
          Text('Dale un periodo de prueba con su propia rutina y precio. Al terminar pasa solo al plan completo que prepares.', style: context.tt.bodySmall),
          const Gap(10),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(onPressed: () => _open(context), icon: const Icon(Icons.schedule_rounded, size: 18), label: const Text('Ofrecer plan de prueba')),
          ),
        ]),
      );

  void _open(BuildContext context) {
    var days = 30;
    final fee = TextEditingController(text: '0');
    showSheet(
      context,
      title: 'Ofrecer plan de prueba',
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Labeled('Duración de la prueba', ChoiceRow<int>(options: [for (final d in trialOptions) (d, d == 30 ? '1 mes' : '$d días')], value: days, onChanged: (v) => setS(() => days = v))),
          const Gap(12),
          Field('Precio de la prueba', controller: fee, keyboard: const TextInputType.numberWithOptions(decimal: true), helper: '0 si es gratis. Mientras dure no se generan mensualidades.'),
        ]),
      ),
      footer: (ctx) => FilledButton(
        onPressed: () async {
          Navigator.pop(ctx);
          runAct(context, store.startTrial(clientId, days, double.tryParse(fee.text.replaceAll(',', '.')) ?? 0), 'Plan de prueba activado', Icons.schedule_rounded);
        },
        child: const Text('Activar prueba'),
      ),
    );
  }
}
