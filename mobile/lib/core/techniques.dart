// Técnicas de rutina (superseries, drop sets, RIR/RPE, tempo), plan de prueba
// y cálculo de series por músculo. Misma lógica que la app web.
import 'dart:math' as math;

import 'format.dart';
import 'json.dart';

/* ---------------- Intensidad y tempo ---------------- */
const rirValues = [0, 1, 2, 3, 4, 5];
const rpeValues = [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0];
final tempoRe = RegExp(r'^[0-9X]{1,2}(-[0-9X]{1,2}){2,3}$', caseSensitive: false);

String _dec(num v) => (v % 1 == 0 ? v.toInt().toString() : v.toString()).replaceAll('.', ',');

String effortLabel(J? e) {
  if (e == null) return '';
  final t = e.s('type');
  if (t == 'rir') return 'RIR ${_dec(e.n('value'))}';
  if (t == 'rpe') return 'RPE ${_dec(e.n('value'))}';
  return '';
}

String effortHelp(J? e) {
  if (e == null) return '';
  final t = e.s('type');
  final v = e.n('value');
  if (t == 'rir') return 'Termina cada serie dejando ${_dec(v)} ${v == 1 ? 'repetición' : 'repeticiones'} en reserva.';
  if (t == 'rpe') return 'Esfuerzo percibido ${_dec(v)} de 10.';
  return '';
}

String tempoHelp(String? t) {
  if (t == null || t.isEmpty) return '';
  final p = t.split('-');
  String s(String v) => v.toUpperCase().contains('X') ? 'explosivo' : '$v s';
  final b = StringBuffer('Bajada ${s(p[0])}');
  if (p.length > 1) b.write(' · pausa ${s(p[1])}');
  if (p.length > 2) b.write(' · subida ${s(p[2])}');
  if (p.length > 3) b.write(' · pausa arriba ${s(p[3])}');
  return b.toString();
}

/* ---------------- Superseries ---------------- */
class SsInfo {
  final String letter;
  final int pos, size, start, end;
  const SsInfo(this.letter, this.pos, this.size, this.start, this.end);
}

/// Para cada índice que forma parte de una superserie (2 o más ejercicios unidos).
Map<int, SsInfo> supersets(List<J> exercises) {
  final out = <int, SsInfo>{};
  var letter = 0;
  for (var i = 0; i < exercises.length; i++) {
    if (!exercises[i].b('linkNext') || i == exercises.length - 1) continue;
    var j = i;
    while (j < exercises.length - 1 && exercises[j].b('linkNext')) {
      j++;
    }
    final l = String.fromCharCode(65 + (letter++ % 26));
    for (var k = i; k <= j; k++) {
      out[k] = SsInfo(l, k - i + 1, j - i + 1, i, j);
    }
    i = j;
  }
  return out;
}

class Block {
  final bool superset;
  final String letter;
  final List<int> items;
  const Block(this.superset, this.letter, this.items);
}

List<Block> blocksOf(List<J> exercises) {
  final ss = supersets(exercises);
  final out = <Block>[];
  for (var i = 0; i < exercises.length; i++) {
    final g = ss[i];
    if (g != null && g.pos == 1) {
      out.add(Block(true, g.letter, List.generate(g.size, (k) => i + k)));
      i = g.end;
    } else {
      out.add(Block(false, '', [i]));
    }
  }
  return out;
}

class AfterSet {
  final bool rest;
  final int? next;
  const AfterSet(this.rest, this.next);
}

/// Al marcar la serie [si] del ejercicio [ei] de un entrenamiento en curso, ¿qué sigue?
AfterSet afterSet(List<J> exercises, int ei, int si) {
  final g = supersets(exercises.map((e) => e.m('target') ?? e).toList())[ei];
  if (g == null) return const AfterSet(true, null);
  int doneCount(J e) => e.lm('sets').where((x) => x.b('done')).length;
  for (var k = ei + 1; k <= g.end; k++) {
    final e = exercises[k];
    if (doneCount(e) <= si && e.lm('sets').any((x) => !x.b('done'))) return AfterSet(false, k);
  }
  for (var k = g.start; k <= g.end; k++) {
    if (exercises[k].lm('sets').any((x) => !x.b('done'))) return AfterSet(true, k);
  }
  return const AfterSet(true, null);
}

/* ---------------- Drop sets ---------------- */
const dropDefault = {'count': 2, 'pct': 20, 'on': 'last'};
const dropPcts = [10, 15, 20, 25, 30, 40];
bool isDrop(J e) => e.s('technique') == 'dropset' && (e.m('drops')?.i('count') ?? 0) > 0;

String dropLabel(J? d) {
  if (d == null) return '';
  final c = d.i('count');
  return 'Drop set · $c ${c == 1 ? 'bajada' : 'bajadas'} de −${d.i('pct')}% ${d.s('on') == 'all' ? 'en cada serie' : 'en la última serie'}';
}

double dropWeight(num base, num pct, int k) {
  final v = base * math.pow(1 - pct / 100, k);
  return v > 0 ? (v * 2).round() / 2 : 0;
}

String setText(J x) {
  final base = '${kg(x.n('weight'))}×${x.s('reps')}';
  final drops = x.lm('drops').where((d) => d.b('done') && (d.n('reps') > 0 || d.n('weight') > 0)).toList();
  if (drops.isEmpty) return base;
  return '$base → ${drops.map((d) => '${kg(d.n('weight'))}×${d.s('reps')}').join(' → ')}';
}

/* ---------------- Plan de prueba ---------------- */
String trialName(int days) => days == 30 ? 'Mes de prueba' : 'Prueba de $days días';

class TrialInfo {
  final J t;
  final bool running;
  final int daysLeft, days;
  final double pct;
  final DateTime start, end;
  final double fee;
  TrialInfo(this.t, this.running, this.daysLeft, this.pct, this.start, this.end, this.days, this.fee);
  bool get ended => !running;
  String get label => running ? (daysLeft <= 1 ? 'Prueba · termina hoy' : 'Prueba · quedan $daysLeft días') : 'Prueba terminada';
}

TrialInfo? trialInfo(J? c) {
  final t = c?.m('trial');
  if (t == null || !['active', 'ended'].contains(t.s('status'))) return null;
  final end = t.d('end') ?? DateTime.now(), start = t.d('start') ?? DateTime.now();
  final now = DateTime.now();
  final left = math.max(0, (end.difference(now).inMinutes / 1440).ceil());
  final running = t.s('status') == 'active' && end.isAfter(now);
  final total = end.difference(start).inMinutes;
  final pct = total <= 0 ? 100.0 : (now.difference(start).inMinutes / total * 100).clamp(0, 100).toDouble();
  return TrialInfo(t, running, left, pct, start, end, t.i('days', 30), t.n('fee'));
}

/* ---------------- Series por músculo ---------------- */
typedef ExLookup = J Function(int id);

void _addSets(Map<String, double> acc, J ex, double n) {
  if (n == 0) return;
  final pri = ex.l('primary').map((e) => e.toString()).toList();
  for (final m in pri) {
    acc[m] = (acc[m] ?? 0) + n;
  }
  for (final m in ex.l('secondary').map((e) => e.toString())) {
    if (!pri.contains(m)) acc[m] = (acc[m] ?? 0) + n * 0.5;
  }
}

Map<String, double> sessionMuscleSets(ExLookup ex, J? session) {
  final acc = <String, double>{};
  for (final e in session?.lm('exercises') ?? const <J>[]) {
    _addSets(acc, ex(e.i('exId')), e.lm('sets').where((s) => s.b('done')).length.toDouble());
  }
  return acc;
}

class MuscleSets {
  final Map<String, double> perWeek;
  final int sessions;
  MuscleSets(this.perWeek, this.sessions);
}

MuscleSets muscleSets(ExLookup ex, List<J> workouts, int days) {
  final since = DateTime.now().subtract(Duration(days: days));
  final acc = <String, double>{};
  var sessions = 0;
  for (final w in workouts) {
    final f = w.d('finishedAt');
    if (f == null || f.isBefore(since)) continue;
    sessions++;
    sessionMuscleSets(ex, w).forEach((m, n) => acc[m] = (acc[m] ?? 0) + n);
  }
  final weeks = days / 7;
  return MuscleSets(acc.map((k, v) => MapEntry(k, v / weeks)), sessions);
}

Map<String, double> routineMuscleSets(ExLookup ex, J? routine) {
  final acc = <String, double>{};
  final days = routine?.lm('days') ?? const <J>[];
  if (days.isEmpty) return acc;
  final freq = routine!.i('frequency', days.length);
  final perWeek = (freq == 0 ? days.length : freq) / days.length;
  for (final d in days) {
    for (final e in d.lm('exercises')) {
      _addSets(acc, ex(e.i('exId')), e.n('sets') * perWeek);
    }
  }
  return acc;
}

class Level {
  final int lv;
  final String label;
  final double max;
  const Level(this.lv, this.label, this.max);
}

const weekLevels = [Level(1, '1–5', 5.5), Level(2, '6–9', 9.5), Level(3, '10–20', 20.5), Level(4, 'Más de 20', double.infinity)];
const sessionLevels = [Level(1, '1–2', 2.5), Level(2, '3–5', 5.5), Level(3, '6–9', 9.5), Level(4, '10+', double.infinity)];

int levelOf(List<Level> levels, double n) {
  if (n < 0.5) return 0;
  return levels.firstWhere((l) => n <= l.max).lv;
}

String fmtSets(double n) {
  final r = (n * 2).round() / 2;
  return '${_dec(r)} ${r == 1 ? 'serie' : 'series'}';
}

const keyMuscles = ['chest', 'lats', 'shoulders', 'quadriceps', 'hamstrings', 'glutes', 'biceps', 'triceps', 'abdominals', 'calves'];

const difficultyLevels = [(1, 'Muy fácil'), (2, 'Fácil'), (3, 'Justo'), (4, 'Duro'), (5, 'Al límite')];
