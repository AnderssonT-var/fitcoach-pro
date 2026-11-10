// Personaje 3D: crece con el progreso de cada músculo y el asesorado lo personaliza.
// El dibujo 3D es la misma página que usa la web (vytra.fit/avatar.html) dentro de la app;
// los datos se le pasan desde aquí y la personalización se hace con controles nativos.
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../app.dart';
import '../../core/api.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

const _skins = ['#f6d7c3', '#eac0a0', '#d8a27c', '#b97f57', '#8d5a3b', '#5e3b26'];
const _hairColors = ['#1b1410', '#3b2516', '#6b4425', '#a8743f', '#d9b56d', '#b3332e', '#9aa0a6', '#f2f2f2'];
const _cloth = ['#5856d6', '#007aff', '#34c759', '#ff3b30', '#ff9500', '#1c1c1e', '#f2f2f7', '#af52de', '#ff2d55', '#30b0c7'];
const _hair = {
  'm': [('corto', 'Corto'), ('rapado', 'Rapado'), ('rizado', 'Rizado'), ('calvo', 'Calvo'), ('largo', 'Largo')],
  'f': [('coleta', 'Coleta'), ('largo', 'Largo'), ('mono', 'Moño'), ('corto', 'Corto'), ('rizado', 'Rizado')],
};
const _outfits = {
  'm': [('tank', 'Esqueleto'), ('tee', 'Camiseta'), ('none', 'Sin camiseta')],
  'f': [('top', 'Top deportivo'), ('tank', 'Esqueleto'), ('tee', 'Camiseta')],
};

String _hex(Color c) => '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

J defaultAvatar(String body) {
  final f = body == 'f';
  return {'body': f ? 'f' : 'm', 'skin': _skins[2], 'hair': f ? 'coleta' : 'corto', 'hairColor': _hairColors[1], 'outfit': f ? 'top' : 'tank',
      'top': f ? '#ff2d55' : '#5856d6', 'bottom': '#1c1c1e', 'shoes': '#f2f2f7', 'name': ''};
}

J normalizeAvatar(J? s, String body) {
  final base = defaultAvatar((s?['body'] as String?) ?? body);
  final out = {...base, ...?s};
  final b = out['body'] as String;
  if (!_hair[b]!.any((h) => h.$1 == out['hair'])) out['hair'] = base['hair'];
  if (!_outfits[b]!.any((o) => o.$1 == out['outfit'])) out['outfit'] = base['outfit'];
  return out;
}

class AvatarCard extends StatefulWidget {
  final int clientId;
  final bool editable;
  const AvatarCard(this.clientId, {super.key, this.editable = false});
  @override
  State<AvatarCard> createState() => _AvatarCardState();
}

class _AvatarCardState extends State<AvatarCard> {
  WebViewController? ctl;
  double height = 820;
  bool ready = false, failed = false;
  J? draft;
  String? _sent;

  J get _style {
    final c = store.clientById(widget.clientId);
    final body = store.userById(widget.clientId)?.s('body') == 'f' ? 'f' : 'm';
    return normalizeAvatar(draft ?? c?.m('avatar'), body);
  }

  String _payload() {
    final c = store.clientById(widget.clientId);
    final custom = <String, String>{for (final e in store.exercises) '${e.i('id')}': e.s('muscle')};
    return jsonEncode({
      'style': _style,
      'bests': c?['bests'] ?? {},
      'workouts': [for (final w in store.workoutsOf(widget.clientId)) {'exercises': [for (final e in w.lm('exercises')) {'exId': e.i('exId')}]}],
      'custom': custom,
    });
  }

  void _push() {
    if (!ready || ctl == null) return;
    final p = _payload();
    if (p == _sent) return;
    _sent = p;
    ctl!.runJavaScript('window.setAvatar($p)');
  }

  void _init(BuildContext context) {
    if (ctl != null || kIsWeb) return;
    final t = context.tok;
    final frag = 'dark=${t.dark ? 1 : 0}&accent=${Uri.encodeComponent(_hex(Theme.of(context).colorScheme.primary))}&bg=${Uri.encodeComponent(_hex(t.bg))}&ink=${Uri.encodeComponent(_hex(t.ink))}';
    final c = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(t.bg)
      ..addJavaScriptChannel('VytraAvatar', onMessageReceived: (m) {
        final msg = m.message;
        if (msg == 'ready') {
          ready = true;
          _sent = null;
          _push();
        } else if (msg.startsWith('h:')) {
          final h = double.tryParse(msg.substring(2));
          if (h != null && mounted && (h - height).abs() > 4) setState(() => height = h.clamp(420, 1400));
        }
      })
      ..setNavigationDelegate(NavigationDelegate(onWebResourceError: (e) {
        if (e.isForMainFrame == true && mounted) setState(() => failed = true);
      }))
      ..loadRequest(Uri.parse('$apiBase/avatar.html#$frag'));
    ctl = c;
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) return const SizedBox.shrink();
    return Watch(builder: (context) {
      _init(context);
      WidgetsBinding.instance.addPostFrameCallback((_) => _push());
      if (failed) {
        return Panel(child: Row(children: [
          const Icon(Icons.wifi_off_rounded),
          const SizedBox(width: 12),
          Expanded(child: Text('Tu personaje se ve con conexión a internet.', style: context.tt.bodyMedium)),
          TextButton(onPressed: () { setState(() { failed = false; ready = false; ctl = null; }); }, child: const Text('Reintentar')),
        ]));
      }
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 4, 4, 4),
          child: Row(children: [
            Expanded(child: Text(widget.editable ? 'Tu personaje' : 'Su personaje', style: context.tt.titleLarge)),
            if (widget.editable)
              FilledButton.tonalIcon(onPressed: () => _customize(context), icon: const Icon(Icons.auto_awesome_rounded, size: 18), label: const Text('Personalizar')),
          ]),
        ),
        SizedBox(
          height: height,
          child: WebViewWidget(
            controller: ctl!,
            // Girar con el dedo (horizontal) sin bloquear el desplazamiento de la página
            gestureRecognizers: {Factory<HorizontalDragGestureRecognizer>(() => HorizontalDragGestureRecognizer()), Factory<TapGestureRecognizer>(() => TapGestureRecognizer())},
          ),
        ),
      ]);
    });
  }

  Future<void> _customize(BuildContext context) async {
    setState(() => draft = Map<String, dynamic>.from(_style));
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: context.tok.surface,
      barrierColor: Colors.black26, // se sigue viendo el personaje mientras eliges
      builder: (ctx) => _CustomizeSheet(
        initial: draft!,
        onChange: (s) { setState(() => draft = s); _push(); },
      ),
    );
    if (!mounted) return;
    if (saved == true && draft != null) {
      final r = await store.saveAvatar(draft!);
      if (!context.mounted) return;
      r.ok ? toast(context, '¡Personaje guardado!') : toast(context, r.error!, error: true);
    }
    setState(() => draft = null);
    _push();
  }
}

class _CustomizeSheet extends StatefulWidget {
  final J initial;
  final ValueChanged<J> onChange;
  const _CustomizeSheet({required this.initial, required this.onChange});
  @override
  State<_CustomizeSheet> createState() => _CustomizeSheetState();
}

class _CustomizeSheetState extends State<_CustomizeSheet> {
  late J s = Map<String, dynamic>.from(widget.initial);
  void set(String k, Object v) {
    setState(() => s = normalizeAvatar({...s, k: v}, s.s('body')));
    widget.onChange(s);
  }

  Widget _swatches(String k, List<String> colors) => Wrap(spacing: 10, runSpacing: 10, children: [
        for (final c in colors)
          InkWell(
            onTap: () => set(k, c),
            customBorder: const CircleBorder(),
            child: Container(
              width: 36, height: 36,
              decoration: BoxDecoration(shape: BoxShape.circle, color: parseHex(c) ?? Colors.grey, border: Border.all(color: s[k] == c ? context.tok.ink : context.tok.line, width: s[k] == c ? 2.5 : 1)),
              child: s[k] == c ? Icon(Icons.check_rounded, size: 18, color: (parseHex(c) ?? Colors.grey).computeLuminance() > 0.5 ? Colors.black : Colors.white) : null,
            ),
          ),
      ]);

  Widget _choices(String k, List<(String, String)> opts) => Wrap(spacing: 8, runSpacing: 8, children: [
        for (final (v, l) in opts) ChoiceChip(label: Text(l), selected: s[k] == v, onSelected: (_) => set(k, v)),
      ]);

  @override
  Widget build(BuildContext context) {
    final b = s.s('body');
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.9,
      builder: (context, scroll) => ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
        Text('Personaliza tu personaje', style: context.tt.titleLarge),
        const Gap(4),
        Text('El tamaño de cada músculo no se elige: lo ganas entrenando y subiendo peso.', style: context.tt.bodySmall),
        const Gap(14),
        Field('Nombre', initial: s.s('name'), maxLength: 24, hint: 'Ej.: Titán', onChanged: (v) => set('name', v)),
        const Gap(12),
        Labeled('Cuerpo', _choices('body', const [('m', 'Masculino'), ('f', 'Femenino')])),
        const Gap(12),
        Labeled('Tono de piel', _swatches('skin', _skins)),
        const Gap(12),
        Labeled('Peinado', _choices('hair', _hair[b]!)),
        const Gap(12),
        Labeled('Color de pelo', _swatches('hairColor', _hairColors)),
        const Gap(12),
        Labeled('Ropa', _choices('outfit', _outfits[b]!)),
        if (s['outfit'] != 'none') ...[const Gap(12), Labeled('Color de la parte de arriba', _swatches('top', _cloth))],
        const Gap(12),
        Labeled('Color del short', _swatches('bottom', _cloth)),
        const Gap(12),
        Labeled('Color de zapatillas', _swatches('shoes', _cloth)),
        const Gap(20),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar'))),
          const SizedBox(width: 12),
          Expanded(child: FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Guardar'))),
        ]),
      ]),
    );
  }
}
