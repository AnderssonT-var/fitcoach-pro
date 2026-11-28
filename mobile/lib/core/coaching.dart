// Lógica del seguimiento (igual que src/lib/coaching.js de la web): cumplimiento, rango con XP,
// hábitos, check-in, nutrición, fases y la lista «Necesitan atención» del entrenador.
import 'json.dart';

String dayKey([DateTime? d]) {
  final x = (d ?? DateTime.now()).toLocal();
  return '${x.year}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
}

String _daysAgo(int n) => dayKey(DateTime.now().subtract(Duration(days: n)));

const defaultHabits = <J>[
  {'id': 'h-sueno', 'name': 'Sueño', 'target': 7, 'unit': 'h', 'kind': 'count'},
  {'id': 'h-agua', 'name': 'Agua', 'target': 8, 'unit': 'vasos', 'kind': 'count'},
  {'id': 'h-pasos', 'name': 'Pasos', 'target': 8000, 'unit': 'pasos', 'kind': 'count'},
  {'id': 'h-proteina', 'name': 'Proteína', 'target': 1, 'unit': '', 'kind': 'check'},
];
const defaultCheckinQuestions = ['¿Qué fue lo mejor de tu semana?', '¿Algo te molestó o te costó?'];
const weekdaysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const daysShort = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

List<J> habitsOf(J? c) {
  final l = c?.lm('habits') ?? const <J>[];
  return l.isNotEmpty ? l : defaultHabits;
}

/// Día del check-in (0 = domingo) y preguntas del entrenador.
({int day, List<String> questions}) checkinCfgOf(J? c) {
  final cfg = c?.m('checkinCfg');
  return (day: cfg?.inn('day') ?? 0, questions: cfg == null ? defaultCheckinQuestions : cfg.l('questions').map((e) => '$e').toList());
}

/* ---------- cumplimiento ---------- */
/// % de entrenamientos hechos frente a los planificados en los últimos [days] días (null sin rutina).
int? compliance(J c, List<J> workouts, int days) {
  final freq = c.m('routine')?.i('frequency') ?? 0;
  if (freq == 0) return null;
  final from = DateTime.now().subtract(Duration(days: days));
  final joined = c.d('joinedAt');
  final start = joined != null && joined.isAfter(from) ? joined : from;
  final span = (DateTime.now().difference(start).inHours / 24).clamp(1, 100000);
  final planned = ((freq * span) / 7).round().clamp(1, 100000);
  final done = workouts.where((w) => w.i('clientId') == c.i('userId') && (w.d('finishedAt')?.isAfter(start) ?? false)).length;
  return ((done / planned) * 100).round().clamp(0, 100);
}

String complianceTone(int? p) => p == null ? '' : p >= 80 ? 'ok' : p >= 50 ? 'warn' : 'bad';

/* ---------- hábitos ---------- */
bool habitDone(J h, dynamic v) {
  final n = numOf(v);
  return h.s('kind') == 'check' ? n >= 1 : n >= h.n('target') && h.n('target') > 0;
}

J _logOf(J? c, String date) => (c?.m('habitLog')?.m(date)) ?? const {};

List<J> habitsToday(J? c, [String? date]) {
  final log = _logOf(c, date ?? dayKey());
  return habitsOf(c).map((h) => {...h, 'value': numOf(log[h.s('id')]), 'done': habitDone(h, log[h.s('id')])}).toList();
}

int? habitCompliance(J? c, [int days = 7]) {
  final hs = habitsOf(c);
  if (hs.isEmpty) return null;
  var ok = 0, total = 0;
  for (var i = 0; i < days; i++) {
    final log = _logOf(c, _daysAgo(i));
    for (final h in hs) {
      total++;
      if (habitDone(h, log[h.s('id')])) ok++;
    }
  }
  return total == 0 ? null : (ok * 100 / total).round();
}

int habitStreak(J? c) {
  final hs = habitsOf(c);
  var n = 0;
  for (var i = 0; i < 365; i++) {
    final log = _logOf(c, _daysAgo(i));
    if (hs.every((h) => habitDone(h, log[h.s('id')]))) {
      n++;
    } else if (i > 0) {
      break;
    }
  }
  return n;
}

/* ---------- check-in ---------- */
J? lastCheckin(J? c) {
  final l = c?.lm('checkins') ?? const <J>[];
  return l.isEmpty ? null : l.last;
}

bool checkinDue(J? c) {
  if (c?.m('routine') == null) return false;
  final last = lastCheckin(c);
  if (last != null && DateTime.now().difference(last.d('date') ?? DateTime(2000)).inDays < 5) return false;
  final since = (DateTime.now().weekday % 7 - checkinCfgOf(c).day + 7) % 7;
  return since <= 2;
}

List<J> pendingReviews(J? c) => (c?.lm('checkins') ?? const <J>[]).where((x) => x['reviewedAt'] == null).toList();

/* ---------- nutrición ---------- */
class FoodDay {
  final J? plan;
  final List<J> meals, entries;
  final int kcal, protein, water;
  const FoodDay(this.plan, this.meals, this.entries, this.kcal, this.protein, this.water);
}

FoodDay foodToday(J? c, [String? date]) {
  final n = c?.m('nutrition');
  final day = c?.m('foodLog')?.m(date ?? dayKey()) ?? const <String, dynamic>{};
  final done = day.m('meals') ?? const <String, dynamic>{};
  final meals = (n?.lm('meals') ?? const <J>[]).map((m) => {...m, 'done': done[m.s('id')] == true}).toList();
  final entries = day.lm('entries');
  final kcal = meals.where((m) => m['done'] == true).fold<double>(0, (t, m) => t + m.n('kcal')) + entries.fold<double>(0, (t, e) => t + e.n('kcal'));
  final protein = entries.fold<double>(0, (t, e) => t + e.n('protein'));
  return FoodDay(n, meals, entries, kcal.round(), protein.round(), day.i('water'));
}

/* ---------- rango y XP ---------- */
const ranks = [
  ('Bronce I', 0), ('Bronce II', 300), ('Bronce III', 700), ('Plata I', 1200), ('Plata II', 1900), ('Plata III', 2800),
  ('Oro I', 4000), ('Oro II', 5500), ('Oro III', 7500), ('Platino', 10000), ('Diamante', 14000), ('Élite', 20000),
];

int xpOf(J? c, List<J> workouts) {
  final mine = workouts.where((w) => w.i('clientId') == c?.i('userId')).toList();
  final prs = mine.fold<int>(0, (t, w) => t + w.l('prs').length);
  var habits = 0;
  final hs = habitsOf(c);
  for (final log in (c?.m('habitLog') ?? const <String, dynamic>{}).values) {
    if (log is! Map) continue;
    for (final h in hs) {
      if (habitDone(h, log[h.s('id')])) habits++;
    }
  }
  return mine.length * 100 + prs * 50 + (c?.lm('checkins').length ?? 0) * 50 + habits * 10;
}

class Rank {
  final String name, tier;
  final String? next;
  final int xp, from, to;
  final double pct;
  const Rank(this.name, this.tier, this.next, this.xp, this.from, this.to, this.pct);
}

Rank rankOf(int xp) {
  var i = 0;
  while (i + 1 < ranks.length && xp >= ranks[i + 1].$2) {
    i++;
  }
  final cur = ranks[i];
  final nxt = i + 1 < ranks.length ? ranks[i + 1] : null;
  final pct = nxt == null ? 1.0 : ((xp - cur.$2) / (nxt.$2 - cur.$2)).clamp(0.0, 1.0);
  return Rank(cur.$1, cur.$1.split(' ').first.toLowerCase(), nxt?.$1, xp, cur.$2, nxt?.$2 ?? cur.$2, pct);
}

int dayStreak(J? c, List<J> workouts) {
  final days = workouts.where((w) => w.i('clientId') == c?.i('userId')).map((w) => dayKey(w.d('finishedAt'))).toSet();
  final hs = habitsOf(c);
  (c?.m('habitLog') ?? const <String, dynamic>{}).forEach((k, log) {
    if (log is Map && hs.any((h) => habitDone(h, log[h.s('id')]))) days.add(k);
  });
  var n = 0;
  for (var i = 0; i < 400; i++) {
    if (days.contains(_daysAgo(i))) {
      n++;
    } else if (i > 0) {
      break;
    }
  }
  return n;
}

/* ---------- programa por fases ---------- */
class PhaseInfo {
  final int index, total, week, weeks, endsIn;
  final J phase;
  const PhaseInfo(this.index, this.total, this.phase, this.week, this.weeks, this.endsIn);
}

PhaseInfo? phaseInfo(J? c) {
  final p = c?.m('program');
  final phases = p?.lm('phases') ?? const <J>[];
  if (phases.isEmpty) return null;
  final i = (p!.i('current')).clamp(0, phases.length - 1);
  var start = p.d('startedAt') ?? DateTime.now();
  for (var k = 0; k < i; k++) {
    start = start.add(Duration(days: 7 * phases[k].i('weeks', 1)));
  }
  final weeks = phases[i].i('weeks', 1);
  final week = (DateTime.now().difference(start).inDays ~/ 7 + 1).clamp(1, weeks);
  final end = start.add(Duration(days: 7 * weeks));
  return PhaseInfo(i, phases.length, phases[i], week, weeks, end.difference(DateTime.now()).inDays + 1);
}

/* ---------- necesitan atención ---------- */
class Attention {
  final int clientId, level;
  final String name, kind, text, action;
  const Attention(this.clientId, this.name, this.level, this.kind, this.text, this.action);
}

List<Attention> needsAttention({required List<J> clients, required List<J> workouts, required List<J> payments, required List<J> messages, required int coachId}) {
  final out = <Attention>[];
  final today = DateTime.now();
  final startToday = DateTime(today.year, today.month, today.day);
  for (final c in clients) {
    if (!c.b('active', true)) continue;
    final id = c.i('userId');
    final name = c.m('user')?.s('name') ?? '';
    void push(int level, String kind, String text, String action) => out.add(Attention(id, name, level, kind, text, action));
    final p7 = compliance(c, workouts, 7), p30 = compliance(c, workouts, 30);
    final drop = p7 != null && p30 != null && p30 - p7 >= 20;
    if (drop) push(3, 'drop', 'Cumplimiento bajó de $p30% a $p7%', 'Escribir');
    final mine = workouts.where((w) => w.i('clientId') == id).toList()..sort((a, b) => (b.d('finishedAt') ?? DateTime(2000)).compareTo(a.d('finishedAt') ?? DateTime(2000)));
    final lastAt = mine.isNotEmpty ? mine.first.d('finishedAt') : c.d('joinedAt');
    final since = lastAt == null ? 0 : today.difference(lastAt).inDays;
    if (c.m('routine') != null && since >= 4 && !drop) push(since >= 7 ? 3 : 2, 'inactive', 'Lleva $since días sin entrenar', 'Escribir');
    final rev = pendingReviews(c);
    if (rev.isNotEmpty) {
      final h = today.difference(rev.first.d('date') ?? today).inHours;
      push(h >= 48 ? 3 : 2, 'checkin', 'Check-in sin revisar · hace ${h < 24 ? '$h h' : '${h ~/ 24} d'}', 'Revisar');
    }
    if (c.m('routine') == null) push(2, 'routine', 'No tiene rutina asignada', 'Crear rutina');
    final ph = phaseInfo(c);
    if (ph != null && ph.index == ph.total - 1 && ph.endsIn <= 7 && ph.endsIn >= 0) push(1, 'phase', 'Su programa termina en ${ph.endsIn} ${ph.endsIn == 1 ? 'día' : 'días'}', 'Renovar');
    final open = payments.where((p) => p.i('clientId') == id && p['paidAt'] == null).toList();
    final sent = open.where((p) => p['clientPaidAt'] != null).toList();
    final over = open.where((p) => (p.d('dueDate') ?? today).isBefore(startToday)).toList();
    if (sent.isNotEmpty) {
      push(2, 'receipt', 'Avisó que pagó ${sent.first.s('concept').toLowerCase()}', 'Confirmar');
    } else if (over.isNotEmpty) {
      push(2, 'payment', 'Pago vencido: ${over.first.s('concept')}', 'Cobrar');
    }
    final unread = messages.where((m) => m.i('clientId') == id && m.i('coachId') == coachId && m.i('from') == id && m['read'] != true).length;
    if (unread > 0) push(1, 'message', '$unread ${unread == 1 ? 'mensaje nuevo' : 'mensajes nuevos'}', 'Responder');
  }
  out.sort((a, b) => b.level.compareTo(a.level));
  return out;
}
