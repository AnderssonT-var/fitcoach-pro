// Estado de la app conectado al servidor, pensado para trabajar SIN CONEXIÓN.
// - Los datos vienen de /api/state y se guardan en el celular: con la sesión iniciada
//   la app abre y funciona aunque no haya internet.
// - Cada cambio se guarda primero en el celular (cola de acciones), se ve al instante y
//   se sube al servidor apenas hay señal, en orden y sin duplicarse (Idempotency-Key).
// - Si el servidor rechaza una acción (datos no válidos), se avisa.
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'catalog.dart';
import 'disk.dart';
import 'format.dart';
import 'json.dart';
import 'push.dart';
import 'techniques.dart';

enum Status { boot, guest, ready, offline }

class AppStore extends ChangeNotifier {
  AppStore._();
  static final AppStore I = AppStore._();

  late SharedPreferences prefs;
  Status status = Status.boot;
  J s = _blank();
  bool offline = false;
  bool busy = false; // servidor ocupado: se reintenta solo
  String? bootError;

  J? _lastRaw;
  Future<void>? _loading;
  Timer? _poll;
  Timer? _saveTimer;
  Timer? _activeRetry;
  J? _pendingActive;
  bool _foreground = true;
  int _backoff = 0;

  List<J> _ops = []; // acciones hechas en este celular que faltan subir (en orden)
  final List<J> _confirmed = []; // ya subidas, se muestran hasta que llegue el estado nuevo
  List<J> _errors = []; // acciones que el servidor no aceptó

  static const _kActive = 'vytrafit.active', _kOutbox = 'vytrafit.outbox', _kBrand = 'vytrafit.brand', _kStateOld = 'vytrafit.state';
  static const _fState = 'state.json', _fOps = 'ops.json', _fErrors = 'sync-errors.json';

  static J _blank() => {
        'users': <dynamic>[], 'clients': <dynamic>[], 'licenses': <dynamic>[], 'payments': <dynamic>[], 'workouts': <dynamic>[],
        'messages': <dynamic>[], 'posts': <dynamic>[], 'templates': <dynamic>[], 'exercises': <dynamic>[], 'activity': <dynamic>[],
        'active': <String, dynamic>{}, 'subscriptions': <dynamic>[], 'settings': <String, dynamic>{}, 'ranking': null, 'access': null, 'sessionUserId': null,
      };

  int? get _uid => _lastRaw?.inn('sessionUserId') ?? s.inn('sessionUserId');
  List<J> get _mine => _ops.where((o) => o.inn('userId') == _uid).toList();

  /// Cambios hechos sin conexión que faltan subir (de esta cuenta).
  List<J> get pendingOps => _mine;
  int get pendingUploads => _mine.length;
  List<J> get syncErrors => _errors.where((e) => e.inn('userId') == _uid).toList();

  /* ============================================================ Arranque */
  Future<void> init() async {
    prefs = await SharedPreferences.getInstance();
    await Api.I.init();
    Api.I.syncInfo = () => (pending: _mine.length, failed: syncErrors.length);
    Api.I.onSessionLost = () {
      // La cola se conserva: se sube cuando esa persona vuelva a entrar
      _pendingActive = null;
      _lastRaw = null;
      _confirmed.clear();
      Disk.write(_fState, null);
      Api.I.setTokens(null);
      Api.I.resetStateTag();
      _set(Status.guest, _blank());
    };
    await _loadLocal();
    if (!Api.I.hasSession) {
      status = Status.guest;
      notifyListeners();
    } else if (_lastRaw != null) {
      // Abre al instante con lo guardado; se actualiza en segundo plano
      _render();
      status = Status.ready;
      notifyListeners();
      unawaited(reload());
    } else {
      await reload();
    }
    _schedulePoll();
    try {
      Connectivity().onConnectivityChanged.listen((r) {
        if (r.any((x) => x != ConnectivityResult.none) && status == Status.ready) {
          _backoff = 0;
          reload();
          _kick();
        }
      });
    } catch (_) {/* sin datos de conectividad */}
  }

  Future<void> _loadLocal() async {
    try {
      final o = await Disk.read(_fOps);
      if (o != null) _ops = (jsonDecode(o) as List).cast<Map>().map((e) => e.cast<String, dynamic>()).toList();
    } catch (_) {}
    try {
      final e = await Disk.read(_fErrors);
      if (e != null) _errors = (jsonDecode(e) as List).cast<Map>().map((x) => x.cast<String, dynamic>()).toList();
    } catch (_) {}
    // Cola antigua (solo entrenamientos terminados) → cola nueva
    try {
      final raw = prefs.getString(_kOutbox);
      if (raw != null) {
        for (final it in (jsonDecode(raw) as List).cast<Map>()) {
          final body = Map<String, dynamic>.from(it.cast<String, dynamic>());
          final userId = body.remove('userId');
          if (_ops.any((x) => x.s('kind') == 'finish' && x.m('body')?.m('session')?.s('id') == body.m('session')?.s('id'))) continue;
          _ops.add(_mkOp(userId as int?, 'finish', 'POST', '/api/client/workout/finish', body,
              label: 'Entrenamiento ${body.m('session')?.s('dayName') ?? ''}'.trim(), at: body.sn('finishedAt')));
        }
        await prefs.remove(_kOutbox);
        _saveOps();
      }
    } catch (_) {}
    if (!Api.I.hasSession) return;
    try {
      String? txt = await Disk.read(_fState);
      txt ??= prefs.getString(_kStateOld);
      if (txt != null) {
        final snap = ((await decodeJson(txt)) as Map).cast<String, dynamic>();
        Api.I.stateTag = snap.sn('__etag');
        snap.remove('__etag');
        _lastRaw = snap;
      }
      await prefs.remove(_kStateOld);
    } catch (_) {}
  }

  void setForeground(bool v) {
    _foreground = v;
    if (v && status == Status.ready) {
      reload();
      _kick();
    }
    if (!v && _pendingActive != null) _flushActive();
  }

  /// Actualización periódica: lo que pida el servidor (20 s normal; más con mucha gente),
  /// con variación para que no consulten todos a la vez; sin señal se espera más.
  void _schedulePoll() {
    _poll?.cancel();
    final base = (offline || busy) && _backoff > 0 ? _backoff : Api.I.pollSeconds * 1000;
    final ms = (base * (0.85 + math.Random().nextDouble() * 0.3)).round();
    _poll = Timer(Duration(milliseconds: ms), () async {
      if (status == Status.ready && _foreground) {
        try {
          await reload();
        } catch (_) {}
      }
      _schedulePoll();
    });
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

  /// Cambio local del entrenamiento en curso (no pasa por la cola).
  void _patchActive(int clientId, J? a) {
    final act = Map<String, dynamic>.from(s.m('active') ?? {});
    if (a == null) {
      act.remove('$clientId');
    } else {
      act['$clientId'] = a;
    }
    s = {...s, 'active': act};
    notifyListeners();
  }

  /* ============================================================ Guardado local */
  void _saveOps() => Disk.write(_fOps, jsonEncode(_ops));
  void _saveErrors() => Disk.write(_fErrors, jsonEncode(_errors));
  Timer? _snapTimer;
  void _saveSnapshot() {
    _snapTimer?.cancel();
    _snapTimer = Timer(const Duration(milliseconds: 1500), () async {
      final raw = _lastRaw;
      if (raw == null || !Api.I.hasSession) return;
      try {
        Disk.write(_fState, await encodeJson({...raw, '__etag': Api.I.stateTag}));
      } catch (_) {}
    });
  }

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

  /// Compatibilidad: entrenamientos terminados sin conexión que faltan subir.
  List<J> outbox() => _mine.where((o) => o.s('kind') == 'finish').map((o) => <String, dynamic>{'userId': o['userId'], ...?o.m('body')}).toList();

  /* ============================================================ Cómo se ve el estado
     lo del servidor + las acciones aún sin subir */
  J _normalize(J raw) {
    // El historial puede ser grande: se copia la lista, no cada entrenamiento (las acciones solo agregan)
    final workouts = raw['workouts'];
    final st = copyJ({...raw, 'workouts': null});
    st['workouts'] = workouts is List ? List<dynamic>.from(workouts) : <dynamic>[];
    final mine = st.lm('exercises').map((e) => {...e, 'photo': absUrl(e.sn('photo'))}).toList();
    st['exercises'] = [...Catalog.library, ...mine];
    st['clients'] = st.lm('clients').map((c) => {...c, 'photos': c.lm('photos').map((p) => {...p, 'src': absUrl(p.sn('src'))}).toList()}).toList();
    st['subscriptions'] = st.lm('subscriptions').map((x) => {...x, 'receipt': absUrl(x.sn('receipt'))}).toList();
    final active = Map<String, dynamic>.from(st.m('active') ?? <String, dynamic>{});
    st['active'] = active;
    if (_pendingActive != null) active['${_pendingActive!.i('clientId')}'] = _pendingActive;
    final local = _localActive();
    if (local != null && local.i('clientId') == st.i('sessionUserId')) {
      final finished = st.lm('workouts').any((w) => w.s('ref') == local.s('id')) ||
          _ops.any((o) => o.s('kind') == 'finish' && o.m('body')?.m('session')?.s('id') == local.s('id'));
      final discarded = _ops.any((o) => o.s('kind') == 'discard' && o.m('args')?.s('id') == local.s('id'));
      final server = active['${local.i('clientId')}'] as Map?;
      if (finished || discarded) {
        _saveLocalActive(null);
      } else if (server == null || server['id'] == local.s('id')) {
        active['${local.i('clientId')}'] = local;
        if (server == null || jsonEncode(server) != jsonEncode(local)) Future.microtask(() => _queueActiveSave(local));
      }
    }
    return st;
  }

  void _render() {
    final raw = _lastRaw;
    if (raw == null) return;
    final d = _normalize(raw);
    final me = d.inn('sessionUserId');
    for (final op in [..._confirmed, ..._ops]) {
      if (op.inn('userId') != me) continue;
      try {
        _reduce(d, op);
      } catch (e) {
        debugLog('[sin conexión] ${op['kind']}: $e');
      }
    }
    s = d;
  }

  void _show({bool? off, bool? isBusy}) {
    if (off != null) offline = off;
    if (isBusy != null) busy = isBusy;
    _render();
    if (_lastRaw != null) status = Status.ready;
    notifyListeners();
  }

  /* ============================================================ Carga */
  /// Vuelve a pedir los datos al servidor.
  Future<void> reload() {
    if (!Api.I.hasSession) {
      _set(Status.guest, _blank());
      return Future.value();
    }
    return _loading ??= () async {
      try {
        final started = DateTime.now().millisecondsSinceEpoch;
        final haveHistory = _lastRaw != null && _lastRaw!['workouts'] is List ? _lastRaw!.sn('historyKey') : null;
        final r = await Api.I.call('GET', '/api/state', null, _lastRaw != null, null, null, haveHistory);
        if (r.notModified) {
          _confirmed.removeWhere((c) => c.i('confirmedAt') <= started);
          _backoff = 0;
          if (offline || busy || status != Status.ready) _show(off: false, isBusy: false);
          return;
        }
        if (!r.ok) {
          if (r.offline || r.status >= 500 || r.status == 429) {
            _backoff = math.min(60000, math.max(5000, _backoff * 2));
            if (_lastRaw != null) {
              _show(off: r.offline, isBusy: !r.offline);
              return;
            }
            bootError = r.error;
            _set(Status.offline, _blank());
            return;
          }
          if (!Api.I.hasSession) _set(Status.guest, _blank());
          return;
        }
        _backoff = 0;
        final data = r.json;
        if (data.b('historyKept') && _lastRaw?['workouts'] is List) data['workouts'] = _lastRaw!['workouts'];
        if (data['workouts'] is! List) {
          data['workouts'] = <dynamic>[];
          data['historyKey'] = null;
          Api.I.resetStateTag();
        }
        data.remove('historyKept');
        _lastRaw = data;
        _confirmed.removeWhere((c) => c.i('confirmedAt') <= started);
        _saveSnapshot();
        _show(off: false, isBusy: false);
        if (_mine.isNotEmpty) _kick();
        if (_pendingActive != null) _flushActive();
      } finally {
        _loading = null;
      }
    }();
  }

  /* ============================================================ Cola de acciones */
  static String _newOpId() {
    final r = math.Random.secure();
    return '${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${List.generate(8, (_) => r.nextInt(36).toRadixString(36)).join()}';
  }

  static J _mkOp(int? userId, String kind, String method, String path, Object? body, {Object? args, String? label, String? at}) => {
        'id': _newOpId(), 'userId': userId, 'kind': kind, 'method': method, 'path': path, 'body': body, 'args': args,
        'label': label ?? 'Cambio', 'at': at ?? DateTime.now().toUtc().toIso8601String(), 'tries': 0,
      };

  static const _blocked = ['consent_required', 'password_change', 'client_inactive', 'coach_license', 'license_required'];
  final Map<String, Completer<ApiResult>> _waiters = {};
  Timer? _kickTimer;
  Future<void>? _flushing;

  void _kick([int delayMs = 0]) {
    _kickTimer?.cancel();
    _kickTimer = Timer(Duration(milliseconds: delayMs), () => flushOutbox());
  }

  void _settle(String id, ApiResult r) {
    final c = _waiters.remove(id);
    if (c != null && !c.isCompleted) c.complete(r);
  }

  /// Sube las acciones pendientes, una por una y en orden.
  Future<void> flushOutbox() => _flushing ??= () async {
        try {
          if (!Api.I.hasSession || _uid == null) return;
          final done = <(String, ApiResult)>[];
          while (true) {
            final i = _ops.indexWhere((o) => o.inn('userId') == _uid);
            if (i < 0) break;
            final op = _ops[i];
            final r = await Api.I.call(op.s('method'), op.s('path'), op['body'], false, op.s('id'), op.sn('at'));
            if (!r.ok && (r.transient || r.status == 402 || _blocked.contains(r.code))) {
              op['tries'] = op.i('tries') + 1;
              op['lastError'] = r.error;
              _saveOps();
              for (final o in _ops) {
                _settle(o.s('id'), const ApiResult(data: {'ok': true, 'queued': true}));
              }
              final wait = r.retryAfter > 0 ? r.retryAfter * 1000 : math.min(60000, 2000 * math.pow(2, math.min(op.i('tries'), 5)).toInt());
              _kick(wait);
              _show(off: r.offline ? true : null);
              if (!r.offline && !r.transient) unawaited(reload()); // falta aceptar algo: se muestra la pantalla
              break;
            }
            _ops.removeAt(i);
            _saveOps();
            if (!r.ok) {
              _errors = [..._errors, {'id': op['id'], 'userId': op['userId'], 'label': op['label'], 'error': r.error, 'at': DateTime.now().toUtc().toIso8601String()}];
              if (_errors.length > 20) _errors = _errors.sublist(_errors.length - 20);
              _saveErrors();
              unawaited(Api.I.call('POST', '/api/sync/report', {
                'failed': [{'label': op['label'], 'path': op['path'], 'error': r.error}]
              }));
            } else {
              _confirmed.add({...op, 'confirmedAt': DateTime.now().millisecondsSinceEpoch});
            }
            done.add((op.s('id'), r));
          }
          if (done.isNotEmpty) {
            await reload();
            for (final (id, r) in done) {
              _settle(id, r);
            }
          }
        } finally {
          _flushing = null;
        }
      }();

  /// Quita el aviso de las acciones que el servidor no aceptó.
  void dismissSyncErrors() {
    _errors = _errors.where((e) => e.inn('userId') != _uid).toList();
    _saveErrors();
    notifyListeners();
  }

  /// Hace una acción.
  /// - Con [kind] se guarda en la cola: se ve al instante y se sube cuando hay señal.
  ///   Devuelve la respuesta del servidor o {queued: true} si quedó guardada para después.
  /// - Sin [kind] necesita conexión (crear cuentas, generar cobros…).
  Future<ApiResult> _act(String method, String path, [Object? body, String? kind, Object? args, String? label, int waitMs = 4000, String? at]) async {
    if (kind == null) {
      final r = await Api.I.call(method, path, body);
      if (r.ok) {
        await reload();
      } else if (r.status == 402 || _blocked.contains(r.code)) {
        await reload();
      }
      if (r.offline) return const ApiResult(error: 'Necesitas conexión a internet para hacer esto.', status: 0, offline: true);
      return r;
    }
    final op = _mkOp(_uid, kind, method, path, body, args: args, label: label, at: at);
    _ops.add(op);
    _saveOps();
    _show();
    final c = Completer<ApiResult>();
    _waiters[op.s('id')] = c;
    _kick();
    // La pantalla no espera a una red lenta: la acción sigue guardada y se sube sola
    return Future.any([c.future, Future.delayed(Duration(milliseconds: waitMs), () => const ApiResult(data: {'ok': true, 'queued': true, 'slow': true}))]);
  }

  /* ============================================================ Cómo se ve cada acción sin subir
     (idempotente: si el servidor ya la tiene, no se duplica) */
  static J? _find(List<dynamic> l, String key, Object? v) {
    for (final x in l) {
      if (x is Map && x[key] == v) return x.cast<String, dynamic>();
    }
    return null;
  }

  void _reduce(J d, J op) {
    final a = op.m('args') ?? <String, dynamic>{};
    final id = op.s('id');
    final at = op.s('at');
    List<dynamic> list(String k) => (d[k] as List?) ?? (d[k] = <dynamic>[]);
    J? client(int? cid) => _find(list('clients'), 'userId', cid);
    List<dynamic> sub(J c, String k) {
      final l = List<dynamic>.from(c[k] as List? ?? const []);
      c[k] = l;
      return l;
    }

    switch (op.s('kind')) {
      case 'msg':
        if (_find(list('messages'), 'id', 'm-$id') == null) {
          list('messages').add({'id': 'm-$id', 'coachId': a['coachId'], 'clientId': a['clientId'], 'from': a['from'], 'text': a['text'], 'at': at, 'read': false,
            'pending': true, 'exId': a['exId'], 'tag': a['tag']});
        }
      case 'read':
        for (final m in list('messages').cast<Map>()) {
          if (m['coachId'] == a['coachId'] && m['clientId'] == a['clientId'] && m['from'] != a['reader']) m['read'] = true;
        }
      case 'like':
        final p = _find(list('posts'), 'id', a['postId']);
        if (p != null) {
          final likes = List<dynamic>.from(p['likes'] as List? ?? const []);
          final on = likes.contains(a['userId']);
          if (a['value'] == true && !on) likes.add(a['userId']);
          if (a['value'] != true && on) likes.remove(a['userId']);
          p['likes'] = likes;
        }
      case 'post':
        if (_find(list('posts'), 'id', 'p-$id') == null) {
          list('posts').insert(0, {'id': 'p-$id', 'coachId': a['coachId'], 'authorId': a['authorId'], 'kind': a['kind'], 'text': a['text'], 'at': at,
            'likes': <dynamic>[], 'comments': <dynamic>[], 'workoutId': null, 'pending': true});
        }
      case 'comment':
        final p = _find(list('posts'), 'id', a['postId']);
        if (p != null && _find(p.l('comments'), 'id', 'c-$id') == null) {
          sub(p, 'comments').add({'id': 'c-$id', 'authorId': a['authorId'], 'text': a['text'], 'at': at, 'pending': true});
        }
      case 'delPost':
        list('posts').removeWhere((p) => p is Map && p['id'] == a['postId']);
      case 'weight':
        final c = client(a['clientId'] as int?);
        if (c != null && !c.l('weights').any((w) => w is Map && w['date'] == at && w['kg'] == a['kg'])) {
          sub(c, 'weights').add({'date': at, 'kg': a['kg'], 'pending': true});
        }
      case 'measure':
        final c = client(a['clientId'] as int?);
        if (c == null || _find(c.l('measurements'), 'id', 'ms-$id') != null) break;
        final date = a.sn('date') != null ? DateTime.parse('${a.s('date')}T08:00:00').toUtc().toIso8601String() : at;
        final row = <String, dynamic>{'id': 'ms-$id', 'date': date, 'note': a.s('note'), 'pending': true};
        for (final k in ['weight', 'fat', 'waist', 'hip', 'chest', 'arm', 'thigh']) {
          if (a.nn(k) != null) row[k] = a.nn(k);
        }
        sub(c, 'measurements')
          ..add(row)
          ..sort((x, y) => '${(x as Map)['date']}'.compareTo('${(y as Map)['date']}'));
        if (row['weight'] != null) sub(c, 'weights').add({'date': date, 'kg': row['weight']});
      case 'delMeasure':
        final c = client(a['clientId'] as int?);
        if (c != null) sub(c, 'measurements').removeWhere((m) => m is Map && m['id'] == a['id']);
      case 'note':
        final c = client(a['clientId'] as int?);
        if (c != null && _find(c.l('notes'), 'id', 'nt-$id') == null) {
          sub(c, 'notes').add({'id': 'nt-$id', 'at': at, 'category': a['category'], 'text': a['text'], 'pinned': false, 'pending': true});
        }
      case 'noteUpd':
        final c = client(a['clientId'] as int?);
        final n = c == null ? null : _find(sub(c, 'notes'), 'id', a['id']);
        if (n != null) n.addAll(a.m('patch') ?? {});
      case 'noteDel':
        final c = client(a['clientId'] as int?);
        if (c != null) sub(c, 'notes').removeWhere((n) => n is Map && n['id'] == a['id']);
      case 'routine':
        final c = client(a['clientId'] as int?);
        if (c != null) c[a['slot'] == 'plan' ? 'planRoutine' : 'routine'] = a['routine'];
      case 'clientUpd':
        final c = client(a['clientId'] as int?);
        final u = _find(list('users'), 'id', a['clientId']);
        final p = a.m('patch') ?? {};
        if (u != null && p['name'] != null) u['name'] = p['name'];
        if (u != null && p['email'] != null) u['email'] = p['email'];
        if (c != null) {
          for (final k in ['goal', 'phone', 'heightCm', 'fee', 'billingDay', 'active']) {
            if (p.containsKey(k)) c[k] = p[k];
          }
        }
      case 'profile':
        final u = _find(list('users'), 'id', a['userId']);
        if (u == null) break;
        final p = a.m('patch') ?? {};
        for (final e in p.entries) {
          if (e.key != 'notif') u[e.key] = e.value;
        }
        if (p['notif'] is Map) u['notif'] = {...?(u['notif'] as Map?)?.cast<String, dynamic>(), ...(p['notif'] as Map).cast<String, dynamic>()};
        if (p.containsKey('phone')) client(a['userId'] as int?)?['phone'] = p['phone'];
      case 'brand':
        final u = _find(list('users'), 'id', a['userId']);
        if (u != null) u['brand'] = {...?(u['brand'] as Map?)?.cast<String, dynamic>(), ...?a.m('patch')};
      case 'pay':
        if (_find(list('payments'), 'id', 'pay-$id') != null) break;
        list('payments').add({'id': 'pay-$id', 'coachId': a['coachId'], 'clientId': a['clientId'], 'concept': a['concept'], 'amount': a['amount'],
          'dueDate': DateTime.parse('${a.s('dueDate')}T09:00:00').toUtc().toIso8601String(), 'paidAt': a.b('paid') ? at : null,
          'method': a.b('paid') ? a.s('method') : '', 'pending': true});
      case 'paid':
        final p = _find(list('payments'), 'id', a['id']);
        if (p != null && p['paidAt'] == null) {
          p['paidAt'] = at;
          p['method'] = a['method'] ?? '';
        }
      case 'unpaid':
        final p = _find(list('payments'), 'id', a['id']);
        if (p != null) {
          p['paidAt'] = null;
          p['method'] = '';
        }
      case 'payDel':
        list('payments').removeWhere((p) => p is Map && p['id'] == a['id']);
      case 'tpl':
        if (_find(list('templates'), 'id', 't-$id') == null) {
          list('templates').insert(0, {...?a.m('routine'), 'name': a['name'], 'id': 't-$id', 'coachId': a['coachId'], 'createdAt': at, 'pending': true});
        }
      case 'tplDel':
        list('templates').removeWhere((t) => t is Map && t['id'] == a['id']);
      case 'exUpd':
        final e = _find(list('exercises'), 'id', a['id']);
        if (e != null) {
          final p = Map<String, dynamic>.from(a.m('patch') ?? {});
          final photo = p.remove('photo');
          e.addAll(p);
          if ((a.m('patch') ?? {}).containsKey('photo')) e['photo'] = photo;
        }
      case 'exDel':
        list('exercises').removeWhere((x) => x is Map && x['id'] == a['id']);
      case 'photos':
        final c = client(a['clientId'] as int?);
        if (c == null) break;
        final photos = a.lm('photos');
        for (var k = 0; k < photos.length; k++) {
          final pid = k == 0 ? 'ph-$id' : 'ph-$id-$k';
          if (_find(c.l('photos'), 'id', pid) != null) continue;
          final p = photos[k];
          sub(c, 'photos').insert(0, {'id': pid, 'src': p['src'], 'pose': p['pose'], 'note': p.s('note'),
            'date': p.sn('date') != null ? DateTime.parse('${p.s('date')}T08:00:00').toUtc().toIso8601String() : at, 'by': a['by'], 'at': at, 'pending': true});
        }
      case 'photoDel':
        final c = client(a['clientId'] as int?);
        if (c != null) sub(c, 'photos').removeWhere((p) => p is Map && p['id'] == a['id']);
      case 'finish':
        final b = op.m('body') ?? {};
        final ses = b.m('session') ?? {};
        (d['active'] as Map).remove('${ses['clientId']}');
        if (list('workouts').any((w) => w is Map && w['ref'] == ses['id'])) break;
        final fin = b.sn('finishedAt') ?? at;
        final started = ses.d('startedAt');
        final exercises = ses.lm('exercises').map((e) => {
              'exId': e['exId'], 'target': e['target'],
              'sets': e.lm('sets').map((x) {
                final drops = x.lm('drops').where((dd) => dd.b('done')).map((dd) => {'weight': dd.n('weight'), 'reps': dd.i('reps'), 'done': true}).toList();
                return {'weight': x.n('weight'), 'reps': x.n('reps').round(), 'done': x.b('done'), if (drops.isNotEmpty) 'drops': drops};
              }).toList(),
            }).toList();
        list('workouts').add({'id': 'w-$id', 'ref': ses['id'], 'clientId': ses['clientId'], 'finishedAt': fin, 'dayId': ses['dayId'], 'dayName': ses['dayName'],
          'routineName': ses['routineName'], 'startedAt': ses['startedAt'],
          'durationSec': started == null ? 0 : math.max(0, (DateTime.tryParse(fin) ?? DateTime.now()).difference(started).inSeconds),
          'difficulty': b['difficulty'], 'comment': b.s('comment'), 'prs': <dynamic>[], 'exercises': exercises, 'pending': true});
      case 'discard':
        final act = d['active'] as Map;
        if ((act['${a['clientId']}'] as Map?)?['id'] == a['id']) act.remove('${a['clientId']}');
    }
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
  List<J> get reviews => s.lm('reviews');
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

  void _freshSession() {
    _lastRaw = null;
    _confirmed.clear();
    Api.I.resetStateTag();
    Disk.write(_fState, null);
  }

  Future<ApiResult> _enter(ApiResult r) async {
    _freshSession();
    await Api.I.setTokens(r.json);
    status = Status.boot;
    await reload();
    return r;
  }

  Future<ApiResult> login(String email, String password, [String? brandSlug]) async {
    final r = await Api.I.call('POST', '/api/auth/login', {'email': email.trim(), 'password': password, if (brandSlug != null && brandSlug.isNotEmpty) 'brandSlug': brandSlug});
    if (!r.ok) {
      return r.offline ? const ApiResult(error: 'Para entrar necesitas conexión a internet. Después puedes usar la app sin señal.', status: 0, offline: true) : r;
    }
    return _enter(r);
  }

  /// Al salir a propósito se borra lo guardado en el celular (datos y cambios sin subir de esta cuenta).
  Future<void> logout() async {
    await Push.I.unregister();
    final rt = Api.I.refreshToken;
    final me = _uid;
    _pendingActive = null;
    _ops.removeWhere((o) => o.inn('userId') == me);
    _saveOps();
    _errors.removeWhere((e) => e.inn('userId') == me);
    _saveErrors();
    _saveLocalActive(null);
    _freshSession();
    Api.I.call('POST', '/api/auth/logout', {'refreshToken': rt});
    await Api.I.setTokens(null);
    _set(Status.guest, _blank());
  }

  Future<void> logoutAll() async {
    final r = await Api.I.call('POST', '/api/auth/logout-all', {});
    if (!r.ok) return;
    _freshSession();
    await Api.I.setTokens(null);
    _set(Status.guest, _blank());
  }

  Future<ApiResult> changePassword(String current, String next) async {
    final r = await Api.I.call('POST', '/api/auth/password', {'current': current, 'next': next});
    if (!r.ok) return r.offline ? const ApiResult(error: 'Necesitas conexión a internet para cambiar la contraseña.', status: 0, offline: true) : r;
    await Api.I.setTokens(r.json);
    await reload();
    return r;
  }

  // Reseñas: el asesorado escribe la suya; el entrenador la aprueba (sale en su página) o la rechaza (se borra)
  Future<ApiResult> saveMyReview(J r) => _act('PUT', '/api/client/review', r);
  Future<ApiResult> deleteMyReview() => _act('DELETE', '/api/client/review');
  Future<ApiResult> approveReview(String id) => _act('POST', '/api/coach/reviews/$id/approve', <String, dynamic>{});
  Future<ApiResult> rejectReview(String id) => _act('DELETE', '/api/coach/reviews/$id');

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
    return _enter(r);
  }

  Future<ApiResult> signupWithCoach(J data) async {
    final r = await Api.I.call('POST', '/api/public/signup', data);
    if (!r.ok) return r;
    return _enter(r);
  }

  Future<ApiResult> redeemCode(String code) => _act('POST', '/api/coach/redeem', {'code': code});
  Future<ApiResult> requestSubscription(J data) => _act('POST', '/api/coach/subscriptions', data);

  /* ============================================================ Entrenador */
  String _first(int id) => (userById(id)?.s('name') ?? '').split(' ').first;

  // Crear cuentas, contraseñas y borrar asesorados necesitan conexión
  Future<ApiResult> addClient(J d) => _act('POST', '/api/coach/clients', d);
  Future<ApiResult> updateClient(int id, J p) => _act('PATCH', '/api/coach/clients/$id', p, 'clientUpd', {'clientId': id, 'patch': p}, 'Datos de ${_first(id)}');
  Future<ApiResult> resetClientPassword(int id) => _act('POST', '/api/coach/clients/$id/reset-password', {});
  Future<ApiResult> deleteClient(int id) => _act('DELETE', '/api/coach/clients/$id');
  Future<ApiResult> addBodyWeight(int clientId, double kgValue) {
    final args = {'clientId': clientId, 'kg': kgValue};
    final label = 'Peso ${kg(kgValue)} kg';
    return isCoach
        ? _act('POST', '/api/coach/clients/$clientId/weight', {'kg': kgValue}, 'weight', args, label)
        : _act('POST', '/api/client/weight', {'kg': kgValue}, 'weight', args, label);
  }

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

  Future<ApiResult> saveRoutine(int clientId, J? routine, [String slot = 'current']) {
    final clean = routine == null ? null : cleanRoutine(routine);
    return _act('PUT', '/api/coach/clients/$clientId/routine', {'routine': clean, 'slot': slot}, 'routine', {'clientId': clientId, 'routine': clean, 'slot': slot},
        'Rutina de ${_first(clientId)}');
  }

  // Plan de prueba: se guarda sin conexión y el servidor lo aplica al volver la señal
  Future<ApiResult> startTrial(int id, int days, double fee) => _act('POST', '/api/coach/clients/$id/trial', {'days': days, 'fee': fee}, 'trial', null, 'Prueba de ${_first(id)}');
  Future<ApiResult> extendTrial(int id, int days) => _act('POST', '/api/coach/clients/$id/trial/extend', {'days': days}, 'trial', null, 'Extender prueba de ${_first(id)}');
  Future<ApiResult> convertTrial(int id) => _act('POST', '/api/coach/clients/$id/trial/convert', {}, 'trial', null, 'Plan completo de ${_first(id)}');
  Future<ApiResult> cancelTrial(int id) => _act('POST', '/api/coach/clients/$id/trial/cancel', {'pause': true}, 'trial', null, 'Cancelar prueba de ${_first(id)}');
  Future<ApiResult> saveTemplate(J routine, String name) {
    final clean = cleanRoutine(routine);
    return _act('POST', '/api/coach/templates', {'routine': clean, 'name': name}, 'tpl', {'routine': clean, 'name': name, 'coachId': meId}, 'Plantilla «$name»');
  }

  Future<ApiResult> deleteTemplate(String id) => _act('DELETE', '/api/coach/templates/$id', null, 'tplDel', {'id': id}, 'Borrar plantilla');

  Future<ApiResult> upsertExercise(J data) {
    final id = data.inn('id');
    final photo = data.sn('photo');
    final body = <String, dynamic>{
      for (final k in ['name', 'muscle', 'equipment', 'level', 'primary', 'secondary', 'steps', 'cues', 'reps']) k: data[k],
      'sets': data.i('sets', 3), 'rest': data.i('rest', 60),
      'photo': photo != null && photo.startsWith('data:') ? photo : null,
    };
    if (photo != null && !photo.startsWith('data:')) body.remove('photo');
    // Un ejercicio nuevo necesita conexión (el servidor le da su número); editarlo, no
    return id != null
        ? _act('PUT', '/api/coach/exercises/$id', body, 'exUpd', {'id': id, 'patch': body}, 'Ejercicio «${data.s('name')}»')
        : _act('POST', '/api/coach/exercises', body);
  }

  Future<ApiResult> deleteExercise(int id) => _act('DELETE', '/api/coach/exercises/$id', null, 'exDel', {'id': id}, 'Borrar ejercicio');
  Future<ApiResult> addPayment(J p) => _act('POST', '/api/coach/payments', p, 'pay', {...p, 'coachId': meId}, 'Pago «${p.s('concept')}»');
  Future<ApiResult> markPaid(String id, String method) => _act('POST', '/api/coach/payments/$id/paid', {'method': method}, 'paid', {'id': id, 'method': method}, 'Marcar pagado');
  Future<ApiResult> markUnpaid(String id) => _act('POST', '/api/coach/payments/$id/unpaid', {}, 'unpaid', {'id': id}, 'Marcar pendiente');
  Future<ApiResult> deletePayment(String id) => _act('DELETE', '/api/coach/payments/$id', null, 'payDel', {'id': id}, 'Borrar pago');
  Future<int> generateMonthly() async {
    final r = await _act('POST', '/api/coach/payments/generate-monthly', {});
    return r.ok ? r.json.i('created') : 0;
  }

  Future<ApiResult> updateBrand(J p) => _act('PUT', '/api/coach/brand', p, 'brand', {'userId': meId, 'patch': p}, 'Marca');
  Future<ApiResult> addMeasurement(int clientId, J m) =>
      _act('POST', '/api/coach/clients/$clientId/measurements', m, 'measure', {'clientId': clientId, ...m}, 'Medidas de ${_first(clientId)}');
  Future<ApiResult> deleteMeasurement(int clientId, String id) =>
      _act('DELETE', '/api/coach/clients/$clientId/measurements/$id', null, 'delMeasure', {'clientId': clientId, 'id': id}, 'Borrar medidas');
  Future<ApiResult> addPhotos(int clientId, List<J> photos) {
    final args = {'clientId': clientId, 'photos': photos, 'by': meId};
    final label = photos.length == 1 ? 'Foto de progreso' : '${photos.length} fotos de progreso';
    return isCoach
        ? _act('POST', '/api/coach/clients/$clientId/photos', {'photos': photos}, 'photos', args, label)
        : _act('POST', '/api/client/photos', {'photos': photos}, 'photos', args, label);
  }

  Future<ApiResult> deletePhoto(int clientId, String id) => isCoach
      ? _act('DELETE', '/api/coach/clients/$clientId/photos/$id', null, 'photoDel', {'clientId': clientId, 'id': id}, 'Borrar foto')
      : _act('DELETE', '/api/client/photos/$id', null, 'photoDel', {'clientId': clientId, 'id': id}, 'Borrar foto');
  Future<ApiResult> addNote(int clientId, J n) => _act('POST', '/api/coach/clients/$clientId/notes', n, 'note', {'clientId': clientId, ...n}, 'Nota de ${_first(clientId)}');
  Future<ApiResult> updateNote(int clientId, String id, J p) =>
      _act('PATCH', '/api/coach/clients/$clientId/notes/$id', p, 'noteUpd', {'clientId': clientId, 'id': id, 'patch': p}, 'Editar nota');
  Future<ApiResult> deleteNote(int clientId, String id) =>
      _act('DELETE', '/api/coach/clients/$clientId/notes/$id', null, 'noteDel', {'clientId': clientId, 'id': id}, 'Borrar nota');

  /* ============================================================ Compartido */
  Future<ApiResult> updateProfile(J p) => _act('PUT', '/api/profile', p, 'profile', {'userId': meId, 'patch': p}, 'Perfil');
  Future<ApiResult> saveReminder(J reminder) => _act('PUT', '/api/profile', {'notif': {'reminder': reminder}}, 'profile', {
        'userId': meId,
        'patch': {'notif': {'reminder': reminder}}
      }, 'Recordatorio');

  Future<ApiResult> sendMessage(int coachId, int clientId, String text, [J? ref]) {
    final tagged = ref?.inn('exId') != null ? {'exId': ref!.i('exId'), 'tag': ref.s('tag', 'comentario')} : <String, dynamic>{};
    final clean = text.trim();
    return _act('POST', '/api/messages', {'text': clean, ...tagged, if (isCoach) 'clientId': clientId}, 'msg',
        {'coachId': coachId, 'clientId': clientId, 'from': meId, 'text': clean, ...tagged}, 'Mensaje: «${clean.length > 40 ? clean.substring(0, 40) : clean}»');
  }

  void markThreadRead(int coachId, int clientId) {
    final reader = meId;
    if (!messages.any((m) => m.i('coachId') == coachId && m.i('clientId') == clientId && m.i('from') != reader && !m.b('read'))) return;
    if (_mine.any((o) => o.s('kind') == 'read' && o.m('args')?.i('coachId') == coachId && o.m('args')?.i('clientId') == clientId)) return;
    _act('POST', '/api/messages/read', isCoach ? {'clientId': clientId} : {}, 'read', {'coachId': coachId, 'clientId': clientId, 'reader': reader}, 'Mensajes leídos');
  }

  Future<ApiResult> addPost(String text, String kind) {
    final coachId = isCoach ? meId : myClient?.inn('coachId');
    return _act('POST', '/api/posts', {'text': text, 'kind': kind}, 'post', {'coachId': coachId, 'authorId': meId, 'text': text.trim(), 'kind': kind},
        kind == 'challenge' ? 'Reto' : 'Publicación');
  }

  Future<ApiResult> toggleLike(String postId) {
    final p = posts.firstWhere((x) => x.s('id') == postId, orElse: () => <String, dynamic>{});
    final value = !p.l('likes').contains(meId);
    return _act('POST', '/api/posts/$postId/like', {}, 'like', {'postId': postId, 'userId': meId, 'value': value}, value ? 'Me gusta' : 'Quitar me gusta');
  }

  Future<ApiResult> addComment(String postId, String text) =>
      _act('POST', '/api/posts/$postId/comments', {'text': text}, 'comment', {'postId': postId, 'authorId': meId, 'text': text.trim()}, 'Comentario');
  Future<ApiResult> deletePost(String postId) => _act('DELETE', '/api/posts/$postId', null, 'delPost', {'postId': postId}, 'Borrar publicación');
  Future<ApiResult> exportMyData() => Api.I.call('GET', '/api/account/export');
  Future<ApiResult> deleteMyAccount(String password) async {
    final r = await Api.I.call('DELETE', '/api/account', {'password': password});
    if (!r.ok) return r;
    _ops.removeWhere((o) => o.inn('userId') == _uid);
    _saveOps();
    _freshSession();
    await Api.I.setTokens(null);
    _set(Status.guest, _blank());
    return r;
  }

  Future<J> pushConfig() async => (await Api.I.call('GET', '/api/push/config')).json;

  /* ============================================================ Entrenamiento en vivo
     Se edita al instante, queda guardado en el celular y se copia al servidor cada
     pocos segundos (si se cierra la app, se retoma; sin señal se sube después). */
  void _queueActiveSave(J a) {
    _pendingActive = a;
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 1200), _flushActive);
  }

  Future<void> _flushActive() async {
    final a = _pendingActive;
    if (a == null) return;
    _activeRetry?.cancel();
    final r = await Api.I.call('PUT', '/api/client/workout/active', a, false, null, null, null, const Duration(seconds: 15));
    if (r.ok) {
      if (identical(_pendingActive, a)) _pendingActive = null;
      return;
    }
    if (r.transient) _activeRetry = Timer(const Duration(seconds: 30), () => _pendingActive != null ? _flushActive() : null);
  }

  String _uidGen(String p) => '$p${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${math.Random().nextInt(1 << 20).toRadixString(36)}';
  String newUid() => _uidGen('re-');

  void startWorkout(int clientId, [String? dayId]) {
    if (hasActive(clientId)) return;
    final c = clientById(clientId);
    final routine = c?.m('routine');
    final days = routine?.lm('days') ?? const <J>[];
    if (days.isEmpty) return;
    final day = days.firstWhere((x) => x.s('id') == dayId, orElse: () => days.first);
    final a = <String, dynamic>{
      'id': _uidGen('w-'), 'clientId': clientId, 'dayId': day.s('id'), 'dayName': day.s('name'), 'routineName': routine!.s('name'),
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
    _patchActive(clientId, a);
    _saveLocalActive(a);
    _pendingActive = a;
    _flushActive();
  }

  void updateWorkout(int clientId, void Function(J a) fn) {
    if (!hasActive(clientId)) return;
    final next = copyJ(active(clientId));
    fn(next);
    _patchActive(clientId, next);
    _saveLocalActive(next);
    _queueActiveSave(next);
  }

  Future<void> discardWorkout(int clientId) async {
    final a = active(clientId);
    _saveTimer?.cancel();
    _pendingActive = null;
    _saveLocalActive(null);
    _patchActive(clientId, null);
    await _act('DELETE', '/api/client/workout/active', null, 'discard', {'clientId': clientId, 'id': a['id']}, 'Descartar entrenamiento');
  }

  /// Guarda el entrenamiento. Sin señal queda en el celular (ya aparece en el historial) y se sube solo después.
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
    final finishedAt = DateTime.now().toUtc().toIso8601String();
    final body = <String, dynamic>{'session': a, 'difficulty': difficulty, 'comment': comment, 'share': share, if (prName != null) 'prName': prName, 'finishedAt': finishedAt};
    _pendingActive = null;
    _saveLocalActive(null);
    final r = await _act('POST', '/api/client/workout/finish', body, 'finish', null, 'Entrenamiento ${a.s('dayName')}'.trim(), 9000, finishedAt);
    if (r.queued) {
      final started = a.d('startedAt') ?? DateTime.now();
      return ApiResult(data: {
        'queued': true, 'slow': r.json.b('slow'), 'durationSec': DateTime.now().difference(started).inSeconds,
        'done': a.lm('exercises').fold<int>(0, (t, e) => t + e.lm('sets').where((x) => x.b('done')).length),
        'volume': sessionVolume(a), 'prs': <dynamic>[], 'comment': comment,
      });
    }
    return r;
  }
}

/// Atajo global.
AppStore get store => AppStore.I;

void debugLog(Object o) {
  if (kDebugMode) debugPrint('$o');
}
