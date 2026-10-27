// Rutina del asesorado: días, ejercicios con técnica, récords y comentarios.
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../core/techniques.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shared/exercise_ui.dart';
import '../shared/messages.dart';
import '../shared/progress_widgets.dart';
import '../shell.dart';
import 'client_home.dart';

class MyRoutine extends StatefulWidget {
  const MyRoutine({super.key});
  @override
  State<MyRoutine> createState() => _MyRoutineState();
}

class _MyRoutineState extends State<MyRoutine> {
  String? dayId;

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final id = store.meId!;
      final c = store.myClient ?? {};
      final coach = store.myCoach ?? {};
      final coachFirst = firstName(coach.s('name'));
      final routine = c.m('routine');
      if (routine == null) {
        return TabPage(children: [
          const PageHead('Mi rutina'),
          Panel(child: EmptyState(icon: Icons.fitness_center_rounded, title: 'Aún no tienes rutina', text: '$coachFirst la está preparando.')),
        ]);
      }
      final days = routine.lm('days');
      dayId ??= store.nextDay(id)?.s('id');
      final day = days.where((d) => d.s('id') == dayId).firstOrNull ?? days.first;
      final active = store.hasActive(id);
      final trial = trialInfo(c);
      final exs = day.lm('exercises');
      final ss = supersets(exs);

      return TabPage(children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (trial?.running == true) Padding(padding: const EdgeInsets.only(bottom: 8), child: Pill('Rutina de prueba · quedan ${trial!.daysLeft} días', tone: 'info', icon: Icons.schedule_rounded)),
          Text(routine.s('name'), style: context.tt.displaySmall),
          const Gap(6),
          Text('${routine.s('goal')} · ${routine.i('frequency')} entrenamientos por semana · preparada por ${coach.s('name')}', style: context.tt.bodyMedium),
        ]),
        if (routine.s('notes').isNotEmpty)
          NoteBox(icon: Icons.sticky_note_2_rounded, child: Text.rich(TextSpan(children: [
            TextSpan(text: '$coachFirst: ', style: const TextStyle(fontWeight: FontWeight.w700)),
            TextSpan(text: routine.s('notes')),
          ]))),
        ChoiceRow<String>(scroll: true, options: [for (final d in days) (d.s('id'), '${d.s('name')}  ${d.lm('exercises').length}')], value: day.s('id'), onChanged: (v) => setState(() => dayId = v)),
        Row(children: [
          Expanded(child: Text('${exs.length} ejercicios · unos ${estimateMin(day)} minutos', style: context.tt.bodySmall)),
          FilledButton.icon(
            onPressed: () => openWorkout(context, active ? null : day.s('id')),
            icon: const Icon(Icons.play_arrow_rounded),
            label: Text(active ? 'Continuar' : 'Empezar'),
          ),
        ]),
        for (final (i, e) in exs.indexed)
          _ExerciseCard(
            e: e,
            index: i,
            ss: ss[i],
            info: store.exerciseById(e.i('exId')),
            last: store.lastPerformance(id, e.i('exId')),
            best: store.bestSet(id, e.i('exId')),
            coachFirst: coachFirst,
            tok: t,
          ),
      ]);
    });
  }
}

class _ExerciseCard extends StatelessWidget {
  final J e, info;
  final J? last, best;
  final int index;
  final SsInfo? ss;
  final String coachFirst;
  final Tok tok;
  const _ExerciseCard({required this.e, required this.info, required this.last, required this.best, required this.index, required this.ss, required this.coachFirst, required this.tok});

  @override
  Widget build(BuildContext context) {
    final t = tok;
    final drop = isDrop(e);
    final effort = e.m('effort');
    final tempo = e.sn('tempo');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (ss != null && ss!.pos == 1)
        Padding(
          padding: const EdgeInsets.only(bottom: 8, left: 4),
          child: Row(children: [
            Icon(Icons.link_rounded, size: 18, color: t.accent),
            const SizedBox(width: 6),
            Text('Superserie ${ss!.letter}', style: context.tt.titleSmall?.copyWith(color: t.accent)),
            const SizedBox(width: 8),
            Expanded(child: Text('${ss!.size} ejercicios seguidos, sin descanso entre ellos', style: context.tt.bodySmall)),
          ]),
        ),
      Panel(
        border: ss != null ? t.accent.withValues(alpha: .45) : null,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            GestureDetector(onTap: () => showExercise(context, info, coachName: coachFirst), child: ExThumb(info, w: 84, h: 62)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  if (ss != null) Padding(padding: const EdgeInsets.only(right: 6), child: SsTag('${ss!.letter}${ss!.pos}')),
                  Expanded(child: Text(info.s('name'), style: context.tt.titleMedium)),
                ]),
                Text('${info.s('muscle')} · ${info.s('equipment')}', style: context.tt.bodySmall),
                const Gap(6),
                Text.rich(TextSpan(children: [
                  TextSpan(text: '${e.s('sets')} × ${e.s('reps')}', style: context.tt.titleLarge),
                  TextSpan(text: '   descanso ${clock(parseRest(e['rest']))}', style: context.tt.bodySmall),
                ])),
              ]),
            ),
          ]),
          if (drop || effort != null || tempo != null) ...[
            const Gap(10),
            Wrap(spacing: 6, runSpacing: 6, children: [
              if (drop) Pill(dropLabel(e.m('drops')), tone: 'warn', icon: Icons.trending_down_rounded),
              if (effort != null) Pill(effortLabel(effort), tone: 'info', icon: Icons.speed_rounded),
              if (tempo != null) Pill('Tempo $tempo', icon: Icons.timer_outlined),
            ]),
            if (effort != null || tempo != null)
              Padding(padding: const EdgeInsets.only(top: 6), child: Text([effortHelp(effort), tempoHelp(tempo)].where((x) => x.isNotEmpty).join(' · '), style: context.tt.bodySmall)),
          ],
          if (info.s('cues').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: Text(info.s('cues'), style: context.tt.bodyMedium)),
          if (e.s('notes').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: NoteBox(icon: Icons.sticky_note_2_rounded, child: Text.rich(TextSpan(children: [
                TextSpan(text: '$coachFirst: ', style: const TextStyle(fontWeight: FontWeight.w700)),
                TextSpan(text: e.s('notes')),
              ]))),
            ),
          if (last != null || (best != null && best!.n('weight') > 0)) ...[
            const Gap(10),
            Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
              if (last != null) Text('Última vez: ${last!.lm('sets').map(setText).join(' · ')}', style: context.tt.bodySmall),
              if (best != null && best!.n('weight') > 0) Pill('${kg(best!.n('weight'))} kg', tone: 'warn', icon: Icons.emoji_events_rounded, small: true),
            ]),
          ],
          const Gap(6),
          Row(children: [
            TextButton.icon(onPressed: () => showExercise(context, info, coachName: coachFirst), icon: const Icon(Icons.play_circle_outline_rounded, size: 18), label: const Text('Ver técnica')),
            TextButton.icon(
              onPressed: () {
                composeRef.value = {'exId': e.i('exId'), 'tag': 'comentario'};
                goTab(context, 'mensajes');
              },
              icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
              label: Text('Comentar a $coachFirst'),
            ),
          ]),
        ]),
      ),
    ]);
  }
}
