// Pantallas previas a la app: carga, sin conexión, contraseña temporal,
// aviso de privacidad, cuenta pausada y aviso para el administrador.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

void openLegal(String kind) => launchUrl(Uri.parse('$apiBase/#$kind'), mode: LaunchMode.externalApplication);

/// Fondo de las pantallas de acceso: un halo del color de la marca.
class AuthScaffold extends StatelessWidget {
  final List<Widget> children;
  final bool center;
  const AuthScaffold({super.key, required this.children, this.center = false});

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    return Scaffold(
      body: Stack(children: [
        Positioned(
          top: -340, left: 0, right: 0,
          child: IgnorePointer(
            child: Center(
              child: Container(
                width: 760, height: 760,
                decoration: BoxDecoration(
                  gradient: RadialGradient(colors: [t.accent.withValues(alpha: t.dark ? .34 : .2), t.accent.withValues(alpha: 0)], radius: .5),
                ),
              ),
            ),
          ),
        ),
        SafeArea(
          child: LayoutBuilder(
            builder: (ctx, box) => SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(22, 28, 22, 28),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: box.maxHeight - 56),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 460),
                    child: Column(
                      mainAxisAlignment: center ? MainAxisAlignment.center : MainAxisAlignment.start,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: children,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

class AuthHero extends StatelessWidget {
  final Widget mark;
  final String title;
  final String? text;
  final Widget? extra;
  const AuthHero({super.key, required this.mark, required this.title, this.text, this.extra});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 26, top: 8),
        child: Column(children: [
          mark,
          const SizedBox(height: 18),
          Text(title, textAlign: TextAlign.center, style: context.tt.displayMedium),
          if (text != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(text!, textAlign: TextAlign.center, style: context.tt.bodyLarge?.copyWith(color: context.tok.ink2))),
          if (extra != null) Padding(padding: const EdgeInsets.only(top: 12), child: extra!),
        ]),
      );
}

class HeroIcon extends StatelessWidget {
  final IconData icon;
  const HeroIcon(this.icon, {super.key});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    return Container(
      width: 72, height: 72,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: LinearGradient(colors: [Color.lerp(t.accent, Colors.white, .15)!, t.accent], begin: Alignment.topLeft, end: Alignment.bottomRight),
        boxShadow: [BoxShadow(color: t.accent.withValues(alpha: .35), blurRadius: 24, offset: const Offset(0, 10))],
      ),
      child: Icon(icon, color: t.onAccent, size: 34),
    );
  }
}

class ErrorText extends StatelessWidget {
  final String? error;
  const ErrorText(this.error, {super.key});
  @override
  Widget build(BuildContext context) {
    if (error == null || error!.isEmpty) return const SizedBox.shrink();
    return Padding(padding: const EdgeInsets.only(top: 4, bottom: 4), child: NoteBox.text(error!, icon: Icons.error_outline_rounded, tone: 'bad'));
  }
}

class DevCredit extends StatelessWidget {
  const DevCredit({super.key});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 18),
        child: Text('Desarrollado por A.T.', textAlign: TextAlign.center, style: context.tt.bodySmall),
      );
}

class Splash extends StatelessWidget {
  const Splash({super.key});
  @override
  Widget build(BuildContext context) => const AuthScaffold(center: true, children: [
        AuthHero(mark: AppLogo(size: 84), title: 'VYTRAFIT'),
        Center(child: SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 3))),
      ]);
}

class OfflineScreen extends StatefulWidget {
  final String? message;
  const OfflineScreen({super.key, this.message});
  @override
  State<OfflineScreen> createState() => _OfflineScreenState();
}

class _OfflineScreenState extends State<OfflineScreen> {
  bool busy = false;
  @override
  Widget build(BuildContext context) => AuthScaffold(center: true, children: [
        AuthHero(mark: const HeroIcon(Icons.wifi_off_rounded), title: 'Sin conexión', text: widget.message ?? 'No pudimos conectar con el servidor.'),
        FilledButton(
          onPressed: busy ? null : () async {
            setState(() => busy = true);
            await store.reload();
            if (mounted) setState(() => busy = false);
          },
          child: Text(busy ? 'Conectando…' : 'Reintentar'),
        ),
      ]);
}

/* ------------------------------------------------------------ Contraseña */
class ChangePasswordForm extends StatefulWidget {
  final bool forced;
  final VoidCallback? onDone;
  const ChangePasswordForm({super.key, this.forced = false, this.onDone});
  @override
  State<ChangePasswordForm> createState() => _ChangePasswordFormState();
}

class _ChangePasswordFormState extends State<ChangePasswordForm> {
  final cur = TextEditingController(), next = TextEditingController(), again = TextEditingController();
  String? error;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    for (final c in [cur, next, again]) {
      c.addListener(() => setState(() => error = null));
    }
  }

  List<(String, bool)> get rules => [
        ('Al menos 8 caracteres', next.text.length >= 8),
        ('Letras y números', RegExp(r'[A-Za-zÁÉÍÓÚáéíóúÑñ]').hasMatch(next.text) && RegExp(r'\d').hasMatch(next.text)),
        ('Las dos coinciden', next.text.isNotEmpty && next.text == again.text),
      ];

  Future<void> submit() async {
    if (!rules.every((r) => r.$2)) return setState(() => error = 'Revisa los requisitos de la contraseña.');
    setState(() => busy = true);
    final r = await store.changePassword(cur.text, next.text);
    if (!mounted) return;
    setState(() => busy = false);
    if (!r.ok) return setState(() => error = r.error);
    toast(context, 'Contraseña actualizada', icon: Icons.lock_rounded);
    widget.onDone?.call();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Field(widget.forced ? 'Contraseña temporal' : 'Contraseña actual', controller: cur, obscure: true, autofill: const [AutofillHints.password]),
      const Gap(14),
      Field('Nueva contraseña', controller: next, obscure: true, autofill: const [AutofillHints.newPassword]),
      const Gap(14),
      Field('Repite la nueva contraseña', controller: again, obscure: true),
      const Gap(12),
      for (final (l, ok) in rules)
        Padding(
          padding: const EdgeInsets.only(bottom: 4, left: 4),
          child: Row(children: [
            Icon(ok ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 17, color: ok ? t.ok : t.muted),
            const SizedBox(width: 8),
            Text(l, style: context.tt.bodySmall?.copyWith(color: ok ? t.ok : t.muted)),
          ]),
        ),
      ErrorText(error),
      const Gap(10),
      FilledButton(onPressed: busy ? null : submit, child: Text(busy ? 'Guardando…' : 'Guardar contraseña')),
    ]);
  }
}

class ChangePasswordScreen extends StatelessWidget {
  const ChangePasswordScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final me = store.me!;
    return AuthScaffold(children: [
      AuthHero(mark: const HeroIcon(Icons.lock_rounded), title: 'Crea tu contraseña',
          text: 'Hola ${firstName(me.s('name'))}. Entraste con una contraseña temporal; elige una propia que solo tú conozcas.'),
      const ChangePasswordForm(forced: true),
      const Gap(8),
      TextButton(onPressed: store.logout, child: const Text('Salir')),
    ]);
  }
}

/* ------------------------------------------------------------ Consentimiento */
class ConsentScreen extends StatefulWidget {
  const ConsentScreen({super.key});
  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  bool accept = false, photos = false, busy = false;
  String? error;

  @override
  Widget build(BuildContext context) {
    final client = store.role == 'client';
    final points = client
        ? const [
            (Icons.lock_rounded, 'Solo tú y tu entrenador ven tus medidas, lesiones, entrenamientos y fotos. El administrador de la plataforma no los ve.'),
            (Icons.photo_camera_rounded, 'Las fotos de tu cuerpo se guardan de forma privada y nunca se publican. Solo se suben si das permiso.'),
            (Icons.download_rounded, 'Puedes descargar tus datos o eliminar tu cuenta cuando quieras desde «Mi perfil».'),
          ]
        : const [
            (Icons.lock_rounded, 'Registra solo los datos necesarios de cada asesorado y no los compartas fuera de la plataforma.'),
            (Icons.photo_camera_rounded, 'Las fotos del cuerpo son datos sensibles: solo podrás subirlas si el asesorado activó su permiso.'),
            (Icons.delete_outline_rounded, 'Atiende los pedidos de tus asesorados para corregir o eliminar sus datos.'),
          ];
    return AuthScaffold(children: [
      AuthHero(
        mark: const HeroIcon(Icons.shield_rounded),
        title: client ? 'Tu privacidad' : 'Antes de empezar',
        text: client
            ? 'Tu entrenador registrará datos de tu salud y progreso. Queremos que sepas cómo los cuidamos.'
            : 'Vas a guardar datos de salud de tus asesorados. Revisa cómo se protegen y tus compromisos.',
      ),
      Panel(
        child: Column(children: [
          for (final (i, txt) in points)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                IconBadge(i, tone: 'info', size: 34),
                const SizedBox(width: 12),
                Expanded(child: Text(txt, style: context.tt.bodyMedium)),
              ]),
            ),
        ]),
      ),
      const Gap(16),
      CheckRow(
        value: accept,
        onChanged: (v) => setState(() {
          accept = v;
          error = null;
        }),
        child: Text.rich(TextSpan(children: [
          TextSpan(text: client ? 'Acepto el ' : 'Acepto los '),
          WidgetSpan(child: GestureDetector(onTap: () => openLegal(client ? 'privacidad' : 'terminos'),
              child: Text(client ? 'aviso de privacidad' : 'términos de uso', style: TextStyle(color: context.tok.accent, fontWeight: FontWeight.w600)))),
          TextSpan(text: client ? ' y el tratamiento de mis datos de salud para mi asesoría.' : ' y la política de privacidad.'),
        ])),
      ),
      if (client)
        CheckRow(
          value: photos,
          onChanged: (v) => setState(() => photos = v),
          child: const Text.rich(TextSpan(children: [
            TextSpan(text: 'Opcional: ', style: TextStyle(fontWeight: FontWeight.w700)),
            TextSpan(text: 'permito que mi entrenador y yo guardemos fotos de mi cuerpo para seguir mi progreso. Puedo retirar este permiso cuando quiera.'),
          ])),
        ),
      ErrorText(error),
      const Gap(12),
      FilledButton(
        onPressed: busy
            ? null
            : () async {
                if (!accept) return setState(() => error = client ? 'Para continuar acepta el aviso de privacidad.' : 'Para continuar acepta los términos.');
                setState(() => busy = true);
                final r = await store.acceptConsent(client ? photos : null);
                if (!mounted) return;
                setState(() {
                  busy = false;
                  error = r.error;
                });
              },
        child: const Text('Continuar'),
      ),
      TextButton(onPressed: store.logout, child: const Text('Salir')),
      const DevCredit(),
    ]);
  }
}

class BlockedScreen extends StatelessWidget {
  final String message;
  const BlockedScreen({super.key, required this.message});
  @override
  Widget build(BuildContext context) => AuthScaffold(center: true, children: [
        AuthHero(mark: const HeroIcon(Icons.lock_clock_rounded), title: 'Acceso pausado', text: message),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: store.reload, child: const Text('Reintentar'))),
          const SizedBox(width: 10),
          Expanded(child: FilledButton(onPressed: store.logout, child: const Text('Salir'))),
        ]),
      ]);
}

class AdminNotice extends StatelessWidget {
  const AdminNotice({super.key});
  @override
  Widget build(BuildContext context) => AuthScaffold(center: true, children: [
        const AuthHero(
          mark: HeroIcon(Icons.admin_panel_settings_rounded),
          title: 'Panel de administración',
          text: 'La administración de licencias, cobros y entrenadores se hace desde la web. Esta app es para entrenadores y asesorados.',
        ),
        FilledButton.icon(
          onPressed: () => launchUrl(Uri.parse(apiBase), mode: LaunchMode.externalApplication),
          icon: const Icon(Icons.open_in_new_rounded),
          label: const Text('Abrir vytra.fit'),
        ),
        const Gap(8),
        TextButton(onPressed: store.logout, child: const Text('Salir')),
      ]);
}
