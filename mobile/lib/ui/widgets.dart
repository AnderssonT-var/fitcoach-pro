// Componentes comunes: tarjetas, etiquetas, cifras, avatares, avisos y diálogos.
import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/json.dart';
import 'theme.dart';

/* ------------------------------------------------------------ Tarjeta */
class Panel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final Color? border;
  final Gradient? gradient;
  final double radius;
  const Panel({super.key, required this.child, this.padding = const EdgeInsets.all(18), this.onTap, this.color, this.border, this.gradient, this.radius = 24});

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius), side: BorderSide(color: border ?? t.line));
    return Material(
      color: gradient != null ? Colors.transparent : (color ?? t.surface),
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: Ink(
        decoration: gradient != null ? BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(radius)) : null,
        child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
      ),
    );
  }
}

/// Tarjeta con encabezado (título + acción) y contenido.
class Section extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget child;
  final EdgeInsetsGeometry bodyPadding;
  const Section({super.key, required this.title, this.subtitle, this.trailing, required this.child, this.bodyPadding = const EdgeInsets.fromLTRB(18, 0, 18, 18)});

  @override
  Widget build(BuildContext context) {
    return Panel(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 12, 12),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: context.tt.titleLarge),
                if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: context.tt.bodySmall)),
              ]),
            ),
            if (trailing != null) trailing!,
          ]),
        ),
        Padding(padding: bodyPadding, child: child),
      ]),
    );
  }
}

/* ------------------------------------------------------------ Encabezado de página */
class PageHead extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  const PageHead(this.title, {super.key, this.subtitle, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: context.tt.displaySmall),
            if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(subtitle!, style: context.tt.bodyMedium)),
          ]),
        ),
        if (trailing != null) Padding(padding: const EdgeInsets.only(left: 12), child: trailing!),
      ]),
    );
  }
}

/// Lista vertical con separación uniforme y padding de página.
class PageList extends StatelessWidget {
  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final EdgeInsets padding;
  final ScrollController? controller;
  const PageList({super.key, required this.children, this.onRefresh, this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 110), this.controller});

  @override
  Widget build(BuildContext context) {
    final list = ListView.separated(
      controller: controller,
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: padding,
      itemCount: children.length,
      separatorBuilder: (_, __) => const SizedBox(height: 14),
      itemBuilder: (_, i) => children[i],
    );
    if (onRefresh == null) return list;
    return RefreshIndicator(onRefresh: onRefresh!, child: list);
  }
}

/* ------------------------------------------------------------ Etiqueta */
class Pill extends StatelessWidget {
  final String text;
  final String tone;
  final IconData? icon;
  final bool small;
  const Pill(this.text, {super.key, this.tone = '', this.icon, this.small = false});

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final fg = t.tone(tone), bg = t.toneSoft(tone);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 10, vertical: small ? 3 : 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) Padding(padding: const EdgeInsets.only(right: 4), child: Icon(icon, size: small ? 12 : 14, color: fg)),
        Text(text, style: TextStyle(fontSize: small ? 11 : 12.5, fontWeight: FontWeight.w700, color: fg, height: 1.1)),
      ]),
    );
  }
}

/* ------------------------------------------------------------ Cifra */
class StatTile extends StatelessWidget {
  final String label;
  final String value;
  final String? sub;
  final IconData? icon;
  final String tone;
  final VoidCallback? onTap;
  const StatTile({super.key, required this.label, required this.value, this.sub, this.icon, this.tone = '', this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final c = tone.isEmpty ? t.ink : t.tone(tone);
    return Panel(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          if (icon != null) ...[
            Container(
              width: 28, height: 28,
              decoration: BoxDecoration(color: tone.isEmpty ? t.surface3 : t.toneSoft(tone), borderRadius: BorderRadius.circular(9)),
              child: Icon(icon, size: 16, color: tone.isEmpty ? t.ink2 : c),
            ),
            const SizedBox(width: 8),
          ],
          Expanded(child: Text(label, style: context.tt.labelMedium, maxLines: 2, overflow: TextOverflow.ellipsis)),
        ]),
        const SizedBox(height: 10),
        FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(value, style: context.tt.headlineMedium?.copyWith(color: c, fontSize: 28))),
        if (sub != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub!, style: context.tt.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis)),
      ]),
    );
  }
}

/// Cuadrícula de 2 columnas con alturas iguales por fila.
class Grid2 extends StatelessWidget {
  final List<Widget> children;
  final double gap;
  const Grid2({super.key, required this.children, this.gap = 12});

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += 2) {
      rows.add(IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(child: children[i]),
          SizedBox(width: gap),
          Expanded(child: i + 1 < children.length ? children[i + 1] : const SizedBox()),
        ]),
      ));
    }
    return Column(children: [for (var i = 0; i < rows.length; i++) ...[if (i > 0) SizedBox(height: gap), rows[i]]]);
  }
}

/* ------------------------------------------------------------ Vacío */
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? text;
  final Widget? action;
  const EmptyState({super.key, required this.icon, required this.title, this.text, this.action});

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 12),
      child: Column(children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(color: t.accentSoft, borderRadius: BorderRadius.circular(20)),
          child: Icon(icon, size: 30, color: t.accent),
        ),
        const SizedBox(height: 14),
        Text(title, style: context.tt.titleLarge, textAlign: TextAlign.center),
        if (text != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(text!, style: context.tt.bodyMedium, textAlign: TextAlign.center)),
        if (action != null) Padding(padding: const EdgeInsets.only(top: 16), child: action!),
      ]),
    );
  }
}

/* ------------------------------------------------------------ Aviso */
class NoteBox extends StatelessWidget {
  final IconData icon;
  final Widget child;
  final String tone;
  final Widget? action;
  const NoteBox({super.key, required this.icon, required this.child, this.tone = 'info', this.action});

  factory NoteBox.text(String text, {IconData icon = Icons.info_outline_rounded, String tone = 'info', Widget? action}) =>
      NoteBox(icon: icon, tone: tone, action: action, child: Text(text));

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final fg = tone == 'neutral' ? t.ink2 : t.tone(tone);
    final bg = tone == 'neutral' ? t.surface2 : t.toneSoft(tone);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(18)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.only(top: 1), child: Icon(icon, size: 19, color: fg)),
        const SizedBox(width: 10),
        Expanded(child: DefaultTextStyle.merge(style: TextStyle(color: t.ink, fontSize: 14, height: 1.4), child: child)),
        if (action != null) ...[const SizedBox(width: 8), action!],
      ]),
    );
  }
}

/* ------------------------------------------------------------ Imagen (data:, red, asset) */
class SmartImage extends StatelessWidget {
  final String? src;
  final BoxFit fit;
  final double? width, height;
  final Widget? fallback;
  const SmartImage(this.src, {super.key, this.fit = BoxFit.cover, this.width, this.height, this.fallback});

  static final Map<String, Uint8List> _cache = {};

  @override
  Widget build(BuildContext context) {
    final s = src;
    final fb = fallback ?? SizedBox(width: width, height: height);
    if (s == null || s.isEmpty) return fb;
    if (s.startsWith('data:')) {
      final comma = s.indexOf(',');
      if (comma < 0) return fb;
      final meta = s.substring(5, comma);
      final payload = s.substring(comma + 1);
      if (meta.contains('svg')) {
        final svg = meta.contains('base64') ? utf8.decode(base64Decode(payload)) : Uri.decodeComponent(payload);
        return SvgPicture.string(svg, fit: fit, width: width, height: height);
      }
      final bytes = _cache[s] ??= base64Decode(payload);
      return Image.memory(bytes, fit: fit, width: width, height: height, gaplessPlayback: true, errorBuilder: (_, __, ___) => fb);
    }
    if (s.startsWith('assets/')) return Image.asset(s, fit: fit, width: width, height: height, errorBuilder: (_, __, ___) => fb);
    final url = absUrl(s)!;
    return CachedNetworkImage(imageUrl: url, fit: fit, width: width, height: height, fadeInDuration: const Duration(milliseconds: 150),
        placeholder: (_, __) => Container(width: width, height: height, color: context.tok.surface3), errorWidget: (_, __, ___) => fb);
  }
}

/* ------------------------------------------------------------ Avatar */
const _avatarHues = [212.0, 262.0, 330.0, 24.0, 152.0, 190.0, 284.0, 8.0];

class Avatar extends StatelessWidget {
  final String name;
  final int id;
  final String? photo;
  final double size;
  const Avatar({super.key, required this.name, this.id = 0, this.photo, this.size = 40});

  factory Avatar.of(J? u, {double size = 40}) => Avatar(name: u?.s('name') ?? '?', id: u?.i('id') ?? 0, photo: u?.sn('photo'), size: size);

  @override
  Widget build(BuildContext context) {
    final hue = _avatarHues[id.abs() % _avatarHues.length];
    final dark = context.tok.dark;
    final bg = HSLColor.fromAHSL(1, hue, .62, dark ? .32 : .9).toColor();
    final fg = HSLColor.fromAHSL(1, hue, .7, dark ? .86 : .34).toColor();
    final ini = Center(child: Text(initials(name), style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, fontSize: size * .36, color: fg)));
    return ClipOval(
      child: Container(
        width: size, height: size, color: bg,
        child: photo != null && photo!.isNotEmpty ? SmartImage(photo, width: size, height: size, fallback: ini) : ini,
      ),
    );
  }
}

/// Logo de la marca del entrenador (o sus iniciales sobre su color).
class BrandMark extends StatelessWidget {
  final J? brand;
  final double size;
  const BrandMark({super.key, required this.brand, this.size = 56});

  @override
  Widget build(BuildContext context) {
    final b = brand;
    final logo = b?.sn('logo');
    final color = parseHex(b?.sn('color')) ?? context.tok.accent;
    final name = (b?.sn('businessName') ?? b?.sn('name') ?? b?.sn('coachName') ?? 'V');
    final r = BorderRadius.circular(size * .28);
    if (logo != null) {
      return Container(
        width: size, height: size,
        decoration: BoxDecoration(color: context.tok.surface, borderRadius: r, border: Border.all(color: context.tok.line)),
        clipBehavior: Clip.antiAlias,
        padding: EdgeInsets.all(size * .08),
        child: SmartImage(logo, fit: BoxFit.contain),
      );
    }
    if (b == null) return AppLogo(size: size);
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        borderRadius: r,
        gradient: LinearGradient(colors: [Color.lerp(color, Colors.white, .12)!, color, Color.lerp(color, Colors.black, .18)!], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Center(child: Text(initials(name), style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, fontSize: size * .36, color: Colors.white))),
    );
  }
}

class AppLogo extends StatelessWidget {
  final double size;
  const AppLogo({super.key, this.size = 64});
  @override
  Widget build(BuildContext context) => Image.asset('assets/brand/logo.png', width: size, height: size);
}

/* ------------------------------------------------------------ Progreso */
class Bar extends StatelessWidget {
  final double value; // 0..1
  final Color? color;
  final double height;
  const Bar(this.value, {super.key, this.color, this.height = 8});
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: LinearProgressIndicator(value: value.clamp(0, 1), minHeight: height, color: color ?? context.tok.accent, backgroundColor: context.tok.surface3),
      );
}

/// Puntos de cumplimiento semanal (hechos / meta).
class Dots extends StatelessWidget {
  final int done, goal;
  const Dots({super.key, required this.done, required this.goal});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final n = goal.clamp(0, 7);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 0; i < n; i++)
        Container(
          width: 9, height: 9, margin: const EdgeInsets.only(right: 4),
          decoration: BoxDecoration(shape: BoxShape.circle, color: i < done ? (done >= goal ? t.ok : t.accent) : t.surface3),
        ),
    ]);
  }
}

/* ------------------------------------------------------------ Selección */
class ChoiceRow<T> extends StatelessWidget {
  final List<(T, String)> options;
  final T? value;
  final ValueChanged<T> onChanged;
  final bool scroll;
  const ChoiceRow({super.key, required this.options, required this.value, required this.onChanged, this.scroll = false});

  @override
  Widget build(BuildContext context) {
    final chips = [
      for (final (v, l) in options)
        ChoiceChip(
          label: Text(l),
          selected: v == value,
          showCheckmark: false,
          onSelected: (_) {
            HapticFeedback.selectionClick();
            onChanged(v);
          },
        ),
    ];
    if (scroll) {
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [for (final c in chips) Padding(padding: const EdgeInsets.only(right: 8), child: c)]),
      );
    }
    return Wrap(spacing: 8, runSpacing: 8, children: chips);
  }
}

/* ------------------------------------------------------------ Campos */
class Field extends StatelessWidget {
  final String label;
  final TextEditingController? controller;
  final String? hint, helper, initial;
  final bool obscure, autofocus;
  final TextInputType? keyboard;
  final int maxLines;
  final int? maxLength;
  final ValueChanged<String>? onChanged;
  final Widget? suffix;
  final TextCapitalization caps;
  final List<TextInputFormatter>? formatters;
  final Iterable<String>? autofill;
  final TextInputAction? action;
  final ValueChanged<String>? onSubmitted;
  final bool enabled;
  const Field(this.label, {super.key, this.controller, this.hint, this.helper, this.initial, this.obscure = false, this.autofocus = false, this.keyboard, this.maxLines = 1, this.maxLength, this.onChanged, this.suffix, this.caps = TextCapitalization.none, this.formatters, this.autofill, this.action, this.onSubmitted, this.enabled = true});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(padding: const EdgeInsets.only(left: 4, bottom: 6), child: Text(label, style: context.tt.labelMedium?.copyWith(color: context.tok.ink2))),
      Semantics(
        label: label,
        child: TextFormField(
        controller: controller,
        initialValue: controller == null ? initial : null,
        obscureText: obscure,
        autofocus: autofocus,
        keyboardType: keyboard,
        maxLines: obscure ? 1 : maxLines,
        minLines: 1,
        maxLength: maxLength,
        onChanged: onChanged,
        textCapitalization: caps,
        inputFormatters: formatters,
        autofillHints: autofill,
        textInputAction: action,
        onFieldSubmitted: onSubmitted,
        enabled: enabled,
        style: const TextStyle(fontSize: 15.5),
        decoration: InputDecoration(hintText: hint, helperText: helper, helperMaxLines: 3, suffixIcon: suffix, counterText: ''),
      )),
    ]);
  }
}

class Labeled extends StatelessWidget {
  final String label;
  final Widget child;
  const Labeled(this.label, this.child, {super.key});
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.only(left: 4, bottom: 8), child: Text(label, style: context.tt.labelMedium?.copyWith(color: context.tok.ink2))),
        child,
      ]);
}

/// Casilla con texto largo (consentimientos, opciones).
class CheckRow extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  final Widget child;
  const CheckRow({super.key, required this.value, required this.onChanged, required this.child});
  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => onChanged(!value),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 28, height: 24, child: Checkbox(value: value, onChanged: (v) => onChanged(v ?? false))),
            const SizedBox(width: 8),
            Expanded(child: DefaultTextStyle.merge(style: TextStyle(fontSize: 14, height: 1.45, color: context.tok.ink2), child: child)),
          ]),
        ),
      );
}

class SwitchRow extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  final String title;
  final String? subtitle;
  const SwitchRow({super.key, required this.value, required this.onChanged, required this.title, this.subtitle});
  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => onChanged(!value),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: context.tt.titleSmall),
                if (subtitle != null) Text(subtitle!, style: context.tt.bodySmall),
              ]),
            ),
            Switch(value: value, onChanged: onChanged),
          ]),
        ),
      );
}

/// Fila de lista con ícono, texto y flecha.
class RowTile extends StatelessWidget {
  final Widget? leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool bold;
  const RowTile({super.key, this.leading, required this.title, this.subtitle, this.trailing, this.onTap, this.bold = true});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(children: [
          if (leading != null) ...[leading!, const SizedBox(width: 12)],
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: bold ? context.tt.titleSmall : context.tt.bodyLarge),
              if (subtitle != null) Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: context.tt.bodySmall),
            ]),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          if (onTap != null && trailing == null) Icon(Icons.chevron_right_rounded, color: context.tok.muted),
        ]),
      ),
    );
  }
}

class IconBadge extends StatelessWidget {
  final IconData icon;
  final String tone;
  final double size;
  const IconBadge(this.icon, {super.key, this.tone = '', this.size = 40});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(color: tone.isEmpty ? t.surface3 : t.toneSoft(tone), borderRadius: BorderRadius.circular(size * .32)),
      child: Icon(icon, size: size * .5, color: tone.isEmpty ? t.ink2 : t.tone(tone)),
    );
  }
}

class CountBadge extends StatelessWidget {
  final int n;
  const CountBadge(this.n, {super.key});
  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minWidth: 20),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: context.tok.bad, borderRadius: BorderRadius.circular(99)),
        child: Text('$n', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800)),
      );
}

/* ------------------------------------------------------------ Mensajes y diálogos */
void toast(BuildContext context, String msg, {bool error = false, IconData? icon}) {
  final m = ScaffoldMessenger.maybeOf(context);
  if (m == null) return;
  m.hideCurrentSnackBar();
  m.showSnackBar(SnackBar(
    content: Row(children: [
      Icon(icon ?? (error ? Icons.error_outline_rounded : Icons.check_circle_rounded), color: error ? const Color(0xFFFF8A80) : const Color(0xFF7CF0A8), size: 20),
      const SizedBox(width: 10),
      Expanded(child: Text(msg)),
    ]),
    duration: Duration(milliseconds: error ? 4500 : 2600),
  ));
}

Future<bool> confirm(BuildContext context, {required String title, required String text, String confirmLabel = 'Confirmar', bool danger = true}) async {
  final t = context.tok;
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(text),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Cancelar', style: TextStyle(color: t.ink2))),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: t.bad, foregroundColor: Colors.white) : null,
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return r ?? false;
}

/// Hoja inferior con título, contenido desplazable y acciones al pie.
Future<T?> showSheet<T>(BuildContext context, {required String title, required Widget Function(BuildContext) builder, Widget Function(BuildContext)? footer, bool full = false}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) {
      final media = MediaQuery.of(ctx);
      return Padding(
        padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: media.size.height * (full ? .94 : .88)),
          child: Column(mainAxisSize: full ? MainAxisSize.max : MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 10), child: Text(title, style: ctx.tt.headlineSmall)),
            Flexible(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 16), child: builder(ctx))),
            if (footer != null)
              Container(
                padding: EdgeInsets.fromLTRB(20, 10, 20, 12 + media.padding.bottom),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: ctx.tok.line))),
                child: footer(ctx),
              ),
          ]),
        ),
      );
    },
  );
}

/// Ejecuta una acción del servidor y muestra el resultado.
Future<bool> runAct(BuildContext context, Future<ApiResult> f, [String? okMsg, IconData? icon]) async {
  final r = await f;
  if (!context.mounted) return r.ok;
  if (!r.ok) {
    toast(context, r.error!, error: true);
    return false;
  }
  if (okMsg != null) toast(context, okMsg, icon: icon);
  return true;
}

class Gap extends StatelessWidget {
  final double h;
  const Gap(this.h, {super.key});
  @override
  Widget build(BuildContext context) => SizedBox(height: h, width: h);
}
