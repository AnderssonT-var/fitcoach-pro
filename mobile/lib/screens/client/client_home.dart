// Inicio del asesorado: entrenamiento de hoy, semana, prueba y último mensaje.
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../core/techniques.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shared/account.dart';
import '../shell.dart';

int estimateMin(J day) {
  final sec = day.lm('exercises').fold<int>(0, (t, e) => t + e.i('sets') * (40 + parseRest(e['rest'])));
  return ((sec / 60 / 5).round() * 5);
}

class ClientHome extends StatefulWidget {
  const ClientHome({super.key});
  @override
  State<ClientHome> createState() => _ClientHomeState();
}

class _ClientHomeState extends State<ClientHome> {
  String? dayId;

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final t = context.tok;
      final me = store.me!;
      final id = me.i('id');
      final c = store.myClient ?? {};
      final coach = store.myCoach ?? {};
      final coachFirst = firstName(coach.s('name'));
      final routine = c.m('routine');
      final days = routine?.lm('days') ?? const <J>[];
      final suggested = store.nextDay(id);
      final day = days.where((d) => d.s('id') == dayId).firstOrNull ?? suggested;
      final ws = store.workoutsOf(id);
      final goal = routine?.i('frequency') ?? 0;
      final week = store.weekCount(id);
      final streak = store.weekStreak(id, goal);
      final trainedToday = ws.any((w) => w.d('finishedAt') != null && sameDay(w.d('finishedAt')!, DateTime.now()));
      final last = ws.firstOrNull;
      final coachMsgs = store.thread(c.i('coachId'), id).where((m) => m.i('from') == c.i('coachId')).toList();
      final lastCoach = coachMsgs.lastOrNull;
      final unread = coachMsgs.where((m) => !m.b('read')).length;
      final active = store.hasActive(id) ? store.active(id) : null;
      final trial = trialInfo(c);

      return TabPage(children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(longDay(DateTime.now()), style: context.tt.labelMedium),
              const Gap(2),
              Text('Hola, ${firstName(me.s('name'))}', style: context.tt.displaySmall),
            ]),
          ),
          GestureDetector(onTap: () => goTab(context, 'mas'), child: Avatar.of(me, size: 46)),
        ]),
        const NotifyPrompt(),
        if (trial != null && trial.running)
          Panel(
            color: t.accentSoft,
            border: Colors.transparent,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                const Pill('Plan de prueba', tone: 'info', icon: Icons.schedule_rounded),
                const Spacer(),
                Text(trial.daysLeft <= 1 ? 'Termina hoy' : 'Te quedan ${trial.daysLeft} días', style: context.tt.titleSmall),
              ]),
              const Gap(10),
              Bar(trial.pct / 100),
              const Gap(10),
              Text('Estás en tu ${trialName(trial.days).toLowerCase()} con $coachFirst. Al terminar pasas a tu plan completo, armado para tus objetivos.', style: context.tt.bodyMedium?.copyWith(color: t.ink)),
            ]),
          ),
        if (active != null)
          _ResumeCard(active: active, onTap: () => openWorkout(context))
        else if (routine == null)
          Panel(
            child: EmptyState(
              icon: Icons.fitness_center_rounded,
              title: '$coachFirst está preparando tu rutina',
              text: 'Te avisaremos aquí apenas esté lista. Mientras tanto puedes escribirle.',
              action: FilledButton(onPressed: () => goTab(context, 'mensajes'), child: const Text('Escribir a mi entrenador')),
            ),
          )
        else if (day != null)
          _TodayCard(
            day: day,
            routine: routine,
            label: trainedToday ? 'Ya entrenaste hoy' : dayId != null ? 'Elegiste' : 'Te toca hoy',
            days: days,
            suggestedId: suggested?.s('id'),
            onPick: (d) => setState(() => dayId = d),
            onStart: () => openWorkout(context, day.s('id')),
          ),
        if (routine != null)
          Panel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Text('Tu semana', style: context.tt.titleLarge),
                const Spacer(),
                Text('$week de $goal', style: context.tt.titleSmall?.copyWith(color: goal > 0 && week >= goal ? t.ok : t.ink2)),
              ]),
              const Gap(14),
              WeekStrip(workouts: ws),
              const Gap(14),
              Row(children: [
                Icon(Icons.local_fire_department_rounded, color: streak > 0 ? const Color(0xFFFF7A1A) : t.muted, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(streak > 0 ? '${plural(streak, 'semana', 'semanas')} seguidas cumpliendo tu meta' : 'Cumple tu meta esta semana para empezar una racha',
                      style: context.tt.bodyMedium),
                ),
              ]),
            ]),
          ),
        if (lastCoach != null)
          Panel(
            onTap: () => goTab(context, 'mensajes'),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Avatar.of(coach, size: 38),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(coach.s('name'), style: context.tt.titleSmall),
                    Text(ago(lastCoach.d('at')), style: context.tt.bodySmall),
                  ]),
                ),
                if (unread > 0) CountBadge(unread),
              ]),
              const Gap(10),
              Text(lastCoach.s('text'), maxLines: 4, overflow: TextOverflow.ellipsis, style: context.tt.bodyLarge),
              const Gap(6),
              Text('Responder', style: context.tt.titleSmall?.copyWith(color: t.accent)),
            ]),
          ),
        if (last != null)
          Panel(
            onTap: () => goTab(context, 'progreso'),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Última sesión · ${ago(last.d('finishedAt'))}', style: context.tt.bodySmall),
              const Gap(4),
              Text(last.s('dayName'), style: context.tt.titleLarge),
              const Gap(10),
              Row(children: [
                _Mini(Icons.timer_outlined, clock(last.n('durationSec'))),
                _Mini(Icons.check_circle_outline_rounded, '${AppStore.doneSetCount(last)} series'),
                _Mini(Icons.fitness_center_rounded, tons(AppStore.sessionVolume(last))),
              ]),
              if (last.lm('prs').isNotEmpty) ...[
                const Gap(10),
                Pill('Récord en ${store.exerciseById(last.lm('prs').first.i('exId')).s('name')}', tone: 'warn', icon: Icons.emoji_events_rounded),
              ],
            ]),
          ),
      ]);
    });
  }
}

class _Mini extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Mini(this.icon, this.text);
  @override
  Widget build(BuildContext context) => Expanded(
        child: Row(children: [
          Icon(icon, size: 16, color: context.tok.muted),
          const SizedBox(width: 5),
          Flexible(child: Text(text, style: context.tt.titleSmall, overflow: TextOverflow.ellipsis)),
        ]),
      );
}

class _ResumeCard extends StatelessWidget {
  final J active;
  final VoidCallback onTap;
  const _ResumeCard({required this.active, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final sets = active.lm('exercises').expand((e) => e.lm('sets')).toList();
    final done = sets.where((s) => s.b('done')).length;
    return Panel(
      gradient: LinearGradient(colors: [t.accent, Color.lerp(t.accent, Colors.black, .3)!], begin: Alignment.topLeft, end: Alignment.bottomRight),
      border: Colors.transparent,
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Tienes un entrenamiento a medias', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
        const Gap(4),
        Text(active.s('dayName'), style: context.tt.displaySmall?.copyWith(color: Colors.white)),
        const Gap(8),
        Text('$done de ${sets.length} series · empezaste ${ago(active.d('startedAt'))}', style: const TextStyle(color: Colors.white)),
        const Gap(12),
        ClipRRect(borderRadius: BorderRadius.circular(9), child: LinearProgressIndicator(value: sets.isEmpty ? 0 : done / sets.length, minHeight: 8, color: Colors.white, backgroundColor: Colors.white24)),
        const Gap(14),
        FilledButton.icon(
          style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: t.accent),
          onPressed: onTap,
          icon: const Icon(Icons.play_arrow_rounded),
          label: const Text('Continuar'),
        ),
      ]),
    );
  }
}

class _TodayCard extends StatelessWidget {
  final J day, routine;
  final String label;
  final List<J> days;
  final String? suggestedId;
  final ValueChanged<String> onPick;
  final VoidCallback onStart;
  const _TodayCard({required this.day, required this.routine, required this.label, required this.days, required this.suggestedId, required this.onPick, required this.onStart});

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final exs = day.lm('exercises');
    final ss = supersets(exs);
    return Panel(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [t.accent, Color.lerp(t.accent, const Color(0xFF070A12), .45)!], begin: Alignment.topLeft, end: Alignment.bottomRight),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label.toUpperCase(), style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700, fontSize: 11.5, letterSpacing: .8)),
            const Gap(6),
            Text(day.s('name'), style: context.tt.displayLarge?.copyWith(color: Colors.white)),
            const Gap(6),
            Wrap(spacing: 14, runSpacing: 4, children: [
              _HeroMeta(Icons.fitness_center_rounded, routine.s('name')),
              _HeroMeta(Icons.format_list_numbered_rounded, '${exs.length} ejercicios'),
              _HeroMeta(Icons.timer_outlined, '~${estimateMin(day)} min'),
            ]),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
          child: Column(children: [
            for (final (i, e) in exs.indexed) ...[
              if (i > 0) const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 11),
                child: Row(children: [
                  if (ss[i] != null) Padding(padding: const EdgeInsets.only(right: 8), child: _Ss('${ss[i]!.letter}${ss[i]!.pos}')),
                  Expanded(child: Text(store.exerciseById(e.i('exId')).s('name'), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall)),
                  Text('${e.s('sets')} × ${e.s('reps')}', style: context.tt.bodySmall?.copyWith(color: t.ink2, fontWeight: FontWeight.w700)),
                ]),
              ),
            ],
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (days.length > 1) ...[
              ChoiceRow<String>(
                scroll: true,
                options: [for (final d in days) (d.s('id'), d.s('id') == suggestedId ? '${d.s('name')} · sugerido' : d.s('name'))],
                value: day.s('id'),
                onChanged: onPick,
              ),
              const Gap(12),
            ],
            FilledButton.icon(onPressed: onStart, icon: const Icon(Icons.play_arrow_rounded), label: Text('Empezar ${day.s('name')}'), style: FilledButton.styleFrom(minimumSize: const Size(48, 56))),
          ]),
        ),
      ]),
    );
  }
}

class _HeroMeta extends StatelessWidget {
  final IconData icon;
  final String text;
  const _HeroMeta(this.icon, this.text);
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 15, color: Colors.white70),
        const SizedBox(width: 5),
        Text(text, style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w600)),
      ]);
}

class _Ss extends StatelessWidget {
  final String text;
  const _Ss(this.text);
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: context.tok.accentSoft, borderRadius: BorderRadius.circular(6)),
        child: Text(text, style: TextStyle(color: context.tok.accent, fontWeight: FontWeight.w800, fontSize: 11)),
      );
}

/// Lunes a domingo con los días entrenados marcados.
class WeekStrip extends StatelessWidget {
  final List<J> workouts;
  const WeekStrip({super.key, required this.workouts});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final mon = weekStart(DateTime.now());
    const names = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    return Row(children: [
      for (var i = 0; i < 7; i++)
        Expanded(
          child: Builder(builder: (_) {
            final d = addDays(mon, i);
            final done = workouts.any((w) => w.d('finishedAt') != null && sameDay(w.d('finishedAt')!, d));
            final today = sameDay(d, DateTime.now());
            return Column(children: [
              Text(names[i], style: context.tt.labelSmall?.copyWith(color: today ? t.accent : t.muted)),
              const Gap(6),
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                width: 36, height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: done ? t.ok : (today ? t.accentSoft : t.surface2),
                  border: today && !done ? Border.all(color: t.accent, width: 2) : null,
                ),
                alignment: Alignment.center,
                child: done
                    ? const Icon(Icons.check_rounded, color: Colors.white, size: 19)
                    : Text('${d.day}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: today ? t.accent : t.ink2)),
              ),
            ]);
          }),
        ),
    ]);
  }
}
