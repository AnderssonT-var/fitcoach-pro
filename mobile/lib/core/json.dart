// Acceso cómodo y seguro a los datos JSON que llegan del servidor.
// El estado se guarda tal cual (mapas y listas) para no romperse si el
// servidor agrega campos nuevos.
typedef J = Map<String, dynamic>;

extension JX on Map<String, dynamic> {
  String s(String k, [String def = '']) {
    final v = this[k];
    if (v == null) return def;
    return v is String ? v : v.toString();
  }

  String? sn(String k) {
    final v = this[k];
    if (v == null) return null;
    final t = v is String ? v : v.toString();
    return t.isEmpty ? null : t;
  }

  int i(String k, [int def = 0]) {
    final v = this[k];
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? double.tryParse(v)?.toInt() ?? def;
    return def;
  }

  int? inn(String k) {
    final v = this[k];
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }

  double n(String k, [double def = 0]) {
    final v = this[k];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v.replaceAll(',', '.')) ?? def;
    return def;
  }

  double? nn(String k) {
    final v = this[k];
    if (v == null) return null;
    if (v is num) return v.toDouble();
    if (v is String) return v.isEmpty ? null : double.tryParse(v.replaceAll(',', '.'));
    return null;
  }

  bool b(String k, [bool def = false]) {
    final v = this[k];
    if (v is bool) return v;
    if (v is num) return v != 0;
    if (v is String) return v == 'true' || v == '1';
    return def;
  }

  List<dynamic> l(String k) {
    final v = this[k];
    return v is List ? v : const [];
  }

  List<J> lm(String k) {
    final v = this[k];
    if (v is! List) return const [];
    return v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
  }

  J? m(String k) {
    final v = this[k];
    return v is Map ? v.cast<String, dynamic>() : null;
  }

  DateTime? d(String k) {
    final v = this[k];
    if (v is String && v.isNotEmpty) return DateTime.tryParse(v)?.toLocal();
    if (v is int) return DateTime.fromMillisecondsSinceEpoch(v);
    return null;
  }
}

/// Copia profunda de datos JSON (mapas, listas y valores simples).
dynamic deepCopy(dynamic v) {
  if (v is Map) return v.map((k, x) => MapEntry(k.toString(), deepCopy(x)));
  if (v is List) return v.map(deepCopy).toList();
  return v;
}

J copyJ(J v) => (deepCopy(v) as Map).cast<String, dynamic>();

double numOf(dynamic v, [double def = 0]) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v.replaceAll(',', '.')) ?? def;
  return def;
}

int intOf(dynamic v, [int def = 0]) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? double.tryParse(v)?.toInt() ?? def;
  return def;
}
