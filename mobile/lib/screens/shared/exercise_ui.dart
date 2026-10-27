// Ejercicios: miniatura, ficha con técnica animada y filtros de la biblioteca.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/catalog.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/muscle_map.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

String? exerciseImage(J ex, [int frame = 0]) => ex.sn('photo') ?? exerciseAsset(ex, frame);

class ExThumb extends StatelessWidget {
  final J ex;
  final double w, h;
  final bool done;
  const ExThumb(this.ex, {super.key, this.w = 64, this.h = 48, this.done = false});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final img = exerciseImage(ex);
    return Stack(clipBehavior: Clip.none, children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: w, height: h, color: t.dark ? const Color(0xFFE9EAEE) : t.surface3,
          child: img != null ? SmartImage(img, width: w, height: h) : Icon(Icons.fitness_center_rounded, color: t.muted, size: h * .45),
        ),
      ),
      if (done)
        Positioned(
          right: -5, bottom: -5,
          child: Container(
            width: 22, height: 22,
            decoration: BoxDecoration(color: t.ok, shape: BoxShape.circle, border: Border.all(color: t.surface, width: 2)),
            child: const Icon(Icons.check_rounded, size: 13, color: Colors.white),
          ),
        ),
    ]);
  }
}

/// Ficha del ejercicio con fotos de inicio y final que se alternan.
Future<void> showExercise(BuildContext context, J ex, {String? coachName, Widget Function(BuildContext)? footer}) {
  return showSheet(context, title: ex.s('name'), full: true, footer: footer, builder: (_) => _ExerciseDetail(ex: ex, coachName: coachName));
}

class _ExerciseDetail extends StatefulWidget {
  final J ex;
  final String? coachName;
  const _ExerciseDetail({required this.ex, this.coachName});
  @override
  State<_ExerciseDetail> createState() => _ExerciseDetailState();
}

class _ExerciseDetailState extends State<_ExerciseDetail> {
  int frame = 0;
  bool play = true;
  Timer? timer;
  late final List<String> frames;

  @override
  void initState() {
    super.initState();
    frames = {exerciseImage(widget.ex, 0), exerciseImage(widget.ex, 1)}.whereType<String>().toList();
    timer = Timer.periodic(const Duration(milliseconds: 1100), (_) {
      if (play && frames.length > 1 && mounted) setState(() => frame = (frame + 1) % frames.length);
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ex = widget.ex;
    final t = context.tok;
    final steps = ex.l('steps').map((e) => e.toString()).toList();
    final pri = ex.l('primary').map((e) => e.toString()).toList(), sec = ex.l('secondary').map((e) => e.toString()).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (frames.isNotEmpty)
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: AspectRatio(
            aspectRatio: 4 / 3,
            child: Container(
              color: const Color(0xFFF2F3F6),
              child: AnimatedSwitcher(duration: const Duration(milliseconds: 260), child: SmartImage(frames[frame], key: ValueKey(frame), fit: BoxFit.contain)),
            ),
          ),
        ),
      if (frames.length > 1)
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Row(children: [
            SegmentedButton<int>(
              showSelectedIcon: false,
              segments: const [ButtonSegment(value: 0, label: Text('Inicio')), ButtonSegment(value: 1, label: Text('Final'))],
              selected: play ? {} : {frame},
              emptySelectionAllowed: true,
              onSelectionChanged: (v) => setState(() {
                play = false;
                if (v.isNotEmpty) frame = v.first;
              }),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: () => setState(() => play = !play),
              icon: Icon(play ? Icons.pause_rounded : Icons.play_arrow_rounded),
              label: Text(play ? 'Pausar' : 'Animar'),
            ),
          ]),
        ),
      const Gap(12),
      Wrap(spacing: 6, runSpacing: 6, children: [
        if (ex.s('muscle').isNotEmpty) Pill(ex.s('muscle'), tone: 'info'),
        if (ex.s('equipment').isNotEmpty) Pill(ex.s('equipment')),
        if (ex.s('level').isNotEmpty) Pill(ex.s('level'), tone: levelTone(ex.s('level'))),
      ]),
      if (ex['sets'] != null || ex['reps'] != null)
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Text('Sugerido: ${ex.s('sets')} × ${ex.s('reps')} · descanso ${clock(parseRest(ex['rest']))}', style: context.tt.bodySmall),
        ),
      const Gap(16),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(20)),
        child: Column(children: [
          MuscleMap(primary: pri, secondary: sec, height: 230, bodyToggle: true, background: t.surface2),
          MuscleLegend(primary: pri, secondary: sec),
        ]),
      ),
      if (steps.isNotEmpty) ...[
        const Gap(18),
        Text('Cómo se hace', style: context.tt.titleLarge),
        const Gap(8),
        for (final (i, s) in steps.indexed)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 26, height: 26, alignment: Alignment.center,
                decoration: BoxDecoration(color: t.accentSoft, shape: BoxShape.circle),
                child: Text('${i + 1}', style: TextStyle(color: t.accent, fontWeight: FontWeight.w800, fontSize: 13)),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(s, style: context.tt.bodyMedium?.copyWith(color: t.ink))),
            ]),
          ),
      ],
      if (ex.s('cues').isNotEmpty) ...[
        const Gap(6),
        NoteBox(icon: Icons.sticky_note_2_rounded, child: Text.rich(TextSpan(children: [
          TextSpan(text: '${widget.coachName ?? 'Consejo'}: ', style: const TextStyle(fontWeight: FontWeight.w700)),
          TextSpan(text: ex.s('cues')),
        ]))),
      ],
      if (ex['coachId'] == null) Padding(padding: const EdgeInsets.only(top: 12), child: Text('Imágenes: Free Exercise DB (dominio público).', style: context.tt.bodySmall)),
    ]);
  }
}

String levelTone(String l) => switch (l) { 'Principiante' => 'ok', 'Intermedio' => 'info', 'Avanzado' => 'warn', _ => '' };

/* ------------------------------------------------------------ Filtros */
class ExFilters extends ChangeNotifier {
  String q = '', group = 'Todos', equipment = '', level = '', muscle = '';
  bool mine = false;
  void set(void Function(ExFilters f) fn) {
    fn(this);
    notifyListeners();
  }

  List<J> apply(List<J> list, int coachId) {
    final nq = normalize(q.trim());
    final base = list.where((e) {
      if (nq.isNotEmpty && !normalize('${e.s('name')} ${e.s('muscle')} ${e.s('equipment')} ${e.l('primary').map((m) => muscleName('$m')).join(' ')}').contains(nq)) return false;
      if (equipment.isNotEmpty && e.s('equipment') != equipment) return false;
      if (level.isNotEmpty && e.s('level') != level) return false;
      if (mine && e.inn('coachId') != coachId) return false;
      if (muscle.isNotEmpty && !e.l('primary').contains(muscle)) return false;
      return true;
    }).toList();
    _base = base;
    final shown = base.where((e) => group == 'Todos' || e.s('muscle') == group).toList()..sort((a, b) => normalize(a.s('name')).compareTo(normalize(b.s('name'))));
    return shown;
  }

  List<J> _base = const [];
  List<(String, int)> groupsOf(List<J> list) {
    final extra = list.map((e) => e.s('muscle')).toSet().where((g) => g.isNotEmpty && !groups.contains(g));
    return [
      ('Todos', _base.length),
      for (final g in [...groups, ...extra]) (g, _base.where((e) => e.s('muscle') == g).length),
    ].where((x) => x.$1 == 'Todos' || x.$2 > 0 || x.$1 == group).toList();
  }
}

class ExFilterBar extends StatefulWidget {
  final ExFilters f;
  final List<J> list;
  final bool showMine;
  const ExFilterBar({super.key, required this.f, required this.list, this.showMine = false});
  @override
  State<ExFilterBar> createState() => _ExFilterBarState();
}

class _ExFilterBarState extends State<ExFilterBar> {
  bool body = false;
  late final TextEditingController q = TextEditingController(text: widget.f.q);

  @override
  Widget build(BuildContext context) {
    final f = widget.f;
    final t = context.tok;
    final equip = widget.list.map((e) => e.s('equipment')).where((e) => e.isNotEmpty).toSet().toList()..sort();
    final counts = <String, int>{};
    for (final e in widget.list) {
      for (final m in e.l('primary')) {
        counts['$m'] = (counts['$m'] ?? 0) + 1;
      }
    }
    final active = f.equipment.isNotEmpty || f.level.isNotEmpty || f.mine || f.q.isNotEmpty || f.muscle.isNotEmpty;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TextField(
        controller: q,
        decoration: InputDecoration(
          hintText: 'Buscar por nombre o músculo',
          prefixIcon: const Icon(Icons.search_rounded),
          suffixIcon: f.q.isNotEmpty ? IconButton(icon: const Icon(Icons.close_rounded), onPressed: () {
            q.clear();
            f.set((x) => x.q = '');
          }) : null,
        ),
        onChanged: (v) => f.set((x) => x.q = v),
      ),
      const Gap(10),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          _Drop(
            label: f.equipment.isEmpty ? 'Equipo' : f.equipment,
            on: f.equipment.isNotEmpty,
            items: ['', ...equip],
            itemLabel: (e) => e.isEmpty ? 'Todo el equipo' : e,
            onPick: (v) => f.set((x) => x.equipment = v),
          ),
          const SizedBox(width: 8),
          _Drop(
            label: f.level.isEmpty ? 'Nivel' : f.level,
            on: f.level.isNotEmpty,
            items: const ['', ...levels],
            itemLabel: (e) => e.isEmpty ? 'Todos los niveles' : e,
            onPick: (v) => f.set((x) => x.level = v),
          ),
          const SizedBox(width: 8),
          FilterChip(
            label: const Text('Por músculo'),
            avatar: Icon(Icons.accessibility_new_rounded, size: 17, color: body || f.muscle.isNotEmpty ? t.accent : t.ink2),
            selected: body || f.muscle.isNotEmpty,
            showCheckmark: false,
            onSelected: (_) => setState(() => body = !body),
          ),
          if (widget.showMine) ...[
            const SizedBox(width: 8),
            FilterChip(label: const Text('Solo míos'), selected: f.mine, showCheckmark: false, onSelected: (v) => f.set((x) => x.mine = v)),
          ],
          if (active) ...[
            const SizedBox(width: 4),
            TextButton(onPressed: () {
              q.clear();
              f.set((x) {
                x.q = '';
                x.equipment = '';
                x.level = '';
                x.mine = false;
                x.muscle = '';
              });
            }, child: const Text('Limpiar')),
          ],
        ]),
      ),
      if (body)
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Panel(
            padding: const EdgeInsets.all(12),
            child: MuscleMap(
              selected: f.muscle.isEmpty ? const [] : [f.muscle],
              onSelect: (m) => f.set((x) {
                x.muscle = x.muscle == m ? '' : m;
                x.group = 'Todos';
              }),
              describe: (m) => '${counts[m] ?? 0} ejercicios',
              height: 230,
              bodyToggle: true,
              hint: f.muscle.isEmpty ? 'Toca un músculo para ver sus ejercicios' : null,
            ),
          ),
        ),
      if (f.muscle.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Row(children: [
            Text('Músculo principal: ', style: context.tt.bodySmall),
            InputChip(label: Text(muscleName(f.muscle)), onDeleted: () => f.set((x) => x.muscle = ''), selected: true, showCheckmark: false),
          ]),
        ),
      const Gap(10),
      ChoiceRow<String>(scroll: true, options: [for (final (g, n) in f.groupsOf(widget.list)) (g, '$g  $n')], value: f.group, onChanged: (v) => f.set((x) => x.group = v)),
    ]);
  }
}

class _Drop extends StatelessWidget {
  final String label;
  final bool on;
  final List<String> items;
  final String Function(String) itemLabel;
  final ValueChanged<String> onPick;
  const _Drop({required this.label, required this.on, required this.items, required this.itemLabel, required this.onPick});
  @override
  Widget build(BuildContext context) => PopupMenuButton<String>(
        onSelected: onPick,
        itemBuilder: (_) => [for (final i in items) PopupMenuItem(value: i, child: Text(itemLabel(i)))],
        child: Chip(
          label: Row(mainAxisSize: MainAxisSize.min, children: [Text(label), const Icon(Icons.expand_more_rounded, size: 18)]),
          backgroundColor: on ? context.tok.accentSoft : null,
        ),
      );
}

/// Tarjeta de ejercicio para la biblioteca y el selector.
class ExTile extends StatelessWidget {
  final J ex;
  final VoidCallback onOpen;
  final Widget? action;
  const ExTile({super.key, required this.ex, required this.onOpen, this.action});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final img = exerciseImage(ex);
    return Panel(
      padding: EdgeInsets.zero,
      radius: 20,
      onTap: onOpen,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        AspectRatio(
          aspectRatio: 4 / 3,
          child: Stack(fit: StackFit.expand, children: [
            Container(
              color: img != null ? const Color(0xFFF2F3F6) : t.surface2,
              child: img != null
                  ? SmartImage(img, fit: BoxFit.cover)
                  : Center(child: MuscleMap(primary: ex.l('primary').map((e) => '$e').toList(), secondary: ex.l('secondary').map((e) => '$e').toList(), height: 92, showCaption: false, background: t.surface2)),
            ),
            if (ex.inn('coachId') != null)
              Positioned(top: 8, left: 8, child: Pill('Tuyo', tone: 'info', small: true)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(ex.s('name'), maxLines: 2, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall?.copyWith(height: 1.25)),
            const Gap(2),
            Text('${ex.s('muscle')} · ${ex.s('equipment')}', maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.bodySmall),
            if (action != null) ...[const Gap(8), action!],
          ]),
        ),
      ]),
    );
  }
}

/// Lista de ejercicios disponibles para el entrenador (biblioteca + los suyos).
List<J> coachExercises() => store.exercises.where((e) => e.inn('coachId') == null || e.inn('coachId') == store.meId).toList();
