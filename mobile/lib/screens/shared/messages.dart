// Mensajes entre entrenador y asesorado, con ejercicios etiquetados
// (comentario, nota, técnica o molestia).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'exercise_ui.dart';

/// Ejercicio que se quiere comentar al abrir el chat (desde la rutina).
final composeRef = ValueNotifier<J?>(null);

const tags = [('comentario', 'Comentario', Icons.chat_bubble_outline_rounded), ('nota', 'Nota', Icons.sticky_note_2_outlined), ('tecnica', 'Técnica', Icons.fitness_center_rounded), ('molestia', 'Molestia', Icons.warning_amber_rounded)];
(String, String, IconData) tagInfo(String? v) => tags.firstWhere((t) => t.$1 == v, orElse: () => tags.first);

class MessagesPage extends StatefulWidget {
  const MessagesPage({super.key});
  @override
  State<MessagesPage> createState() => _MessagesPageState();
}

class _MessagesPageState extends State<MessagesPage> {
  String q = '';

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      if (!store.isCoach) {
        final c = store.myClient ?? {};
        final coach = store.myCoach ?? {};
        return ChatThread(coachId: c.i('coachId'), clientId: store.meId!, other: coach, embedded: true);
      }
      final t = context.tok;
      final me = store.meId!;
      final convs = store.clientsOf(me).map((c) {
        final th = store.thread(me, c.i('userId'));
        return (c, th.lastOrNull, th.where((m) => !m.b('read') && m.i('from') != me).length);
      }).where((x) => q.isEmpty || normalize(x.$1.m('user')!.s('name')).contains(normalize(q))).toList()
        ..sort((a, b) => (b.$2?.s('at') ?? '').compareTo(a.$2?.s('at') ?? ''));
      return SafeArea(
        bottom: false,
        child: PageList(onRefresh: store.reload, padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: [
          const PageHead('Mensajes', subtitle: 'Aquí también llegan los comentarios de tus asesorados al terminar un entrenamiento.'),
          TextField(decoration: const InputDecoration(hintText: 'Buscar asesorado', prefixIcon: Icon(Icons.search_rounded)), onChanged: (v) => setState(() => q = v)),
          Panel(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: convs.isEmpty
                ? const EmptyState(icon: Icons.forum_rounded, title: 'Sin conversaciones', text: 'Cuando agregues asesorados podrás escribirles aquí.')
                : Column(children: [
                    for (final (i, (c, last, unread)) in convs.indexed) ...[
                      if (i > 0) const Divider(height: 1),
                      InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => openChat(context, c.i('userId')),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                          child: Row(children: [
                            Avatar.of(c.m('user'), size: 46),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Expanded(child: Text(c.m('user')!.s('name'), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall?.copyWith(fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w600))),
                                  if (last != null) Text(ago(last.d('at')), style: context.tt.bodySmall),
                                ]),
                                const Gap(2),
                                Text(
                                  last == null
                                      ? 'Sin mensajes'
                                      : '${last.i('from') == me ? 'Tú: ' : ''}${last.inn('exId') != null ? '[${store.exerciseById(last.i('exId')).s('name')}] ' : ''}${last.s('text')}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: context.tt.bodySmall?.copyWith(color: unread > 0 ? t.ink : t.muted),
                                ),
                              ]),
                            ),
                            if (unread > 0) Padding(padding: const EdgeInsets.only(left: 8), child: CountBadge(unread)),
                          ]),
                        ),
                      ),
                    ],
                  ]),
          ),
        ]),
      );
    });
  }
}

/// Abre la conversación con un asesorado (entrenador).
Future<void> openChat(BuildContext context, int clientId, {J? ref}) {
  if (ref != null) composeRef.value = ref;
  return push(context, Scaffold(body: ChatThread(coachId: store.meId!, clientId: clientId, other: store.userById(clientId) ?? {})));
}

class ChatThread extends StatefulWidget {
  final int coachId, clientId;
  final J other;
  final bool embedded;
  const ChatThread({super.key, required this.coachId, required this.clientId, required this.other, this.embedded = false});
  @override
  State<ChatThread> createState() => _ChatThreadState();
}

class _ChatThreadState extends State<ChatThread> {
  final text = TextEditingController();
  final input = FocusNode();
  J? ref;
  int lastCount = -1;

  @override
  void initState() {
    super.initState();
    _takeRef();
    composeRef.addListener(_takeRef);
  }

  void _takeRef() {
    final r = composeRef.value;
    if (r == null) return;
    composeRef.value = null;
    setState(() => ref = r);
    Future.delayed(const Duration(milliseconds: 300), () => mounted ? input.requestFocus() : null);
  }

  @override
  void dispose() {
    composeRef.removeListener(_takeRef);
    text.dispose();
    input.dispose();
    super.dispose();
  }

  void send() {
    final v = text.text.trim();
    if (v.isEmpty) return;
    HapticFeedback.lightImpact();
    store.sendMessage(widget.coachId, widget.clientId, v, ref).then((r) {
      if (!r.ok && mounted) toast(context, r.error!, error: true);
    });
    text.clear();
    setState(() => ref = null);
  }

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final me = store.meId!;
      final msgs = store.thread(widget.coachId, widget.clientId);
      final visible = TickerMode.valuesOf(context).enabled;
      if (visible && msgs.length != lastCount) {
        lastCount = msgs.length;
        WidgetsBinding.instance.addPostFrameCallback((_) => store.markThreadRead(widget.coachId, widget.clientId));
      }
      final other = widget.other;
      final items = <Widget>[];
      DateTime? prevDay;
      for (final m in msgs) {
        final at = m.d('at') ?? DateTime.now();
        if (prevDay == null || !sameDay(prevDay, at)) {
          items.add(Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Center(child: Text(sameDay(at, DateTime.now()) ? 'Hoy' : capitalize(weekdayDate(at)), style: context.tt.labelSmall)),
          ));
          prevDay = at;
        }
        items.add(_Bubble(m: m, mine: m.i('from') == me, coachFirst: firstName(store.userById(widget.coachId)?.s('name') ?? '')));
      }
      return Column(children: [
        Container(
          decoration: BoxDecoration(color: t.surface, border: Border(bottom: BorderSide(color: t.line))),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(widget.embedded ? 16 : 4, 8, 16, 10),
              child: Row(children: [
                if (!widget.embedded) const BackButton(),
                Avatar.of(other, size: 42),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(other.s('name'), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleMedium),
                    Text(other.s('role') == 'coach' ? 'Tu entrenador' : 'Asesorado', style: context.tt.bodySmall),
                  ]),
                ),
              ]),
            ),
          ),
        ),
        Expanded(
          child: msgs.isEmpty
              ? Center(
                  child: EmptyState(
                    icon: Icons.waving_hand_rounded,
                    title: 'Escribe el primer mensaje',
                    text: store.isCoach ? 'Puedes etiquetar un ejercicio para comentar su técnica.' : 'Cuéntale tus dudas, molestias o cómo te sientes.',
                  ),
                )
              : ListView(reverse: true, padding: const EdgeInsets.fromLTRB(12, 12, 12, 12), children: items.reversed.toList()),
        ),
        Container(
          decoration: BoxDecoration(color: t.surface, border: Border(top: BorderSide(color: t.line))),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 10, 8),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                if (ref != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 6, bottom: 8),
                    child: ExerciseChip(exId: ref!.i('exId'), tag: ref!.s('tag'), onTap: _pick, onRemove: () => setState(() => ref = null)),
                  ),
                Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  IconButton(onPressed: _pick, icon: Icon(Icons.fitness_center_rounded, color: t.accent), tooltip: 'Etiquetar un ejercicio'),
                  Expanded(
                    child: TextField(
                      controller: text,
                      focusNode: input,
                      minLines: 1,
                      maxLines: 5,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        hintText: ref != null ? '${tagInfo(ref!.s('tag')).$2} sobre ${store.exerciseById(ref!.i('exId')).s('name')}' : 'Escribe a ${firstName(other.s('name'))}',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide(color: t.accent)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton.filled(
                    onPressed: text.text.trim().isEmpty ? null : send,
                    icon: const Icon(Icons.send_rounded),
                    style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
                    tooltip: 'Enviar',
                  ),
                ]),
              ]),
            ),
          ),
        ),
      ]);
    });
  }

  Future<void> _pick() async {
    final r = await pickTaggedExercise(context, widget.coachId, widget.clientId, ref);
    if (r != null && mounted) {
      setState(() => ref = r);
      input.requestFocus();
    }
  }
}

class _Bubble extends StatelessWidget {
  final J m;
  final bool mine;
  final String coachFirst;
  const _Bubble({required this.m, required this.mine, required this.coachFirst});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final at = m.d('at') ?? DateTime.now();
    final bg = mine ? t.accent : t.surface;
    final fg = mine ? t.onAccent : t.ink;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .8),
        child: Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
          decoration: BoxDecoration(
            color: bg,
            border: mine ? null : Border.all(color: t.line),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(20), topRight: const Radius.circular(20),
              bottomLeft: Radius.circular(mine ? 20 : 6), bottomRight: Radius.circular(mine ? 6 : 20),
            ),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (m.inn('exId') != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ExerciseChip(exId: m.i('exId'), tag: m.s('tag'), mine: mine, onTap: () => showExercise(context, store.exerciseById(m.i('exId')), coachName: coachFirst)),
              ),
            Text(m.s('text'), style: TextStyle(color: fg, fontSize: 15, height: 1.35)),
            const Gap(3),
            Align(
              alignment: Alignment.centerRight,
              child: Text('${timeOf(at)}${mine && m.b('read') ? ' · Visto' : ''}${m.b('pending') ? ' · enviando' : ''}',
                  style: TextStyle(color: mine ? fg.withValues(alpha: .75) : t.muted, fontSize: 11)),
            ),
          ]),
        ),
      ),
    );
  }
}

class ExerciseChip extends StatelessWidget {
  final int exId;
  final String? tag;
  final bool mine;
  final VoidCallback? onTap, onRemove;
  const ExerciseChip({super.key, required this.exId, this.tag, this.mine = false, this.onTap, this.onRemove});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final ex = store.exerciseById(exId);
    final info = tagInfo(tag);
    final tagColor = switch (info.$1) { 'molestia' => t.bad, 'tecnica' => t.accent, 'nota' => t.warn, _ => t.ok };
    return Material(
      color: mine ? Colors.white.withValues(alpha: .18) : t.surface2,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            ExThumb(ex, w: 44, h: 34),
            const SizedBox(width: 8),
            Flexible(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(info.$3, size: 12, color: mine ? Colors.white : tagColor),
                  const SizedBox(width: 3),
                  Text(info.$2.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: .4, color: mine ? Colors.white : tagColor)),
                ]),
                Text(ex.s('name'), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: mine ? Colors.white : t.ink)),
              ]),
            ),
            if (onRemove != null) IconButton(visualDensity: VisualDensity.compact, onPressed: onRemove, icon: const Icon(Icons.close_rounded, size: 18)),
          ]),
        ),
      ),
    );
  }
}

/// Elegir ejercicio para etiquetar: primero los de la rutina del asesorado, luego la biblioteca.
Future<J?> pickTaggedExercise(BuildContext context, int coachId, int clientId, J? initial) {
  var tag = initial?.s('tag', 'comentario') ?? 'comentario';
  var q = '';
  return showSheet<J>(
    context,
    title: 'Etiquetar un ejercicio',
    full: true,
    builder: (ctx) => StatefulBuilder(builder: (ctx, setS) {
      final routine = store.clientById(clientId)?.m('routine');
      final inRoutine = <(int, String)>[];
      for (final d in routine?.lm('days') ?? const <J>[]) {
        for (final e in d.lm('exercises')) {
          if (!inRoutine.any((x) => x.$1 == e.i('exId'))) inRoutine.add((e.i('exId'), d.s('name')));
        }
      }
      final nq = normalize(q.trim());
      bool match(J ex) => nq.isEmpty || normalize('${ex.s('name')} ${ex.s('muscle')} ${ex.s('equipment')}').contains(nq);
      final rl = inRoutine.map((x) => (store.exerciseById(x.$1), x.$2)).where((x) => match(x.$1)).toList();
      final lib = store.exercises.where((e) => e.inn('coachId') == null || e.inn('coachId') == coachId);
      final others = nq.isEmpty ? <J>[] : lib.where((e) => match(e) && !inRoutine.any((x) => x.$1 == e.i('id'))).take(40).toList();
      Widget row(J ex, String sub) => RowTile(
            leading: ExThumb(ex, w: 52, h: 40),
            title: ex.s('name'),
            subtitle: sub,
            onTap: () => Navigator.pop(ctx, {'exId': ex.i('id'), 'tag': tag}),
          );
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Labeled('Tipo de mensaje', ChoiceRow<String>(options: [for (final t in tags) (t.$1, t.$2)], value: tag, onChanged: (v) => setS(() => tag = v))),
        const Gap(14),
        TextField(decoration: const InputDecoration(hintText: 'Buscar en toda la biblioteca', prefixIcon: Icon(Icons.search_rounded)), onChanged: (v) => setS(() => q = v)),
        const Gap(12),
        if (rl.isNotEmpty) Text('DE LA RUTINA', style: ctx.tt.labelSmall),
        for (final (ex, day) in rl) row(ex, '$day · ${ex.s('muscle')}'),
        if (others.isNotEmpty) ...[const Gap(10), Text('BIBLIOTECA', style: ctx.tt.labelSmall)],
        for (final ex in others) row(ex, '${ex.s('muscle')} · ${ex.s('equipment')}'),
        if (rl.isEmpty && others.isEmpty) Padding(padding: const EdgeInsets.all(8), child: Text(nq.isNotEmpty ? 'No hay ejercicios con ese nombre.' : 'Escribe para buscar un ejercicio.', style: ctx.tt.bodyMedium)),
      ]);
    }),
  );
}
