// Seguimiento desde el entrenador: cumplimiento, cuestionario, etiquetas, check-ins
// lado a lado, hábitos, nutrición, programa por fases y automatizaciones con cobro en línea.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app.dart';
import '../../core/coaching.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

String _fmt(num v) => v == v.roundToDouble() ? v.round().toString() : v.toStringAsFixed(1);
const _exp = {'principiante': 'Principiante', 'intermedio': 'Intermedio', 'avanzado': 'Avanzado'};
const _place = {'gimnasio': 'Gimnasio', 'casa': 'Casa', 'ambos': 'Gimnasio y casa'};
bool _same(Object? a, Object? b) => jsonEncode(a) == jsonEncode(b);

Color toneColor(BuildContext context, int? p) {
  final t = context.tok;
  return switch (complianceTone(p)) { 'ok' => t.ok, 'warn' => t.warn, 'bad' => t.bad, _ => t.ink2 };
}

/* ------------------------------------------------------------ Cumplimiento */
class ComplianceCard extends StatelessWidget {
  final J c;
  const ComplianceCard({super.key, required this.c});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final ws = store.workoutsAll;
    final d7 = compliance(c, ws, 7), d30 = compliance(c, ws, 30), d90 = compliance(c, ws, 90);
    final h = habitCompliance(c, 7);
    final drop = d7 != null && d30 != null && d30 - d7 >= 20;
    return Panel(
      color: drop ? t.badSoft : null,
      border: drop ? t.bad.withValues(alpha: .4) : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text('CUMPLIMIENTO', style: context.tt.labelSmall?.copyWith(letterSpacing: .8, color: drop ? t.bad : t.muted, fontWeight: FontWeight.w800))),
          if (drop) Text('−${d30 - d7} puntos', style: context.tt.labelMedium?.copyWith(color: t.bad, fontWeight: FontWeight.w800)),
        ]),
        const Gap(10),
        if (d7 == null)
          Text('Asigna una rutina para medir su cumplimiento.', style: context.tt.bodySmall)
        else
          Row(children: [
            for (final (v, l) in [(d7, '7 días'), (d30, '30 días'), (d90, '90 días'), (h, 'hábitos')])
              Expanded(
                child: Column(children: [
                  Text(v == null ? '—' : '$v%', style: context.tt.headlineSmall?.copyWith(color: toneColor(context, v))),
                  Text(l, style: context.tt.labelSmall),
                ]),
              ),
          ]),
      ]),
    );
  }
}

class OnboardingAnswers extends StatelessWidget {
  final J c;
  const OnboardingAnswers({super.key, required this.c});
  @override
  Widget build(BuildContext context) {
    final o = c.m('onboarding');
    if (o == null) return const SizedBox.shrink();
    final days = o.l('days').map(intOf).toList()..sort();
    Widget fact(String l, String v) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(l, style: context.tt.labelSmall), Text(v, style: context.tt.titleSmall)]),
        );
    return Section(
      title: 'Cuestionario de inicio',
      subtitle: shortDate(o.d('at')),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [fact('Objetivo', o.s('goal')), fact('Experiencia', _exp[o.s('experience')] ?? o.s('experience'))]),
        const Gap(10),
        Row(children: [fact('Días', days.isEmpty ? '—' : days.map((d) => daysShort[d % 7]).join(' ')), fact('Lugar', _place[o.s('place')] ?? o.s('place'))]),
        if (o.s('injuries').isNotEmpty) ...[const Gap(12), NoteBox(icon: Icons.healing_rounded, tone: 'bad', child: Text('Lesiones o molestias: ${o.s('injuries')}'))],
        if (o.s('notes').isNotEmpty) ...[const Gap(10), Text(o.s('notes'), style: context.tt.bodyMedium)],
      ]),
    );
  }
}

class TagsEditor extends StatefulWidget {
  final J c;
  const TagsEditor({super.key, required this.c});
  @override
  State<TagsEditor> createState() => _TagsEditorState();
}

class _TagsEditorState extends State<TagsEditor> {
  late List<String> tags = widget.c.l('tags').map((e) => '$e').toList();
  final ctl = TextEditingController();
  void add() {
    final v = ctl.text.trim();
    if (v.isEmpty || tags.contains(v) || tags.length >= 8) return;
    setState(() => tags = [...tags, v.length > 24 ? v.substring(0, 24) : v]);
    ctl.clear();
  }

  @override
  Widget build(BuildContext context) {
    final dirty = !_same(tags, widget.c.l('tags'));
    return Section(
      title: 'Etiquetas',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (tags.isNotEmpty)
          Wrap(spacing: 6, runSpacing: 6, children: [for (final x in tags) InputChip(label: Text(x), onDeleted: () => setState(() => tags = tags.where((y) => y != x).toList()))]),
        if (tags.length < 8) ...[
          const Gap(8),
          TextField(controller: ctl, decoration: InputDecoration(hintText: 'Ej. Presencial, Competidor', suffixIcon: IconButton(onPressed: add, icon: const Icon(Icons.add_rounded), tooltip: 'Agregar')), onSubmitted: (_) => add()),
        ],
        if (dirty) ...[const Gap(10), FilledButton(onPressed: () => runAct(context, store.saveTags(widget.c.i('userId'), tags), 'Etiquetas guardadas'), child: const Text('Guardar etiquetas'))],
      ]),
    );
  }
}

/* ------------------------------------------------------------ Check-ins */
const _rows = [('weight', 'Peso', 'kg', -1), ('waist', 'Cintura', 'cm', -1), ('energy', 'Energía', '', 1), ('sleep', 'Sueño', '', 1), ('stress', 'Estrés', '', -1), ('hunger', 'Hambre', '', 0)];

class CheckinsTab extends StatefulWidget {
  final int clientId;
  const CheckinsTab({super.key, required this.clientId});
  @override
  State<CheckinsTab> createState() => _CheckinsTabState();
}

class _CheckinsTabState extends State<CheckinsTab> {
  String? sel;
  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final c = store.clientById(widget.clientId) ?? {};
      final first = firstName(store.userById(widget.clientId)?.s('name') ?? '');
      final list = c.lm('checkins').reversed.toList();
      sel ??= (list.where((x) => x['reviewedAt'] == null).firstOrNull ?? list.firstOrNull)?.s('id');
      final i = list.indexWhere((x) => x.s('id') == sel);
      final cur = i >= 0 ? list[i] : null;
      final prev = i >= 0 && i + 1 < list.length ? list[i + 1] : null;
      J? photoOf(J? x) {
        final ids = x?.l('photos') ?? const [];
        if (ids.isEmpty) return null;
        return c.lm('photos').where((p) => p.s('id') == '${ids.first}').firstOrNull;
      }

      return PageList(children: [
        Row(children: [
          Expanded(child: Text('Lo pide los ${weekdaysEs[checkinCfgOf(c).day].toLowerCase()} · ${plural(list.length, 'check-in', 'check-ins')}', style: context.tt.bodySmall)),
          TextButton.icon(onPressed: () => _config(context, c), icon: const Icon(Icons.edit_rounded, size: 17), label: const Text('Día y preguntas')),
        ]),
        if (cur == null)
          Panel(child: EmptyState(icon: Icons.assignment_rounded, title: 'Aún no envía check-ins', text: '$first recibe un aviso el día del check-in. Aquí verás su peso, fotos y respuestas, lado a lado con el anterior.'))
        else ...[
          Panel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text(prev == null ? shortDate(cur.d('date')) : '${shortDate(cur.d('date'))} vs ${shortDate(prev.d('date'))}', style: context.tt.titleLarge)),
                Pill(cur['reviewedAt'] != null ? 'Revisado' : 'Por revisar', tone: cur['reviewedAt'] != null ? 'ok' : 'warn', small: true),
              ]),
              if (photoOf(cur) != null || photoOf(prev) != null) ...[
                const Gap(12),
                Row(children: [
                  for (final x in [prev, cur].whereType<J>())
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Column(children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: AspectRatio(
                              aspectRatio: 3 / 4,
                              child: photoOf(x) != null ? SmartImage(photoOf(x)!.s('src')) : Container(color: t.surface2, alignment: Alignment.center, child: Text('Sin foto', style: context.tt.bodySmall)),
                            ),
                          ),
                          const Gap(4),
                          Text(shortDate(x.d('date')), style: context.tt.labelSmall),
                        ]),
                      ),
                    ),
                ]),
              ],
              const Gap(12),
              Table(
                columnWidths: const {0: FlexColumnWidth(1.4)},
                children: [
                  TableRow(children: [for (final h in ['Dato', 'Antes', 'Ahora', 'Cambio']) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(h, style: context.tt.labelSmall))]),
                  for (final (k, l, unit, better) in _rows)
                    if (prev?.nn(k) != null || cur.nn(k) != null)
                      () {
                        final a = prev?.nn(k), b = cur.nn(k);
                        final d = a != null && b != null ? double.parse((b - a).toStringAsFixed(1)) : null;
                        final col = d == null || d == 0 || better == 0 ? t.ink2 : ((d > 0) == (better > 0) ? t.ok : t.warn);
                        String v(double? x) => x == null ? '—' : '${_fmt(x)}${unit.isNotEmpty ? ' $unit' : ''}';
                        return TableRow(children: [
                          Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Text(l, style: context.tt.bodyMedium)),
                          Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Text(v(a), style: context.tt.bodyMedium?.copyWith(color: t.muted))),
                          Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Text(v(b), style: context.tt.titleSmall)),
                          Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Text(d == null ? '' : d == 0 ? '=' : '${d > 0 ? '+' : ''}${_fmt(d)}', style: context.tt.titleSmall?.copyWith(color: col))),
                        ]);
                      }(),
                ],
              ),
              for (final x in cur.lm('answers')) ...[
                const Gap(10),
                Text(x.s('q'), style: context.tt.labelSmall),
                Text('“${x.s('a')}”', style: context.tt.bodyLarge),
              ],
              const Gap(14),
              _Review(key: ValueKey(cur.s('id')), clientId: widget.clientId, ci: cur),
            ]),
          ),
          Section(
            title: 'Historial',
            child: Column(children: [
              for (final x in list)
                RowTile(
                  title: shortDate(x.d('date')),
                  subtitle: '${x.nn('weight') != null ? '${_fmt(x.n('weight'))} kg · ' : ''}energía ${x.i('energy')} · estrés ${x.i('stress')}',
                  trailing: x['reviewedAt'] == null ? Container(width: 10, height: 10, decoration: BoxDecoration(color: t.warn, shape: BoxShape.circle)) : (x.s('id') == sel ? Icon(Icons.check_rounded, color: t.accent) : null),
                  onTap: () => setState(() => sel = x.s('id')),
                ),
            ]),
          ),
        ],
      ]);
    });
  }

  void _config(BuildContext context, J c) {
    final cfg = checkinCfgOf(c);
    var day = cfg.day;
    final qs = [for (final q in cfg.questions) TextEditingController(text: q)];
    showSheet(context,
        title: 'Check-in semanal',
        builder: (ctx) => StatefulBuilder(
              builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Labeled('Día en que lo pide', ChoiceRow<int>(scroll: true, options: [for (var i = 0; i < 7; i++) (i, weekdaysEs[i])], value: day, onChanged: (v) => set(() => day = v))),
                const Gap(16),
                for (var i = 0; i < qs.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(children: [
                      Expanded(child: TextField(controller: qs[i], maxLength: 200, decoration: InputDecoration(hintText: 'Pregunta ${i + 1}', counterText: ''))),
                      IconButton(onPressed: () => set(() => qs.removeAt(i)), icon: const Icon(Icons.delete_outline_rounded), tooltip: 'Quitar'),
                    ]),
                  ),
                if (qs.length < 6) Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => set(() => qs.add(TextEditingController())), icon: const Icon(Icons.add_rounded), label: const Text('Agregar pregunta'))),
              ]),
            ),
        footer: (ctx) => FilledButton(
              onPressed: () async {
                final list = qs.map((q) => q.text.trim()).where((q) => q.isNotEmpty).toList();
                if (await runAct(ctx, store.saveCheckinCfg(c.i('userId'), {'day': day, 'questions': list}), 'Check-in actualizado') && ctx.mounted) Navigator.pop(ctx);
              },
              child: const Text('Guardar'),
            ));
  }
}

class _Review extends StatefulWidget {
  final int clientId;
  final J ci;
  const _Review({super.key, required this.clientId, required this.ci});
  @override
  State<_Review> createState() => _ReviewState();
}

class _ReviewState extends State<_Review> {
  late final ctl = TextEditingController(text: widget.ci.s('reply'));
  bool busy = false;
  @override
  Widget build(BuildContext context) {
    final done = widget.ci['reviewedAt'] != null;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Field(done ? 'Tu respuesta' : 'Responder (le llega como mensaje)', controller: ctl, maxLines: 4, caps: TextCapitalization.sentences, hint: '¡Buen trabajo esta semana! Ajustemos…'),
      const Gap(10),
      FilledButton.icon(
        onPressed: busy
            ? null
            : () async {
                setState(() => busy = true);
                await runAct(context, store.reviewCheckin(widget.clientId, widget.ci.s('id'), ctl.text.trim()), ctl.text.trim().isEmpty ? 'Marcado como revisado' : 'Respuesta enviada', Icons.check_circle_rounded);
                if (mounted) setState(() => busy = false);
              },
        icon: Icon(ctl.text.trim().isEmpty ? Icons.done_all_rounded : Icons.send_rounded),
        label: Text(done ? 'Enviar de nuevo' : 'Marcar como revisado'),
      ),
    ]);
  }
}

/* ------------------------------------------------------------ Hábitos */
class HabitsTab extends StatefulWidget {
  final int clientId;
  const HabitsTab({super.key, required this.clientId});
  @override
  State<HabitsTab> createState() => _HabitsTabState();
}

class _HabitsTabState extends State<HabitsTab> {
  late List<J> list = habitsOf(store.clientById(widget.clientId)).map(copyJ).toList();

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final c = store.clientById(widget.clientId) ?? {};
      final days = [for (var i = 13; i >= 0; i--) DateTime.now().subtract(Duration(days: i))];
      final dirty = !_same(list, habitsOf(c));
      return PageList(children: [
        Section(
          title: 'Últimos 14 días',
          subtitle: '${habitCompliance(c, 14) ?? 0}% cumplido',
          child: Column(children: [
            for (final h in habitsOf(c))
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  SizedBox(width: 78, child: Text(h.s('name'), style: context.tt.labelMedium, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  for (final d in days)
                    Expanded(
                      child: Builder(builder: (_) {
                        final v = c.m('habitLog')?.m(dayKey(d))?[h.s('id')];
                        final ok = habitDone(h, v);
                        return Container(
                          height: 18,
                          margin: const EdgeInsets.symmetric(horizontal: 1.5),
                          decoration: BoxDecoration(color: ok ? t.ok : (numOf(v) > 0 ? t.ok.withValues(alpha: .35) : t.surface3), borderRadius: BorderRadius.circular(5)),
                        );
                      }),
                    ),
                ]),
              ),
            Row(children: [
              const SizedBox(width: 78),
              for (final d in days) Expanded(child: Text(daysShort[d.weekday % 7], textAlign: TextAlign.center, style: context.tt.labelSmall?.copyWith(fontSize: 9.5))),
            ]),
          ]),
        ),
        Section(
          title: 'Hábitos asignados',
          trailing: TextButton(onPressed: () => setState(() => list = defaultHabits.map(copyJ).toList()), child: const Text('Usar los básicos')),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final (i, h) in list.indexed)
              Padding(
                key: ValueKey(h.s('id')),
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [
                    Expanded(child: TextFormField(initialValue: h.s('name'), decoration: const InputDecoration(hintText: 'Nombre', counterText: ''), maxLength: 40, onChanged: (v) => setState(() => h['name'] = v))),
                    IconButton(onPressed: () => setState(() => list.removeAt(i)), icon: const Icon(Icons.delete_outline_rounded), tooltip: 'Quitar'),
                  ]),
                  Row(children: [
                    ChoiceRow<String>(options: const [('count', 'Con meta'), ('check', 'Sí / no')], value: h.s('kind'), onChanged: (v) => setState(() => h['kind'] = v)),
                    if (h.s('kind') == 'count') ...[
                      const SizedBox(width: 8),
                      SizedBox(width: 70, child: TextFormField(initialValue: _fmt(h.n('target')), keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'Meta'), onChanged: (v) => setState(() => h['target'] = numOf(v)))),
                      const SizedBox(width: 6),
                      Expanded(child: TextFormField(initialValue: h.s('unit'), decoration: const InputDecoration(hintText: 'unidad', counterText: ''), maxLength: 16, onChanged: (v) => setState(() => h['unit'] = v))),
                    ],
                  ]),
                ]),
              ),
            if (list.length < 8)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(onPressed: () => setState(() => list.add({'id': store.newUid(), 'name': '', 'target': 1, 'unit': '', 'kind': 'check'})), icon: const Icon(Icons.add_rounded), label: const Text('Agregar hábito')),
              ),
            if (dirty)
              FilledButton(
                onPressed: () {
                  if (list.any((h) => h.s('name').trim().isEmpty)) return toast(context, 'Ponle nombre a cada hábito', error: true);
                  runAct(context, store.saveHabits(widget.clientId, [for (final h in list) {...h, 'name': h.s('name').trim(), 'target': h.n('target'), 'unit': h.s('unit')}]), 'Hábitos guardados');
                },
                child: const Text('Guardar hábitos'),
              ),
          ]),
        ),
      ]);
    });
  }
}

/* ------------------------------------------------------------ Nutrición */
class NutritionTab extends StatefulWidget {
  final int clientId;
  const NutritionTab({super.key, required this.clientId});
  @override
  State<NutritionTab> createState() => _NutritionTabState();
}

class _NutritionTabState extends State<NutritionTab> {
  late J? p = store.clientById(widget.clientId)?.m('nutrition') == null ? null : copyJ(store.clientById(widget.clientId)!.m('nutrition')!);
  int _formKey = 0;

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final c = store.clientById(widget.clientId) ?? {};
      final saved = c.m('nutrition');
      final p = this.p;
      final log = Section(
        title: 'Lo que registró',
        subtitle: 'últimos 7 días',
        child: Column(children: [
          for (var i = 0; i < 7; i++)
            Builder(builder: (_) {
              final d = DateTime.now().subtract(Duration(days: i));
              final f = foodToday(c, dayKey(d));
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(width: 74, child: Text('${daysShort[d.weekday % 7]} ${d.day}', style: context.tt.titleSmall)),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${f.meals.where((m) => m['done'] == true).length}/${f.meals.length} comidas · ${f.water} vasos · ${f.kcal} kcal', style: context.tt.bodySmall),
                      if (f.entries.isNotEmpty) ...[
                        const Gap(6),
                        Wrap(spacing: 6, runSpacing: 6, children: [
                          for (final e in f.entries)
                            e.sn('photoUrl') != null
                                ? Tooltip(message: e.s('name'), child: ClipRRect(borderRadius: BorderRadius.circular(10), child: SmartImage(e.s('photoUrl'), width: 46, height: 46)))
                                : Pill(e.s('name'), small: true),
                        ]),
                      ],
                    ]),
                  ),
                ]),
              );
            }),
        ]),
      );
      if (p == null) {
        return PageList(children: [
          Panel(
            child: EmptyState(
              icon: Icons.restaurant_rounded,
              title: 'Sin plan de nutrición',
              text: 'Define calorías, macros y las comidas del día. Tu asesorado las marca y puede registrar lo que come con foto.',
              action: FilledButton(onPressed: () => setState(() => this.p = {'kcal': 2200, 'protein': 150, 'carbs': 230, 'fat': 70, 'water': 8, 'meals': <dynamic>[], 'notes': ''}), child: const Text('Crear plan')),
            ),
          ),
          log,
        ]);
      }
      final meals = p.lm('meals');
      final fromMacros = (p.n('protein') * 4 + p.n('carbs') * 4 + p.n('fat') * 9).round();
      final dirty = !_same(p, saved);
      Widget num(String k, String l) => Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Field(l, key: ValueKey('$k-$_formKey'), initial: _fmt(p.n(k)), keyboard: TextInputType.number, formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(5)], onChanged: (v) => setState(() => p[k] = int.tryParse(v) ?? 0)),
            ),
          );
      return PageList(children: [
        Section(
          title: 'Metas diarias',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [num('kcal', 'Calorías'), num('water', 'Agua (vasos)')]),
            const Gap(10),
            Row(children: [num('protein', 'Proteína g'), num('carbs', 'Carbos g'), num('fat', 'Grasas g')]),
            if ((fromMacros - p.n('kcal')).abs() > 150) ...[
              const Gap(10),
              Row(children: [
                Expanded(child: Text('Los macros suman $fromMacros kcal.', style: context.tt.bodySmall?.copyWith(color: t.warn))),
                TextButton(onPressed: () => setState(() { p['kcal'] = fromMacros; _formKey++; }), child: Text('Usar $fromMacros')),
              ]),
            ],
          ]),
        ),
        Section(
          title: 'Comidas del día',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final (i, m) in meals.indexed)
              Padding(
                key: ValueKey(m.s('id')),
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(children: [
                  Row(children: [
                    Expanded(child: TextFormField(initialValue: m.s('name'), maxLength: 40, decoration: const InputDecoration(hintText: 'Desayuno', counterText: ''), onChanged: (v) => setState(() => _meal(i, 'name', v)))),
                    const SizedBox(width: 8),
                    SizedBox(width: 82, child: TextFormField(initialValue: m.n('kcal') > 0 ? _fmt(m.n('kcal')) : '', keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)], decoration: const InputDecoration(hintText: 'kcal'), onChanged: (v) => setState(() => _meal(i, 'kcal', int.tryParse(v) ?? 0)))),
                    IconButton(onPressed: () => setState(() => p['meals'] = [...meals]..removeAt(i)), icon: const Icon(Icons.delete_outline_rounded), tooltip: 'Quitar'),
                  ]),
                  const Gap(6),
                  TextFormField(initialValue: m.s('desc'), maxLength: 300, decoration: const InputDecoration(hintText: 'Avena, 3 huevos, plátano', counterText: ''), onChanged: (v) => setState(() => _meal(i, 'desc', v))),
                ]),
              ),
            if (meals.length < 10)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => setState(() => p['meals'] = [...meals, {'id': store.newUid(), 'name': meals.length < 4 ? ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'][meals.length] : '', 'desc': '', 'kcal': 0}]),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Agregar comida'),
                ),
              ),
            const Gap(6),
            Field('Indicaciones', initial: p.s('notes'), maxLines: 2, maxLength: 1000, hint: 'Ej. Toma 2 L de agua antes de las 4 p. m.', onChanged: (v) => setState(() => p['notes'] = v)),
            const Gap(12),
            if (dirty)
              FilledButton(
                onPressed: () {
                  if (meals.any((m) => m.s('name').trim().isEmpty)) return toast(context, 'Ponle nombre a cada comida', error: true);
                  runAct(context, store.saveNutrition(widget.clientId, p), 'Plan de nutrición guardado');
                },
                child: const Text('Guardar plan'),
              ),
            if (saved != null)
              TextButton(
                onPressed: () async {
                  if (await runAct(context, store.saveNutrition(widget.clientId, null), 'Plan quitado') && mounted) setState(() => this.p = null);
                },
                child: const Text('Quitar plan'),
              ),
          ]),
        ),
        log,
      ]);
    });
  }

  void _meal(int i, String k, Object v) {
    final meals = p!.lm('meals');
    meals[i] = {...meals[i], k: v};
    p!['meals'] = meals;
  }
}

/* ------------------------------------------------------------ Programa por fases */
J _stripIds(J r) => {
      'name': r.s('name'), 'goal': r.s('goal'), 'frequency': r.i('frequency', 3), 'notes': r.s('notes'),
      'days': [
        for (final d in r.lm('days')) {...copyJ(d), 'id': store.newUid(), 'exercises': [for (final e in d.lm('exercises')) {...copyJ(e), 'uid': store.newUid()}]},
      ],
    };

class ProgramTab extends StatefulWidget {
  final int clientId;
  const ProgramTab({super.key, required this.clientId});
  @override
  State<ProgramTab> createState() => _ProgramTabState();
}

class _ProgramTabState extends State<ProgramTab> {
  late List<J> phases = (store.clientById(widget.clientId)?.m('program')?.lm('phases') ?? const <J>[]).map(copyJ).toList();
  late DateTime start = store.clientById(widget.clientId)?.m('program')?.d('startedAt') ?? DateTime.now();
  static const _names = ['Adaptación', 'Hipertrofia', 'Fuerza', 'Descarga'];

  List<(String, String, J)> _sources(J c) => [
        if (c.m('routine') != null) ('__actual', 'Rutina actual: ${c.m('routine')!.s('name', 'sin nombre')}', c.m('routine')!),
        for (final tp in store.templates.where((x) => x.i('coachId') == store.meId)) (tp.s('id'), 'Plantilla: ${tp.s('name')}', tp),
      ];

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final c = store.clientById(widget.clientId) ?? {};
      final info = phaseInfo(c);
      final sources = _sources(c);
      final savedStart = c.m('program')?.d('startedAt');
      final dirty = !_same(phases.map((p) => {...p}..remove('source')).toList(), c.m('program')?.lm('phases') ?? const []) || (savedStart != null && dayKey(savedStart) != dayKey(start));
      var from = DateTime(start.year, start.month, start.day, 8);
      return PageList(children: [
        Section(
          title: 'Programa por fases',
          subtitle: 'Cada fase usa su propia rutina. Al terminar sus semanas, la siguiente pasa a ser la rutina actual sola.',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (info != null) ...[Align(alignment: Alignment.centerLeft, child: Pill('Fase ${info.index + 1} de ${info.total} · semana ${info.week} de ${info.weeks}', tone: 'info')), const Gap(12)],
            RowTile(
              leading: const IconBadge(Icons.event_rounded, tone: 'info'),
              title: 'Empieza el ${shortDate(start)}',
              subtitle: 'Toca para cambiar la fecha',
              onTap: () async {
                final d = await showDatePicker(context: context, initialDate: start, firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365)));
                if (d != null) setState(() => start = d);
              },
            ),
            if (phases.isEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text('Agrega la primera fase. Ej.: 4 semanas de hipertrofia y 4 de fuerza.', style: context.tt.bodySmall)),
          ]),
        ),
        for (final (i, p) in phases.indexed)
          () {
            final f = from;
            from = from.add(Duration(days: 7 * p.i('weeks', 1)));
            final to = from.subtract(const Duration(days: 1));
            final days = p.m('routine')?.lm('days') ?? const <J>[];
            return Panel(
              key: ValueKey(p.s('id')),
              color: info?.index == i ? t.accentSoft : null,
              border: info?.index == i ? t.accent.withValues(alpha: .5) : null,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Expanded(child: Text('FASE ${i + 1} · ${shortDate(f)} – ${shortDate(to)}', style: context.tt.labelSmall?.copyWith(letterSpacing: .6, fontWeight: FontWeight.w800, color: info?.index == i ? t.accent : t.muted))),
                  IconButton(onPressed: () => setState(() => phases.removeAt(i)), icon: const Icon(Icons.delete_outline_rounded), tooltip: 'Quitar fase ${i + 1}'),
                ]),
                TextFormField(initialValue: p.s('name'), maxLength: 60, decoration: const InputDecoration(hintText: 'Nombre de la fase', counterText: ''), onChanged: (v) => setState(() => p['name'] = v)),
                const Gap(10),
                Row(children: [
                  IconButton.filledTonal(onPressed: p.i('weeks', 1) > 1 ? () => setState(() => p['weeks'] = p.i('weeks', 1) - 1) : null, icon: const Icon(Icons.remove_rounded), tooltip: 'Menos semanas'),
                  Expanded(child: Text(plural(p.i('weeks', 1), 'semana', 'semanas'), textAlign: TextAlign.center, style: context.tt.titleSmall)),
                  IconButton.filledTonal(onPressed: p.i('weeks', 1) < 12 ? () => setState(() => p['weeks'] = p.i('weeks', 1) + 1) : null, icon: const Icon(Icons.add_rounded), tooltip: 'Más semanas'),
                ]),
                const Gap(10),
                DropdownButtonFormField<String>(
                  initialValue: sources.any((s) => s.$1 == p.sn('source')) ? p.s('source') : null,
                  isExpanded: true,
                  hint: Text(p.m('routine')?.s('name', 'Rutina guardada') ?? 'Rutina guardada', overflow: TextOverflow.ellipsis),
                  items: [for (final s in sources) DropdownMenuItem(value: s.$1, child: Text(s.$2, overflow: TextOverflow.ellipsis))],
                  onChanged: (v) {
                    final s = sources.where((x) => x.$1 == v).firstOrNull;
                    if (s != null) setState(() => phases[i] = {...p, 'routine': _stripIds(s.$3), 'source': s.$1});
                  },
                ),
                const Gap(6),
                Text('${plural(days.length, 'día', 'días')} · ${days.map((d) => d.s('name')).join(', ')}', style: context.tt.bodySmall),
              ]),
            );
          }(),
        Wrap(spacing: 10, runSpacing: 10, children: [
          if (phases.length < 8)
            OutlinedButton.icon(
              onPressed: () {
                if (sources.isEmpty) return toast(context, 'Primero crea una rutina o una plantilla', error: true);
                final s = sources.first;
                setState(() => phases.add({'id': store.newUid(), 'name': phases.length < 4 ? _names[phases.length] : 'Fase ${phases.length + 1}', 'weeks': 4, 'routine': _stripIds(s.$3), 'source': s.$1}));
              },
              icon: const Icon(Icons.add_rounded),
              label: const Text('Agregar fase'),
            ),
          if ((dirty || c['program'] == null) && phases.isNotEmpty)
            FilledButton(
              onPressed: () {
                if (phases.any((p) => p.s('name').trim().isEmpty)) return toast(context, 'Ponle nombre a cada fase', error: true);
                runAct(context, store.saveProgram(widget.clientId, {
                  'phases': [for (final p in phases) {...p}..remove('source')],
                  'startedAt': DateTime(start.year, start.month, start.day, 8).toUtc().toIso8601String(),
                }), 'Programa guardado: la fase en curso es su rutina actual');
              },
              child: const Text('Guardar programa'),
            ),
          if (c['program'] != null)
            TextButton(
              onPressed: () async {
                if (await runAct(context, store.saveProgram(widget.clientId, null), 'Programa quitado (su rutina actual se queda)') && mounted) setState(() => phases = []);
              },
              child: const Text('Quitar programa'),
            ),
        ]),
      ]);
    });
  }
}

/* ------------------------------------------------------------ Necesitan atención */
class AttentionList extends StatelessWidget {
  final List<Attention> items;
  final void Function(Attention a) onOpen;
  const AttentionList({super.key, required this.items, required this.onOpen});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    return Section(
      title: 'Necesitan atención',
      subtitle: items.isEmpty ? 'Todo en orden hoy' : plural(items.length, 'aviso', 'avisos'),
      child: items.isEmpty
          ? Text('Nadie se está quedando atrás. Buen trabajo.', style: context.tt.bodyMedium)
          : Column(children: [
              for (final a in items.take(8))
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => onOpen(a),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
                      child: Row(children: [
                        Container(width: 4, height: 38, decoration: BoxDecoration(color: a.level >= 3 ? t.bad : a.level == 2 ? t.warn : t.muted, borderRadius: BorderRadius.circular(4))),
                        const SizedBox(width: 10),
                        Avatar.of(store.userById(a.clientId) ?? {'name': a.name}, size: 36),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(a.name, style: context.tt.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                            Text(a.text, style: context.tt.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                          ]),
                        ),
                        Text(a.action, style: context.tt.labelMedium?.copyWith(color: t.accent, fontWeight: FontWeight.w800)),
                      ]),
                    ),
                  ),
                ),
            ]),
    );
  }
}

/* ------------------------------------------------------------ Automatizaciones y cobro en línea */
const _ruleDefs = [
  ('welcome', 'Dar la bienvenida', 'Cuando se une un asesorado nuevo', 'Le envía este mensaje por ti.'),
  ('checkin', 'Pedir el check-in semanal', 'El día de su check-in, desde la hora indicada', 'Aviso al celular si no lo envió en los últimos 5 días.'),
  ('inactive', 'Avisarme si deja de entrenar', 'Tras varios días sin entrenar', 'Te llega un aviso y aparece en «Necesitan atención».'),
  ('pr', 'Felicitar récords', 'Cuando hace un récord nuevo', 'Le escribe por ti con este mensaje y el récord.'),
  ('phase', 'Cambiar de fase', 'Al cumplirse las semanas de una fase', 'La siguiente fase pasa a ser su rutina y les avisa a los dos.'),
];
const _ruleDefaults = <String, J>{
  'welcome': {'on': true, 'text': '¡Bienvenido/a! Ya tienes acceso. Completa tu cuestionario de inicio para armar tu programa.'},
  'checkin': {'on': true, 'day': 0, 'hour': 18},
  'inactive': {'on': true, 'days': 4},
  'pr': {'on': true, 'text': '¡Nuevo récord! Así se progresa, sigue así.'},
  'phase': {'on': true},
};
const _periods = ['mes', 'trimestre', 'semestre', 'año', 'única'];

class AutomationsPage extends StatefulWidget {
  const AutomationsPage({super.key});
  @override
  State<AutomationsPage> createState() => _AutomationsPageState();
}

class _AutomationsPageState extends State<AutomationsPage> {
  late final Map<String, J> rules;
  late final TextEditingController link, label, instructions;
  late List<J> plans;

  @override
  void initState() {
    super.initState();
    final me = store.me ?? {};
    final saved = {for (final r in me.lm('automations')) r.s('kind'): r};
    rules = {for (final d in _ruleDefs) d.$1: {..._ruleDefaults[d.$1]!, ...?saved[d.$1], 'kind': d.$1}};
    final b = me.m('billing') ?? {};
    link = TextEditingController(text: b.s('payLink'));
    label = TextEditingController(text: b.s('payLabel'));
    instructions = TextEditingController(text: b.s('instructions'));
    plans = b.lm('plans').map(copyJ).toList();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    return Scaffold(
      appBar: AppBar(title: const Text('Automatizaciones')),
      body: PageList(padding: const EdgeInsets.fromLTRB(16, 8, 16, 40), children: [
        Text('Reglas «cuando pase X, hacer Y» que trabajan por ti.', style: context.tt.bodyMedium),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final (i, (kind, title, whenTxt, desc)) in _ruleDefs.indexed) ...[
              if (i > 0) const Divider(height: 24),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(whenTxt.toUpperCase(), style: context.tt.labelSmall?.copyWith(color: t.accent, fontWeight: FontWeight.w800, letterSpacing: .5)),
                    const Gap(3),
                    Text(title, style: context.tt.titleSmall),
                    Text(desc, style: context.tt.bodySmall),
                  ]),
                ),
                Switch(value: rules[kind]!.b('on'), onChanged: (v) => setState(() => rules[kind]!['on'] = v)),
              ]),
              if (rules[kind]!.b('on')) ...[
                if (rules[kind]!.containsKey('text')) ...[
                  const Gap(8),
                  TextFormField(initialValue: rules[kind]!.s('text'), maxLines: 2, maxLength: 400, decoration: const InputDecoration(counterText: ''), onChanged: (v) => rules[kind]!['text'] = v),
                ],
                if (kind == 'checkin') ...[
                  const Gap(8),
                  Row(children: [
                    Text('Desde las', style: context.tt.bodyMedium),
                    const SizedBox(width: 10),
                    DropdownButton<int>(
                      value: rules[kind]!.i('hour', 18),
                      items: [for (var h = 6; h <= 21; h++) DropdownMenuItem(value: h, child: Text('$h:00'))],
                      onChanged: (v) => setState(() => rules[kind]!['hour'] = v),
                    ),
                  ]),
                ],
                if (kind == 'inactive') ...[
                  const Gap(8),
                  Row(children: [
                    Text('Después de', style: context.tt.bodyMedium),
                    const SizedBox(width: 10),
                    DropdownButton<int>(
                      value: [2, 3, 4, 5, 7, 10, 14].contains(rules[kind]!.i('days', 4)) ? rules[kind]!.i('days', 4) : 4,
                      items: [for (final d in [2, 3, 4, 5, 7, 10, 14]) DropdownMenuItem(value: d, child: Text('$d días'))],
                      onChanged: (v) => setState(() => rules[kind]!['days'] = v),
                    ),
                  ]),
                ],
              ],
            ],
            const Gap(16),
            FilledButton(onPressed: () => runAct(context, store.saveAutomations(rules.values.toList()), 'Automatizaciones guardadas'), child: const Text('Guardar reglas')),
          ]),
        ),
        Section(
          title: 'Cobro en línea',
          subtitle: 'Pega tu enlace de pago (PayPhone, PayPal, Kushki, DeUna u otro). Tus asesorados verán «Pagar en línea» en cada cobro y podrán avisarte con su comprobante.',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Field('Enlace de pago', controller: link, hint: 'https://...', keyboard: TextInputType.url, helper: 'Debe empezar con https://'),
            const Gap(12),
            Field('Nombre del medio', controller: label, hint: 'PayPhone', maxLength: 40),
            const Gap(12),
            Field('Indicaciones para transferencia (opcional)', controller: instructions, maxLines: 3, maxLength: 600, hint: 'Banco · tipo y número de cuenta · a nombre de…'),
            const Gap(16),
            Text('Tus planes', style: context.tt.titleMedium),
            const Gap(8),
            for (final (i, p) in plans.indexed)
              Padding(
                key: ValueKey(p.s('id')),
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  Expanded(flex: 3, child: TextFormField(initialValue: p.s('name'), maxLength: 60, decoration: const InputDecoration(hintText: 'Online', counterText: ''), onChanged: (v) => p['name'] = v)),
                  const SizedBox(width: 6),
                  Expanded(flex: 2, child: TextFormField(initialValue: p.n('price') > 0 ? _fmt(p.n('price')) : '', keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(prefixText: '\$ '), onChanged: (v) => p['price'] = numOf(v))),
                  const SizedBox(width: 6),
                  DropdownButton<String>(
                    value: _periods.contains(p.s('period')) ? p.s('period') : 'mes',
                    items: [for (final x in _periods) DropdownMenuItem(value: x, child: Text(x == 'única' ? 'única' : '/$x'))],
                    onChanged: (v) => setState(() => p['period'] = v),
                  ),
                  IconButton(onPressed: () => setState(() => plans.removeAt(i)), icon: const Icon(Icons.delete_outline_rounded), tooltip: 'Quitar'),
                ]),
              ),
            if (plans.length < 8)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(onPressed: () => setState(() => plans.add({'id': store.newUid(), 'name': '', 'price': 0, 'period': 'mes'})), icon: const Icon(Icons.add_rounded), label: const Text('Agregar plan')),
              ),
            const Gap(8),
            FilledButton(
              onPressed: () {
                final l = link.text.trim();
                if (l.isNotEmpty && !RegExp(r'^https://\S+$').hasMatch(l)) return toast(context, 'El enlace de pago debe empezar con https://', error: true);
                if (plans.any((p) => p.s('name').trim().isEmpty)) return toast(context, 'Ponle nombre a cada plan', error: true);
                runAct(context, store.saveBilling({
                  'payLink': l, 'payLabel': label.text.trim(), 'instructions': instructions.text.trim(),
                  'plans': [for (final p in plans) {'id': p.s('id'), 'name': p.s('name').trim(), 'price': p.n('price'), 'period': _periods.contains(p.s('period')) ? p.s('period') : 'mes'}],
                }), 'Cobro en línea guardado');
              },
              child: const Text('Guardar cobro en línea'),
            ),
          ]),
        ),
      ]),
    );
  }
}

/// Atajo para la lista de clientes: % de cumplimiento a 30 días con su color.
Widget compliancePill(BuildContext context, J c) {
  final p = compliance(c, store.workoutsAll, 30);
  if (p == null) return const SizedBox.shrink();
  return Pill('$p%', tone: complianceTone(p), small: true);
}

Future<void> openAutomations(BuildContext context) => push(context, const AutomationsPage());
