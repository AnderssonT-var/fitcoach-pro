// Cuenta: notificaciones y recordatorios, privacidad de los datos y seguridad.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/notify.dart';
import '../../core/push.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../auth/gates.dart';

/// Aviso en Inicio para activar las notificaciones (se puede cerrar).
class NotifyPrompt extends StatefulWidget {
  const NotifyPrompt({super.key});
  @override
  State<NotifyPrompt> createState() => _NotifyPromptState();
}

class _NotifyPromptState extends State<NotifyPrompt> {
  String? st;
  bool hidden = true;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) async {
      final h = p.getString('vytrafit.notifyPrompt') == 'no';
      final s = h ? null : await Notify.I.status();
      if (mounted) setState(() {
        hidden = h;
        st = s;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    if (hidden || st != 'off') return const SizedBox.shrink();
    return NoteBox(
      icon: Icons.notifications_active_rounded,
      action: Row(mainAxisSize: MainAxisSize.min, children: [
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(0, 38), padding: const EdgeInsets.symmetric(horizontal: 14)),
          onPressed: () async {
            final err = await Notify.I.enable();
            if (!context.mounted) return;
            if (err != null) return toast(context, err, error: true);
            toast(context, 'Notificaciones activadas', icon: Icons.notifications_rounded);
            if (!store.isCoach) Notify.I.scheduleReminders(store.me?.m('notif')?.m('reminder'));
            setState(() => st = 'on');
          },
          child: const Text('Activar'),
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          icon: const Icon(Icons.close_rounded, size: 19),
          onPressed: () {
            SharedPreferences.getInstance().then((p) => p.setString('vytrafit.notifyPrompt', 'no'));
            setState(() => hidden = true);
          },
        ),
      ]),
      child: Text(store.isCoach ? 'Activa las notificaciones para enterarte al instante.' : 'Activa las notificaciones: te avisamos cuando termina el descanso y te recordamos entrenar.'),
    );
  }
}

/* ------------------------------------------------------------ Notificaciones */
class NotificationsPanel extends StatefulWidget {
  const NotificationsPanel({super.key});
  @override
  State<NotificationsPanel> createState() => _NotificationsPanelState();
}

class _NotificationsPanelState extends State<NotificationsPanel> {
  String status = 'loading';
  bool busy = false;
  late J saved = store.me?.m('notif')?.m('reminder') ?? {'on': false, 'days': [1, 3, 5], 'time': '18:00'};
  late J rem = copyJ(saved);

  @override
  void initState() {
    super.initState();
    Notify.I.status().then((s) => mounted ? setState(() => status = s) : null);
  }

  static const _days = [('L', 1), ('M', 2), ('X', 3), ('J', 4), ('V', 5), ('S', 6), ('D', 0)];
  static final _times = List.generate(31, (i) {
    final m = 5 * 60 + i * 30;
    return '${(m ~/ 60).toString().padLeft(2, '0')}:${m % 60 == 0 ? '00' : '30'}';
  });

  @override
  Widget build(BuildContext context) {
    final coach = store.isCoach;
    final dirty = jsonEncode(rem) != jsonEncode(saved);
    final days = rem.l('days').map((e) => intOf(e)).toList();
    return Section(
      title: 'Notificaciones',
      trailing: status == 'on' ? const Pill('Activas', tone: 'ok', icon: Icons.check_rounded) : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(coach
            ? 'Avisos en este teléfono. Tus asesorados también reciben el fin del descanso y sus recordatorios.'
            : 'Te avisamos cuando termina el descanso (aunque la pantalla esté apagada) y te recordamos entrenar.', style: context.tt.bodyMedium),
        const Gap(12),
        if (status == 'on')
          Wrap(spacing: 8, runSpacing: 8, children: [
            OutlinedButton.icon(onPressed: () => Notify.I.test(), icon: const Icon(Icons.notifications_rounded), label: const Text('Enviar una de prueba')),
            TextButton(
              onPressed: busy ? null : () async {
                await Push.I.unregister();
                await Notify.I.disable();
                if (!mounted) return;
                setState(() => status = 'off');
                toast(context, 'Notificaciones desactivadas en este equipo', icon: Icons.notifications_off_rounded);
              },
              child: const Text('Desactivar'),
            ),
          ])
        else if (status == 'denied')
          NoteBox.text('Las notificaciones están bloqueadas para VYTRAFIT. Actívalas en los ajustes del teléfono y vuelve aquí.', icon: Icons.warning_amber_rounded, tone: 'warn')
        else if (status == 'unsupported')
          NoteBox.text('Este equipo no permite notificaciones.', icon: Icons.notifications_off_rounded, tone: 'neutral')
        else if (status == 'off')
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton.icon(
              onPressed: busy ? null : () async {
                setState(() => busy = true);
                final err = await Notify.I.enable();
                if (!mounted) return;
                setState(() => busy = false);
                if (err != null) return toast(context, err, error: true);
                setState(() => status = 'on');
                toast(context, 'Notificaciones activadas', icon: Icons.notifications_rounded);
                Notify.I.test();
                Push.I.register();
                if (!coach) Notify.I.scheduleReminders(saved);
              },
              icon: const Icon(Icons.notifications_active_rounded),
              label: Text(busy ? 'Activando…' : 'Activar notificaciones'),
            ),
          ),
        if (!coach) ...[
          const Gap(14),
          Container(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
            decoration: BoxDecoration(color: context.tok.surface2, borderRadius: BorderRadius.circular(18)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SwitchRow(value: rem.b('on'), onChanged: (v) => setState(() => rem['on'] = v), title: 'Recordarme entrenar', subtitle: 'Los días y la hora que elijas.'),
              if (rem.b('on')) ...[
                const Gap(8),
                Row(children: [
                  for (final (l, d) in _days)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: ChoiceChip(
                          label: SizedBox(width: double.infinity, child: Text(l, textAlign: TextAlign.center)),
                          showCheckmark: false,
                          labelPadding: EdgeInsets.zero,
                          selected: days.contains(d),
                          onSelected: (_) => setState(() {
                            final n = [...days];
                            n.contains(d) ? n.remove(d) : n.add(d);
                            n.sort();
                            rem['days'] = n;
                          }),
                        ),
                      ),
                    ),
                ]),
                const Gap(10),
                DropdownButtonFormField<String>(
                  initialValue: _times.contains(rem.s('time')) ? rem.s('time') : '18:00',
                  decoration: const InputDecoration(labelText: 'Hora'),
                  items: [for (final t in _times) DropdownMenuItem(value: t, child: Text(t))],
                  onChanged: (v) => setState(() => rem['time'] = v),
                ),
              ],
              if (dirty) ...[
                const Gap(10),
                FilledButton(
                  onPressed: () async {
                    final r = await store.saveReminder(rem);
                    if (!context.mounted) return;
                    if (!r.ok) return toast(context, r.error!, error: true);
                    setState(() => saved = copyJ(rem));
                    Notify.I.scheduleReminders(rem);
                    toast(context, rem.b('on') ? 'Recordatorio guardado' : 'Recordatorio desactivado', icon: Icons.alarm_rounded);
                  },
                  child: const Text('Guardar recordatorio'),
                ),
              ],
              if (rem.b('on') && status != 'on') Padding(padding: const EdgeInsets.only(top: 8), child: Text('Activa las notificaciones para recibir el recordatorio.', style: context.tt.bodySmall)),
            ]),
          ),
        ],
      ]),
    );
  }
}

/* ------------------------------------------------------------ Privacidad (asesorado) */
class PrivacyPanel extends StatelessWidget {
  const PrivacyPanel({super.key});
  @override
  Widget build(BuildContext context) {
    final u = store.me ?? {};
    final t = context.tok;
    return Section(
      title: 'Privacidad y datos',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SwitchRow(
          value: u.b('photoConsent'),
          title: 'Permitir fotos de mi cuerpo',
          subtitle: 'Mi entrenador y yo podemos guardar fotos de progreso. Solo las vemos nosotros dos y nunca se publican.',
          onChanged: (v) async {
            if (!v &&
                !await confirm(context, title: 'Retirar permiso de fotos', danger: false, confirmLabel: 'Retirar permiso',
                    text: 'Tu entrenador ya no podrá subir fotos nuevas. Las que ya existen se conservan hasta que las borres o le pidas que las borre.')) {
              return;
            }
            if (!context.mounted) return;
            runAct(context, store.setPhotoConsent(v), v ? 'Permiso de fotos activado' : 'Permiso retirado. No se podrán subir fotos nuevas.', v ? Icons.photo_camera_rounded : Icons.lock_rounded);
          },
        ),
        if (u.d('consentAt') != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Aceptaste el aviso de privacidad el ${shortDate(u.d('consentAt'))}.', style: context.tt.bodySmall)),
        const Gap(12),
        Wrap(spacing: 8, runSpacing: 8, children: [
          OutlinedButton.icon(onPressed: () => openLegal('privacidad'), icon: const Icon(Icons.shield_outlined, size: 18), label: const Text('Política de privacidad')),
          OutlinedButton.icon(onPressed: () => exportData(context), icon: const Icon(Icons.download_rounded, size: 18), label: const Text('Descargar mis datos')),
          TextButton.icon(
            onPressed: () => _delete(context),
            style: TextButton.styleFrom(foregroundColor: t.bad),
            icon: const Icon(Icons.delete_outline_rounded, size: 18),
            label: const Text('Eliminar mi cuenta'),
          ),
        ]),
      ]),
    );
  }

  static Future<void> exportData(BuildContext context) async {
    final r = await store.exportMyData();
    if (!context.mounted) return;
    if (!r.ok) return toast(context, r.error!, error: true);
    final txt = const JsonEncoder.withIndent('  ').convert(r.data);
    try {
      if (kIsWeb) {
        await SharePlus.instance.share(ShareParams(text: txt, subject: 'Mis datos de VYTRAFIT'));
        return;
      }
      final dir = await getTemporaryDirectory();
      final f = File('${dir.path}/mis-datos-vytrafit.json');
      await f.writeAsString(txt);
      await SharePlus.instance.share(ShareParams(files: [XFile(f.path, mimeType: 'application/json')], subject: 'Mis datos de VYTRAFIT'));
    } catch (_) {
      if (context.mounted) toast(context, 'No se pudo preparar el archivo.', error: true);
    }
  }

  void _delete(BuildContext context) {
    final pw = TextEditingController();
    String? error;
    showSheet(
      context,
      title: 'Eliminar mi cuenta',
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Se borrarán tu cuenta, tus entrenamientos, medidas, fotos, mensajes y pagos. No se puede deshacer. Si quieres conservar una copia, descarga tus datos antes.', style: ctx.tt.bodyMedium),
          const Gap(14),
          Field('Escribe tu contraseña para confirmar', controller: pw, obscure: true, onChanged: (_) => setS(() => error = null)),
          ErrorText(error),
          const Gap(12),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: ctx.tok.bad, foregroundColor: Colors.white),
            onPressed: () async {
              if (pw.text.isEmpty) return;
              final r = await store.deleteMyAccount(pw.text);
              if (!r.ok) return setS(() => error = r.error);
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Eliminar definitivamente'),
          ),
        ]),
      ),
    );
  }
}

/* ------------------------------------------------------------ Seguridad */
class SecurityPanel extends StatelessWidget {
  const SecurityPanel({super.key});
  @override
  Widget build(BuildContext context) => Section(
        title: 'Seguridad',
        child: Column(children: [
          RowTile(
            leading: const IconBadge(Icons.lock_rounded),
            title: 'Cambiar contraseña',
            subtitle: 'Se cerrará tu sesión en los demás dispositivos.',
            onTap: () => showSheet(context, title: 'Cambiar contraseña', builder: (ctx) => ChangePasswordForm(onDone: () => Navigator.pop(ctx))),
          ),
          const Divider(height: 1),
          RowTile(
            leading: const IconBadge(Icons.devices_rounded),
            title: 'Cerrar sesión en todos los dispositivos',
            subtitle: 'Útil si perdiste tu teléfono o entraste en otro equipo.',
            onTap: () async {
              if (await confirm(context, title: 'Cerrar todas las sesiones', danger: false, confirmLabel: 'Cerrar sesiones',
                  text: 'Tendrás que volver a iniciar sesión en todos tus dispositivos, incluido este.')) {
                store.logoutAll();
              }
            },
          ),
        ]),
      );
}
