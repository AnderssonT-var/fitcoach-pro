// Progreso: historial de sesiones, gráficas semanales, peso, récords y músculos.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/catalog.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../core/techniques.dart';
import '../../ui/charts.dart';
import '../../ui/muscle_map.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class DiffBar extends StatelessWidget {
  final int v;
  const DiffBar(this.v, {super.key});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final c = {1: t.ok, 2: t.ok, 3: t.accent, 4: t.warn, 5: t.bad}[v] ?? t.muted;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 1; i <= 5; i++)
        Container(width: 4, height: 6.0 + i * 2, margin: const EdgeInsets.only(right: 2), decoration: BoxDecoration(color: i <= v ? c : t.surface3, borderRadius: BorderRadius.circular(2))),
      const SizedBox(width: 6),
      Text(v >= 1 && v <= 5 ? difficultyLevels[v - 1].$2 : '', style: context.tt.labelMedium?.copyWith(color: t.ink2)),
    ]);
  }
}

/// Lista de entrenamientos con detalle por serie al tocar.
class SessionList extends StatefulWidget {
  final List<J> sessions;
  final bool showClient;
  final int? limit;
  final void Function(int clientId)? onReply;
  const SessionList({super.key, required this.sessions, this.showClient = false, this.limit, this.onReply});
  @override
  State<SessionList> createState() => _SessionListState();
}

class _SessionListState extends State<SessionList> {
  String? open;
  int shown = 20;

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final all = widget.sessions;
    final list = all.take(widget.limit ?? shown).toList();
    if (list.isEmpty) return Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text('Aún no hay entrenamientos registrados.', style: context.tt.bodyMedium));
    return Column(children: [
      for (final (i, w) in list.indexed) ...[
        if (i > 0) const Divider(height: 1),
        _row(context, t, w),
      ],
      if (widget.limit == null && all.length > shown)
        TextButton(onPressed: () => setState(() => shown += 20), child: Text('Ver más (${all.length - shown})')),
    ]);
  }

  Widget _row(BuildContext context, Tok t, J w) {
    final isOpen = open == w.s('id');
    final u = store.userById(w.i('clientId'));
    final f = w.d('finishedAt');
    final prs = w.lm('prs');
    final ss = supersets(w.lm('exercises').map((e) => e.m('target') ?? <String, dynamic>{}).toList());
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      InkWell(
        onTap: () => setState(() => open = isOpen ? null : w.s('id')),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(children: [
            if (widget.showClient && u != null) ...[Avatar.of(u, size: 36), const SizedBox(width: 10)],
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text.rich(TextSpan(children: [
                  TextSpan(text: '${widget.showClient && u != null ? '${firstName(u.s('name'))} · ' : ''}${w.s('dayName')}'),
                  if (prs.isNotEmpty) TextSpan(text: '  🏆 ${prs.length}', style: TextStyle(color: t.gold)),
                ]), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall),
                const Gap(2),
                Text(
                  '${widget.showClient ? ago(f) : (f != null ? weekdayDate(f) : '')} · ${clock(w.n('durationSec'))} · ${AppStore.doneSetCount(w)} series · ${tons(AppStore.sessionVolume(w))}',
                  style: context.tt.bodySmall,
                ),
              ]),
            ),
            if (w.i('difficulty') > 0) Padding(padding: const EdgeInsets.only(left: 8), child: DiffBar(w.i('difficulty'))),
            Icon(isOpen ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: t.muted),
          ]),
        ),
      ),
      if (w.s('comment').isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(14)),
                child: Text('“${w.s('comment')}”', style: context.tt.bodyMedium?.copyWith(fontStyle: FontStyle.italic)),
              ),
            ),
            if (widget.onReply != null) TextButton(onPressed: () => widget.onReply!(w.i('clientId')), child: const Text('Responder')),
          ]),
        ),
      if (isOpen)
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (w.b('summary')) Text('El detalle por serie se muestra para los últimos 4 meses (queda guardado completo).', style: context.tt.bodySmall),
            for (final (i, e) in w.lm('exercises').indexed)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    if (ss[i] != null) SsTag('${ss[i]!.letter}${ss[i]!.pos}'),
                    Text(store.exerciseById(e.i('exId')).s('name'), style: context.tt.titleSmall),
                    if (e.m('target')?.m('drop') != null) const Pill('Drop set', tone: 'warn', small: true),
                    if (e.m('target')?.m('effort') != null) Pill(effortLabel(e.m('target')!.m('effort')), tone: 'info', small: true),
                    if (e.m('target')?.sn('tempo') != null) Pill('Tempo ${e.m('target')!.s('tempo')}', small: true),
                  ]),
                  const Gap(6),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final x in e.lm('sets'))
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                        decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(9)),
                        child: Text(x.lm('drops').isNotEmpty ? setText(x) : '${kg(x.n('weight'))} × ${x.s('reps')}',
                            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: x.b('done') ? t.ink : t.muted, decoration: x.b('done') ? null : TextDecoration.lineThrough)),
                      ),
                    if (w.lm('prs').any((p) => p.i('exId') == e.i('exId'))) const Pill('Récord', tone: 'warn', icon: Icons.emoji_events_rounded, small: true),
                  ]),
                ]),
              ),
          ]),
        ),
    ]);
  }
}

class SsTag extends StatelessWidget {
  final String text;
  const SsTag(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(color: context.tok.accent, borderRadius: BorderRadius.circular(7)),
        child: Text(text, style: TextStyle(color: context.tok.onAccent, fontWeight: FontWeight.w800, fontSize: 11.5)),
      );
}

/* ------------------------------------------------------------ Series semanales */
List<(String, int, double)> weeklySeries(int clientId, [int n = 8]) {
  final mon = weekStart(DateTime.now());
  final ws = store.workoutsOf(clientId);
  return List.generate(n, (i) {
    final from = addDays(mon, -7 * (n - 1 - i));
    final to = addDays(from, 7);
    final inWeek = ws.where((w) {
      final f = w.d('finishedAt');
      return f != null && !f.isBefore(from) && f.isBefore(to);
    });
    return (i == n - 1 ? 'Esta' : '${from.day}/${from.month}', inWeek.length, inWeek.fold<double>(0, (t, w) => t + AppStore.sessionVolume(w)));
  });
}

class AdherenceChart extends StatelessWidget {
  final int clientId;
  const AdherenceChart(this.clientId, {super.key});
  @override
  Widget build(BuildContext context) {
    final goal = store.clientById(clientId)?.m('routine')?.i('frequency');
    return Section(
      title: 'Entrenamientos por semana',
      subtitle: goal != null && goal > 0 ? 'Meta: $goal por semana' : null,
      child: BarSeries(data: [for (final w in weeklySeries(clientId)) (w.$1, w.$2.toDouble())], format: (v) => v.toInt().toString(), goal: goal?.toDouble()),
    );
  }
}

class VolumeChart extends StatelessWidget {
  final int clientId;
  const VolumeChart(this.clientId, {super.key});
  @override
  Widget build(BuildContext context) => Section(
        title: 'Volumen por semana',
        subtitle: 'Kilos levantados',
        child: BarSeries(data: [for (final w in weeklySeries(clientId)) (w.$1, w.$3)], format: (v) => v >= 1000 ? '${(v / 1000).toStringAsFixed(1).replaceAll('.', ',')}t' : kg(v)),
      );
}

class WeightChart extends StatelessWidget {
  final int clientId;
  final Widget? action;
  const WeightChart(this.clientId, {super.key, this.action});
  @override
  Widget build(BuildContext context) {
    final c = store.clientById(clientId);
    final ws = c?.lm('weights') ?? const <J>[];
    final pts = ws.skip(math.max(0, ws.length - 10)).map((w) => (shortDate(w.d('date')), w.n('kg'))).toList();
    final delta = pts.length > 1 ? pts.last.$2 - pts.first.$2 : 0.0;
    return Section(
      title: 'Peso corporal',
      subtitle: pts.length > 1 ? '${delta > 0 ? '+' : ''}${kg(delta)} kg en ${pts.length} registros' : null,
      trailing: action,
      child: pts.length > 1
          ? LineSeries(points: pts, format: (v) => kg((v * 10).round() / 10))
          : Text(pts.isNotEmpty ? 'Último registro: ${kg(pts.first.$2)} kg. La curva aparece con dos registros o más.' : 'Sin registros de peso todavía.', style: context.tt.bodyMedium),
    );
  }
}

class Records extends StatelessWidget {
  final int clientId;
  const Records(this.clientId, {super.key});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final ws = store.workoutsOf(clientId);
    final bests = store.clientById(clientId)?.m('bests') ?? {};
    final ids = {...bests.keys.map(int.tryParse).whereType<int>(), ...ws.expand((w) => w.lm('exercises').map((e) => e.i('exId')))};
    final rows = <(int, J, double)>[];
    for (final id in ids) {
      final best = store.bestSet(clientId, id);
      if (best == null || best.n('weight') <= 0) continue;
      double firstTop = best.nn('first') ?? 0;
      if (best['first'] == null) {
        for (final w in ws.reversed) {
          final e = w.lm('exercises').where((x) => x.i('exId') == id).firstOrNull;
          if (e != null) {
            final done = e.lm('sets').where((x) => x.b('done')).map((x) => x.n('weight'));
            firstTop = done.isEmpty ? 0 : done.reduce(math.max);
            break;
          }
        }
      }
      rows.add((id, best, best.n('weight') - firstTop));
    }
    rows.sort((a, b) => b.$2.n('weight').compareTo(a.$2.n('weight')));
    return Section(
      title: 'Récords personales',
      trailing: Icon(Icons.emoji_events_rounded, color: t.gold),
      child: rows.isEmpty
          ? Text('Aparecerán cuando registre entrenamientos con peso.', style: context.tt.bodyMedium)
          : Column(children: [
              for (final (i, (id, best, gain)) in rows.take(12).indexed) ...[
                if (i > 0) const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(store.exerciseById(id).s('name'), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall),
                        Text(shortDate(best.d('at')), style: context.tt.bodySmall),
                      ]),
                    ),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text.rich(TextSpan(children: [
                        TextSpan(text: '${kg(best.n('weight'))} kg', style: context.tt.titleLarge),
                        TextSpan(text: ' × ${kg(best.n('reps'))}', style: context.tt.bodySmall),
                      ])),
                      if (gain > 0) Text('+${kg(gain)} kg desde el inicio', style: TextStyle(color: t.ok, fontWeight: FontWeight.w700, fontSize: 12)),
                    ]),
                  ]),
                ),
              ],
            ]),
    );
  }
}

/// Resumen rápido de un asesorado.
class QuickStats {
  final int total, week, goal, month, avgMin;
  final double monthVolume;
  QuickStats(this.total, this.week, this.goal, this.month, this.avgMin, this.monthVolume);
  factory QuickStats.of(int clientId) {
    final ws = store.workoutsOf(clientId);
    final c = store.clientById(clientId);
    final now = DateTime.now();
    final month = ws.where((w) {
      final f = w.d('finishedAt');
      return f != null && f.month == now.month && f.year == now.year;
    }).toList();
    final avg = ws.isEmpty ? 0 : (ws.fold<double>(0, (t, w) => t + w.n('durationSec')) / ws.length / 60).round();
    return QuickStats(ws.length, store.weekCount(clientId), c?.m('routine')?.i('frequency') ?? 0, month.length, avg, month.fold(0, (t, w) => t + AppStore.sessionVolume(w)));
  }
}

/* ------------------------------------------------------------ Músculos trabajados */
class MuscleVolume extends StatefulWidget {
  final Map<String, double> sets;
  final String? body;
  final bool showZone;
  const MuscleVolume({super.key, required this.sets, this.body, this.showZone = true});
  @override
  State<MuscleVolume> createState() => _MuscleVolumeState();
}

class _MuscleVolumeState extends State<MuscleVolume> {
  String? focus;
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final sets = widget.sets;
    final list = allMuscles.where((m) => (sets[m] ?? 0) > 0).toList()..sort((a, b) => sets[b]!.compareTo(sets[a]!));
    final maxV = math.max(24.0, list.isEmpty ? 0 : sets[list.first]!);
    final heat = sets.map((k, v) => MapEntry(k, levelOf(weekLevels, v)));
    final missing = keyMuscles.where((m) => (sets[m] ?? 0) <= 0).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      MuscleMap(
        body: widget.body,
        heat: heat,
        selected: focus == null ? const [] : [focus!],
        onSelect: (m) => setState(() => focus = focus == m ? null : m),
        describe: (m) => (sets[m] ?? 0) > 0 ? '${fmtSets(sets[m]!)}/sem' : 'sin series',
        height: 250,
        bodyToggle: true,
        hint: 'Toca un músculo para ver sus series',
      ),
      const Gap(8),
      HeatScale(levels: [for (final l in weekLevels) (l.lv, l.label)], unit: 'Series por semana'),
      const Gap(14),
      for (final m in list)
        InkWell(
          onTap: () => setState(() => focus = focus == m ? null : m),
          child: Opacity(
            opacity: focus != null && focus != m ? .45 : 1,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(children: [
                SizedBox(width: 108, child: Text(muscleName(m), style: context.tt.bodyMedium?.copyWith(color: t.ink, fontWeight: focus == m ? FontWeight.w700 : FontWeight.w500))),
                Expanded(
                  child: LayoutBuilder(builder: (ctx, box) {
                    final w = box.maxWidth;
                    return Stack(children: [
                      Container(height: 10, decoration: BoxDecoration(color: t.surface3, borderRadius: BorderRadius.circular(6))),
                      if (widget.showZone)
                        Positioned(left: w * 10 / maxV, width: w * 10 / maxV, top: 0, bottom: 0, child: Container(height: 10, decoration: BoxDecoration(border: Border.symmetric(vertical: BorderSide(color: t.ok.withValues(alpha: .8), width: 1.2))))),
                      Container(height: 10, width: math.max(4, w * sets[m]! / maxV), decoration: BoxDecoration(color: heatColor(context, math.max(1, levelOf(weekLevels, sets[m]!))), borderRadius: BorderRadius.circular(6))),
                    ]);
                  }),
                ),
                SizedBox(width: 38, child: Text(((sets[m]! * 2).round() / 2).toString().replaceAll('.0', '').replaceAll('.', ','), textAlign: TextAlign.right, style: context.tt.labelLarge)),
              ]),
            ),
          ),
        ),
      if (widget.showZone) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Las líneas verdes marcan 10–20 series semanales, el rango que suele recomendarse para ganar músculo. Los ejercicios secundarios cuentan media serie.', style: context.tt.bodySmall)),
      if (missing.isNotEmpty) ...[
        const Gap(10),
        Text('Sin trabajar', style: context.tt.titleSmall),
        const Gap(6),
        Wrap(spacing: 6, runSpacing: 6, children: [for (final m in missing) Pill(muscleName(m))]),
      ],
    ]);
  }
}

class MuscleLoadPanel extends StatefulWidget {
  final int clientId;
  const MuscleLoadPanel(this.clientId, {super.key});
  @override
  State<MuscleLoadPanel> createState() => _MuscleLoadPanelState();
}

class _MuscleLoadPanelState extends State<MuscleLoadPanel> {
  int days = 7;
  @override
  Widget build(BuildContext context) {
    final data = muscleSets(store.exerciseById, store.workoutsOf(widget.clientId), days);
    return Section(
      title: 'Músculos trabajados',
      subtitle: '${plural(data.sessions, 'entrenamiento', 'entrenamientos')} ${days == 7 ? 'en los últimos 7 días' : 'en 30 días · promedio semanal'}',
      trailing: SegmentedButton<int>(
        showSelectedIcon: false,
        segments: const [ButtonSegment(value: 7, label: Text('7 d')), ButtonSegment(value: 30, label: Text('30 d'))],
        selected: {days},
        onSelectionChanged: (v) => setState(() => days = v.first),
      ),
      child: data.perWeek.isEmpty
          ? const EmptyState(icon: Icons.accessibility_new_rounded, title: 'Sin entrenamientos en este periodo', text: 'El mapa se colorea con cada serie que se registra.')
          : MuscleVolume(sets: data.perWeek, body: store.userById(widget.clientId)?.sn('body')),
    );
  }
}
