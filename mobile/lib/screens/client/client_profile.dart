// Perfil del asesorado: sus datos, silueta del mapa, lesiones, su entrenador y la cuenta.
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shared/account.dart';
import '../shared/tracking.dart';
import '../shell.dart';

class ClientProfilePage extends StatelessWidget {
  const ClientProfilePage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Mi perfil')),
        body: Watch(builder: (context) => PageList(children: [
              const _ProfileForm(),
              _ReviewPanel(key: ValueKey('rv-${store.reviews.isEmpty ? '' : '${store.reviews.first.s('status')}${store.reviews.first.s('text').hashCode}'}')),
              _CoachCard(coach: store.myCoach ?? {}, brand: store.brand()),
              const NotificationsPanel(),
              const PrivacyPanel(),
              const SecurityPanel(),
            ])),
      );
}

class _ProfileForm extends StatefulWidget {
  const _ProfileForm();
  @override
  State<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends State<_ProfileForm> {
  late J u = store.me ?? {};
  late J c = store.myClient ?? {};
  late final name = TextEditingController(text: u.s('name'));
  late final phone = TextEditingController(text: c.s('phone'));
  late final birth = TextEditingController(text: u.s('birthYear'));
  late final bio = TextEditingController(text: u.s('bio'));
  late final injuries = TextEditingController(text: u.s('injuries'));
  late String body = u.s('body', 'm');
  bool dirty = false;

  void mark() => setState(() => dirty = true);

  Future<void> save() async {
    if (name.text.trim().isEmpty) return toast(context, 'Escribe tu nombre', error: true);
    final year = DateTime.now().year;
    final by = int.tryParse(birth.text.trim());
    if (birth.text.trim().isNotEmpty && (by == null || by < 1920 || by > year - 10)) return toast(context, 'Revisa el año de nacimiento', error: true);
    final ok = await runAct(context, store.updateProfile({'name': name.text.trim(), 'phone': phone.text.trim(), 'birthYear': by, 'bio': bio.text.trim(), 'injuries': injuries.text.trim(), 'body': body}), 'Perfil guardado');
    if (ok && mounted) setState(() => dirty = false);
  }

  @override
  Widget build(BuildContext context) {
    final me = store.me ?? {};
    final coachFirst = firstName(store.myCoach?.s('name') ?? '');
    return Section(
      title: 'Tus datos',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Avatar.of(me, size: 72),
          const SizedBox(width: 14),
          Expanded(
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              OutlinedButton.icon(
                onPressed: () async {
                  final img = await pickImages(context, max: 360, quality: 82);
                  if (img.isEmpty || !context.mounted) return;
                  runAct(context, store.updateProfile({'photo': img.first}), 'Foto de perfil actualizada', Icons.person_rounded);
                },
                icon: const Icon(Icons.photo_camera_outlined, size: 18),
                label: Text(me.sn('photo') != null ? 'Cambiar foto' : 'Subir foto'),
              ),
              if (me.sn('photo') != null) TextButton(onPressed: () => runAct(context, store.updateProfile({'photo': null}), 'Foto quitada'), child: const Text('Quitar')),
            ]),
          ),
        ]),
        const Gap(16),
        Field('Nombre', controller: name, caps: TextCapitalization.words, onChanged: (_) => mark()),
        const Gap(12),
        Field('Teléfono', controller: phone, keyboard: TextInputType.phone, onChanged: (_) => mark()),
        const Gap(12),
        Field('Año de nacimiento', controller: birth, keyboard: TextInputType.number, onChanged: (_) => mark()),
        const Gap(12),
        Labeled(
          'Silueta del mapa muscular',
          SegmentedButton<String>(
            showSelectedIcon: false,
            segments: const [ButtonSegment(value: 'm', label: Text('Hombre')), ButtonSegment(value: 'f', label: Text('Mujer'))],
            selected: {body},
            onSelectionChanged: (v) => setState(() {
              body = v.first;
              dirty = true;
            }),
          ),
        ),
        const Gap(12),
        Field('Sobre mí', controller: bio, maxLines: 4, maxLength: 300, helper: 'Tu objetivo, horarios, lo que te motiva.', onChanged: (_) => mark()),
        const Gap(12),
        Field('Lesiones o molestias', controller: injuries, maxLines: 3, maxLength: 300, hint: 'Ej.: me duele la rodilla al bajar escaleras', helper: '$coachFirst lo tendrá en cuenta al armar tu rutina.', onChanged: (_) => mark()),
        const Gap(14),
        FilledButton(onPressed: dirty ? save : null, child: const Text('Guardar')),
        const Gap(8),
        Text('Cliente desde ${shortDate((store.myClient ?? {}).d('joinedAt'))} · ${me.s('email')}', style: context.tt.bodySmall),
      ]),
    );
  }
}

class _CoachCard extends StatelessWidget {
  final J coach;
  final J? brand;
  const _CoachCard({required this.coach, required this.brand});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final meta = [coach.s('headline'), if (coach.i('years') > 0) '${coach.i('years')} años de experiencia', coach.s('city')].where((x) => x.isNotEmpty).join(' · ');
    return Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          BrandMark(brand: brand, size: 34),
          const SizedBox(width: 10),
          Expanded(child: Text(brand?.sn('businessName') ?? 'Tu entrenador', style: context.tt.titleLarge)),
        ]),
        const Gap(14),
        Row(children: [
          Avatar.of(coach, size: 60),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(coach.s('name'), style: context.tt.titleLarge),
              if (meta.isNotEmpty) Text(meta, style: context.tt.bodySmall),
            ]),
          ),
        ]),
        if (coach.s('bio').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(coach.s('bio'), style: context.tt.bodyMedium)),
        if (coach.l('specialties').isNotEmpty)
          Padding(padding: const EdgeInsets.only(top: 10), child: Wrap(spacing: 6, runSpacing: 6, children: [for (final s in coach.l('specialties')) Pill('$s', tone: 'info')])),
        if (coach.l('services').isNotEmpty) ...[
          const Gap(12),
          Text('Tu plan incluye', style: context.tt.titleSmall),
          for (final s in coach.l('services'))
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(children: [Icon(Icons.check_circle_rounded, size: 17, color: t.ok), const SizedBox(width: 8), Expanded(child: Text('$s', style: context.tt.bodyMedium))]),
            ),
        ],
        if (coach.l('certifications').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: Text('Certificaciones: ${coach.l('certifications').join(', ')}', style: context.tt.bodySmall)),
        const Gap(14),
        Row(children: [
          FilledButton.icon(
            onPressed: () {
              Navigator.pop(context);
              goTab(context, 'mensajes');
            },
            icon: const Icon(Icons.chat_bubble_rounded, size: 18),
            label: const Text('Escribirle'),
          ),
          const SizedBox(width: 12),
          if (coach.s('instagram').isNotEmpty) Expanded(child: Text(coach.s('instagram'), style: context.tt.bodySmall, overflow: TextOverflow.ellipsis)),
        ]),
      ]),
    );
  }
}

/// Reseña del asesorado: su entrenador la aprueba antes de publicarla en su página.
class _ReviewPanel extends StatefulWidget {
  const _ReviewPanel({super.key});
  @override
  State<_ReviewPanel> createState() => _ReviewPanelState();
}

class _ReviewPanelState extends State<_ReviewPanel> {
  J? get review => store.reviews.isEmpty ? null : store.reviews.first;
  late int rating = review?.i('rating', 5) ?? 5;
  late final text = TextEditingController(text: review?.s('text') ?? '');
  late final detail = TextEditingController(text: review?.s('detail') ?? '');
  late bool editing = review == null;
  bool busy = false;

  String get coachName => (store.myCoach?.s('name') ?? 'tu entrenador').split(' ').first;

  Future<void> _send() async {
    if (text.text.trim().length < 10) return toast(context, 'Escribe al menos unas palabras sobre tu experiencia', error: true);
    setState(() => busy = true);
    final r = await store.saveMyReview({'rating': rating, 'text': text.text.trim(), 'detail': detail.text.trim()});
    if (!mounted) return;
    setState(() => busy = false);
    if (!r.ok) return toast(context, r.error!, error: true);
    setState(() => editing = false);
    toast(context, '¡Gracias! $coachName la revisará antes de publicarla', icon: Icons.favorite_rounded);
  }

  Future<void> _delete() async {
    if (!await confirm(context, title: '¿Borrar tu reseña?', text: 'Si ya estaba publicada, se quita de la página.', confirmLabel: 'Borrar')) return;
    final r = await store.deleteMyReview();
    if (!mounted) return;
    if (!r.ok) return toast(context, r.error!, error: true);
    toast(context, 'Reseña borrada');
  }

  Widget _stars(int n, {ValueChanged<int>? onTap, double size = 32}) => Row(children: [
        for (var i = 1; i <= 5; i++)
          onTap == null
              ? Icon(Icons.star_rounded, size: size, color: i <= n ? const Color(0xFFF5B301) : context.tok.surface3)
              : IconButton(visualDensity: VisualDensity.compact, onPressed: () => onTap(i), icon: Icon(Icons.star_rounded, size: size, color: i <= n ? const Color(0xFFF5B301) : context.tok.surface3)),
      ]);

  @override
  Widget build(BuildContext context) {
    final r = review;
    final approved = r?.s('status') == 'approved';
    return Section(
      title: 'Tu reseña',
      trailing: r == null ? null : Pill(approved ? 'Publicada' : 'Por aprobar', tone: approved ? 'ok' : 'warn'),
      child: !editing && r != null
          ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _stars(r.i('rating'), size: 22),
              const Gap(8),
              Text('“${r.s('text')}”', style: context.tt.bodyLarge),
              if (r.s('detail').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(r.s('detail'), style: context.tt.titleSmall?.copyWith(color: context.tok.accent))),
              const Gap(8),
              Text(approved ? 'Se ve en la página de $coachName. ¡Gracias por recomendarlo!' : '$coachName la revisará antes de publicarla en su página.', style: context.tt.bodySmall),
              const Gap(10),
              Wrap(spacing: 8, children: [
                OutlinedButton.icon(onPressed: () => setState(() => editing = true), icon: const Icon(Icons.edit_rounded, size: 18), label: const Text('Editar')),
                TextButton(onPressed: _delete, child: const Text('Borrar')),
              ]),
            ])
          : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Cuéntale a otras personas cómo te va entrenando con $coachName. Se publica en su página cuando la aprueba.', style: context.tt.bodySmall),
              const Gap(6),
              _stars(rating, onTap: (n) => setState(() => rating = n)),
              const Gap(6),
              Field('Tu experiencia', controller: text, maxLines: 5, maxLength: 700, caps: TextCapitalization.sentences, hint: 'Ej.: En 3 meses mejoré mi fuerza y me siento con más energía…'),
              const Gap(12),
              Field('Tu resultado (opcional)', controller: detail, maxLength: 70, hint: 'Ej.: -5 kg en 3 meses'),
              const Gap(8),
              Text('Se muestra tu nombre y la inicial de tu apellido${r != null ? '. Si la editas, vuelve a revisión.' : '.'}', style: context.tt.bodySmall),
              const Gap(12),
              Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                if (r != null) TextButton(onPressed: () => setState(() => editing = false), child: const Text('Cancelar')),
                const SizedBox(width: 8),
                FilledButton.icon(onPressed: busy ? null : _send, icon: const Icon(Icons.send_rounded, size: 18), label: Text(busy ? 'Enviando…' : r != null ? 'Enviar cambios' : 'Enviar reseña')),
              ]),
            ]),
    );
  }
}
