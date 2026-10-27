// Estado de la app conectado al servidor.
// Los datos vienen de /api/state (solo lo que el usuario puede ver) y cada acción
// llama a la API; el servidor valida permisos. Sin conexión se usa lo último
// guardado en el celular, y los entrenamientos terminados se suben solos después.
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'catalog.dart';
import 'format.dart';
import 'json.dart';
import 'techniques.dart';

enum Status { boot, guest, ready, offline }

class AppStore extends ChangeNotifier {
  AppStore._();
  static final AppStore I = AppStore._();

  late SharedPreferences prefs;
  Status status = Status.boot;
  J s = _blank();
  bool offline = false;
  String? bootError;
  int pendingUploads = 0;

  J? _lastRaw;
  bool _localDirty = false;
  Future<void>? _loading;
  Timer? _poll;
  Timer? _saveTimer;
  J? _pendingActive;
  bool _foreground = true;

  static const _kState = 'vytrafit.state', _kActive = 'vytrafit.active', _kOutbox = 'vytrafit.outbox', _kBrand = 'vytrafit.brand';

  static J _blank() => {
        'users': <dynamic>[], 'clients': <dynamic>[], 'licenses': <dynamic>[], 'payments': <dynamic>[], 'workouts': <dynamic>[],
        'messages': <dynamic>[], 'posts': <dynamic>[], 'templates': <dynamic>[], 'exercises': <dynamic>[], 'activity': <dynamic>[],
        'active': <String, dynamic>{}, 'subscriptions': <dynamic>[], 'settings': <String, dynamic>{}, 'ranking': null, 'access': null, 'sessionUserId': null,
      };

  /* ============================================================ Arranque */
  Future<void> init() async {
    prefs = await SharedPreferences.getInstance();
    await Api.I.init();
    Api.I.onSessionLost = () {
      _pendingActive = null;
      _lastRaw = null;
      prefs.remove(_kState);
      Api.I.setTokens(null);
      _set(Status.guest, _blank());
    };
    if (!Api.I.hasSession) {
      status = Status.guest;
      notifyListeners();
    } else {
      await reload();
    }
    _poll = Timer.periodic(const Duration(seconds: 20), (_) {
      if (status == Status.ready && _foreground) reload();
    });
    Timer.periodic(const Duration(seconds: 30), (_) {
      if (status == Status.ready && outbox().isNotEmpty) flushOutbox();
    });
  }

  void setForeground(bool v) {
    _foreground = v;
    if (v && status == Status.ready) reload();
    if (!v && _pendingActive != null) _flushActive();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  void _set(Status st, J next) {
    status = st;
    s = next;
    notifyListeners();
  }

  void _patch(void Function(J d) fn) {
    final d = copyJ(s);
    fn(d);
    _localDirty = true;
    s = d;
    notifyListeners();
  }

  /* ============================================================ Carga */
  List<J> outbox() {
    try {
      final raw = prefs.getString(_kOutbox);
      if (raw == null) return [];
      return (jsonDecode(raw) as List).cast<Map>().map((e) => e.cast<String, dynamic>()).toList();
    } catch (_) {
      return [];
    }
  }

  void _setOutbox(List<J> v) => v.isEmpty ? prefs.remove(_kOutbox) : prefs.setString(_kOutbox, jsonEncode(v));

  void _saveLocalActive(J? a) {
    if (a == null) {
      prefs.remove(_kActive);
    } else {
      prefs.setString(_kActive, jsonEncode({'a': a, 'at': DateTime.now().millisecondsSinceEpoch}));
    }
  }

  J? _localActive() {
    try {
      final raw = prefs.getString(_kActive);
      if (raw == null) return null;
      return (jsonDecode(raw) as Map).cast<String, dynamic>().m('a');
    } catch (_) {
      return null;
    }
  }

  J _normalize(J raw) {
    final st = copyJ(raw);
    final mine = st.lm('exercises').map((e) => {...e, 'photo': absUrl(e.sn('photo'))}).toList();
    st['exercises'] = [...Catalog.library, ...mine];
    st['clients'] = st.lm('clients').map((c) => {...c, 'photos': c.lm('photos').map((p) => {...p, 'src': absUrl(p.sn('src'))}).toList()}).toList();
    st['subscriptions'] = st.lm('subscriptions').map((x) => {...x, 'receipt': absUrl(x.sn('receipt'))}).toList();
    final active = (st.m('active') ?? <String, dynamic>{});
    st['active'] = active;
    if (_pendingActive != null) active['${_pendingActive!.i('clientId')}'] = _pendingActive;
    final local = _localActive();
    if (local != null && local.i('clientId') == st.i('sessionUserId')) {
      final finished = st.lm('workouts').any((w) => w.s('ref') == local.s('id')) || outbox().any((o) => o.m('session')?.s('id') == local.s('id'));
      final server = active['${local.i('clientId')}'] as Map?;
      if (finished) {
        _saveLocalActive(null);
      } else if (server == null || server['id'] == local.s('id')) {
        active['${local.i('clientId')}'] = local;
        if (server == null || jsonEncode(server) != jsonEncode(local)) Future.microtask(() => _queueActiveSave(local));
      }
    }
    pendingUploads = outbox().where((o) => o.i('userId') == st.i('sessionUserId')).length;
    return st;
  }

  /// Vuelve a pedir los datos al servidor.
  Future<void> reload() {
    if (!Api.I.hasSession) {
      _set(Status.guest, _blank());
      return Future.value();
    }
    return _loading ??= () async {
      try {
        final ready = status == Status.ready && _lastRaw != null;
        final r = await Api.I.call('GET', '/api/state', null, ready);
        if (r.notModified) {
          if (_localDirty || offline) {
            _localDirty = false;
            offline = false;
            _set(Status.ready, _normalize(_lastRaw!));
          }
          return;
        }
        if (!r.ok) {
          if (r.offline && status == Status.ready) {
            if (!offline) {
              offline = true;
              notifyListeners();
            }
            return;
          }
          if (r.offline) {
            final cached = prefs.getString(_kState);
            if (cached != null) {
              _lastRaw = (jsonDecode(cached) as Map).cast<String, dynamic>();
              offline = true;
              _set(Status.ready, _normalize(_lastRaw!));
              return;
            }
            bootError = r.error;
            _set(Status.offline, _blank());
            return;
          }
          if (!Api.I.hasSession) _set(Status.guest, _blank());
          return;
        }
        final data = r.json;
        _lastRaw = data;
        _localDirty = false;
        offline = false;
        try {
          final txt = jsonEncode(data);
          if (txt.length < 4e6) prefs.setString(_kState, txt);
        } catch (_) {}
        _set(Status.ready, _normalize(data));
        if (outbox().any((o) => o.i('userId') == data.i('sessionUserId'))) Future.microtask(flushOutbox);
      } finally {
        _loading = null;
      }
    }();
  }

  Future<ApiResult> _act(String method, String path, [Object? body]) async {
    final r = await Api.I.call(method, path, body);
    if (r.ok) {
      await reload();
    } else if (r.status == 402 || ['consent_required', 'password_change', 'client_inactive', 'coach_license'].contains(r.code)) {
      await reload();
    }
    return r;
  }

  /* ============================================================ Selectores */
  int? get meId => s.inn('sessionUserId');
  J? get me => meId == null ? null : userById(meId!);
  String get role => me?.s('role') ?? '';
  bool get isCoach => role == 'coach';

  List<J> get users => s.lm('users');
  List<J> get clients => s.lm('clients');
  List<J> get workoutsAll => s.lm('workouts');
  List<J> get payments => s.lm('payments');
  List<J> get messages => s.lm('messages');
  List<J> get posts => s.lm('posts');
  List<J> get templates => s.lm('templates');
  List<J> get exercises => s.lm('exercises');
  List<J> get subscriptions => s.lm('subscriptions');
  List<J> get licenses => s.lm('licenses');
  J get settings => s.m('settings') ?? {};
  J? get access => s.m('access');
  J active(int clientId) => s.m('active')?.m('$clientId') ?? {};
  bool hasActive(int clientId) => s.m('active')?.m('$clientId') != null;

  J? userById(int? id) {
    if (id == null) return null;
    for (final u in users) {
      if (u.i('id') == id) return u;
    }
    return null;
  }

  J? clientById(int? id) {
    if (id == null) return null;
    for (final c in clients) {
      if (c.i('userId') == id) return c;
    }
    return null;
  }

  J? get myClient => clientById(meId);
  J? get myCoach => isCoach ? me : userById(myClient?.i('coachId'));

  final Map<int, J> _exCache = {};
  J exerciseById(int id) {
    for (final e in exercises) {
      if (e.i('id') == id) return e;
    }
    return _exCache[id] ??= {'id': id, 'name': 'Ejercicio', 'muscle': '', 'equipment': '', 'primary': <dynamic>[], 'secondary': <dynamic>[]};
  }

  /// Marca de un entrenador (o del entrenador del asesorado).
  J? brand() {
    final u = me;
    if (u == null) return null;
    final coach = isCoach ? u : myCoach;
    if (coach == null) return null;
    return {...(coach.m('brand') ?? {}), 'coachName': coach.s('name'), 'coachPhoto': coach.sn('photo'), 'coachId': coach.i('id')};
  }

  List<J> clientsOf(int coachId) => clients.where((c) => c.i('coachId') == coachId).map((c) => {...c, 'user': userById(c.i('userId'))}).where((c) => c['user'] != null).toList();

  List<J> workoutsOf(int? clientId) {
    final l = workoutsAll.where((w) => clientId == null || w.i('clientId') == clientId).toList();
    l.sort((a, b) => b.s('finishedAt').compareTo(a.s('finishedAt')));
    return l;
  }

  List<J> workoutsForCoach(int coachId) {
    final ids = clients.where((c) => c.i('coachId') == coachId).map((c) => c.i('userId')).toSet();
    final l = workoutsAll.where((w) => ids.contains(w.i('clientId'))).toList();
    l.sort((a, b) => b.s('finishedAt').compareTo(a.s('finishedAt')));
    return l;
  }

  int weekCount(int clientId, [int offsetWeeks = 0]) {
    final from = addDays(weekStart(DateTime.now()), -7 * offsetWeeks);
    final to = addDays(from, 7);
    return workoutsAll.where((w) {
      final f = w.d('finishedAt');
      return w.i('clientId') == clientId && f != null && !f.isBefore(from) && f.isBefore(to);
    }).length;
  }

  int weekStreak(int clientId, int goal) {
    if (goal <= 0) return 0;
    var streak = weekCount(clientId) >= goal ? 1 : 0;
    for (var w = 1; w < 60; w++) {
      if (weekCount(clientId, w) >= goal) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  static double sessionVolume(J w) {
    if (w.b('summary')) return w.n('vol');
    var t = 0.0;
    for (final e in w.lm('exercises')) {
      for (final x in e.lm('sets')) {
        if (!x.b('done')) continue;
        t += x.n('weight') * x.n('reps');
        for (final d in x.lm('drops')) {
          t += d.n('weight') * d.n('reps');
        }
      }
    }
    return t;
  }

  static int doneSetCount(J w) {
    if (w.b('summary')) return w.i('setCount');
    return w.lm('exercises').fold(0, (t, e) => t + e.lm('sets').where((x) => x.b('done')).length);
  }

  J? lastPerformance(int clientId, int exId) {
    for (final w in workoutsOf(clientId)) {
      for (final e in w.lm('exercises')) {
        if (e.i('exId') == exId && e.lm('sets').any((x) => x.b('done'))) {
          return {'at': w.s('finishedAt'), 'sets': e.lm('sets').where((x) => x.b('done')).toList()};
        }
      }
    }
    return null;
  }

  /// Récord de todos los tiempos (servidor) + lo registrado recién.
  J? bestSet(int clientId, int exId) {
    final b = clientById(clientId)?.m('bests')?.m('$exId');
    J? best = b != null && b.n('w') >= 0 ? {'weight': b.n('w'), 'reps': b.n('r'), 'at': b.s('at'), 'first': b['first']} : null;
    for (final w in workoutsAll) {
      if (w.i('clientId') != clientId) continue;
      for (final e in w.lm('exercises')) {
        if (e.i('exId') != exId) continue;
        for (final x in e.lm('sets')) {
          if (!x.b('done') || !(x.n('reps') > 0)) continue;
          if (best == null || x.n('weight') > best.n('weight') || (x.n('weight') == best.n('weight') && x.n('reps') > best.n('reps'))) {
            best = {...?best, 'weight': x.n('weight'), 'reps': x.n('reps'), 'at': w.s('finishedAt')};
          }
        }
      }
    }
    return best;
  }

  J? nextDay(int clientId) {
    final c = clientById(clientId);
    final days = c?.m('routine')?.lm('days') ?? const <J>[];
    if (days.isEmpty) return null;
    J? last;
    for (final w in workoutsOf(clientId)) {
      if (days.any((d) => d.s('id') == w.s('dayId'))) {
        last = w;
        break;
      }
    }
    if (last == null) return days.first;
    final i = days.indexWhere((d) => d.s('id') == last!.s('dayId'));
    return days[(i + 1) % days.length];
  }

  List<J> thread(int coachId, int clientId) {
    final l = messages.where((m) => m.i('coachId') == coachId && m.i('clientId') == clientId).toList();
    l.sort((a, b) => a.s('at').compareTo(b.s('at')));
    return l;
  }

  J? lastExerciseNote(int coachId, int clientId, int exId) {
    final l = thread(coachId, clientId).where((m) => m.inn('exId') == exId && m.i('from') == coachId).toList();
    return l.isEmpty ? null : l.last;
  }

  int unreadFor(int userId) =>
      messages.where((m) => !m.b('read') && m.i('from') != userId && (m.i('coachId') == userId || m.i('clientId') == userId)).length;

  bool exerciseInUse(int id) => clients.any((c) => (c.m('routine')?.lm('days') ?? const <J>[]).any((d) => d.lm('exercises').any((e) => e.i('exId') == id)));

  static String licenseStatus(J l) {
    if (l.b('revoked')) return 'revoked';
    if (l['coachId'] == null) return 'available';
    final exp = l.d('expiresAt');
    if (exp == null) return 'expired';
    final left = exp.difference(DateTime.now()).inHours / 24;
    if (left < 0) return 'expired';
    if (left <= 30) return 'expiring';
    return 'active';
  }

  J? coachLicense(int coachId) {
    final mine = licenses.where((l) => l.i('coachId') == coachId).toList();
    final valid = mine.where((l) => ['active', 'expiring'].contains(licenseStatus(l))).toList();
    final pool = valid.isNotEmpty ? valid : mine;
    if (pool.isEmpty) return null;
    pool.sort((a, b) => b.s('expiresAt').compareTo(a.s('expiresAt')));
    return pool.first;
  }

  bool coachCanWork(int coachId) {
    final l = coachLicense(coachId);
    return l != null && ['active', 'expiring'].contains(licenseStatus(l));
  }

  static String paymentStatus(J p) {
    if (p['paidAt'] != null) return 'paid';
    final due = p.d('dueDate');
    return due != null && due.isBefore(startOfDay(DateTime.now())) ? 'overdue' : 'pending';
  }

  List<J> plans() {
    final p = settings.m('pricing');
    if (p == null) return [];
    return [1, 3, 6, 12].map((m) {
      final d = p.m('discounts')?.n('$m') ?? 0;
      final v = p.n('monthly') * m * (1 - d / 100);
      return <String, dynamic>{'months': m, 'label': '$m ${m == 1 ? 'mes' : 'meses'}', 'discount': d, 'price': d > 0 ? v.roundToDouble() : (v * 100).round() / 100};
    }).toList();
  }

  /* ============================================================ Sesión */
  String? get savedBrand => prefs.getString(_kBrand);
  void saveBrand(String? slug) => slug == null || slug.isEmpty ? prefs.remove(_kBrand) : prefs.setString(_kBrand, slug);

  Future<ApiResult> login(String email, String password, [String? brandSlug]) async {
    final r = await Api.I.call('POST', '/api/auth/login', {'email': email.trim(), 'password': password, if (brandSlug != null && brandSlug.isNotEmpty) 'brandSlug': brandSlug});
    if (!r.ok) return r;
    await Api.I.setTokens(r.json);
    status = Status.boot;
    await reload();
    return r;
  }

  Future<void> logout() async {
    final rt = Api.I.refreshToken;
    _pendingActive = null;
    _lastRaw = null;
    await prefs.remove(_kState);
    Api.I.call('POST', '/api/auth/logout', {'refreshToken': rt});
    await Api.I.setTokens(null);
    Api.I.resetStateTag();
    _set(Status.guest, _blank());
  }

  Future<void> logoutAll() async {
    await Api.I.call('POST', '/api/auth/logout-all', {});
    await Api.I.setTokens(null);
    _set(Status.guest, _blank());
  }

  Future<ApiResult> changePassword(String current, String next) async {
    final r = await Api.I.call('POST', '/api/auth/password', {'current': current, 'next': next});
    if (!r.ok) return r;
    await Api.I.setTokens(r.json);
    await reload();
    return r;
  }

  Future<ApiResult> acceptConsent([bool? photos]) => _act('POST', '/api/auth/consent', {'accept': true, if (photos != null) 'photos': photos});
  Future<ApiResult> setPhotoConsent(bool v) => _act('POST', '/api/auth/photo-consent', {'value': v});

  Future<J?> fetchBrand(String slug) async {
    if (slug.isEmpty) return null;
    final r = await Api.I.call('GET', '/api/public/brand/${Uri.encodeComponent(slug.toLowerCase())}');
    return r.ok ? r.json : null;
  }

  static String normalizeCode(String code) {
    final raw = code.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '').replaceFirst(RegExp(r'^FIT'), '');
    final cut = raw.substring(0, math.min(12, raw.length));
    if (cut.isEmpty) return '';
    final parts = <String>[];
    for (var i = 0; i < cut.length; i += 4) {
      parts.add(cut.substring(i, math.min(i + 4, cut.length)));
    }
    return 'FIT-${parts.join('-')}';
  }

  Future<ApiResult> activateLicense(J f) async {
    final r = await Api.I.call('POST', '/api/auth/activate', f);
    if (!r.ok) return r;
    await Api.I.setTokens(r.json);
    status = Status.boot;
    await reload();
    return r;
  }

  Future<ApiResult> signupWithCoach(J data) async {
    final r = await Api.I.call('POST', '/api/public/signup', data);
    if (!r.ok) return r;
    await Api.I.setTokens(r.json);
    status = Status.boot;
    await reload();
    return r;
  }

  Future<ApiResult> redeemCode(String code) => _act('POST', '/api/coach/redeem', {'code': code});
  Future<ApiResult> requestSubscription(J data) => _act('POST', '/api/coach/subscriptions', data);

  /* ============================================================ Entrenador */
  Future<ApiResult> addClient(J d) => _act('POST', '/api/coach/clients', d);
  Future<ApiResult> updateClient(int id, J p) => _act('PATCH', '/api/coach/clients/$id', p);
  Future<ApiResult> resetClientPassword(int id) => _act('POST', '/api/coach/clients/$id/reset-password', {});
  Future<ApiResult> deleteClient(int id) => _act('DELETE', '/api/coach/clients/$id');
  Future<ApiResult> addBodyWeight(int clientId, double kgValue) =>
      isCoach ? _act('POST', '/api/coach/clients/$clientId/weight', {'kg': kgValue}) : _act('POST', '/api/client/weight', {'kg': kgValue});

  static J cleanRoutine(J r) => {
        'name': r.s('name'), 'goal': r.s('goal'), 'frequency': r.i('frequency', 3) == 0 ? 3 : r.i('frequency', 3), 'notes': r.s('notes'),
        'days': r.lm('days').map((d) => {
              'id': d.s('id'), 'name': d.s('name'),
              'exercises': d.lm('exercises').map((e) {
                final drop = e.s('technique') == 'dropset' && e.m('drops') != null;
                final tempo = e.s('tempo');
                return <String, dynamic>{
                  'uid': e.s('uid'), 'exId': e.i('exId'), 'sets': math.max(1, e.i('sets', 1)), 'reps': e.s('reps'), 'rest': e.i('rest'), 'notes': e.s('notes'),
                  'technique': drop ? 'dropset' : 'normal',
                  if (drop) 'drops': {'count': e.m('drops')!.i('count'), 'pct': e.m('drops')!.i('pct'), 'on': e.m('drops')!.s('on') == 'all' ? 'all' : 'last'},
                  if (e.b('linkNext')) 'linkNext': true,
                  if (e.m('effort')?.sn('type') != null) 'effort': {'type': e.m('effort')!.s('type'), 'value': e.m('effort')!.n('value')},
                  if (tempo.isNotEmpty && tempoRe.hasMatch(tempo)) 'tempo': tempo.toUpperCase(),
                };
              }).toList(),
            }).toList(),
      };

  Future<ApiResult> saveRoutine(int clientId, J? routine, [String slot = 'current']) =>
      _act('PUT', '/api/coach/clients/$clientId/routine', {'routine': routine == null ? null : cleanRoutine(routine), 'slot': slot});
  Future<ApiResult> startTrial(int id, int days, double fee) => _act('POST', '/api/coach/clients/$id/trial', {'days': days, 'fee': fee});
  Future<ApiResult> extendTrial(int id, int days) => _act('POST', '/api/coach/clients/$id/trial/extend', {'days': days});
  Future<ApiResult> convertTrial(int id) => _act('POST', '/api/coach/clients/$id/trial/convert', {});
  Future<ApiResult> cancelTrial(int id) => _act('POST', '/api/coach/clients/$id/trial/cancel', {'pause': true});
  Future<ApiResult> saveTemplate(J routine, String name) => _act('POST', '/api/coach/templates', {'routine': cleanRoutine(routine), 'name': name});
  Future<ApiResult> deleteTemplate(String id) => _act('DELETE', '/api/coach/templates/$id');

  Future<ApiResult> upsertExercise(J data) {
    final id = data.inn('id');
    final photo = data.sn('photo');
    final body = <String, dynamic>{
      for (final k in ['name', 'muscle', 'equipment', 'level', 'primary', 'secondary', 'steps', 'cues', 'reps']) k: data[k],
      'sets': data.i('sets', 3), 'rest': data.i('rest', 60),
      'photo': photo != null && photo.startsWith('data:') ? photo : (photo != null ? null : null),
    };
    if (photo != null && !photo.startsWith('data:')) body.remove('photo');
    return id != null ? _act('PUT', '/api/coach/exercises/$id', body) : _act('POST', '/api/coach/exercises', body);
  }

  Future<ApiResult> deleteExercise(int id) => _act('DELETE', '/api/coach/exercises/$id');
  Future<ApiResult> addPayment(J p) => _act('POST', '/api/coach/payments', p);
  Future<ApiResult> markPaid(String id, String method) => _act('POST', '/api/coach/payments/$id/paid', {'method': method});
  Future<ApiResult> markUnpaid(String id) => _act('POST', '/api/coach/payments/$id/unpaid', {});
  Future<ApiResult> deletePayment(String id) => _act('DELETE', '/api/coach/payments/$id');
  Future<int> generateMonthly() async {
    final r = await _act('POST', '/api/coach/payments/generate-monthly', {});
    return r.ok ? r.json.i('created') : 0;
  }

  Future<ApiResult> updateBrand(J p) => _act('PUT', '/api/coach/brand', p);
  Future<ApiResult> addMeasurement(int clientId, J m) => _act('POST', '/api/coach/clients/$clientId/measurements', m);
  Future<ApiResult> deleteMeasurement(int clientId, String id) => _act('DELETE', '/api/coach/clients/$clientId/measurements/$id');
  Future<ApiResult> addPhotos(int clientId, List<J> photos) => isCoach
      ? _act('POST', '/api/coach/clients/$clientId/photos', {'photos': photos})
      : _act('POST', '/api/client/photos', {'photos': photos});
  Future<ApiResult> deletePhoto(int clientId, String id) =>
      isCoach ? _act('DELETE', '/api/coach/clients/$clientId/photos/$id') : _act('DELETE', '/api/client/photos/$id');
  Future<ApiResult> addNote(int clientId, J n) => _act('POST', '/api/coach/clients/$clientId/notes', n);
  Future<ApiResult> updateNote(int clientId, String id, J p) => _act('PATCH', '/api/coach/clients/$clientId/notes/$id', p);
  Future<ApiResult> deleteNote(int clientId, String id) => _act('DELETE', '/api/coach/clients/$clientId/notes/$id');

  /* ============================================================ Compartido */
  Future<ApiResult> updateProfile(J p) => _act('PUT', '/api/profile', p);
  Future<ApiResult> saveReminder(J reminder) => _act('PUT', '/api/profile', {'notif': {'reminder': reminder}});

  Future<ApiResult> sendMessage(int coachId, int clientId, String text, [J? ref]) {
    final tagged = ref?.inn('exId') != null ? {'exId': ref!.i('exId'), 'tag': ref.s('tag', 'comentario')} : <String, dynamic>{};
    _patch((d) => (d['messages'] as List).add({
          'id': 'tmp-${DateTime.now().microsecondsSinceEpoch}', 'coachId': coachId, 'clientId': clientId, 'from': meId, 'text': text.trim(),
          'at': DateTime.now().toUtc().toIso8601String(), 'read': false, 'pending': true, 'exId': null, 'tag': null, ...tagged,
        }));
    return _act('POST', '/api/messages', {'text': text.trim(), ...tagged, if (isCoach) 'clientId': clientId});
  }

  void markThreadRead(int coachId, int clientId) {
    final reader = meId;
    if (!messages.any((m) => m.i('coachId') == coachId && m.i('clientId') == clientId && m.i('from') != reader && !m.b('read'))) return;
    _patch((d) {
      for (final m in (d['messages'] as List).cast<Map>()) {
        if (m['coachId'] == coachId && m['clientId'] == clientId && m['from'] != reader) m['read'] = true;
      }
    });
    Api.I.call('POST', '/api/messages/read', isCoach ? {'clientId': clientId} : {});
  }

  Future<ApiResult> addPost(String text, String kind) => _act('POST', '/api/posts', {'text': text, 'kind': kind});
  Future<ApiResult> toggleLike(String postId) {
    _patch((d) {
      for (final p in (d['posts'] as List).cast<Map>()) {
        if (p['id'] == postId) {
          final likes = (p['likes'] as List? ?? []).toList();
          likes.contains(meId) ? likes.remove(meId) : likes.add(meId);
          p['likes'] = likes;
        }
      }
    });
    return _act('POST', '/api/posts/$postId/like', {});
  }

  Future<ApiResult> addComment(String postId, String text) => _act('POST', '/api/posts/$postId/comments', {'text': text});
  Future<ApiResult> deletePost(String postId) => _act('DELETE', '/api/posts/$postId');
  Future<ApiResult> exportMyData() => Api.I.call('GET', '/api/account/export');
  Future<ApiResult> deleteMyAccount(String password) async {
    final r = await Api.I.call('DELETE', '/api/account', {'password': password});
    if (!r.ok) return r;
    await Api.I.setTokens(null);
    _set(Status.guest, _blank());
    return r;
  }

  Future<J> pushConfig() async => (await Api.I.call('GET', '/api/push/config')).json;

  /* ============================================================ Entrenamiento en vivo
     Se edita al instante y se guarda en el servidor cada pocos segundos
     (si se cierra la app, se retoma). */
  void _queueActiveSave(J a) {
    _pendingActive = a;
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 1200), _flushActive);
  }

  Future<void> _flushActive() async {
    final a = _pendingActive;
    if (a == null) return;
    final r = await Api.I.call('PUT', '/api/client/workout/active', a);
    if (r.ok && identical(_pendingActive, a)) _pendingActive = null;
  }

  String _uid(String p) => '$p${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${math.Random().nextInt(1 << 20).toRadixString(36)}';
  String newUid() => _uid('re-');

  void startWorkout(int clientId, [String? dayId]) {
    if (hasActive(clientId)) return;
    final c = clientById(clientId);
    final routine = c?.m('routine');
    final days = routine?.lm('days') ?? const <J>[];
    if (days.isEmpty) return;
    final day = days.firstWhere((x) => x.s('id') == dayId, orElse: () => days.first);
    final a = <String, dynamic>{
      'id': _uid('w-'), 'clientId': clientId, 'dayId': day.s('id'), 'dayName': day.s('name'), 'routineName': routine!.s('name'),
      'startedAt': DateTime.now().toUtc().toIso8601String(), 'restEndsAt': null, 'restTotal': 0,
      'exercises': day.lm('exercises').map((e) {
        final last = lastPerformance(clientId, e.i('exId'));
        final lastSets = last?.lm('sets') ?? const <J>[];
        final nSets = math.max(1, e.i('sets', 1));
        final dropsCfg = e.m('drops');
        final drop = e.s('technique') == 'dropset' && (dropsCfg?.i('count') ?? 0) > 0
            ? {'count': dropsCfg!.i('count'), 'pct': dropsCfg.i('pct', 20), 'on': dropsCfg.s('on') == 'all' ? 'all' : 'last'}
            : null;
        return <String, dynamic>{
          'exId': e.i('exId'), 'notes': e.s('notes'),
          'target': {
            'sets': nSets, 'reps': e.s('reps'), 'rest': e.i('rest'), if (drop != null) 'drop': drop,
            if (e.b('linkNext')) 'linkNext': true, if (e.m('effort') != null) 'effort': e.m('effort'), if (e.sn('tempo') != null) 'tempo': e.s('tempo'),
          },
          'sets': List.generate(nSets, (i) {
            final prev = lastSets.isEmpty ? null : (i < lastSets.length ? lastSets[i] : lastSets.last);
            final st = <String, dynamic>{'weight': '', 'reps': '', 'prevWeight': prev?['weight'], 'prevReps': prev?['reps'], 'done': false};
            if (drop != null && (drop['on'] == 'all' || i == nSets - 1)) {
              st['drops'] = List.generate(drop['count'] as int, (k) => {'weight': '', 'reps': '', 'prevReps': prev?.lm('drops').elementAtOrNull(k)?['reps'], 'done': false});
            }
            return st;
          }),
        };
      }).toList(),
    };
    _patch((d) => (d['active'] as Map)['$clientId'] = a);
    _saveLocalActive(a);
    _pendingActive = a;
    _flushActive();
  }

  void updateWorkout(int clientId, void Function(J a) fn) {
    if (!hasActive(clientId)) return;
    _patch((d) => fn(((d['active'] as Map)['$clientId'] as Map).cast<String, dynamic>()));
    final a = active(clientId);
    _saveLocalActive(a);
    _queueActiveSave(a);
  }

  Future<void> discardWorkout(int clientId) async {
    _saveTimer?.cancel();
    _pendingActive = null;
    _saveLocalActive(null);
    _patch((d) => (d['active'] as Map).remove('$clientId'));
    await _act('DELETE', '/api/client/workout/active');
  }

  /// Guarda el entrenamiento. Sin señal queda en el celular y se sube solo después.
  Future<ApiResult> finishWorkout(int clientId, {required int difficulty, String comment = '', bool share = false}) async {
    final a = active(clientId);
    if (a.isEmpty) return const ApiResult(error: 'No hay un entrenamiento en curso.');
    _saveTimer?.cancel();
    String? prName;
    for (final e in a.lm('exercises')) {
      final done = e.lm('sets').where((x) => x.b('done') && x.n('reps') > 0).map((x) => x.n('weight'));
      final top = done.isEmpty ? 0.0 : done.reduce(math.max);
      final prev = bestSet(clientId, e.i('exId'));
      if (prev != null && top > prev.n('weight')) {
        prName = exerciseById(e.i('exId')).s('name');
        break;
      }
    }
    final body = <String, dynamic>{'session': a, 'difficulty': difficulty, 'comment': comment, 'share': share, if (prName != null) 'prName': prName, 'finishedAt': DateTime.now().toUtc().toIso8601String()};
    final r = await Api.I.call('POST', '/api/client/workout/finish', body);
    if (!r.ok && (r.offline || r.status >= 500)) {
      _setOutbox([...outbox().where((o) => o.m('session')?.s('id') != a.s('id')), {'userId': clientId, ...body}]);
      _pendingActive = null;
      _saveLocalActive(null);
      _patch((d) => (d['active'] as Map).remove('$clientId'));
      pendingUploads = outbox().where((o) => o.i('userId') == clientId).length;
      final started = a.d('startedAt') ?? DateTime.now();
      return ApiResult(data: {
        'queued': true, 'durationSec': DateTime.now().difference(started).inSeconds,
        'done': a.lm('exercises').fold<int>(0, (t, e) => t + e.lm('sets').where((x) => x.b('done')).length),
        'volume': sessionVolume(a), 'prs': <dynamic>[], 'comment': comment,
      });
    }
    if (!r.ok) return r;
    _pendingActive = null;
    _saveLocalActive(null);
    _patch((d) => (d['active'] as Map).remove('$clientId'));
    await reload();
    return r;
  }

  bool _flushing = false;
  Future<void> flushOutbox() async {
    if (_flushing || status != Status.ready) return;
    final mine = outbox().where((o) => o.i('userId') == meId).toList();
    if (mine.isEmpty) return;
    _flushing = true;
    var sent = 0;
    try {
      for (final item in mine) {
        final body = Map<String, dynamic>.from(item)..remove('userId');
        final r = await Api.I.call('POST', '/api/client/workout/finish', body);
        if (!r.ok && (r.offline || r.status >= 500 || r.status == 401)) break;
        _setOutbox(outbox().where((o) => o.m('session')?.s('id') != item.m('session')?.s('id')).toList());
        if (r.ok) sent++;
      }
    } finally {
      _flushing = false;
    }
    if (sent > 0) {
      await reload();
    } else {
      pendingUploads = outbox().where((o) => o.i('userId') == meId).length;
      notifyListeners();
    }
  }
}

/// Atajo global.
AppStore get store => AppStore.I;

void debugLog(Object o) {
  if (kDebugMode) debugPrint('$o');
}
