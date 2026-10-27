// Comunidad del entrenador: publicaciones, retos, logros y tabla del mes.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class CommunityPage extends StatelessWidget {
  final bool standalone;
  const CommunityPage({super.key, this.standalone = false});

  @override
  Widget build(BuildContext context) {
    final body = Watch(builder: (context) {
      final me = store.me!;
      final coachId = store.isCoach ? me.i('id') : (store.myClient?.i('coachId') ?? 0);
      final coach = store.userById(coachId) ?? {};
      final posts = store.posts.where((p) => p.i('coachId') == coachId).toList()..sort((a, b) => b.s('at').compareTo(a.s('at')));
      final now = DateTime.now();
      final ranking = store.s['ranking'];
      final board = (ranking is List
              ? ranking.cast<Map>().map((r) => (store.userById(intOf(r['userId'])), intOf(r['n'])))
              : store.clients.where((c) => c.i('coachId') == coachId && c.b('active')).map((c) => (
                    store.userById(c.i('userId')),
                    store.workoutsAll.where((w) {
                      final f = w.d('finishedAt');
                      return w.i('clientId') == c.i('userId') && f != null && f.month == now.month && f.year == now.year;
                    }).length
                  )))
          .where((x) => x.$1 != null)
          .map((x) => (x.$1!, x.$2))
          .toList()
        ..sort((a, b) => b.$2.compareTo(a.$2));
      return PageList(onRefresh: store.reload, padding: EdgeInsets.fromLTRB(16, standalone ? 8 : 14, 16, 28), children: [
        if (!standalone) const PageHead('Comunidad'),
        Text(store.isCoach ? 'Tu grupo: comparte retos, consejos y celebra los logros de tus asesorados.' : 'El grupo de ${firstName(coach.s('name'))}: comparte tus logros y anima a los demás.',
            style: context.tt.bodyMedium),
        _Board(board: board, meId: me.i('id')),
        const _Composer(),
        if (posts.isEmpty) const Panel(child: EmptyState(icon: Icons.diversity_3_rounded, title: 'Todavía no hay publicaciones', text: 'Escribe la primera para animar al grupo.')),
        for (final p in posts) _Post(p: p, leader: board.isEmpty ? null : board.first),
      ]);
    });
    return standalone ? Scaffold(appBar: AppBar(title: const Text('Comunidad')), body: body) : SafeArea(bottom: false, child: body);
  }
}

class _Board extends StatelessWidget {
  final List<(J, int)> board;
  final int meId;
  const _Board({required this.board, required this.meId});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    if (board.isEmpty) return const SizedBox.shrink();
    return Section(
      title: 'Tabla del mes',
      subtitle: 'Entrenamientos registrados en ${monthName()}',
      trailing: Icon(Icons.emoji_events_rounded, color: t.gold),
      child: Column(children: [
        for (final (i, (u, n)) in board.take(10).indexed)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(children: [
              SizedBox(
                width: 28,
                child: Text('${i + 1}', style: context.tt.titleLarge?.copyWith(color: i == 0 ? t.gold : i < 3 ? t.ink2 : t.muted)),
              ),
              Avatar.of(u, size: 34),
              const SizedBox(width: 10),
              Expanded(child: Text('${u.s('name')}${u.i('id') == meId ? ' (tú)' : ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall)),
              Text('$n', style: context.tt.headlineSmall),
            ]),
          ),
      ]),
    );
  }
}

class _Composer extends StatefulWidget {
  const _Composer();
  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  final c = TextEditingController();
  String kind = 'post';
  bool busy = false;
  @override
  Widget build(BuildContext context) {
    final me = store.me!;
    return Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Avatar.of(me, size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: c,
              minLines: 2,
              maxLines: 6,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(hintText: store.isCoach ? 'Comparte un consejo o lanza un reto al grupo' : 'Cuenta cómo te fue hoy'),
              onChanged: (_) => setState(() {}),
            ),
          ),
        ]),
        const Gap(10),
        Row(children: [
          if (store.isCoach)
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [ButtonSegment(value: 'post', label: Text('Publicación')), ButtonSegment(value: 'challenge', label: Text('Reto'))],
              selected: {kind},
              onSelectionChanged: (v) => setState(() => kind = v.first),
            ),
          const Spacer(),
          FilledButton(
            onPressed: c.text.trim().isEmpty || busy
                ? null
                : () async {
                    setState(() => busy = true);
                    final ok = await runAct(context, store.addPost(c.text.trim(), kind), kind == 'challenge' ? 'Reto publicado' : 'Publicado', Icons.diversity_3_rounded);
                    if (!mounted) return;
                    setState(() => busy = false);
                    if (ok) {
                      c.clear();
                      setState(() => kind = 'post');
                    }
                  },
            child: const Text('Publicar'),
          ),
        ]),
      ]),
    );
  }
}

class _Post extends StatefulWidget {
  final J p;
  final (J, int)? leader;
  const _Post({required this.p, required this.leader});
  @override
  State<_Post> createState() => _PostState();
}

class _PostState extends State<_Post> {
  late bool open = widget.p.l('comments').isNotEmpty && widget.p.l('comments').length <= 2;
  final reply = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final p = widget.p;
    final me = store.meId!;
    final author = store.userById(p.i('authorId'));
    final liked = p.l('likes').contains(me);
    final canDelete = p.i('authorId') == me || store.isCoach;
    final comments = p.lm('comments');
    final kind = p.s('kind');
    return Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Avatar.of(author, size: 40),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(author?.s('name') ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall)),
                if (author?.s('role') == 'coach') const Padding(padding: EdgeInsets.only(left: 6), child: Pill('Entrenador', small: true)),
              ]),
              Text(ago(p.d('at')), style: context.tt.bodySmall),
            ]),
          ),
          if (kind == 'challenge') const Pill('Reto', tone: 'warn', icon: Icons.emoji_events_rounded, small: true),
          if (kind == 'workout') const Pill('Entrenamiento', tone: 'ok', icon: Icons.fitness_center_rounded, small: true),
          if (canDelete)
            IconButton(
              visualDensity: VisualDensity.compact,
              icon: Icon(Icons.more_horiz_rounded, color: t.muted),
              onPressed: () async {
                if (await confirm(context, title: 'Eliminar publicación', text: 'La publicación y sus comentarios desaparecen del grupo.', confirmLabel: 'Eliminar') && context.mounted) {
                  runAct(context, store.deletePost(p.s('id')), 'Publicación eliminada', Icons.delete_rounded);
                }
              },
            ),
        ]),
        const Gap(10),
        Text(p.s('text'), style: context.tt.bodyLarge),
        if (kind == 'challenge' && widget.leader != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: NoteBox(icon: Icons.emoji_events_rounded, tone: 'warn', child: Text('Va ganando ${firstName(widget.leader!.$1.s('name'))} con ${widget.leader!.$2} entrenamientos este mes.')),
          ),
        const Gap(8),
        Row(children: [
          TextButton.icon(
            onPressed: () {
              HapticFeedback.lightImpact();
              store.toggleLike(p.s('id'));
            },
            style: TextButton.styleFrom(foregroundColor: liked ? const Color(0xFFFF3B5C) : t.ink2),
            icon: Icon(liked ? Icons.favorite_rounded : Icons.favorite_border_rounded, size: 20),
            label: Text(p.l('likes').isEmpty ? 'Me gusta' : '${p.l('likes').length}'),
          ),
          TextButton.icon(
            onPressed: () => setState(() => open = !open),
            style: TextButton.styleFrom(foregroundColor: t.ink2),
            icon: const Icon(Icons.chat_bubble_outline_rounded, size: 19),
            label: Text(comments.isEmpty ? 'Comentar' : '${comments.length}'),
          ),
        ]),
        if (open) ...[
          for (final c in comments)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Avatar.of(store.userById(c.i('authorId')), size: 30),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 9),
                    decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(14)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text.rich(TextSpan(children: [
                        TextSpan(text: firstName(store.userById(c.i('authorId'))?.s('name') ?? ''), style: const TextStyle(fontWeight: FontWeight.w700)),
                        TextSpan(text: '  ${ago(c.d('at'))}', style: context.tt.bodySmall),
                      ])),
                      Text(c.s('text'), style: context.tt.bodyMedium?.copyWith(color: t.ink)),
                    ]),
                  ),
                ),
              ]),
            ),
          const Gap(8),
          Row(children: [
            Expanded(
              child: TextField(
                controller: reply,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(hintText: 'Escribe un comentario'),
                onChanged: (_) => setState(() {}),
              ),
            ),
            IconButton(
              onPressed: reply.text.trim().isEmpty
                  ? null
                  : () {
                      runAct(context, store.addComment(p.s('id'), reply.text.trim()));
                      reply.clear();
                      setState(() {});
                    },
              icon: const Icon(Icons.send_rounded),
            ),
          ]),
        ],
      ]),
    );
  }
}
