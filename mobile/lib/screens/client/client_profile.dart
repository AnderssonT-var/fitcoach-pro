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
