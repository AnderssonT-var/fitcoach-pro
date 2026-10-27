// Entrenamiento en vivo: cada serie se registra con peso y repeticiones; al marcarla
// arranca el descanso que definió el entrenador (con aviso aunque la pantalla esté
// apagada). Superseries, drop sets, RIR/RPE y tempo. Todo se guarda al instante.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../app.dart';
import '../../core/catalog.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/notify.dart';
import '../../core/store.dart';
import '../../core/techniques.dart';
import '../../ui/charts.dart';
import '../../ui/muscle_map.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shared/exercise_ui.dart';
import '../shared/progress_widgets.dart';

double _setVolume(J x) {
  var v = x.b('done') ? x.n('weight') * x.n('reps') : 0.0;
  for (final d in x.lm('drops')) {
    if (d.b('done')) v += d.n('weight') * d.n('reps');
  }
  return v;
}

class WorkoutSession extends StatefulWidget {
  final int clientId;
  const WorkoutSession({super.key, required this.clientId});
  @override
  State<WorkoutSession> createState() => _WorkoutSessionState();
}

enum _Stage { train, finish, done }

class _WorkoutSessionState extends State<WorkoutSession> with WidgetsBindingObserver {
  _Stage stage = _Stage.train;
  Timer? tick;
  DateTime now = DateTime.now();
  bool flash = false;
  int difficulty = 3;
  final comment = TextEditingController();
  bool share = true, saving = false;
  J? result;
  J? keep; // copia para la pantalla final (el entrenamiento ya no está «en curso»)
  int? notified;
  final cardKeys = <int, GlobalKey>{};
  final scroll = ScrollController();

  int get cid => widget.clientId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WakelockPlus.enable().catchError((_) {});
    tick = Timer.periodic(const Duration(milliseconds: 250), (_) => _onTick());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    tick?.cancel();
    WakelockPlus.disable().catchError((_) {});
    Notify.I.armRestAlarm(null);
    comment.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    final a = store.hasActive(cid) ? store.active(cid) : null;
    final rest = a?.inn('restEndsAt');
    if (s == AppLifecycleState.paused || s == AppLifecycleState.hidden) {
      Notify.I.armRestAlarm(rest != null && rest > DateTime.now().millisecondsSinceEpoch ? DateTime.fromMillisecondsSinceEpoch(rest) : null);
    } else if (s == AppLifecycleState.resumed) {
      Notify.I.armRestAlarm(null);
    }
  }

  void _onTick() {
    if (!mounted) return;
    setState(() => now = DateTime.now());
    if (!store.hasActive(cid)) return;
    final rest = store.active(cid).inn('restEndsAt');
    if (rest == null || now.millisecondsSinceEpoch < rest || notified == rest) return;
    notified = rest;
    HapticFeedback.heavyImpact();
    Future.delayed(const Duration(milliseconds: 180), HapticFeedback.heavyImpact);
    SystemSound.play(SystemSoundType.alert);
    setState(() => flash = true);
    Future.delayed(const Duration(milliseconds: 2600), () {
      if (mounted) setState(() => flash = false);
    });
    store.updateWorkout(cid, (a) => a['restEndsAt'] = null);
  }

  void upd(void Function(J a) fn) => store.updateWorkout(cid, fn);

  List<J> _ex(J a) => (a['exercises'] as List).cast<Map>().map((e) => e.cast<String, dynamic>()).toList();
  List<J> _sets(J e) => (e['sets'] as List).cast<Map>().map((s) => s.cast<String, dynamic>()).toList();

  void _startRest(J a, J ex) {
    final left = _ex(a).any((e) => _sets(e).any((x) => !x.b('done') || x.lm('drops').any((d) => !d.b('done'))));
    final total = parseRest(ex.m('target')?['rest']);
    a['restTotal'] = total;
    a['restEndsAt'] = left ? DateTime.now().millisecondsSinceEpoch + total * 1000 : null;
  }

  int? _afterRound(J a, int ei, int si) {
    final exs = _ex(a);
    final nx = afterSet(exs, ei, si);
    final g = supersets(exs.map((e) => e.m('target') ?? <String, dynamic>{}).toList())[ei];
    if (nx.rest) {
      _startRest(a, g != null ? exs[g.end] : exs[ei]);
    } else {
      a['restEndsAt'] = null;
    }
    if (nx.next != null) {
      a['focus'] = nx.next;
    } else {
      a.remove('focus');
    }
    if (nx.next != null) return nx.next;
    return _sets(exs[ei]).every((x) => x.b('done')) ? ei + 1 : null;
  }

  void toggle(int ei, int si) {
    int? goTo;
    upd((a) {
      final ex = _ex(a)[ei];
      final st = _sets(ex)[si];
      if (st.b('done')) {
        st['done'] = false;
        return;
      }
      if (st.s('weight').isEmpty && st['prevWeight'] != null) st['weight'] = kgRaw(st.n('prevWeight'));
      if (st.s('reps').isEmpty) st['reps'] = (st['prevReps'] ?? repsLow(ex.m('target')?['reps']) ?? '').toString();
      st['done'] = true;
      if (st.lm('drops').any((d) => !d.b('done'))) {
        a['restEndsAt'] = null;
        return;
      }
      goTo = _afterRound(a, ei, si);
    });
    HapticFeedback.lightImpact();
    _scrollTo(goTo, ei);
  }

  void toggleDrop(int ei, int si, int di) {
    int? goTo;
    upd((a) {
      final ex = _ex(a)[ei];
      final st = _sets(ex)[si];
      final drops = (st['drops'] as List).cast<Map>();
      final d = drops[di].cast<String, dynamic>();
      if (d.b('done')) {
        d['done'] = false;
        return;
      }
      final pct = ex.m('target')?.m('drop')?.n('pct', 20) ?? 20;
      if (d.s('weight').isEmpty) {
        final w = dropWeight(st.nn('weight') ?? st.nn('prevWeight') ?? 0, pct, di + 1);
        d['weight'] = w > 0 ? kgRaw(w) : '';
      }
      if (d.s('reps').isEmpty) d['reps'] = (d['prevReps'] ?? '').toString();
      st['done'] = true;
      d['done'] = true;
      if (drops.any((x) => x['done'] != true)) return;
      goTo = _afterRound(a, ei, si);
    });
    HapticFeedback.lightImpact();
    _scrollTo(goTo, ei);
  }

  void _scrollTo(int? target, int from) {
    if (target == null || target == from) return;
    Future.delayed(const Duration(milliseconds: 260), () {
      final ctx = cardKeys[target]?.currentContext;
      if (ctx != null && ctx.mounted) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 380), curve: Curves.easeOutCubic, alignment: .02);
    });
  }

  void edit(int ei, int si, String k, String v) => upd((a) => _sets(_ex(a)[ei])[si][k] = v.replaceAll(',', '.'));
  void editDrop(int ei, int si, int di, String k, String v) => upd((a) => ((_sets(_ex(a)[ei])[si]['drops'] as List)[di] as Map)[k] = v.replaceAll(',', '.'));

  void addSet(int ei) => upd((a) {
        final ex = _ex(a)[ei];
        final ss = ex['sets'] as List;
        final l = (ss.isEmpty ? <String, dynamic>{} : (ss.last as Map).cast<String, dynamic>());
        final drop = ex.m('target')?.m('drop');
        ss.add({
          'weight': l['weight'] ?? '', 'reps': '', 'prevWeight': l['prevWeight'], 'prevReps': l['prevReps'], 'done': false,
          if (drop != null && drop.s('on') == 'all') 'drops': List.generate(drop.i('count'), (_) => {'weight': '', 'reps': '', 'done': false}),
        });
      });

  void removeSet(int ei) => upd((a) {
        final ss = _ex(a)[ei]['sets'] as List;
        if (ss.length > 1 && (ss.last as Map)['done'] != true) ss.removeLast();
      });

  void adjust(int d) => upd((a) {
        final r = a.inn('restEndsAt');
        if (r == null) return;
        final minEnd = DateTime.now().millisecondsSinceEpoch + 1000;
        final next = r + d * 1000;
        a['restEndsAt'] = next < minEnd ? minEnd : next;
        final total = a.i('restTotal') + d;
        a['restTotal'] = total < 1 ? 1 : (total > 3600 ? 3600 : total);
      });

  Future<void> save() async {
    if (saving) return;
    setState(() => saving = true);
    keep = copyJ(store.active(cid));
    final r = await store.finishWorkout(cid, difficulty: difficulty, comment: comment.text.trim(), share: share);
    if (!mounted) return;
    setState(() => saving = false);
    if (!r.ok) {
      toast(context, '${r.error} Tus series no se perdieron: vuelve a tocar Guardar.', error: true);
      return;
    }
    if (r.json.b('queued')) {
      toast(context, r.json.b('slow') ? 'La señal está lenta: el entrenamiento ya quedó guardado y se termina de subir solo.' : 'Sin conexión: el entrenamiento quedó guardado en tu celular y se subirá solo.',
          icon: Icons.wifi_off_rounded);
    }
    HapticFeedback.mediumImpact();
    setState(() {
      result = r.json;
      stage = _Stage.done;
    });
  }

  Future<void> exitSheet() async {
    final t = context.tok;
    final r = await showSheet<String>(context, title: '¿Salir del entrenamiento?', builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Tu progreso queda guardado. Puedes continuar desde Inicio cuando quieras.', style: ctx.tt.bodyMedium),
          const Gap(16),
          FilledButton(onPressed: () => Navigator.pop(ctx), child: const Text('Seguir entrenando')),
          const Gap(10),
          OutlinedButton(onPressed: () => Navigator.pop(ctx, 'leave'), child: const Text('Salir y continuar después')),
          const Gap(10),
          TextButton(onPressed: () => Navigator.pop(ctx, 'discard'), style: TextButton.styleFrom(foregroundColor: t.bad), child: const Text('Descartar entrenamiento')),
        ]));
    if (!mounted) return;
    if (r == 'leave') Navigator.pop(context);
    if (r == 'discard' &&
        await confirm(context, title: 'Descartar entrenamiento', text: 'Se borran las series que registraste en esta sesión.', confirmLabel: 'Descartar') &&
        mounted) {
      store.discardWorkout(cid);
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final live = store.hasActive(cid) ? store.active(cid) : null;
      if (live != null) keep = live;
      final s = live ?? keep;
      if (s == null) return const Scaffold(body: SizedBox());
      final t = context.tok;
      final exs = _ex(s);
      final all = exs.expand(_sets).toList();
      final done = all.where((x) => x.b('done')).length;
      final volume = exs.fold<double>(0, (v, e) => v + _sets(e).fold<double>(0, (a, x) => a + _setVolume(x)));
      final pct = all.isEmpty ? 0 : (done / all.length * 100).round();
      final started = s.d('startedAt') ?? now;
      final elapsed = now.difference(started).inSeconds;
      final rest = live?.inn('restEndsAt');
      final restLeft = rest == null ? null : ((rest - now.millisecondsSinceEpoch) / 1000).ceil();
      final focus = s.inn('focus');
      final current = focus != null && focus < exs.length && _sets(exs[focus]).any((x) => !x.b('done')) ? focus : exs.indexWhere((e) => _sets(e).any((x) => !x.b('done')));
      final client = store.clientById(cid) ?? {};
      final coach = store.userById(client.i('coachId')) ?? {};
      final coachFirst = firstName(coach.s('name'));

      return PopScope(
        canPop: stage == _Stage.done,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) return;
          if (stage == _Stage.finish) {
            setState(() => stage = _Stage.train);
          } else {
            exitSheet();
          }
        },
        child: Scaffold(
          body: Column(children: [
            // ---------- encabezado
            Container(
              decoration: BoxDecoration(color: t.surface, border: Border(bottom: BorderSide(color: t.line))),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 6, 12, 12),
                  child: Column(children: [
                    Row(children: [
                      if (stage == _Stage.train)
                        IconButton(onPressed: exitSheet, icon: const Icon(Icons.close_rounded), tooltip: 'Salir del entrenamiento')
                      else if (stage == _Stage.finish)
                        IconButton(onPressed: () => setState(() => stage = _Stage.train), icon: const Icon(Icons.arrow_back_rounded), tooltip: 'Volver')
                      else
                        const SizedBox(width: 48),
                      Expanded(
                        child: Column(children: [
                          Text('${s.s('dayName')} · ${s.s('routineName')}', maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.bodySmall),
                          Text(clock(stage == _Stage.done && result != null ? result!.n('durationSec') : elapsed),
                              style: context.tt.displaySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                        ]),
                      ),
                      if (stage == _Stage.train)
                        FilledButton(onPressed: () => setState(() => stage = _Stage.finish), style: FilledButton.styleFrom(minimumSize: const Size(0, 42)), child: const Text('Terminar'))
                      else
                        const SizedBox(width: 48),
                    ]),
                    const Gap(8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Column(children: [
                        Bar(pct / 100, color: pct == 100 ? t.ok : null, height: 7),
                        const Gap(6),
                        Row(children: [
                          Text('$done de ${all.length} series', style: context.tt.bodySmall),
                          const Spacer(),
                          Text('${tons(volume)} levantados', style: context.tt.bodySmall),
                        ]),
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
            // ---------- contenido
            Expanded(
              child: switch (stage) {
                _Stage.train => ListView(
                    controller: scroll,
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                    children: [
                      for (final b in blocksOf(exs.map((e) => e.m('target') ?? <String, dynamic>{}).toList()))
                        Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: b.superset
                              ? Container(
                                  padding: const EdgeInsets.fromLTRB(8, 10, 8, 8),
                                  decoration: BoxDecoration(color: t.accentSoft, borderRadius: BorderRadius.circular(26)),
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
                                      child: Row(children: [
                                        Icon(Icons.link_rounded, size: 18, color: t.accent),
                                        const SizedBox(width: 6),
                                        Text('Superserie ${b.letter}', style: context.tt.titleSmall?.copyWith(color: t.accent)),
                                        const SizedBox(width: 8),
                                        Expanded(child: Text('Alterna sin descanso · descansas al terminar la ronda', style: context.tt.bodySmall)),
                                      ]),
                                    ),
                                    for (final (k, ei) in b.items.indexed) ...[
                                      if (k > 0) const Gap(8),
                                      _card(context, exs, ei, current, '${b.letter}${k + 1}', coachFirst, client),
                                    ],
                                  ]),
                                )
                              : _card(context, exs, b.items.first, current, null, coachFirst, client),
                        ),
                    ],
                  ),
                _Stage.finish => _FinishView(
                    elapsed: elapsed, done: done, total: all.length, volume: volume, difficulty: difficulty, comment: comment, share: share, coachFirst: coachFirst,
                    onDifficulty: (v) => setState(() => difficulty = v), onShare: (v) => setState(() => share = v), onBack: () => setState(() => stage = _Stage.train),
                  ),
                _Stage.done => _DoneView(result: result ?? {}, session: s, coachName: coach.s('name')),
              },
            ),
            // ---------- pie
            Container(
              decoration: BoxDecoration(color: t.surface, border: Border(top: BorderSide(color: t.line))),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 220),
                    child: switch (stage) {
                      _Stage.train when restLeft != null && restLeft > 0 => _RestPanel(
                          key: const ValueKey('rest'), left: restLeft, total: live?.i('restTotal') ?? restLeft, onAdjust: adjust, onSkip: () => upd((a) => a['restEndsAt'] = null)),
                      _Stage.train when flash => SizedBox(
                          key: const ValueKey('flash'),
                          height: 56,
                          child: Center(child: Text('¡A por la siguiente serie!', style: context.tt.headlineSmall?.copyWith(color: t.accent))),
                        ),
                      _Stage.train => SizedBox(
                          key: const ValueKey('end'),
                          width: double.infinity,
                          child: pct == 100
                              ? FilledButton(
                                  style: FilledButton.styleFrom(backgroundColor: t.ok, foregroundColor: Colors.white, minimumSize: const Size(48, 54)),
                                  onPressed: () => setState(() => stage = _Stage.finish),
                                  child: const Text('Terminar entrenamiento'))
                              : OutlinedButton(onPressed: () => setState(() => stage = _Stage.finish), style: OutlinedButton.styleFrom(minimumSize: const Size(48, 54)), child: Text('Terminar entrenamiento · $pct%')),
                        ),
                      _Stage.finish => SizedBox(
                          key: const ValueKey('save'),
                          width: double.infinity,
                          child: FilledButton(onPressed: saving ? null : save, style: FilledButton.styleFrom(minimumSize: const Size(48, 54)), child: Text(saving ? 'Guardando…' : 'Guardar entrenamiento')),
                        ),
                      _Stage.done => SizedBox(
                          key: const ValueKey('ok'),
                          width: double.infinity,
                          child: FilledButton(onPressed: () => Navigator.pop(context), style: FilledButton.styleFrom(minimumSize: const Size(48, 54)), child: const Text('Listo')),
                        ),
                    },
                  ),
                ),
              ),
            ),
          ]),
        ),
      );
    });
  }

  Widget _card(BuildContext context, List<J> exs, int ei, int current, String? ssLabel, String coachFirst, J client) {
    final ex = exs[ei];
    final info = store.exerciseById(ex.i('exId'));
    final key = cardKeys[ei] ??= GlobalKey();
    return _ExerciseCard(
      key: key,
      ei: ei,
      ex: ex,
      info: info,
      isCurrent: ei == current,
      ssLabel: ssLabel,
      best: store.bestSet(cid, ex.i('exId')),
      coachFirst: coachFirst,
      chatNote: store.lastExerciseNote(client.i('coachId'), cid, ex.i('exId')),
      state: this,
    );
  }
}

String kgRaw(num v) => v % 1 == 0 ? v.toInt().toString() : ((v * 100).round() / 100).toString();

/* ------------------------------------------------------------ Tarjeta de ejercicio */
class _ExerciseCard extends StatefulWidget {
  final int ei;
  final J ex, info;
  final bool isCurrent;
  final String? ssLabel;
  final J? best, chatNote;
  final String coachFirst;
  final _WorkoutSessionState state;
  const _ExerciseCard({super.key, required this.ei, required this.ex, required this.info, required this.isCurrent, required this.ssLabel, required this.best, required this.coachFirst, required this.chatNote, required this.state});
  @override
  State<_ExerciseCard> createState() => _ExerciseCardState();
}

class _ExerciseCardState extends State<_ExerciseCard> {
  final ctrls = <String, TextEditingController>{};
  final focus = <String, FocusNode>{};

  TextEditingController ctrl(String k, String value) {
    final c = ctrls[k] ??= TextEditingController(text: value);
    final f = focus[k] ??= FocusNode()..addListener(() {
          final fc = focus[k]!;
          if (fc.hasFocus) ctrls[k]!.selection = TextSelection(baseOffset: 0, extentOffset: ctrls[k]!.text.length);
        });
    if (!f.hasFocus && c.text != value) c.text = value;
    return c;
  }

  @override
  void dispose() {
    for (final c in ctrls.values) {
      c.dispose();
    }
    for (final f in focus.values) {
      f.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final ex = widget.ex, info = widget.info, st = widget.state;
    final target = ex.m('target') ?? {};
    final sets = ex.lm('sets');
    final complete = sets.every((x) => x.b('done') && !x.lm('drops').any((d) => !d.b('done')));
    final next = sets.indexWhere((x) => !x.b('done'));
    (int, int)? dropNext;
    for (var i = 0; i < sets.length && dropNext == null; i++) {
      if (sets[i].b('done')) {
        final k = sets[i].lm('drops').indexWhere((d) => !d.b('done'));
        if (k >= 0) dropNext = (i, k);
      }
    }
    final drop = target.m('drop');
    final pct = drop?.n('pct', 20) ?? 20;
    final best = widget.best;
    final shown = () {
      final x = sets[next >= 0 ? next : sets.length - 1];
      return x.nn('weight') ?? x.nn('prevWeight') ?? 0;
    }();
    final barbell = info.s('equipment') == 'Barra';

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: complete ? t.ok.withValues(alpha: .5) : widget.isCurrent ? t.accent.withValues(alpha: .6) : t.line, width: widget.isCurrent && !complete ? 1.6 : 1),
      ),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          GestureDetector(onTap: () => showExercise(context, info, coachName: widget.coachFirst), child: ExThumb(info, w: 66, h: 50, done: complete)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                if (widget.ssLabel != null) Padding(padding: const EdgeInsets.only(right: 6), child: SsTag(widget.ssLabel!)),
                Expanded(child: Text(info.s('name'), style: context.tt.titleLarge?.copyWith(fontSize: 18))),
              ]),
              const Gap(2),
              Text('Objetivo ${target.s('sets')} × ${target.s('reps')} · descanso ${clock(parseRest(target['rest']))}', style: context.tt.bodySmall),
              if (best != null && best.n('weight') > 0)
                Padding(padding: const EdgeInsets.only(top: 2), child: Text('Récord ${kg(best.n('weight'))} kg', style: TextStyle(color: t.gold, fontWeight: FontWeight.w700, fontSize: 12.5))),
            ]),
          ),
          IconButton(onPressed: () => showExercise(context, info, coachName: widget.coachFirst), icon: const Icon(Icons.info_outline_rounded), tooltip: 'Ver técnica'),
        ]),
        if (drop != null || target.m('effort') != null || target.sn('tempo') != null) ...[
          const Gap(10),
          Wrap(spacing: 6, runSpacing: 6, children: [
            if (drop != null) Pill(dropLabel(drop), tone: 'warn', icon: Icons.trending_down_rounded, small: true),
            if (target.m('effort') != null) Pill(effortLabel(target.m('effort')), tone: 'info', icon: Icons.speed_rounded, small: true),
            if (target.sn('tempo') != null) Pill('Tempo ${target.s('tempo')}', icon: Icons.timer_outlined, small: true),
          ]),
          if (target.m('effort') != null || target.sn('tempo') != null)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text([effortHelp(target.m('effort')), tempoHelp(target.sn('tempo'))].where((x) => x.isNotEmpty).join(' · '), style: context.tt.bodySmall)),
        ],
        if (ex.s('notes').isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: NoteBox(icon: Icons.sticky_note_2_rounded, child: Text.rich(TextSpan(children: [
              TextSpan(text: '${widget.coachFirst}: ', style: const TextStyle(fontWeight: FontWeight.w700)),
              TextSpan(text: ex.s('notes')),
            ]))),
          ),
        if (widget.chatNote != null && widget.chatNote!.s('text') != ex.s('notes'))
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: NoteBox(icon: Icons.chat_bubble_rounded, tone: 'neutral', child: Text.rich(TextSpan(children: [
              TextSpan(text: '${widget.coachFirst} en el chat: ', style: const TextStyle(fontWeight: FontWeight.w700)),
              TextSpan(text: widget.chatNote!.s('text')),
            ]))),
          ),
        if (barbell && shown > 20 && !complete) Padding(padding: const EdgeInsets.only(top: 10), child: PlateLoader(weight: shown)),
        const Gap(10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(children: [
            SizedBox(width: 30, child: Text('#', textAlign: TextAlign.center, style: context.tt.labelSmall)),
            Expanded(flex: 5, child: Text('Anterior', style: context.tt.labelSmall)),
            Expanded(flex: 4, child: Text('Kg', textAlign: TextAlign.center, style: context.tt.labelSmall)),
            const SizedBox(width: 8),
            Expanded(flex: 4, child: Text('Reps', textAlign: TextAlign.center, style: context.tt.labelSmall)),
            const SizedBox(width: 52),
          ]),
        ),
        const Gap(4),
        for (final (si, x) in sets.indexed) ...[
          _row(
            context,
            num: Text('${si + 1}', textAlign: TextAlign.center, style: context.tt.titleMedium?.copyWith(fontFamily: 'Sora')),
            prev: x['prevWeight'] != null ? '${kg(x.n('prevWeight'))} × ${x.s('prevReps')}' : '—',
            weightKey: 'w$si', weight: x.s('weight'), weightHint: x['prevWeight'] != null ? kgRaw(x.n('prevWeight')) : 'kg',
            repsKey: 'r$si', reps: x.s('reps'), repsHint: '${x['prevReps'] ?? repsLow(target['reps']) ?? ''}',
            done: x.b('done'), next: widget.isCurrent && dropNext == null && si == next,
            onW: (v) => st.edit(widget.ei, si, 'weight', v), onR: (v) => st.edit(widget.ei, si, 'reps', v), onCheck: () => st.toggle(widget.ei, si),
          ),
          for (final (di, d) in x.lm('drops').indexed)
            _row(
              context,
              drop: true,
              num: Text('↓${di + 1}', textAlign: TextAlign.center, style: TextStyle(color: t.warn, fontWeight: FontWeight.w800)),
              prev: () {
                final sug = dropWeight(x.nn('weight') ?? x.nn('prevWeight') ?? 0, pct, di + 1);
                return sug > 0 ? '≈ ${kg(sug)} kg' : '−${pct.toInt()}%';
              }(),
              weightKey: 'w$si-$di', weight: d.s('weight'), weightHint: () {
                final sug = dropWeight(x.nn('weight') ?? x.nn('prevWeight') ?? 0, pct, di + 1);
                return sug > 0 ? kgRaw(sug) : 'kg';
              }(),
              repsKey: 'r$si-$di', reps: d.s('reps'), repsHint: 'reps',
              done: d.b('done'), next: widget.isCurrent && dropNext?.$1 == si && dropNext?.$2 == di,
              onW: (v) => st.editDrop(widget.ei, si, di, 'weight', v), onR: (v) => st.editDrop(widget.ei, si, di, 'reps', v), onCheck: () => st.toggleDrop(widget.ei, si, di),
            ),
        ],
        const Gap(4),
        Row(children: [
          Expanded(
            child: TextButton.icon(
              onPressed: () => st.addSet(widget.ei),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Serie'),
              style: TextButton.styleFrom(foregroundColor: t.ink2),
            ),
          ),
          if (sets.length > 1 && !sets.last.b('done')) TextButton(onPressed: () => st.removeSet(widget.ei), style: TextButton.styleFrom(foregroundColor: t.muted), child: const Text('Quitar última')),
        ]),
      ]),
    );
  }

  Widget _row(BuildContext context,
      {required Widget num, required String prev, required String weightKey, required String weight, required String weightHint, required String repsKey, required String reps,
      required String repsHint, required bool done, required bool next, required ValueChanged<String> onW, required ValueChanged<String> onR, required VoidCallback onCheck, bool drop = false}) {
    final t = context.tok;
    final bg = done ? t.okSoft : next ? t.accentSoft : Colors.transparent;
    InputDecoration deco(String hint) => InputDecoration(
          hintText: hint,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(vertical: 11, horizontal: 6),
          filled: true,
          fillColor: done ? Colors.transparent : t.surface2,
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: done ? Colors.transparent : t.line)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: t.accent, width: 1.6)),
        );
    const numStyle = TextStyle(fontSize: 17, fontWeight: FontWeight.w700, fontFamily: 'Sora');
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      margin: const EdgeInsets.only(bottom: 4),
      padding: EdgeInsets.fromLTRB(4, 4, 4, 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        SizedBox(width: 30, child: num),
        Expanded(flex: 5, child: Text(prev, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.bodySmall?.copyWith(color: drop ? t.warn : t.muted))),
        Expanded(
          flex: 4,
          child: TextField(
            controller: ctrl(weightKey, weight),
            focusNode: focus[weightKey],
            textAlign: TextAlign.center,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d{0,4}([.,]\d{0,2})?'))],
            style: numStyle,
            decoration: deco(weightHint),
            onChanged: onW,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          flex: 4,
          child: TextField(
            controller: ctrl(repsKey, reps),
            focusNode: focus[repsKey],
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
            style: numStyle,
            decoration: deco(repsHint),
            onChanged: onR,
          ),
        ),
        const SizedBox(width: 8),
        Semantics(
          button: true,
          label: done ? 'Desmarcar ${drop ? 'bajada' : 'serie'}' : 'Completar ${drop ? 'bajada' : 'serie'}',
          child: GestureDetector(
          onTap: () {
            FocusScope.of(context).unfocus();
            onCheck();
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: done ? t.ok : next ? t.accent : t.surface3,
              borderRadius: BorderRadius.circular(14),
              boxShadow: done || next ? [BoxShadow(color: (done ? t.ok : t.accent).withValues(alpha: .35), blurRadius: 12, offset: const Offset(0, 4))] : null,
            ),
            child: Icon(Icons.check_rounded, color: done || next ? Colors.white : t.muted, size: drop ? 20 : 24),
          ),
        )),
      ]),
    );
  }
}

/// Discos por lado para una barra olímpica de 20 kg.
class PlateLoader extends StatelessWidget {
  final double weight;
  const PlateLoader({super.key, required this.weight});
  static const plates = [25.0, 20.0, 15.0, 10.0, 5.0, 2.5, 1.25];
  static final colors = <double, Color>{25.0: Color(0xFFE53935), 20.0: Color(0xFF1E63D6), 15.0: Color(0xFFF4B400), 10.0: Color(0xFF2E9E4F), 5.0: Color(0xFFECEFF4), 2.5: Color(0xFF3A3D45), 1.25: Color(0xFFB8BCC6)};

  @override
  Widget build(BuildContext context) {
    var side = (weight - 20) / 2;
    final out = <double>[];
    for (final p in plates) {
      while (side >= p - 0.001) {
        out.add(p);
        side -= p;
      }
    }
    if (out.isEmpty) return const SizedBox.shrink();
    final t = context.tok;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        Container(width: 18, height: 6, decoration: BoxDecoration(color: t.muted, borderRadius: BorderRadius.circular(2))),
        for (final p in out)
          Container(
            width: 8 + p / 2.2, height: 16 + p * 1.2, margin: const EdgeInsets.only(left: 2),
            decoration: BoxDecoration(color: colors[p], borderRadius: BorderRadius.circular(3), border: Border.all(color: Colors.black12)),
          ),
        const SizedBox(width: 10),
        Expanded(child: Text('Por lado: ${out.map((p) => kg(p)).join(' + ')} kg', style: context.tt.bodySmall?.copyWith(color: t.ink2, fontWeight: FontWeight.w600))),
      ]),
    );
  }
}

class _RestPanel extends StatelessWidget {
  final int left, total;
  final ValueChanged<int> onAdjust;
  final VoidCallback onSkip;
  const _RestPanel({super.key, required this.left, required this.total, required this.onAdjust, required this.onSkip});
  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Ring(value: total > 0 ? left / total : 0, size: 56, stroke: 6),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text('Descanso', style: context.tt.labelMedium),
          Text(clock(left), style: context.tt.displaySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()], height: 1)),
        ]),
      ),
      _Small('−15', () => onAdjust(-15)),
      const SizedBox(width: 6),
      _Small('+15', () => onAdjust(15)),
      const SizedBox(width: 8),
      FilledButton(onPressed: onSkip, style: FilledButton.styleFrom(minimumSize: const Size(0, 46)), child: const Text('Saltar')),
    ]);
  }
}

class _Small extends StatelessWidget {
  final String text;
  final VoidCallback onTap;
  const _Small(this.text, this.onTap);
  @override
  Widget build(BuildContext context) => OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(minimumSize: const Size(52, 46), padding: const EdgeInsets.symmetric(horizontal: 10)),
        child: Text(text),
      );
}

/* ------------------------------------------------------------ Cerrar sesión */
class _FinishView extends StatelessWidget {
  final int elapsed, done, total, difficulty;
  final double volume;
  final TextEditingController comment;
  final bool share;
  final String coachFirst;
  final ValueChanged<int> onDifficulty;
  final ValueChanged<bool> onShare;
  final VoidCallback onBack;
  const _FinishView({required this.elapsed, required this.done, required this.total, required this.volume, required this.difficulty, required this.comment, required this.share, required this.coachFirst, required this.onDifficulty, required this.onShare, required this.onBack});

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final left = total - done;
    return ListView(padding: const EdgeInsets.fromLTRB(16, 18, 16, 24), children: [
      Text('Cierra tu sesión', style: context.tt.displaySmall),
      const Gap(16),
      Row(children: [
        Expanded(child: StatTile(label: 'Duración', value: clock(elapsed))),
        const SizedBox(width: 10),
        Expanded(child: StatTile(label: 'Series', value: '$done/$total')),
        const SizedBox(width: 10),
        Expanded(child: StatTile(label: 'Volumen', value: tons(volume))),
      ]),
      if (left > 0) ...[
        const Gap(14),
        NoteBox(
          icon: Icons.warning_amber_rounded,
          tone: 'warn',
          action: TextButton(onPressed: onBack, child: const Text('Volver')),
          child: Text('Te ${left == 1 ? 'falta 1 serie' : 'faltan $left series'} sin marcar. Se guardan como no hechas.'),
        ),
      ],
      const Gap(20),
      Text('¿Qué tan duro fue?', style: context.tt.titleMedium),
      const Gap(10),
      Row(children: [
        for (final (v, l) in difficultyLevels)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  onDifficulty(v);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: this.difficulty == v ? t.accent : t.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: this.difficulty == v ? t.accent : t.line),
                  ),
                  child: Column(children: [
                    Text('$v', style: context.tt.headlineSmall?.copyWith(color: this.difficulty == v ? t.onAccent : t.ink)),
                    const Gap(2),
                    Text(l, textAlign: TextAlign.center, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: this.difficulty == v ? t.onAccent : t.muted)),
                  ]),
                ),
              ),
            ),
          ),
      ]),
      const Gap(20),
      Field('Mensaje para $coachFirst (opcional)', controller: comment, maxLines: 3, hint: 'Ej.: me molestó un poco el hombro en el press', helper: 'Le llega a sus mensajes.'),
      const Gap(10),
      SwitchRow(value: share, onChanged: onShare, title: 'Compartir el logro en la comunidad'),
    ]);
  }
}

class _DoneView extends StatelessWidget {
  final J result, session;
  final String coachName;
  const _DoneView({required this.result, required this.session, required this.coachName});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final prs = result.lm('prs');
    final sets = sessionMuscleSets(store.exerciseById, session);
    final list = sets.keys.toList()..sort((a, b) => sets[b]!.compareTo(sets[a]!));
    return ListView(padding: const EdgeInsets.fromLTRB(16, 26, 16, 24), children: [
      Center(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: .4, end: 1),
          duration: const Duration(milliseconds: 500),
          curve: Curves.elasticOut,
          builder: (_, v, child) => Transform.scale(scale: v, child: child),
          child: Container(
            width: 96, height: 96,
            decoration: BoxDecoration(color: t.ok, shape: BoxShape.circle, boxShadow: [BoxShadow(color: t.ok.withValues(alpha: .4), blurRadius: 30, offset: const Offset(0, 12))]),
            child: const Icon(Icons.check_rounded, color: Colors.white, size: 54),
          ),
        ),
      ),
      const Gap(20),
      Text('Entrenamiento guardado', textAlign: TextAlign.center, style: context.tt.displaySmall),
      const Gap(8),
      Text(
        result.b('queued')
            ? 'Quedó guardado en tu celular. Se subirá solo cuando vuelva la conexión.'
            : '$coachName ya puede ver tu sesión${result.s('comment').isNotEmpty ? ' y tu mensaje' : ''}.',
        textAlign: TextAlign.center,
        style: context.tt.bodyLarge?.copyWith(color: t.ink2),
      ),
      const Gap(20),
      Row(children: [
        Expanded(child: StatTile(label: 'Duración', value: clock(result.n('durationSec')))),
        const SizedBox(width: 10),
        Expanded(child: StatTile(label: 'Series', value: '${result.i('done')}')),
        const SizedBox(width: 10),
        Expanded(child: StatTile(label: 'Volumen', value: tons(result.n('volume')))),
      ]),
      if (prs.isNotEmpty) ...[
        const Gap(14),
        Panel(
          color: t.goldSoft,
          border: Colors.transparent,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Icon(Icons.emoji_events_rounded, color: t.gold),
              const SizedBox(width: 8),
              Text(prs.length == 1 ? 'Nuevo récord' : 'Nuevos récords', style: context.tt.titleLarge),
            ]),
            for (final p in prs)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Row(children: [
                  Expanded(child: Text(store.exerciseById(p.i('exId')).s('name'), style: context.tt.titleSmall)),
                  Text('${kg(p.n('weight'))} kg', style: context.tt.titleMedium),
                  Text('  antes ${kg(p.n('prev'))}', style: context.tt.bodySmall),
                ]),
              ),
          ]),
        ),
      ],
      if (list.isNotEmpty) ...[
        const Gap(14),
        Section(
          title: 'Músculos de hoy',
          child: Column(children: [
            MuscleMap(body: store.me?.sn('body'), heat: sets.map((k, v) => MapEntry(k, levelOf(sessionLevels, v))), describe: (m) => sets[m] != null ? fmtSets(sets[m]!) : '', height: 220),
            const Gap(8),
            HeatScale(levels: [for (final l in sessionLevels) (l.lv, l.label)], unit: 'Series'),
            const Gap(10),
            Wrap(spacing: 6, runSpacing: 6, alignment: WrapAlignment.center, children: [for (final m in list) Pill('${muscleName(m)} ${fmtSets(sets[m]!)}')]),
          ]),
        ),
      ],
    ]);
  }
}
