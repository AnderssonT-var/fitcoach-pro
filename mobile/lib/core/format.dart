// Formatos y fechas compartidos por toda la app (español de Ecuador).
import 'package:intl/intl.dart';

const _locale = 'es';

String _num(double v, {int maxDecimals = 2}) {
  final f = NumberFormat.decimalPattern(_locale)
    ..maximumFractionDigits = maxDecimals
    ..minimumFractionDigits = 0;
  return f.format(v);
}

String money(num? n) {
  final v = (n ?? 0).toDouble();
  final hasCents = (v * 100).round() % 100 != 0;
  final f = NumberFormat.decimalPattern(_locale)
    ..minimumFractionDigits = hasCents ? 2 : 0
    ..maximumFractionDigits = hasCents ? 2 : 0;
  return '\$${f.format(v)}';
}

String kg(num? n) {
  if (n == null || n.isNaN) return '—';
  return _num((n * 100).round() / 100);
}

String tons(num n) => n >= 1000 ? '${_num(n / 1000, maxDecimals: 1)} t' : '${kg(n)} kg';

String clock(num sec) {
  final r0 = sec.round();
  final s = r0 < 0 ? 0 : r0;
  final h = s ~/ 3600, m = (s % 3600) ~/ 60, r = s % 60;
  String two(int x) => x.toString().padLeft(2, '0');
  return h > 0 ? '$h:${two(m)}:${two(r)}' : '$m:${two(r)}';
}

DateTime startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);
DateTime addDays(DateTime d, int n) => DateTime(d.year, d.month, d.day + n, d.hour, d.minute, d.second);
DateTime weekStart(DateTime d) {
  final x = startOfDay(d);
  return addDays(x, -((x.weekday + 6) % 7));
}

bool sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
int daysUntil(DateTime d) => (startOfDay(d.toLocal()).difference(startOfDay(DateTime.now())).inHours / 24).ceil();
int daysSince(DateTime d) => (startOfDay(DateTime.now()).difference(startOfDay(d.toLocal())).inHours / 24).floor();

DateTime? parseDate(dynamic v) {
  if (v is String && v.isNotEmpty) return DateTime.tryParse(v)?.toLocal();
  if (v is int) return DateTime.fromMillisecondsSinceEpoch(v);
  return null;
}

String capitalize(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

String fullDate(DateTime d) => DateFormat("d 'de' MMMM 'de' y", _locale).format(d);
String longDay(DateTime d) => capitalize(DateFormat("EEEE d 'de' MMMM", _locale).format(d));
String shortDate(DateTime? d) {
  if (d == null) return '—';
  final sameYear = d.year == DateTime.now().year;
  return DateFormat(sameYear ? 'd MMM' : 'd MMM y', _locale).format(d).replaceAll('.', '');
}

String weekdayDate(DateTime d) => DateFormat('EEE d MMM', _locale).format(d).replaceAll('.', '');
String timeOf(DateTime d) => DateFormat('HH:mm', _locale).format(d);
String monthName([DateTime? d]) => DateFormat('MMMM', _locale).format(d ?? DateTime.now());
String isoDay(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

String ago(DateTime? d) {
  if (d == null) return '';
  final s = DateTime.now().difference(d).inSeconds;
  if (s < 60) return 'ahora';
  if (s < 3600) return 'hace ${s ~/ 60} min';
  if (s < 86400 && sameDay(d, DateTime.now())) return 'hace ${s ~/ 3600} h';
  final days = daysSince(d);
  if (days <= 1) return 'ayer';
  if (days < 7) return 'hace $days días';
  return shortDate(d);
}

String initials(String name) {
  final parts = name.split(' ').where((p) => p.isNotEmpty).take(2);
  return parts.map((p) => p[0]).join().toUpperCase();
}

String firstName(String name) => name.trim().split(' ').first;

String plural(int n, String one, String many) => '$n ${n == 1 ? one : many}';

/// "90s" → 90 · "2min" → 120 · "1:30" → 90
int parseRest(dynamic rest) {
  if (rest == null || rest == '') return 90;
  if (rest is num) return rest.round();
  final s = rest.toString().trim().toLowerCase();
  final mmss = RegExp(r'^(\d+):(\d{1,2})$').firstMatch(s);
  if (mmss != null) return int.parse(mmss.group(1)!) * 60 + int.parse(mmss.group(2)!);
  final n = double.tryParse(RegExp(r'[\d.]+').firstMatch(s)?.group(0) ?? '');
  if (n == null) return 90;
  return s.contains('m') ? (n * 60).round() : n.round();
}

int? repsLow(dynamic reps) => int.tryParse(RegExp(r'\d+').firstMatch(reps?.toString() ?? '')?.group(0) ?? '');

String normalize(String s) {
  const from = 'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ';
  const to = 'aaaaaeeeeiiiiooooouuuunAAAAAEEEEIIIIOOOOOUUUUN';
  final b = StringBuffer();
  for (final ch in s.split('')) {
    final i = from.indexOf(ch);
    b.write(i >= 0 ? to[i] : ch);
  }
  return b.toString().toLowerCase();
}
