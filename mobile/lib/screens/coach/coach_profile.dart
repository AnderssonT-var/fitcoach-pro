// Perfil y marca del entrenador: foto, presentación, logo, color, enlace de acceso
// e inscripción abierta desde el enlace.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../app.dart';
import '../../core/api.dart';
import '../../core/catalog.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shared/account.dart';
import '../shared/tracking.dart';

String brandUrl(String slug) => '$apiBase/#$slug';

class CoachProfilePage extends StatelessWidget {
  const CoachProfilePage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Perfil y marca')),
        body: Watch(builder: (context) {
          final u = store.me!;
          return PageList(children: [
            _Preview(u: u),
            _ProfileForm(key: ValueKey('pf-${u.s('name')}'), u: u),
            _BrandForm(key: ValueKey('bf-${['businessName', 'tagline', 'color', 'slug'].map((k) => u.m('brand')?.s(k) ?? '').join('|')}'), u: u),
            _SignupSettings(key: ValueKey('ss-${jsonEncode(u.m('brand')?.m('signup'))}'), u: u),
            const NotificationsPanel(),
            const SecurityPanel(),
          ]);
        }),
      );
}

class _Preview extends StatelessWidget {
  final J u;
  const _Preview({required this.u});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final b = u.m('brand') ?? {};
    final color = parseHex(b.sn('color')) ?? t.accent;
    final slug = b.s('slug');
    return Panel(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
          decoration: BoxDecoration(gradient: RadialGradient(center: const Alignment(0, -1.4), radius: 1.6, colors: [color.withValues(alpha: .3), Colors.transparent])),
          child: Column(children: [
            Text('Así ven tu acceso', style: context.tt.labelMedium),
            const Gap(14),
            BrandMark(brand: {...b, 'coachName': u.s('name')}, size: 70),
            const Gap(10),
            Text(b.sn('businessName') ?? u.s('name'), textAlign: TextAlign.center, style: context.tt.headlineSmall),
            if (b.s('tagline').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(b.s('tagline'), textAlign: TextAlign.center, style: context.tt.bodyMedium)),
            const Gap(12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(14)),
              child: Text('Iniciar sesión', textAlign: TextAlign.center, style: TextStyle(color: ThemeData.estimateBrightnessForColor(color) == Brightness.dark ? Colors.white : Colors.black, fontWeight: FontWeight.w700)),
            ),
          ]),
        ),
        if (slug.isNotEmpty)
          Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: t.line))),
            child: Row(children: [
              Icon(Icons.link_rounded, color: t.accent, size: 20),
              const SizedBox(width: 8),
              Expanded(child: Text(brandUrl(slug), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall)),
              IconButton(icon: const Icon(Icons.copy_rounded, size: 20), tooltip: 'Copiar enlace', onPressed: () {
                Clipboard.setData(ClipboardData(text: brandUrl(slug)));
                toast(context, 'Enlace copiado');
              }),
              IconButton(icon: const Icon(Icons.ios_share_rounded, size: 20), tooltip: 'Compartir', onPressed: () {
                SharePlus.instance.share(ShareParams(text: 'Entrena conmigo en ${b.sn('businessName') ?? 'VYTRAFIT'}: ${brandUrl(slug)}'));
              }),
            ]),
          ),
      ]),
    );
  }
}

class _ProfileForm extends StatefulWidget {
  final J u;
  const _ProfileForm({super.key, required this.u});
  @override
  State<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends State<_ProfileForm> {
  late final J u = widget.u;
  late final name = TextEditingController(text: u.s('name')), headline = TextEditingController(text: u.s('headline')), years = TextEditingController(text: u.s('years'));
  late final city = TextEditingController(text: u.s('city')), phone = TextEditingController(text: u.s('phone')), ig = TextEditingController(text: u.s('instagram'));
  late final bio = TextEditingController(text: u.s('bio'));
  late final spec = TextEditingController(text: u.l('specialties').join(', ')), cert = TextEditingController(text: u.l('certifications').join(', ')), serv = TextEditingController(text: u.l('services').join('\n'));
  bool dirty = false;

  List<String> _list(String v, [String sep = ',']) => v.split(sep).map((x) => x.trim()).where((x) => x.isNotEmpty).toList();

  Future<void> save() async {
    if (name.text.trim().isEmpty) return toast(context, 'Escribe tu nombre', error: true);
    final y = int.tryParse(years.text.trim());
    final ok = await runAct(context, store.updateProfile({
      'name': name.text.trim(), 'headline': headline.text.trim(), 'years': y?.clamp(0, 60), 'city': city.text.trim(), 'phone': phone.text.trim(), 'instagram': ig.text.trim(),
      'bio': bio.text.trim(), 'specialties': _list(spec.text), 'certifications': _list(cert.text), 'services': _list(serv.text, '\n'),
    }), 'Perfil guardado');
    if (ok && mounted) setState(() => dirty = false);
  }

  @override
  Widget build(BuildContext context) {
    void mark(_) => setState(() => dirty = true);
    final me = store.me!;
    return Section(
      title: 'Tu perfil',
      subtitle: 'Lo que ven tus asesorados de ti',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Avatar.of(me, size: 70),
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
        Field('Nombre', controller: name, caps: TextCapitalization.words, onChanged: mark),
        const Gap(12),
        Field('Especialidad', controller: headline, hint: 'Ej.: Fuerza e hipertrofia', onChanged: mark),
        const Gap(12),
        Row(children: [
          Expanded(child: Field('Años de experiencia', controller: years, keyboard: TextInputType.number, onChanged: mark)),
          const SizedBox(width: 10),
          Expanded(child: Field('Ciudad', controller: city, onChanged: mark)),
        ]),
        const Gap(12),
        Row(children: [
          Expanded(child: Field('Teléfono', controller: phone, keyboard: TextInputType.phone, onChanged: mark)),
          const SizedBox(width: 10),
          Expanded(child: Field('Instagram', controller: ig, hint: '@tu.usuario', onChanged: mark)),
        ]),
        const Gap(12),
        Field('Sobre mí', controller: bio, maxLines: 4, maxLength: 400, hint: 'Cuéntales a tus asesorados cómo trabajas', onChanged: mark),
        const Gap(12),
        Field('Especialidades', controller: spec, hint: 'Fuerza, Hipertrofia…', helper: 'Separadas por comas', onChanged: mark),
        const Gap(12),
        Field('Certificaciones', controller: cert, hint: 'Ej.: NSCA-CPT', helper: 'Separadas por comas', onChanged: mark),
        const Gap(12),
        Field('Qué incluye tu plan', controller: serv, maxLines: 4, hint: 'Ej.: Revisión semanal', helper: 'Una por línea', onChanged: mark),
        const Gap(14),
        FilledButton(onPressed: dirty ? save : null, child: const Text('Guardar perfil')),
      ]),
    );
  }
}

class _BrandForm extends StatefulWidget {
  final J u;
  const _BrandForm({super.key, required this.u});
  @override
  State<_BrandForm> createState() => _BrandFormState();
}

class _BrandFormState extends State<_BrandForm> {
  late final J b = widget.u.m('brand') ?? {};
  late final name = TextEditingController(text: b.s('businessName')), tag = TextEditingController(text: b.s('tagline')), slug = TextEditingController(text: b.s('slug'));
  late String color = b.s('color');
  bool dirty = false;
  String? error;

  Future<void> save() async {
    final r = await store.updateBrand({'businessName': name.text.trim(), 'tagline': tag.text.trim(), 'color': color, 'slug': slug.text.trim()});
    if (!mounted) return;
    if (!r.ok) return setState(() => error = r.error);
    setState(() => dirty = false);
    toast(context, 'Marca guardada. Tus asesorados ya la ven');
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final u = store.me!;
    final logo = u.m('brand')?.sn('logo');
    void mark(_) => setState(() {
          dirty = true;
          error = null;
        });
    return Section(
      title: 'Tu marca',
      subtitle: 'Solo afecta a tu cuenta y a tus asesorados',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          BrandMark(brand: {...?u.m('brand'), 'businessName': name.text, 'color': color, 'coachName': u.s('name')}, size: 70),
          const SizedBox(width: 14),
          Expanded(
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              OutlinedButton.icon(
                onPressed: () async {
                  final img = await pickImages(context, max: 320, quality: 90, allowCamera: false);
                  if (img.isEmpty || !context.mounted) return;
                  runAct(context, store.updateBrand({'logo': img.first}), 'Logo actualizado', Icons.auto_awesome_rounded);
                },
                icon: const Icon(Icons.image_outlined, size: 18),
                label: Text(logo != null ? 'Cambiar logo' : 'Subir logo'),
              ),
              if (logo != null) TextButton(onPressed: () => runAct(context, store.updateBrand({'logo': null}), 'Logo quitado'), child: const Text('Quitar')),
            ]),
          ),
        ]),
        Padding(padding: const EdgeInsets.only(top: 6), child: Text('PNG con fondo transparente. Se muestra cuadrado.', style: context.tt.bodySmall)),
        const Gap(14),
        Field('Nombre comercial', controller: name, maxLength: 40, hint: 'Ej.: Méndez Strength', onChanged: mark),
        const Gap(12),
        Field('Frase de bienvenida', controller: tag, maxLength: 70, hint: 'Ej.: Entrena con método', onChanged: mark),
        const Gap(14),
        Text('Color de marca', style: context.tt.labelMedium?.copyWith(color: t.ink2)),
        const Gap(8),
        Wrap(spacing: 10, runSpacing: 10, children: [
          for (final (label, hex) in [('Azul VYTRAFIT', ''), ...brandColors])
            GestureDetector(
              onTap: () => setState(() {
                color = hex;
                dirty = true;
              }),
              child: Tooltip(
                message: label,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: parseHex(hex) ?? vytraBlue,
                    shape: BoxShape.circle,
                    border: Border.all(color: color == hex ? t.ink : Colors.transparent, width: 3),
                  ),
                  child: color == hex ? const Icon(Icons.check_rounded, color: Colors.white, size: 20) : null,
                ),
              ),
            ),
        ]),
        const Gap(14),
        Field('Tu enlace de acceso', controller: slug, hint: 'mendez-strength', helper: 'Tus asesorados entran desde aquí y ven tu logo. Solo letras, números y guiones.',
            formatters: [FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9-]')), LengthLimitingTextInputFormatter(40)],
            onChanged: (v) {
              final c = v.toLowerCase();
              if (c != v) slug.value = TextEditingValue(text: c, selection: TextSelection.collapsed(offset: c.length));
              mark(v);
            }),
        if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: NoteBox.text(error!, icon: Icons.error_outline_rounded, tone: 'bad')),
        const Gap(14),
        FilledButton(onPressed: dirty ? save : null, child: const Text('Guardar marca')),
      ]),
    );
  }
}

class _SignupSettings extends StatefulWidget {
  final J u;
  const _SignupSettings({super.key, required this.u});
  @override
  State<_SignupSettings> createState() => _SignupSettingsState();
}

class _SignupSettingsState extends State<_SignupSettings> {
  late final J saved = {'open': false, 'fee': 0, 'trialDays': 0, 'trialFee': 0, 'templateId': null, ...?widget.u.m('brand')?.m('signup')};
  late bool open = saved.b('open');
  late int trialDays = saved.i('trialDays');
  late String? templateId = saved.sn('templateId');
  late final fee = TextEditingController(text: _n(saved.n('fee'))), trialFee = TextEditingController(text: _n(saved.n('trialFee')));
  bool dirty = false;

  static String _n(double v) => v % 1 == 0 ? v.toInt().toString() : v.toString();

  @override
  Widget build(BuildContext context) {
    final templates = store.templates.where((x) => x.i('coachId') == store.meId).toList();
    final slug = widget.u.m('brand')?.s('slug') ?? '';
    final f = double.tryParse(fee.text.replaceAll(',', '.')) ?? 0, tf = double.tryParse(trialFee.text.replaceAll(',', '.')) ?? 0;
    void mark(_) => setState(() => dirty = true);
    return Section(
      title: 'Inscripción desde tu enlace',
      trailing: saved.b('open') ? const Pill('Abierta', tone: 'ok') : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Comparte tu enlace en Instagram o WhatsApp: los nuevos asesorados se registran solos, aceptan el aviso de privacidad y empiezan su prueba.', style: context.tt.bodyMedium),
        const Gap(8),
        SwitchRow(value: open, onChanged: (v) => setState(() {
              open = v;
              dirty = true;
            }), title: 'Permitir que se inscriban solos', subtitle: 'Si está apagado, solo tú creas las cuentas.'),
        if (open) ...[
          const Gap(8),
          Field('Mensualidad', controller: fee, keyboard: const TextInputType.numberWithOptions(decimal: true), onChanged: mark),
          const Gap(12),
          DropdownButtonFormField<String?>(
            initialValue: templates.any((x) => x.s('id') == templateId) ? templateId : null,
            isExpanded: true,
            decoration: InputDecoration(labelText: 'Rutina inicial', helperText: templates.isEmpty ? 'Guarda una rutina como plantilla para usarla aquí' : 'Se copia al inscribirse'),
            items: [const DropdownMenuItem<String?>(value: null, child: Text('Ninguna: la armo yo')), for (final x in templates) DropdownMenuItem<String?>(value: x.s('id'), child: Text(x.s('name')))],
            onChanged: (v) => setState(() {
              templateId = v;
              dirty = true;
            }),
          ),
          const Gap(12),
          Labeled('Plan de prueba', ChoiceRow<int>(options: [(0, 'Sin prueba'), for (final d in trialOptions) (d, d == 30 ? '1 mes' : '$d días')], value: trialDays, onChanged: (v) => setState(() {
                trialDays = v;
                dirty = true;
              }))),
          if (trialDays > 0) ...[const Gap(12), Field('Precio de la prueba', controller: trialFee, keyboard: const TextInputType.numberWithOptions(decimal: true), helper: '0 si es gratis', onChanged: mark)],
          const Gap(12),
          NoteBox.text(
            'Al inscribirse ${trialDays > 0 ? 'empieza una prueba de ${trialDays == 30 ? '1 mes' : '$trialDays días'} (${tf > 0 ? 'cobro de ${money(tf)}' : 'gratis'}) y luego paga ${money(f)} al mes' : 'se registra su mensualidad de ${money(f)}'}.${templateId != null ? ' Recibe la rutina inicial al instante.' : ' Le armas la rutina después.'}',
            icon: Icons.groups_rounded),
        ],
        if (saved.b('open') && slug.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: OutlinedButton.icon(
              onPressed: () => SharePlus.instance.share(ShareParams(text: 'Inscríbete conmigo: ${brandUrl(slug)}')),
              icon: const Icon(Icons.ios_share_rounded, size: 18),
              label: const Text('Compartir enlace de inscripción'),
            ),
          ),
        const Gap(12),
        FilledButton(
          onPressed: !dirty
              ? null
              : () async {
                  final ok = await runAct(context, store.updateBrand({'signup': {'open': open, 'fee': f, 'trialDays': trialDays, 'trialFee': tf, 'templateId': templateId}}),
                      open ? 'Inscripción abierta' : 'Inscripción cerrada', Icons.groups_rounded);
                  if (ok && mounted) setState(() => dirty = false);
                },
          child: const Text('Guardar'),
        ),
      ]),
    );
  }
}
