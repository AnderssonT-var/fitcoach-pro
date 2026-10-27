// Acceso: iniciar sesión (general o con la marca del entrenador), activar una
// licencia de entrenador e inscribirse con el enlace de un entrenador.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app.dart';
import '../../core/catalog.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'gates.dart';

enum _Mode { login, activate, signup, brand }

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  _Mode mode = _Mode.login;
  J? brand;
  String slug = '';
  bool loadingBrand = false;

  @override
  void initState() {
    super.initState();
    final saved = store.savedBrand;
    if (saved != null && saved.isNotEmpty) _loadBrand(saved, remember: false);
  }

  Future<String?> _loadBrand(String s, {bool remember = true}) async {
    setState(() => loadingBrand = true);
    final b = await store.fetchBrand(s);
    if (!mounted) return null;
    setState(() {
      loadingBrand = false;
      if (b != null) {
        brand = b;
        slug = b.s('slug', s);
        loginBrandColor.value = parseHex(b.sn('color'));
      }
    });
    if (b == null) return 'No encontramos un entrenador con ese enlace.';
    if (remember) store.saveBrand(slug);
    return null;
  }

  void _clearBrand() {
    store.saveBrand(null);
    loginBrandColor.value = null;
    setState(() {
      brand = null;
      slug = '';
      mode = _Mode.login;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      child: switch (mode) {
        _Mode.activate => _ActivateForm(key: const ValueKey('a'), onBack: () => setState(() => mode = _Mode.login)),
        _Mode.signup => _SignupForm(key: const ValueKey('s'), slug: slug, coach: brand!, onBack: () => setState(() => mode = _Mode.login)),
        _Mode.brand => _BrandForm(key: const ValueKey('b'), onBack: () => setState(() => mode = _Mode.login), onPick: (s) async {
            final err = await _loadBrand(s);
            if (err == null && mounted) setState(() => mode = _Mode.login);
            return err;
          }),
        _Mode.login => _LoginForm(
            key: ValueKey('l$slug'),
            brand: brand,
            slug: slug,
            loading: loadingBrand,
            onActivate: () => setState(() => mode = _Mode.activate),
            onSignup: () => setState(() => mode = _Mode.signup),
            onBrand: () => setState(() => mode = _Mode.brand),
            onClearBrand: _clearBrand,
          ),
      },
    );
  }
}

class _LoginForm extends StatefulWidget {
  final J? brand;
  final String slug;
  final bool loading;
  final VoidCallback onActivate, onSignup, onBrand, onClearBrand;
  const _LoginForm({super.key, required this.brand, required this.slug, required this.loading, required this.onActivate, required this.onSignup, required this.onBrand, required this.onClearBrand});
  @override
  State<_LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<_LoginForm> {
  final email = TextEditingController(), pass = TextEditingController();
  bool show = false, busy = false, forgot = false;
  String? error;

  Future<void> submit() async {
    if (email.text.trim().isEmpty || pass.text.isEmpty) return setState(() => error = 'Escribe tu correo y tu contraseña.');
    setState(() {
      busy = true;
      error = null;
    });
    TextInput.finishAutofillContext();
    final r = await store.login(email.text, pass.text, widget.brand != null ? widget.slug : null);
    if (!mounted) return;
    setState(() {
      busy = false;
      error = r.error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final c = widget.brand;
    final su = c?.m('signup');
    final coachFirst = firstName(c?.s('coachName') ?? '');
    return AuthScaffold(children: [
      if (c != null)
        AuthHero(
          mark: BrandMark(brand: c, size: 88),
          title: c.sn('businessName') ?? c.s('coachName'),
          text: c.sn('tagline'),
          extra: Container(
            padding: const EdgeInsets.fromLTRB(6, 6, 14, 6),
            decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(99), border: Border.all(color: t.line)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Avatar(name: c.s('coachName'), id: c.i('coachId'), photo: c.sn('coachPhoto'), size: 28),
              const SizedBox(width: 8),
              Text('con ${c.s('coachName')}', style: context.tt.titleSmall),
            ]),
          ),
        )
      else
        AuthHero(
          mark: const AppLogo(size: 84),
          title: 'VYTRAFIT',
          text: widget.loading ? 'Cargando…' : 'Rutinas, seguimiento y pagos de tus clientes, en un solo lugar.',
        ),
      AutofillGroup(
        child: Panel(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Field('Correo', controller: email, hint: 'tu@correo.com', keyboard: TextInputType.emailAddress, autofill: const [AutofillHints.email, AutofillHints.username],
                action: TextInputAction.next, onChanged: (_) => setState(() => error = null)),
            const Gap(14),
            Field('Contraseña', controller: pass, obscure: !show, autofill: const [AutofillHints.password], action: TextInputAction.done, onSubmitted: (_) => submit(),
                onChanged: (_) => setState(() => error = null),
                suffix: IconButton(icon: Icon(show ? Icons.visibility_off_rounded : Icons.visibility_rounded), onPressed: () => setState(() => show = !show))),
            ErrorText(error),
            const Gap(16),
            FilledButton(onPressed: busy ? null : submit, child: busy ? const _Dots() : const Text('Iniciar sesión')),
            const Gap(4),
            TextButton(onPressed: () => setState(() => forgot = !forgot), child: const Text('¿Olvidaste tu contraseña?')),
            if (forgot)
              NoteBox.text(
                'Si eres asesorado, pídele a tu entrenador una contraseña temporal desde tu ficha. Si eres entrenador, escríbele al administrador de la plataforma. Al entrar tendrás que crear una nueva.',
                icon: Icons.lock_outline_rounded, tone: 'neutral'),
          ]),
        ),
      ),
      const Gap(14),
      if (su?.b('open') == true)
        Panel(
          color: t.accentSoft,
          border: Colors.transparent,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text.rich(TextSpan(children: [
              const TextSpan(text: '¿Eres nuevo? ', style: TextStyle(fontWeight: FontWeight.w700)),
              TextSpan(text: 'Inscríbete con $coachFirst'),
              if (su!.i('trialDays') > 0)
                TextSpan(text: ' y empieza tu ${su.i('trialDays') == 30 ? 'mes' : 'prueba de ${su.i('trialDays')} días'} de prueba${su.n('trialFee') > 0 ? ' (${money(su.n('trialFee'))})' : ' gratis'}'),
              const TextSpan(text: '.'),
            ]), style: context.tt.bodyMedium?.copyWith(color: t.ink)),
            const Gap(10),
            OutlinedButton.icon(onPressed: widget.onSignup, icon: const Icon(Icons.person_add_alt_1_rounded), label: const Text('Crear mi cuenta')),
          ]),
        ),
      const Gap(6),
      if (c != null)
        Column(children: [
          Text('Acceso exclusivo para ${c.sn('businessName') ?? c.s('coachName')} y sus asesorados', textAlign: TextAlign.center, style: context.tt.bodySmall),
          TextButton(onPressed: widget.onClearBrand, child: const Text('Ir al acceso general')),
        ])
      else ...[
        _LinkRow(icon: Icons.link_rounded, text: '¿Te invitó tu entrenador?', action: 'Entrar con su enlace', onTap: widget.onBrand),
        _LinkRow(icon: Icons.key_rounded, text: '¿Eres entrenador y tienes un código?', action: 'Activa tu cuenta', onTap: widget.onActivate),
      ],
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        TextButton(onPressed: () => openLegal('privacidad'), child: const Text('Privacidad')),
        Text('·', style: context.tt.bodySmall),
        TextButton(onPressed: () => openLegal('terminos'), child: const Text('Términos')),
      ]),
      const DevCredit(),
    ]);
  }
}

class _LinkRow extends StatelessWidget {
  final IconData icon;
  final String text, action;
  final VoidCallback onTap;
  const _LinkRow({required this.icon, required this.text, required this.action, required this.onTap});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Panel(
          onTap: onTap,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          radius: 18,
          child: Row(children: [
            IconBadge(icon, tone: 'info', size: 36),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text, style: context.tt.bodySmall),
                Text(action, style: context.tt.titleSmall?.copyWith(color: context.tok.accent)),
              ]),
            ),
            Icon(Icons.chevron_right_rounded, color: context.tok.muted),
          ]),
        ),
      );
}

class _Dots extends StatelessWidget {
  const _Dots();
  @override
  Widget build(BuildContext context) => SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: context.tok.onAccent));
}

/* ------------------------------------------------------------ Enlace del entrenador */
class _BrandForm extends StatefulWidget {
  final VoidCallback onBack;
  final Future<String?> Function(String slug) onPick;
  const _BrandForm({super.key, required this.onBack, required this.onPick});
  @override
  State<_BrandForm> createState() => _BrandFormState();
}

class _BrandFormState extends State<_BrandForm> {
  final c = TextEditingController();
  String? error;
  bool busy = false;

  String _slugOf(String v) {
    var s = v.trim();
    final hash = s.lastIndexOf('#');
    if (hash >= 0) s = s.substring(hash + 1);
    return s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9-]'), '');
  }

  Future<void> go() async {
    final s = _slugOf(c.text);
    if (s.isEmpty) return setState(() => error = 'Pega el enlace o escribe el nombre que te dio tu entrenador.');
    setState(() => busy = true);
    final err = await widget.onPick(s);
    if (mounted) {
      setState(() {
        busy = false;
        error = err;
      });
    }
  }

  @override
  Widget build(BuildContext context) => AuthScaffold(children: [
        Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: widget.onBack, icon: const Icon(Icons.arrow_back_rounded), label: const Text('Volver'))),
        const AuthHero(
          mark: HeroIcon(Icons.link_rounded),
          title: 'Entra con tu entrenador',
          text: 'Pega el enlace que te compartió (por ejemplo vytra.fit/#mendez-strength) o escribe solo la última parte.',
        ),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Field('Enlace o nombre', controller: c, hint: 'mendez-strength', keyboard: TextInputType.url, action: TextInputAction.go, onSubmitted: (_) => go(),
                onChanged: (_) => setState(() => error = null)),
            ErrorText(error),
            const Gap(14),
            FilledButton(onPressed: busy ? null : go, child: Text(busy ? 'Buscando…' : 'Continuar')),
          ]),
        ),
      ]);
}

/* ------------------------------------------------------------ Activar licencia */
class _ActivateForm extends StatefulWidget {
  final VoidCallback onBack;
  const _ActivateForm({super.key, required this.onBack});
  @override
  State<_ActivateForm> createState() => _ActivateFormState();
}

class _ActivateFormState extends State<_ActivateForm> {
  final code = TextEditingController(), name = TextEditingController(), email = TextEditingController(), pass = TextEditingController();
  bool accept = false, busy = false;
  String? error;

  Future<void> submit() async {
    if (code.text.length < 18) return setState(() => error = 'El código tiene el formato FIT-XXXX-XXXX-XXXX.');
    if (name.text.trim().isEmpty || !email.text.contains('@')) return setState(() => error = 'Escribe tu nombre y un correo válido.');
    final p = pass.text;
    if (p.length < 8 || !RegExp(r'\d').hasMatch(p) || !RegExp(r'[a-zA-Z]').hasMatch(p)) return setState(() => error = 'La contraseña necesita al menos 8 caracteres, con letras y números.');
    if (!accept) return setState(() => error = 'Acepta los términos y la política de privacidad.');
    setState(() => busy = true);
    final r = await store.activateLicense({'code': code.text, 'name': name.text.trim(), 'email': email.text.trim(), 'password': p, 'acceptTerms': true});
    if (!mounted) return;
    setState(() {
      busy = false;
      error = r.error;
    });
    if (r.ok) toast(context, 'Licencia activada. ¡Bienvenido!', icon: Icons.key_rounded);
  }

  @override
  Widget build(BuildContext context) => AuthScaffold(children: [
        Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: widget.onBack, icon: const Icon(Icons.arrow_back_rounded), label: const Text('Iniciar sesión'))),
        const AuthHero(mark: HeroIcon(Icons.key_rounded), title: 'Activa tu licencia', text: 'Crea tu cuenta de entrenador con el código que te dio el administrador. La licencia empieza a contar hoy.'),
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Field('Código de licencia', controller: code, hint: 'FIT-XXXX-XXXX-XXXX', caps: TextCapitalization.characters, onChanged: (v) {
              final n = AppStore.normalizeCode(v);
              if (n != v) code.value = TextEditingValue(text: n, selection: TextSelection.collapsed(offset: n.length));
              setState(() => error = null);
            }),
            const Gap(14),
            Field('Nombre completo', controller: name, caps: TextCapitalization.words, autofill: const [AutofillHints.name]),
            const Gap(14),
            Field('Correo', controller: email, keyboard: TextInputType.emailAddress, autofill: const [AutofillHints.email]),
            const Gap(14),
            Field('Contraseña', controller: pass, obscure: true, helper: 'Mínimo 8 caracteres, con letras y números.', autofill: const [AutofillHints.newPassword]),
            const Gap(10),
            CheckRow(
              value: accept,
              onChanged: (v) => setState(() => accept = v),
              child: Text.rich(TextSpan(children: [
                const TextSpan(text: 'Acepto los '),
                WidgetSpan(child: GestureDetector(onTap: () => openLegal('terminos'), child: Text('términos de uso', style: TextStyle(color: context.tok.accent, fontWeight: FontWeight.w600)))),
                const TextSpan(text: ' y la '),
                WidgetSpan(child: GestureDetector(onTap: () => openLegal('privacidad'), child: Text('política de privacidad', style: TextStyle(color: context.tok.accent, fontWeight: FontWeight.w600)))),
                const TextSpan(text: ', y me comprometo a cuidar los datos de mis asesorados.'),
              ])),
            ),
            ErrorText(error),
            const Gap(12),
            FilledButton(onPressed: busy ? null : submit, child: Text(busy ? 'Activando…' : 'Activar y entrar')),
          ]),
        ),
        const DevCredit(),
      ]);
}

/* ------------------------------------------------------------ Inscripción con el enlace del entrenador */
class _SignupForm extends StatefulWidget {
  final String slug;
  final J coach;
  final VoidCallback onBack;
  const _SignupForm({super.key, required this.slug, required this.coach, required this.onBack});
  @override
  State<_SignupForm> createState() => _SignupFormState();
}

class _SignupFormState extends State<_SignupForm> {
  final name = TextEditingController(), email = TextEditingController(), phone = TextEditingController(), pass = TextEditingController();
  String goal = 'Hipertrofia';
  bool accept = false, photos = false, busy = false, show = false;
  String? error;

  Future<void> submit() async {
    if (name.text.trim().length < 3) return setState(() => error = 'Escribe tu nombre completo.');
    if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(email.text.trim())) return setState(() => error = 'Escribe un correo válido: lo usarás para entrar.');
    final p = pass.text;
    if (p.length < 8 || !RegExp(r'\d').hasMatch(p) || !RegExp(r'[a-zA-Z]').hasMatch(p)) return setState(() => error = 'La contraseña necesita al menos 8 caracteres, con letras y números.');
    if (!accept) return setState(() => error = 'Acepta el aviso de privacidad para inscribirte.');
    setState(() => busy = true);
    final r = await store.signupWithCoach({
      'slug': widget.slug, 'name': name.text.trim(), 'email': email.text.trim().toLowerCase(), 'phone': phone.text.trim(), 'goal': goal,
      'password': p, 'acceptTerms': true, 'photos': photos, 'website': '',
    });
    if (!mounted) return;
    setState(() {
      busy = false;
      error = r.error;
    });
    if (r.ok) toast(context, '¡Bienvenido/a, ${firstName(name.text)}!');
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.coach;
    final s = c.m('signup') ?? {};
    final trial = s.i('trialDays');
    final text = trial > 0
        ? 'Empiezas con ${trial == 30 ? 'un mes' : '$trial días'} de prueba${s.n('trialFee') > 0 ? ' por ${money(s.n('trialFee'))}' : ' gratis'}${s.n('fee') > 0 ? '; luego ${money(s.n('fee'))} al mes' : ''}.'
        : s.n('fee') > 0
            ? 'Mensualidad: ${money(s.n('fee'))}.'
            : 'Crea tu cuenta para empezar a entrenar.';
    return AuthScaffold(children: [
      Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: widget.onBack, icon: const Icon(Icons.arrow_back_rounded), label: const Text('Ya tengo cuenta'))),
      AuthHero(mark: BrandMark(brand: c, size: 72), title: 'Inscríbete con ${c.sn('businessName') ?? c.s('coachName')}', text: text),
      Panel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Field('Nombre completo', controller: name, caps: TextCapitalization.words, autofill: const [AutofillHints.name]),
          const Gap(14),
          Field('Correo', controller: email, hint: 'tu@correo.com', keyboard: TextInputType.emailAddress, autofill: const [AutofillHints.email]),
          const Gap(14),
          Field('Teléfono', controller: phone, keyboard: TextInputType.phone, autofill: const [AutofillHints.telephoneNumber]),
          const Gap(14),
          Labeled('Objetivo', ChoiceRow<String>(options: [for (final g in goals) (g, g)], value: goal, onChanged: (v) => setState(() => goal = v))),
          const Gap(14),
          Field('Crea tu contraseña', controller: pass, obscure: !show, helper: 'Al menos 8 caracteres, con letras y números', autofill: const [AutofillHints.newPassword],
              suffix: IconButton(icon: Icon(show ? Icons.visibility_off_rounded : Icons.visibility_rounded), onPressed: () => setState(() => show = !show))),
          const Gap(8),
          CheckRow(
            value: accept,
            onChanged: (v) => setState(() => accept = v),
            child: Text.rich(TextSpan(children: [
              const TextSpan(text: 'Acepto el '),
              WidgetSpan(child: GestureDetector(onTap: () => openLegal('privacidad'), child: Text('aviso de privacidad', style: TextStyle(color: context.tok.accent, fontWeight: FontWeight.w600)))),
              const TextSpan(text: ' y los términos. Mis medidas y lesiones son datos sensibles y solo los verá mi entrenador.'),
            ])),
          ),
          CheckRow(
            value: photos,
            onChanged: (v) => setState(() => photos = v),
            child: const Text.rich(TextSpan(children: [
              TextSpan(text: 'Opcional: ', style: TextStyle(fontWeight: FontWeight.w700)),
              TextSpan(text: 'permito que mi entrenador y yo guardemos fotos de mi cuerpo para seguir mi progreso.'),
            ])),
          ),
          ErrorText(error),
          const Gap(12),
          FilledButton(onPressed: busy ? null : submit, child: Text(busy ? 'Creando tu cuenta…' : 'Crear mi cuenta')),
        ]),
      ),
      const DevCredit(),
    ]);
  }
}
