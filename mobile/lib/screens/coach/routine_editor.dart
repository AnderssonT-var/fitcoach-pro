// Editor de rutinas: días, ejercicios, series/reps/descanso, drop sets, superseries,
// RIR/RPE, tempo, notas, plantillas y balance muscular.
import 'dart:convert';

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
import '../shared/exercise_ui.dart';
import '../shared/progress_widgets.dart';

J _blank(String name, String goal) => {'name': name, 'goal': goal, 'frequency': 3, 'notes': '', 'days': [{'id': store.newUid(), 'name': 'Día 1', 'exercises': <dynamic>[]}]};

J cloneWithIds(J r) {
  final n = copyJ(r);
  n['days'] = n.lm('days').map((d) => {...d, 'id': store.newUid(), 'exercises': d.lm('exercises').map((e) => {...e, 'uid': store.newUid()}).toList()}).toList();
  n.remove('id');
  n.remove('coachId');
  n.remove('createdAt');
  return n;
}

class RoutineEditor extends StatefulWidget {
  final int clientId;
  final String slot;
  final Widget? header;
  final String? headerNote;
  const RoutineEditor({super.key, required this.clientId, this.slot = 'current', this.header, this.headerNote});
  @override
  State<RoutineEditor> createState() => _RoutineEditorState();
}

class _RoutineEditorState extends State<RoutineEditor> {
  J? draft;
  int dayIdx = 0;
  bool saving = false;

  bool get isPlan => widget.slot == 'plan';
  J get client => store.clientById(widget.clientId) ?? {};
  J? get saved => isPlan ? client.m('planRoutine') : client.m('routine');
  String get first => firstName(store.userById(widget.clientId)?.s('name') ?? '');

  @override
  void initState() {
    super.initState();
    final s = saved;
    draft = s == null ? null : copyJ(s);
  }

  bool get dirty => jsonEncode(draft) != jsonEncode(saved);

  void up(void Function(J d) fn) => setState(() => fn(draft!));
  List<dynamic> get _days => draft!['days'] as List;
  J get day => (_days[dayIdx.clamp(0, _days.length - 1)] as Map).cast<String, dynamic>();
  List<dynamic> get _exs => day['exercises'] as List;
  J exAt(int i) => (_exs[i] as Map).cast<String, dynamic>();

  Future<void> save() async {
    final d = draft!;
    if (d.s('name').trim().isEmpty) return toast(context, 'Ponle un nombre a la rutina', error: true);
    final total = d.lm('days').fold<int>(0, (t, x) => t + x.lm('exercises').length);
    if (total == 0) return toast(context, 'Agrega al menos un ejercicio', error: true);
    final bad = d.lm('days').expand((x) => x.lm('exercises')).any((e) => e.s('tempo').isNotEmpty && !tempoRe.hasMatch(e.s('tempo')));
    if (bad) return toast(context, 'Revisa el tempo: 3 o 4 números separados por guiones (ej. 3-1-1-0).', error: true);
    setState(() => saving = true);
    await runAct(context, store.saveRoutine(widget.clientId, d, widget.slot), isPlan ? 'Plan completo guardado. Se activará al terminar la prueba' : 'Rutina guardada. $first ya la ve en su app');
    if (!mounted) return;
    setState(() {
      saving = false;
      final s = saved;
      if (s != null) draft = copyJ(s);
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    if (draft == null) {
      return PageList(children: [
        if (widget.header != null) widget.header!,
        if (widget.headerNote != null) Text(widget.headerNote!, style: context.tt.bodySmall),
        Panel(
          child: EmptyState(
            icon: Icons.fitness_center_rounded,
            title: isPlan ? 'Prepara el plan completo de $first' : '$first todavía no tiene rutina',
            text: isPlan
                ? 'Es la rutina específica para sus objetivos. Se activa sola cuando termine la prueba (o cuando tú decidas). Mientras tanto no la ve.'
                : 'Empieza desde cero o parte de una de tus plantillas y ajústala a su nivel.',
            action: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              FilledButton.icon(
                onPressed: () => setState(() => draft = _blank(isPlan ? 'Plan completo de $first' : client.m('trial')?.s('status') == 'active' ? 'Prueba de $first' : 'Plan de $first', client.s('goal', 'Hipertrofia'))),
                icon: const Icon(Icons.add_rounded),
                label: const Text('Empezar desde cero'),
              ),
              const Gap(8),
              OutlinedButton.icon(onPressed: _pickTemplate, icon: const Icon(Icons.layers_rounded), label: const Text('Usar plantilla')),
              if (isPlan && client.m('routine') != null) ...[
                const Gap(8),
                OutlinedButton.icon(
                  onPressed: () => setState(() => draft = {...cloneWithIds(client.m('routine')!), 'name': 'Plan completo de $first'}),
                  icon: const Icon(Icons.copy_rounded),
                  label: const Text('Partir de la rutina de prueba'),
                ),
              ],
            ]),
          ),
        ),
      ]);
    }

    final d = draft!;
    final total = d.lm('days').fold<int>(0, (t, x) => t + x.lm('exercises').length);
    final exs = day.lm('exercises');
    final ss = supersets(exs);
    return Column(children: [
      Expanded(
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
          if (widget.header != null) ...[widget.header!, const Gap(6)],
          if (widget.headerNote != null) ...[Text(widget.headerNote!, style: context.tt.bodySmall), const Gap(12)],
          Panel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Field('Nombre de la rutina', initial: d.s('name'), key: ValueKey('rn-${d.hashCode}'), onChanged: (v) => up((x) => x['name'] = v)),
              const Gap(12),
              Labeled('Objetivo', ChoiceRow<String>(scroll: true, options: [for (final g in goals) (g, g)], value: d.s('goal'), onChanged: (v) => up((x) => x['goal'] = v))),
              const Gap(12),
              Labeled('Entrenamientos por semana', ChoiceRow<int>(options: [for (var k = 1; k <= 6; k++) (k, '$k')], value: d.i('frequency'), onChanged: (v) => up((x) => x['frequency'] = v))),
              const Gap(12),
              Field('Indicaciones generales', initial: d.s('notes'), key: ValueKey('rnotes-${d.hashCode}'), maxLines: 3, hint: 'Ej.: calienta 10 min antes de empezar', onChanged: (v) => up((x) => x['notes'] = v)),
              const Gap(10),
              Wrap(spacing: 8, runSpacing: 8, children: [
                OutlinedButton.icon(onPressed: _pickTemplate, icon: const Icon(Icons.layers_rounded, size: 18), label: const Text('Usar plantilla')),
                OutlinedButton.icon(onPressed: total == 0 ? null : _saveAsTemplate, icon: const Icon(Icons.bookmark_add_outlined, size: 18), label: const Text('Guardar como plantilla')),
              ]),
            ]),
          ),
          const Gap(14),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              for (final (i, x) in d.lm('days').indexed)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text('${x.s('name').isEmpty ? 'Día ${i + 1}' : x.s('name')}  ${x.lm('exercises').length}'),
                    selected: i == dayIdx,
                    showCheckmark: false,
                    onSelected: (_) => setState(() => dayIdx = i),
                  ),
                ),
              ActionChip(
                avatar: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Día'),
                onPressed: () => up((x) {
                  (x['days'] as List).add({'id': store.newUid(), 'name': 'Día ${(x['days'] as List).length + 1}', 'exercises': <dynamic>[]});
                  dayIdx = (x['days'] as List).length - 1;
                }),
              ),
            ]),
          ),
          const Gap(12),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Expanded(child: Field('Nombre del día', initial: day.s('name'), key: ValueKey('dn-${day.s('id')}'), hint: 'Ej.: Torso', onChanged: (v) => up((_) => day['name'] = v))),
            if (_days.length > 1)
              Padding(
                padding: const EdgeInsets.only(left: 8),
                child: IconButton(
                  icon: Icon(Icons.delete_outline_rounded, color: t.bad),
                  tooltip: 'Quitar día',
                  onPressed: () async {
                    if (await confirm(context, title: 'Quitar ${day.s('name')}', confirmLabel: 'Quitar día',
                            text: 'Se quitan sus ${exs.length} ejercicios. El cambio se aplica cuando guardes la rutina.') &&
                        mounted) {
                      up((x) => (x['days'] as List).removeAt(dayIdx));
                      setState(() => dayIdx = 0);
                    }
                  },
                ),
              ),
          ]),
          const Gap(12),
          if (exs.isEmpty) NoteBox.text('Este día no tiene ejercicios. Agrega el primero desde tu biblioteca.', icon: Icons.fitness_center_rounded, tone: 'neutral'),
          for (var i = 0; i < exs.length; i++) _exerciseCard(context, i, exs, ss[i]),
          const Gap(4),
          OutlinedButton.icon(
            onPressed: _pickExercise,
            style: OutlinedButton.styleFrom(minimumSize: const Size(48, 54), side: BorderSide(color: t.accent.withValues(alpha: .5))),
            icon: const Icon(Icons.add_rounded),
            label: Text('Agregar ejercicio a ${day.s('name').isEmpty ? 'este día' : day.s('name')}'),
          ),
          const Gap(16),
          _Balance(routine: d, body: store.userById(widget.clientId)?.sn('body')),
        ]),
      ),
      Container(
        decoration: BoxDecoration(color: t.surface, border: Border(top: BorderSide(color: t.line))),
        padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.of(context).padding.bottom),
        child: Row(children: [
          Expanded(
            child: Text(
              '${dirty ? 'Cambios sin guardar' : saved != null ? (isPlan ? 'Se activa al terminar la prueba' : '$first ve esta versión') : 'Aún no se ha guardado'} · ${plural(_days.length, 'día', 'días')}, $total ejercicios',
              style: context.tt.bodySmall,
            ),
          ),
          if (dirty && saved != null)
            TextButton(
              onPressed: () async {
                if (await confirm(context, title: 'Descartar cambios', confirmLabel: 'Descartar', text: 'Vuelves a la última versión guardada de la rutina.') && mounted) {
                  setState(() {
                    draft = copyJ(saved!);
                    dayIdx = 0;
                  });
                }
              },
              child: const Text('Descartar'),
            ),
          FilledButton(onPressed: (!dirty && saved != null) || saving ? null : save, child: Text(saving ? 'Guardando…' : isPlan ? 'Guardar plan' : 'Guardar rutina')),
        ]),
      ),
    ]);
  }

  Widget _exerciseCard(BuildContext context, int i, List<J> exs, SsInfo? g) {
    final t = context.tok;
    final e = exs[i];
    final info = store.exerciseById(e.i('exId'));
    void set(String k, dynamic v) => up((_) => exAt(i)[k] = v);
    final tempoBad = e.s('tempo').isNotEmpty && !tempoRe.hasMatch(e.s('tempo'));
    final drop = isDrop(e);
    final effort = e.m('effort');
    final key = e.s('uid');
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.fromLTRB(12, 12, 6, 12),
          decoration: BoxDecoration(
            color: t.surface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: g != null ? t.accent.withValues(alpha: .55) : t.line, width: g != null ? 1.4 : 1),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              GestureDetector(onTap: () => showExercise(context, info), child: ExThumb(info, w: 58, h: 44)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (g != null) Padding(padding: const EdgeInsets.only(bottom: 3), child: SsTag('Superserie ${g.letter}${g.pos}')),
                  Text('${i + 1}. ${info.s('name')}', style: context.tt.titleSmall),
                  Text('${info.s('muscle')} · ${info.s('equipment')}', style: context.tt.bodySmall),
                ]),
              ),
              IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.arrow_upward_rounded, size: 19), onPressed: i == 0 ? null : () => up((_) {
                final l = _exs;
                final x = l.removeAt(i);
                l.insert(i - 1, x);
              })),
              IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.arrow_downward_rounded, size: 19), onPressed: i == exs.length - 1 ? null : () => up((_) {
                final l = _exs;
                final x = l.removeAt(i);
                l.insert(i + 1, x);
              })),
              IconButton(visualDensity: VisualDensity.compact, icon: Icon(Icons.close_rounded, size: 19, color: t.muted), onPressed: () => up((_) => _exs.removeAt(i))),
            ]),
            const Gap(10),
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Row(children: [
                Expanded(child: _Stepper(label: 'Series', value: e.i('sets', 3), min: 1, max: 10, onChanged: (v) => set('sets', v))),
                const SizedBox(width: 8),
                Expanded(
                  child: _MiniField(label: 'Reps', value: e.s('reps'), keyId: 'reps-$key', hint: '8-10', onChanged: (v) => set('reps', v.length > 7 ? v.substring(0, 7) : v)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _MiniDrop<int>(
                    label: g != null && g.pos < g.size ? 'Descanso (ronda)' : 'Descanso',
                    value: rests.contains(e.i('rest')) ? e.i('rest') : 90,
                    items: [for (final r in rests) (r, clock(r))],
                    onChanged: (v) => set('rest', v),
                  ),
                ),
              ]),
            ),
            const Gap(8),
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Row(children: [
                Expanded(
                  child: _MiniDrop<String>(
                    label: 'Técnica',
                    value: drop ? 'dropset' : 'normal',
                    items: const [('normal', 'Normal'), ('dropset', 'Drop set')],
                    onChanged: (v) => up((_) {
                      final x = exAt(i);
                      x['technique'] = v;
                      if (v == 'dropset' && x['drops'] == null) x['drops'] = Map<String, dynamic>.from(dropDefault);
                    }),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _MiniDrop<String>(
                    label: 'Intensidad',
                    value: effort == null ? '' : '${effort.s('type')}:${effort.n('value')}',
                    items: [
                      ('', '—'),
                      for (final v in rirValues) ('rir:${v.toDouble()}', effortLabel({'type': 'rir', 'value': v})),
                      for (final v in rpeValues) ('rpe:$v', effortLabel({'type': 'rpe', 'value': v})),
                    ],
                    onChanged: (v) => up((_) {
                      final x = exAt(i);
                      if (v.isEmpty) {
                        x.remove('effort');
                      } else {
                        final p = v.split(':');
                        x['effort'] = {'type': p[0], 'value': double.parse(p[1])};
                      }
                    }),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _MiniField(
                    label: 'Tempo',
                    value: e.s('tempo'),
                    keyId: 'tempo-$key',
                    hint: '3-1-1-0',
                    error: tempoBad,
                    formatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9xX-]')), LengthLimitingTextInputFormatter(11)],
                    onChanged: (v) => set('tempo', v.toUpperCase()),
                  ),
                ),
              ]),
            ),
            if (tempoBad) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Tempo: 3 o 4 números separados por guiones, por ejemplo 3-1-1-0 (X = explosivo).', style: TextStyle(color: t.bad, fontSize: 12))),
            if (e.s('tempo').isNotEmpty && !tempoBad) Padding(padding: const EdgeInsets.only(top: 6), child: Text(tempoHelp(e.s('tempo')), style: context.tt.bodySmall)),
            if (drop) ...[
              const Gap(10),
              Container(
                padding: const EdgeInsets.all(10),
                margin: const EdgeInsets.only(right: 6),
                decoration: BoxDecoration(color: t.warnSoft, borderRadius: BorderRadius.circular(16)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [
                    Expanded(child: _MiniDrop<int>(label: 'Bajadas', value: e.m('drops')!.i('count', 2), items: [for (final n in [1, 2, 3, 4]) (n, '$n')], onChanged: (v) => up((_) => exAt(i).m('drops')!['count'] = v))),
                    const SizedBox(width: 8),
                    Expanded(child: _MiniDrop<int>(label: 'Bajar el peso', value: e.m('drops')!.i('pct', 20), items: [for (final p in dropPcts) (p, '−$p%')], onChanged: (v) => up((_) => exAt(i).m('drops')!['pct'] = v))),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MiniDrop<String>(
                        label: 'Aplicar en',
                        value: e.m('drops')!.s('on', 'last'),
                        items: const [('last', 'Última serie'), ('all', 'Todas')],
                        onChanged: (v) => up((_) => exAt(i).m('drops')!['on'] = v),
                      ),
                    ),
                  ]),
                  const Gap(6),
                  Text('${dropLabel(e.m('drops'))}. Sin descanso entre bajadas.', style: context.tt.bodySmall?.copyWith(color: t.ink2)),
                ]),
              ),
            ],
            const Gap(8),
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: _MiniField(label: 'Nota para $first', value: e.s('notes'), keyId: 'notes-$key', hint: 'Opcional', onChanged: (v) => set('notes', v)),
            ),
          ]),
        ),
        if (i < exs.length - 1)
          Center(
            child: TextButton.icon(
              onPressed: () => up((_) => exAt(i)['linkNext'] = !e.b('linkNext')),
              style: TextButton.styleFrom(foregroundColor: e.b('linkNext') ? t.accent : t.muted, visualDensity: VisualDensity.compact),
              icon: Icon(e.b('linkNext') ? Icons.link_rounded : Icons.add_link_rounded, size: 18),
              label: Text(e.b('linkNext') ? 'En superserie con el siguiente · separar' : 'Unir en superserie con el siguiente'),
            ),
          ),
      ]),
    );
  }

  Future<void> _pickExercise() async {
    await push(context, ExercisePickerPage(
      title: 'Agregar a ${day.s('name').isEmpty ? 'este día' : day.s('name')}',
      onPick: (ex) {
        up((_) => _exs.add({
              'uid': store.newUid(), 'exId': ex.i('id'), 'sets': ex.i('sets', 3) == 0 ? 3 : ex.i('sets', 3), 'reps': ex.s('reps', '10'),
              'rest': rests.contains(ex.i('rest')) ? ex.i('rest') : 90, 'notes': '',
            }));
      },
    ));
  }

  Future<void> _pickTemplate() async {
    final list = store.templates.where((x) => x.i('coachId') == store.meId).toList();
    final pick = await showSheet<J>(
      context,
      title: 'Elegir plantilla',
      builder: (ctx) => list.isEmpty
          ? Text('Aún no tienes plantillas. Guarda una rutina como plantilla para reutilizarla.', style: ctx.tt.bodyMedium)
          : Column(children: [
              for (final tpl in list)
                RowTile(
                  leading: const IconBadge(Icons.layers_rounded, tone: 'info'),
                  title: tpl.s('name'),
                  subtitle: '${tpl.s('goal')} · ${plural(tpl.lm('days').length, 'día', 'días')} · ${tpl.i('frequency')}×/semana · ${tpl.lm('days').fold<int>(0, (n, d) => n + d.lm('exercises').length)} ejercicios',
                  onTap: () => Navigator.pop(ctx, tpl),
                ),
            ]),
    );
    if (pick == null || !mounted) return;
    setState(() {
      final keepName = draft?.s('name');
      draft = cloneWithIds(pick);
      if (keepName != null && keepName.isNotEmpty) draft!['name'] = keepName;
      dayIdx = 0;
    });
    toast(context, 'Plantilla aplicada. Revisa y guarda');
  }

  Future<void> _saveAsTemplate() async {
    final c = TextEditingController(text: draft!.s('name'));
    await showSheet(
      context,
      title: 'Guardar como plantilla',
      builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Field('Nombre de la plantilla', controller: c, autofocus: true),
        const Gap(8),
        Text('La plantilla queda en tu biblioteca para usarla con otros asesorados.', style: ctx.tt.bodySmall),
      ]),
      footer: (ctx) => FilledButton(
        onPressed: () {
          if (c.text.trim().isEmpty) return;
          Navigator.pop(ctx);
          runAct(context, store.saveTemplate(draft!, c.text.trim()), 'Plantilla guardada en tu biblioteca', Icons.layers_rounded);
        },
        child: const Text('Guardar plantilla'),
      ),
    );
  }
}

class _Balance extends StatelessWidget {
  final J routine;
  final String? body;
  const _Balance({required this.routine, this.body});
  @override
  Widget build(BuildContext context) {
    final sets = routineMuscleSets(store.exerciseById, routine);
    final freq = routine.i('frequency', routine.lm('days').length);
    return Section(
      title: 'Balance muscular',
      subtitle: 'Series semanales que plantea esta rutina con $freq ${freq == 1 ? 'sesión' : 'sesiones'} por semana',
      child: sets.isEmpty
          ? const EmptyState(icon: Icons.accessibility_new_rounded, title: 'Agrega ejercicios', text: 'Verás aquí qué músculos cubre la rutina y cuáles quedan sin trabajar.')
          : MuscleVolume(sets: sets, body: body),
    );
  }
}

/* ------------------------------------------------------------ Controles compactos */
class _Stepper extends StatelessWidget {
  final String label;
  final int value, min, max;
  final ValueChanged<int> onChanged;
  const _Stepper({required this.label, required this.value, required this.min, required this.max, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: context.tt.labelSmall),
      const Gap(4),
      Container(
        height: 44,
        decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.line)),
        child: Row(children: [
          InkWell(onTap: value > min ? () => onChanged(value - 1) : null, child: SizedBox(width: 30, height: 44, child: Icon(Icons.remove_rounded, size: 18, color: t.ink2))),
          Expanded(child: Text('$value', textAlign: TextAlign.center, style: const TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, fontSize: 16))),
          InkWell(onTap: value < max ? () => onChanged(value + 1) : null, child: SizedBox(width: 30, height: 44, child: Icon(Icons.add_rounded, size: 18, color: t.ink2))),
        ]),
      ),
    ]);
  }
}

class _MiniField extends StatefulWidget {
  final String label, value, keyId;
  final String? hint;
  final bool error;
  final List<TextInputFormatter>? formatters;
  final ValueChanged<String> onChanged;
  const _MiniField({required this.label, required this.value, required this.keyId, this.hint, this.error = false, this.formatters, required this.onChanged});
  @override
  State<_MiniField> createState() => _MiniFieldState();
}

class _MiniFieldState extends State<_MiniField> {
  late final c = TextEditingController(text: widget.value);
  @override
  void didUpdateWidget(_MiniField old) {
    super.didUpdateWidget(old);
    if (widget.value != c.text && old.keyId == widget.keyId && !FocusScope.of(context).hasFocus) c.text = widget.value;
    if (old.keyId != widget.keyId) c.text = widget.value;
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(widget.label, style: context.tt.labelSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
      const Gap(4),
      TextField(
        controller: c,
        inputFormatters: widget.formatters,
        style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          hintText: widget.hint,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: widget.error ? t.bad : t.line)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: widget.error ? t.bad : t.accent, width: 1.6)),
        ),
        onChanged: widget.onChanged,
      ),
    ]);
  }
}

class _MiniDrop<T> extends StatelessWidget {
  final String label;
  final T value;
  final List<(T, String)> items;
  final ValueChanged<T> onChanged;
  const _MiniDrop({required this.label, required this.value, required this.items, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final current = items.where((x) => x.$1 == value).firstOrNull ?? items.first;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: context.tt.labelSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
      const Gap(4),
      PopupMenuButton<T>(
        onSelected: onChanged,
        itemBuilder: (_) => [for (final (v, l) in items) PopupMenuItem<T>(value: v, height: 40, child: Text(l))],
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.line)),
          child: Row(children: [
            Expanded(child: Text(current.$2, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
            Icon(Icons.expand_more_rounded, size: 18, color: t.muted),
          ]),
        ),
      ),
    ]);
  }
}

/* ------------------------------------------------------------ Selector de ejercicios */
class ExercisePickerPage extends StatefulWidget {
  final String title;
  final void Function(J ex) onPick;
  const ExercisePickerPage({super.key, required this.title, required this.onPick});
  @override
  State<ExercisePickerPage> createState() => _ExercisePickerPageState();
}

class _ExercisePickerPageState extends State<ExercisePickerPage> {
  final f = ExFilters();
  final added = <int, int>{};

  @override
  void initState() {
    super.initState();
    f.addListener(() => setState(() {}));
  }

  void add(J ex) {
    HapticFeedback.lightImpact();
    widget.onPick(ex);
    setState(() => added[ex.i('id')] = (added[ex.i('id')] ?? 0) + 1);
    toast(context, '${ex.s('name')} agregado');
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final list = coachExercises();
    final shown = f.apply(list, store.meId!);
    final n = added.values.fold<int>(0, (a, b) => a + b);
    return Scaffold(
      appBar: AppBar(title: Text(widget.title), actions: [
        Padding(padding: const EdgeInsets.only(right: 12), child: FilledButton(onPressed: () => Navigator.pop(context), child: Text(n > 0 ? 'Listo ($n)' : 'Listo'))),
      ]),
      body: CustomScrollView(slivers: [
        SliverPadding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 8), sliver: SliverToBoxAdapter(child: ExFilterBar(f: f, list: list, showMine: true))),
        SliverPadding(padding: const EdgeInsets.symmetric(horizontal: 16), sliver: SliverToBoxAdapter(child: Text('${shown.length} ejercicios', style: context.tt.bodySmall))),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 30),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 220, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: .66),
            delegate: SliverChildBuilderDelegate(
              (ctx, i) {
                final ex = shown[i];
                final a = added[ex.i('id')] ?? 0;
                return ExTile(
                  ex: ex,
                  onOpen: () => showExercise(context, ex, footer: (c) => FilledButton.icon(onPressed: () {
                    Navigator.pop(c);
                    add(ex);
                  }, icon: const Icon(Icons.add_rounded), label: const Text('Agregar'))),
                  action: SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(minimumSize: const Size(0, 38), backgroundColor: a > 0 ? t.ok : null, foregroundColor: a > 0 ? Colors.white : null),
                      onPressed: () => add(ex),
                      icon: Icon(a > 0 ? Icons.check_rounded : Icons.add_rounded, size: 17),
                      label: Text(a > 0 ? 'Agregado' : 'Agregar'),
                    ),
                  ),
                );
              },
              childCount: shown.length,
            ),
          ),
        ),
      ]),
    );
  }
}
