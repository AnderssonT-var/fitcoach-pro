// Seguimiento del asesorado: rango con XP, hábitos de hoy, check-in semanal,
// cuestionario de inicio y nutrición (igual que la web).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app.dart';
import '../../core/coaching.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/charts.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shared/tracking.dart';

String _fmt(num v) => v == v.roundToDouble() ? v.round().toString() : v.toStringAsFixed(1);

/* ------------------------------------------------------------ Rango */
class RankCard extends StatelessWidget {
  final J c;
  const RankCard({super.key, required this.c});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final r = rankOf(xpOf(c, store.workoutsAll));
    final streak = dayStreak(c, store.workoutsAll);
    return Panel(
      child: Row(children: [
        Container(
          width: 52, height: 52,
          decoration: BoxDecoration(color: t.accentSoft, borderRadius: BorderRadius.circular(16), border: Border.all(color: t.accent.withValues(alpha: .5))),
          alignment: Alignment.center,
          child: Icon(Icons.military_tech_rounded, color: t.accent, size: 30),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: Text(r.name, style: context.tt.titleLarge)),
              Text('${r.xp} XP', style: context.tt.titleSmall?.copyWith(color: t.accent)),
            ]),
            const Gap(8),
            Bar(r.pct),
            const Gap(6),
            Row(children: [
              Expanded(child: Text(r.next == null ? 'Rango máximo' : '${r.to - r.xp} XP para ${r.next}', style: context.tt.bodySmall)),
              Icon(Icons.local_fire_department_rounded, size: 16, color: streak > 0 ? const Color(0xFFFF7A1A) : t.muted),
              const SizedBox(width: 3),
              Text(plural(streak, 'día', 'días'), style: context.tt.labelMedium),
            ]),
          ]),
        ),
      ]),
    );
  }
}

/* ------------------------------------------------------------ Hábitos */
class HabitsCard extends StatelessWidget {
  final J c;
  const HabitsCard({super.key, required this.c});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final list = habitsToday(c);
    final done = list.where((h) => h['done'] == true).length;
    return Section(
      title: 'Hábitos de hoy',
      subtitle: '$done de ${list.length} cumplidos${habitStreak(c) > 1 ? ' · ${habitStreak(c)} días seguidos' : ''}',
      child: Column(children: [
        for (final h in list)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Material(
              color: h['done'] == true ? t.okSoft : t.surface2,
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () {
                  HapticFeedback.selectionClick();
                  if (h.s('kind') == 'check') {
                    store.logHabit(dayKey(), h.s('id'), h['done'] == true ? 0 : 1);
                  } else {
                    _habitSheet(context, h);
                  }
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(children: [
                    Icon(h['done'] == true ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, color: h['done'] == true ? t.ok : t.muted),
                    const SizedBox(width: 10),
                    Expanded(child: Text(h.s('name'), style: context.tt.titleSmall)),
                    if (h.s('kind') != 'check')
                      Text('${_fmt(h.n('value'))} / ${_fmt(h.n('target'))} ${h.s('unit')}', style: context.tt.bodySmall?.copyWith(fontWeight: FontWeight.w700, color: t.ink2)),
                  ]),
                ),
              ),
            ),
          ),
      ]),
    );
  }

  void _habitSheet(BuildContext context, J h) {
    final step = h.n('target') >= 1000 ? 1000.0 : 1.0;
    final ctl = TextEditingController(text: _fmt(h.n('value')));
    showSheet(context,
        title: h.s('name'),
        builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('¿Cuánto llevas hoy? Meta: ${_fmt(h.n('target'))} ${h.s('unit')}', style: ctx.tt.bodyMedium),
              const Gap(12),
              Row(children: [
                IconButton.filledTonal(onPressed: () => ctl.text = _fmt((numOf(ctl.text) - step).clamp(0, 1e9)), icon: const Icon(Icons.remove_rounded), tooltip: 'Menos'),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(controller: ctl, textAlign: TextAlign.center, keyboardType: const TextInputType.numberWithOptions(decimal: true), style: ctx.tt.headlineMedium),
                ),
                const SizedBox(width: 10),
                IconButton.filledTonal(onPressed: () => ctl.text = _fmt(numOf(ctl.text) + step), icon: const Icon(Icons.add_rounded), tooltip: 'Más'),
              ]),
            ]),
        footer: (ctx) => FilledButton(
              onPressed: () {
                store.logHabit(dayKey(), h.s('id'), numOf(ctl.text));
                Navigator.pop(ctx);
              },
              child: const Text('Guardar'),
            ));
  }
}

/* ------------------------------------------------------------ Avisos del inicio */
class CheckinBanner extends StatelessWidget {
  final J c;
  const CheckinBanner({super.key, required this.c});
  @override
  Widget build(BuildContext context) {
    if (!checkinDue(c)) return const SizedBox.shrink();
    return NoteBox(
      icon: Icons.assignment_turned_in_rounded,
      tone: 'info',
      action: FilledButton(onPressed: () => push(context, const CheckinPage()), child: const Text('Enviar')),
      child: const Text('Te toca tu check-in semanal. Toma 2 minutos y suma 50 XP.'),
    );
  }
}

class OnboardingPrompt extends StatelessWidget {
  final J c;
  const OnboardingPrompt({super.key, required this.c});
  @override
  Widget build(BuildContext context) {
    if (c['onboarding'] != null || store.selfCoached) return const SizedBox.shrink();
    final t = context.tok;
    return Panel(
      color: t.accentSoft,
      border: t.accent.withValues(alpha: .4),
      onTap: () => openOnboarding(context, c),
      child: Row(children: [
        Icon(Icons.waving_hand_rounded, color: t.accent),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Cuéntale a tu entrenador sobre ti', style: context.tt.titleSmall),
            Text('Objetivo, días disponibles y lesiones. Así arma tu plan a tu medida.', style: context.tt.bodySmall),
          ]),
        ),
        Icon(Icons.chevron_right_rounded, color: t.accent),
      ]),
    );
  }
}

class NutritionMini extends StatelessWidget {
  final J c;
  const NutritionMini({super.key, required this.c});
  @override
  Widget build(BuildContext context) {
    final n = c.m('nutrition');
    if (n == null) return const SizedBox.shrink();
    final f = foodToday(c);
    final goal = n.n('kcal');
    return Panel(
      onTap: () => push(context, const NutritionPage()),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Nutrición de hoy', style: context.tt.bodySmall),
        const Gap(4),
        Text('${(goal - f.kcal).clamp(0, 99999).round()} kcal restantes', style: context.tt.titleLarge),
        const Gap(10),
        Bar(goal > 0 ? f.kcal / goal : 0, color: context.tok.ok),
        const Gap(8),
        Text('${f.meals.where((m) => m['done'] == true).length} de ${f.meals.length} comidas · ${f.water} vasos de agua', style: context.tt.bodySmall),
      ]),
    );
  }
}

/* ------------------------------------------------------------ Cuestionario de inicio */
const _goals = [('Hipertrofia', 'Ganar músculo'), ('Pérdida de grasa', 'Definición'), ('Fuerza', 'Más fuerza'), ('Salud general', 'Moverme mejor')];

Future<void> openOnboarding(BuildContext context, J c) => push(context, _Onboarding(c: c));

class _Onboarding extends StatefulWidget {
  final J c;
  const _Onboarding({required this.c});
  @override
  State<_Onboarding> createState() => _OnboardingState();
}

class _OnboardingState extends State<_Onboarding> {
  int step = 0;
  bool busy = false;
  late String goal, experience, place;
  late Set<int> days;
  final injuries = TextEditingController(), notes = TextEditingController(), weight = TextEditingController(), height = TextEditingController();

  @override
  void initState() {
    super.initState();
    final o = widget.c.m('onboarding') ?? {};
    goal = o.sn('goal') ?? widget.c.sn('goal') ?? 'Hipertrofia';
    if (!_goals.any((g) => g.$1 == goal)) goal = 'Hipertrofia';
    experience = o.sn('experience') ?? 'intermedio';
    place = o.sn('place') ?? 'gimnasio';
    days = o['days'] is List ? o.l('days').map(intOf).toSet() : {1, 3, 5};
    injuries.text = o.s('injuries');
    notes.text = o.s('notes');
    final h = widget.c.nn('heightCm');
    if (h != null) height.text = _fmt(h);
  }

  Future<void> save() async {
    setState(() => busy = true);
    final ok = await runAct(
        context,
        store.saveOnboarding({
          'goal': goal, 'experience': experience, 'days': (days.toList()..sort()), 'place': place,
          'injuries': injuries.text.trim(), 'notes': notes.text.trim(),
          'weight': weight.text.isEmpty ? null : numOf(weight.text), 'heightCm': height.text.isEmpty ? null : numOf(height.text),
        }),
        '¡Listo! Tu entrenador ya tiene tus respuestas',
        Icons.check_circle_rounded);
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final steps = <Widget>[
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('¿Qué quieres lograr?', style: context.tt.titleLarge),
        const Gap(14),
        for (final g in _goals)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Panel(
              color: goal == g.$1 ? t.accentSoft : null,
              border: goal == g.$1 ? t.accent : null,
              onTap: () => setState(() => goal = g.$1),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(g.$1, style: context.tt.titleSmall),
                    Text(g.$2, style: context.tt.bodySmall),
                  ]),
                ),
                if (goal == g.$1) Icon(Icons.check_circle_rounded, color: t.accent),
              ]),
            ),
          ),
        const Gap(8),
        Labeled('Experiencia', ChoiceRow<String>(options: const [('principiante', 'Principiante'), ('intermedio', 'Intermedio'), ('avanzado', 'Avanzado')], value: experience, onChanged: (v) => setState(() => experience = v))),
      ]),
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('¿Qué días puedes entrenar?', style: context.tt.titleLarge),
        const Gap(14),
        Row(children: [
          for (var i = 0; i < 7; i++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => setState(() => days.contains(i) ? days.remove(i) : days.add(i)),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    height: 46,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: days.contains(i) ? t.accent : t.surface2, borderRadius: BorderRadius.circular(14)),
                    child: Text(daysShort[i], style: TextStyle(fontWeight: FontWeight.w800, color: days.contains(i) ? t.onAccent : t.ink2)),
                  ),
                ),
              ),
            ),
        ]),
        const Gap(18),
        Labeled('Dónde entrenas', ChoiceRow<String>(options: const [('gimnasio', 'Gimnasio'), ('casa', 'Casa'), ('ambos', 'Ambos')], value: place, onChanged: (v) => setState(() => place = v))),
        const Gap(16),
        Row(children: [
          Expanded(child: Field('Peso (kg)', controller: weight, hint: 'Opcional', keyboard: const TextInputType.numberWithOptions(decimal: true))),
          const SizedBox(width: 12),
          Expanded(child: Field('Estatura (cm)', controller: height, hint: 'Opcional', keyboard: TextInputType.number)),
        ]),
      ]),
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Lo que debe saber tu entrenador', style: context.tt.titleLarge),
        const Gap(14),
        Field('Lesiones o molestias', controller: injuries, maxLines: 3, helper: 'Por ejemplo: molestia en el hombro derecho al hacer press.', caps: TextCapitalization.sentences),
        const Gap(14),
        Field('Algo más', controller: notes, maxLines: 3, caps: TextCapitalization.sentences),
      ]),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Cuestionario de inicio')),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 24), children: [
        Row(children: [
          for (var i = 0; i < steps.length; i++)
            Expanded(child: Container(height: 5, margin: const EdgeInsets.symmetric(horizontal: 3), decoration: BoxDecoration(color: i <= step ? t.accent : t.surface3, borderRadius: BorderRadius.circular(9)))),
        ]),
        const Gap(20),
        steps[step],
      ]),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Row(children: [
            if (step > 0) ...[OutlinedButton(onPressed: () => setState(() => step--), child: const Text('Atrás')), const SizedBox(width: 12)],
            Expanded(
              child: FilledButton(
                onPressed: busy || (step == 1 && days.isEmpty) ? null : () => step < steps.length - 1 ? setState(() => step++) : save(),
                child: Text(step < steps.length - 1 ? 'Siguiente' : (busy ? 'Enviando…' : 'Enviar a mi entrenador')),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------ Check-in semanal */
const _scales = [('energy', 'Energía'), ('sleep', 'Calidad de sueño'), ('stress', 'Estrés'), ('hunger', 'Hambre')];

class CheckinPage extends StatefulWidget {
  const CheckinPage({super.key});
  @override
  State<CheckinPage> createState() => _CheckinPageState();
}

class _CheckinPageState extends State<CheckinPage> {
  final weight = TextEditingController(), waist = TextEditingController();
  final scales = <String, int>{'energy': 7, 'sleep': 7, 'stress': 5, 'hunger': 5};
  late final List<TextEditingController> answers;
  final photos = <J>[];
  bool busy = false;

  @override
  void initState() {
    super.initState();
    answers = checkinCfgOf(store.myClient).questions.map((_) => TextEditingController()).toList();
  }

  Future<void> addPhotos() async {
    const poses = ['Frente', 'Perfil', 'Espalda'];
    final imgs = await pickImages(context, multiple: true);
    setState(() {
      for (final src in imgs.take(3 - photos.length)) {
        photos.add({'src': src, 'pose': photos.length < 3 ? poses[photos.length] : 'Otra'});
      }
    });
  }

  Future<void> send() async {
    final c = store.myClient ?? {};
    if (photos.isNotEmpty && !c.b('photoConsent')) {
      toast(context, 'Activa el permiso de fotos en «Mi perfil» para enviarlas.', error: true);
      return;
    }
    final qs = checkinCfgOf(c).questions;
    setState(() => busy = true);
    final ok = await runAct(
        context,
        store.sendCheckin({
          'weight': weight.text.isEmpty ? null : numOf(weight.text),
          'waist': waist.text.isEmpty ? null : numOf(waist.text),
          ...scales,
          'answers': [for (var i = 0; i < qs.length; i++) if (answers[i].text.trim().isNotEmpty) {'q': qs[i], 'a': answers[i].text.trim()}],
          'photos': photos,
        }),
        'Check-in enviado · +50 XP',
        Icons.check_circle_rounded);
    if (!mounted) return;
    setState(() => busy = false);
    if (ok) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Check-in semanal')),
      body: Watch(builder: (context) {
        final t = context.tok;
        final c = store.myClient ?? {};
        final cfg = checkinCfgOf(c);
        final last = lastCheckin(c);
        final history = c.lm('checkins').reversed.toList();
        final coach = firstName(store.myCoach?.s('name') ?? 'Tu entrenador');
        return PageList(padding: const EdgeInsets.fromLTRB(16, 8, 16, 32), children: [
          Text('$coach lo revisa y te responde. ${last != null ? 'Último: ${ago(last.d('date'))}.' : ''}', style: context.tt.bodyMedium),
          Panel(
            child: Row(children: [
              Expanded(child: Field('Peso en ayunas (kg)', controller: weight, hint: last?.nn('weight') != null ? _fmt(last!.n('weight')) : '—', keyboard: const TextInputType.numberWithOptions(decimal: true))),
              const SizedBox(width: 12),
              Expanded(child: Field('Cintura (cm)', controller: waist, hint: last?.nn('waist') != null ? _fmt(last!.n('waist')) : 'Opcional', keyboard: const TextInputType.numberWithOptions(decimal: true))),
            ]),
          ),
          Section(
            title: 'Fotos de progreso',
            subtitle: 'Misma luz y hora · opcional',
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (photos.isNotEmpty)
                Row(children: [
                  for (final (i, p) in photos.indexed)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Stack(children: [
                          ClipRRect(borderRadius: BorderRadius.circular(14), child: AspectRatio(aspectRatio: 3 / 4, child: SmartImage(p.s('src')))),
                          Positioned(left: 6, bottom: 6, child: Pill(p.s('pose'), small: true)),
                          Positioned(
                            right: 0, top: 0,
                            child: IconButton(onPressed: () => setState(() => photos.removeAt(i)), icon: const Icon(Icons.close_rounded, color: Colors.white), tooltip: 'Quitar'),
                          ),
                        ]),
                      ),
                    ),
                ]),
              if (photos.length < 3) ...[
                if (photos.isNotEmpty) const Gap(10),
                OutlinedButton.icon(onPressed: addPhotos, icon: const Icon(Icons.add_a_photo_rounded), label: const Text('Agregar fotos (frente, perfil, espalda)')),
              ],
            ]),
          ),
          Section(
            title: '¿Cómo te sentiste esta semana?',
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final (k, l) in _scales) ...[
                Row(children: [Expanded(child: Text(l, style: context.tt.titleSmall)), Text('${scales[k]}/10', style: context.tt.titleSmall?.copyWith(color: t.accent))]),
                Slider(value: scales[k]!.toDouble(), min: 1, max: 10, divisions: 9, label: '${scales[k]}', onChanged: (v) => setState(() => scales[k] = v.round())),
              ],
            ]),
          ),
          if (cfg.questions.isNotEmpty)
            Section(
              title: 'Preguntas de $coach',
              child: Column(children: [
                for (var i = 0; i < cfg.questions.length && i < answers.length; i++) ...[
                  if (i > 0) const Gap(12),
                  Field(cfg.questions[i], controller: answers[i], maxLines: 3, caps: TextCapitalization.sentences),
                ],
              ]),
            ),
          FilledButton.icon(
            onPressed: busy ? null : send,
            icon: const Icon(Icons.send_rounded),
            label: Text(busy ? 'Enviando…' : 'Enviar check-in'),
            style: FilledButton.styleFrom(minimumSize: const Size(48, 54)),
          ),
          if (history.isNotEmpty)
            Section(
              title: 'Tus check-ins',
              child: Column(children: [
                for (final (i, x) in history.take(12).indexed) ...[
                  if (i > 0) const Divider(height: 18),
                  Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Row(children: [
                      Expanded(child: Text(shortDate(x.d('date')), style: context.tt.titleSmall)),
                      if (x.nn('weight') != null) Text('${_fmt(x.n('weight'))} kg', style: context.tt.titleSmall),
                      const SizedBox(width: 8),
                      Pill(x['reviewedAt'] != null ? 'Revisado' : 'Enviado', tone: x['reviewedAt'] != null ? 'ok' : '', small: true),
                    ]),
                    if (x.s('reply').isNotEmpty) ...[
                      const Gap(6),
                      Text('$coach: ${x.s('reply')}', style: context.tt.bodyMedium?.copyWith(color: t.ink)),
                    ],
                  ]),
                ],
              ]),
            ),
        ]);
      }),
    );
  }
}

/* ------------------------------------------------------------ Nutrición */
class NutritionPage extends StatelessWidget {
  const NutritionPage({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nutrición')),
      floatingActionButton: FloatingActionButton.extended(onPressed: () => _addFood(context), icon: const Icon(Icons.add_a_photo_rounded), label: const Text('Registrar comida')),
      body: Watch(builder: (context) {
        final t = context.tok;
        final c = store.myClient ?? {};
        final f = foodToday(c);
        final p = f.plan;
        final today = dayKey();
        final coach = firstName(store.myCoach?.s('name') ?? 'Tu entrenador');
        return PageList(padding: const EdgeInsets.fromLTRB(16, 8, 16, 110), children: [
          if (p == null)
            Panel(child: EmptyState(icon: Icons.restaurant_rounded, title: 'Aún no tienes plan de nutrición', text: '$coach te lo asignará aquí. Mientras tanto puedes registrar lo que comes con una foto.'))
          else ...[
            Panel(
              child: Row(children: [
                Ring(
                  value: p.n('kcal') > 0 ? f.kcal / p.n('kcal') : 0,
                  size: 104,
                  stroke: 10,
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text('${f.kcal}', style: context.tt.headlineSmall),
                    Text('de ${p.n('kcal').round()} kcal', style: context.tt.labelSmall),
                  ]),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    _Macro('Proteína', f.protein, p.n('protein'), t.ok),
                    const Gap(10),
                    _Macro('Carbohidratos', null, p.n('carbs'), t.info),
                    const Gap(10),
                    _Macro('Grasas', null, p.n('fat'), t.warn),
                  ]),
                ),
              ]),
            ),
            if (p.s('notes').isNotEmpty) NoteBox.text(p.s('notes'), icon: Icons.tips_and_updates_rounded),
            if (f.meals.isNotEmpty)
              Section(
                title: 'Comidas del plan',
                child: Column(children: [
                  for (final m in f.meals)
                    CheckRow(
                      value: m['done'] == true,
                      onChanged: (v) => store.toggleMeal(today, m.s('id'), v),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${m.s('name')}${m.n('kcal') > 0 ? ' · ${m.n('kcal').round()} kcal' : ''}', style: context.tt.titleSmall),
                        if (m.s('desc').isNotEmpty) Text(m.s('desc')),
                      ]),
                    ),
                ]),
              ),
          ],
          Panel(
            child: Row(children: [
              Icon(Icons.water_drop_rounded, color: t.info),
              const SizedBox(width: 10),
              Expanded(child: Text('Agua: ${f.water} ${f.water == 1 ? 'vaso' : 'vasos'}', style: context.tt.titleSmall)),
              IconButton.filledTonal(onPressed: f.water > 0 ? () => store.setWater(today, f.water - 1) : null, icon: const Icon(Icons.remove_rounded), tooltip: 'Quitar un vaso'),
              const SizedBox(width: 6),
              IconButton.filled(onPressed: () => store.setWater(today, f.water + 1), icon: const Icon(Icons.add_rounded), tooltip: 'Sumar un vaso'),
            ]),
          ),
          Section(
            title: 'Registrado hoy',
            child: f.entries.isEmpty
                ? Text('Toma una foto de lo que comes para que $coach lo vea.', style: context.tt.bodyMedium)
                : Column(children: [
                    for (final e in f.entries)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(children: [
                          if (e.sn('photoUrl') != null)
                            ClipRRect(borderRadius: BorderRadius.circular(12), child: SmartImage(e.s('photoUrl'), width: 52, height: 52))
                          else
                            Container(width: 52, height: 52, decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(12)), child: Icon(Icons.restaurant_rounded, color: t.muted)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(e.s('name'), style: context.tt.titleSmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                              Text([if (e.n('kcal') > 0) '${e.n('kcal').round()} kcal', if (e.n('protein') > 0) '${e.n('protein').round()} g proteína'].join(' · '), style: context.tt.bodySmall),
                            ]),
                          ),
                          IconButton(onPressed: () => runAct(context, store.deleteFoodEntry(e.s('id')), 'Borrado'), icon: const Icon(Icons.delete_outline_rounded), tooltip: 'Borrar'),
                        ]),
                      ),
                  ]),
          ),
        ]);
      }),
    );
  }

  Future<void> _addFood(BuildContext context) async {
    String? photo;
    final name = TextEditingController(), kcal = TextEditingController(), protein = TextEditingController();
    var busy = false;
    await showSheet(context,
        title: 'Registrar comida',
        builder: (ctx) => StatefulBuilder(
              builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (photo != null)
                  ClipRRect(borderRadius: BorderRadius.circular(16), child: AspectRatio(aspectRatio: 4 / 3, child: SmartImage(photo)))
                else
                  OutlinedButton.icon(
                    onPressed: () async {
                      final img = await pickImages(ctx);
                      if (img.isNotEmpty) set(() => photo = img.first);
                    },
                    icon: const Icon(Icons.photo_camera_rounded),
                    label: const Text('Tomar o elegir foto'),
                  ),
                const Gap(14),
                Field('¿Qué comiste?', controller: name, hint: 'Ej. Arroz con pollo y ensalada', caps: TextCapitalization.sentences),
                const Gap(12),
                Row(children: [
                  Expanded(child: Field('Calorías (opcional)', controller: kcal, keyboard: TextInputType.number, formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)])),
                  const SizedBox(width: 12),
                  Expanded(child: Field('Proteína g (opcional)', controller: protein, keyboard: TextInputType.number, formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)])),
                ]),
              ]),
            ),
        footer: (ctx) => StatefulBuilder(
              builder: (ctx, set) => FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        if (name.text.trim().isEmpty) return toast(ctx, 'Escribe qué comiste', error: true);
                        set(() => busy = true);
                        final ok = await runAct(ctx, store.addFoodEntry({'date': dayKey(), 'name': name.text.trim(), 'kcal': kcal.text.isEmpty ? null : int.parse(kcal.text), 'protein': protein.text.isEmpty ? null : int.parse(protein.text), 'photo': photo}), 'Comida registrada');
                        if (ctx.mounted) {
                          set(() => busy = false);
                          if (ok) Navigator.pop(ctx);
                        }
                      },
                child: Text(busy ? 'Guardando…' : 'Guardar'),
              ),
            ));
  }
}

class _Macro extends StatelessWidget {
  final String label;
  final int? now;
  final double goal;
  final Color color;
  const _Macro(this.label, this.now, this.goal, this.color);
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text(label, style: context.tt.labelMedium)),
          Text(now != null ? '$now / ${goal.round()} g' : 'meta ${goal.round()} g', style: context.tt.labelMedium?.copyWith(color: context.tok.muted)),
        ]),
        const Gap(5),
        if (now != null) Bar(goal > 0 ? now! / goal : 0, color: color, height: 6) else Container(height: 6, decoration: BoxDecoration(borderRadius: BorderRadius.circular(9), border: Border.all(color: color.withValues(alpha: .45)))),
      ]);
}
