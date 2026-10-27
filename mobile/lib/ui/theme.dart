// Sistema visual de VYTRAFIT: superficies profundas, tipografía Sora para títulos
// y cifras, Inter para el texto, y el color de marca del entrenador como acento.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const vytraBlue = Color(0xFF0A5BFF);

Color? parseHex(String? hex) {
  if (hex == null || hex.isEmpty) return null;
  final h = hex.replaceAll('#', '');
  if (h.length != 6) return null;
  final v = int.tryParse(h, radix: 16);
  return v == null ? null : Color(0xFF000000 | v);
}

String toHex(Color c) => '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0').toUpperCase()}';

const brandColors = [
  ('Azul', '#0071E3'), ('Índigo', '#5856D6'), ('Morado', '#9B3FD1'), ('Rosa', '#D6245E'), ('Rojo', '#D93025'),
  ('Naranja', '#E8590C'), ('Verde', '#1E9E50'), ('Turquesa', '#0E8A9C'), ('Grafito', '#3A3A3C'),
];

/// Colores con nombre que usan los componentes (se leen con `context.tok`).
@immutable
class Tok extends ThemeExtension<Tok> {
  final Color bg, surface, surface2, surface3, line, ink, ink2, muted, accent, accentSoft, onAccent;
  final Color ok, okSoft, warn, warnSoft, bad, badSoft, info, infoSoft, gold, goldSoft;
  final bool dark;
  const Tok({
    required this.bg, required this.surface, required this.surface2, required this.surface3, required this.line, required this.ink,
    required this.ink2, required this.muted, required this.accent, required this.accentSoft, required this.onAccent, required this.ok,
    required this.okSoft, required this.warn, required this.warnSoft, required this.bad, required this.badSoft, required this.info,
    required this.infoSoft, required this.gold, required this.goldSoft, required this.dark,
  });

  Color tone(String t) => switch (t) { 'ok' => ok, 'warn' => warn, 'bad' => bad, 'info' => accent, _ => ink2 };
  Color toneSoft(String t) => switch (t) { 'ok' => okSoft, 'warn' => warnSoft, 'bad' => badSoft, 'info' => accentSoft, _ => surface3 };

  @override
  Tok copyWith() => this;

  @override
  Tok lerp(ThemeExtension<Tok>? other, double t) {
    if (other is! Tok) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return Tok(
      bg: l(bg, other.bg), surface: l(surface, other.surface), surface2: l(surface2, other.surface2), surface3: l(surface3, other.surface3),
      line: l(line, other.line), ink: l(ink, other.ink), ink2: l(ink2, other.ink2), muted: l(muted, other.muted), accent: l(accent, other.accent),
      accentSoft: l(accentSoft, other.accentSoft), onAccent: l(onAccent, other.onAccent), ok: l(ok, other.ok), okSoft: l(okSoft, other.okSoft),
      warn: l(warn, other.warn), warnSoft: l(warnSoft, other.warnSoft), bad: l(bad, other.bad), badSoft: l(badSoft, other.badSoft),
      info: l(info, other.info), infoSoft: l(infoSoft, other.infoSoft), gold: l(gold, other.gold), goldSoft: l(goldSoft, other.goldSoft),
      dark: t < .5 ? dark : other.dark,
    );
  }
}

extension TokX on BuildContext {
  Tok get tok => Theme.of(this).extension<Tok>()!;
  TextTheme get tt => Theme.of(this).textTheme;
}

/// Acento legible sobre el fondo: en modo oscuro aclara marcas muy oscuras.
Color _accentFor(Color brand, bool dark) {
  final hsl = HSLColor.fromColor(brand);
  if (dark && hsl.lightness < 0.5) return hsl.withLightness(0.58).withSaturation((hsl.saturation * 1.05).clamp(0, 1)).toColor();
  if (!dark && hsl.lightness > 0.55) return hsl.withLightness(0.45).toColor();
  return brand;
}

ThemeData buildTheme(Color brand, Brightness b) {
  final dark = b == Brightness.dark;
  final accent = _accentFor(brand, dark);
  final onAccent = ThemeData.estimateBrightnessForColor(accent) == Brightness.dark ? Colors.white : const Color(0xFF0B0F1A);
  final tok = dark
      ? Tok(
          dark: true, bg: const Color(0xFF070A12), surface: const Color(0xFF10141F), surface2: const Color(0xFF161B28), surface3: const Color(0xFF1F2535),
          line: Colors.white.withValues(alpha: .07), ink: const Color(0xFFF2F4F9), ink2: const Color(0xFFC3C9D8), muted: const Color(0xFF8189A0),
          accent: accent, accentSoft: accent.withValues(alpha: .16), onAccent: onAccent,
          ok: const Color(0xFF34D17A), okSoft: const Color(0xFF34D17A).withValues(alpha: .15), warn: const Color(0xFFFFB020), warnSoft: const Color(0xFFFFB020).withValues(alpha: .15),
          bad: const Color(0xFFFF5B5B), badSoft: const Color(0xFFFF5B5B).withValues(alpha: .15), info: const Color(0xFF5AA9FF), infoSoft: const Color(0xFF5AA9FF).withValues(alpha: .15),
          gold: const Color(0xFFFFC94D), goldSoft: const Color(0xFFFFC94D).withValues(alpha: .14),
        )
      : Tok(
          dark: false, bg: const Color(0xFFF3F4F8), surface: Colors.white, surface2: const Color(0xFFF7F8FB), surface3: const Color(0xFFE9ECF3),
          line: const Color(0xFF0D1324).withValues(alpha: .08), ink: const Color(0xFF0D1220), ink2: const Color(0xFF394057), muted: const Color(0xFF6B7287),
          accent: accent, accentSoft: accent.withValues(alpha: .11), onAccent: onAccent,
          ok: const Color(0xFF138A47), okSoft: const Color(0xFF1FB45E).withValues(alpha: .13), warn: const Color(0xFFB35C00), warnSoft: const Color(0xFFFF9F0A).withValues(alpha: .15),
          bad: const Color(0xFFD0261C), badSoft: const Color(0xFFFF3B30).withValues(alpha: .11), info: const Color(0xFF0060DF), infoSoft: const Color(0xFF0A84FF).withValues(alpha: .11),
          gold: const Color(0xFF9A6400), goldSoft: const Color(0xFFFFC233).withValues(alpha: .2),
        );

  final scheme = ColorScheme.fromSeed(seedColor: accent, brightness: b).copyWith(
    primary: accent, onPrimary: onAccent, surface: tok.surface, onSurface: tok.ink, error: tok.bad, outline: tok.line,
    surfaceContainerHighest: tok.surface3, surfaceContainerHigh: tok.surface2, surfaceContainer: tok.surface2, surfaceContainerLow: tok.surface,
  );

  const body = 'Inter', display = 'Sora';
  TextStyle d(double size, FontWeight w, {double h = 1.15, double ls = -0.4}) =>
      TextStyle(fontFamily: display, fontSize: size, fontWeight: w, height: h, letterSpacing: ls, color: tok.ink);
  TextStyle t(double size, FontWeight w, {double h = 1.4, Color? c}) => TextStyle(fontFamily: body, fontSize: size, fontWeight: w, height: h, color: c ?? tok.ink);

  final text = TextTheme(
    displayLarge: d(44, FontWeight.w800, h: 1.02, ls: -1.4),
    displayMedium: d(36, FontWeight.w800, h: 1.05, ls: -1.1),
    displaySmall: d(30, FontWeight.w700, h: 1.08, ls: -0.8),
    headlineMedium: d(26, FontWeight.w700, ls: -0.6),
    headlineSmall: d(22, FontWeight.w700, ls: -0.4),
    titleLarge: d(19, FontWeight.w700, ls: -0.3),
    titleMedium: t(16, FontWeight.w600),
    titleSmall: t(14, FontWeight.w600),
    bodyLarge: t(16, FontWeight.w400, h: 1.45),
    bodyMedium: t(14.5, FontWeight.w400, h: 1.45, c: tok.ink2),
    bodySmall: t(12.5, FontWeight.w500, h: 1.35, c: tok.muted),
    labelLarge: t(15, FontWeight.w600),
    labelMedium: t(12.5, FontWeight.w600, c: tok.muted),
    labelSmall: t(11, FontWeight.w700, c: tok.muted),
  );

  final radius = BorderRadius.circular(16);
  return ThemeData(
    useMaterial3: true,
    brightness: b,
    colorScheme: scheme,
    scaffoldBackgroundColor: tok.bg,
    canvasColor: tok.bg,
    fontFamily: body,
    textTheme: text,
    extensions: [tok],
    splashFactory: InkSparkle.splashFactory,
    visualDensity: VisualDensity.standard,
    dividerTheme: DividerThemeData(color: tok.line, thickness: 1, space: 1),
    appBarTheme: AppBarTheme(
      backgroundColor: tok.bg, surfaceTintColor: Colors.transparent, elevation: 0, scrolledUnderElevation: 0, centerTitle: false,
      titleTextStyle: d(19, FontWeight.w700), foregroundColor: tok.ink,
      systemOverlayStyle: dark ? SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent) : SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: tok.surface, surfaceTintColor: Colors.transparent, indicatorColor: tok.accentSoft, height: 68, elevation: 0,
      labelTextStyle: WidgetStateProperty.resolveWith((s) => t(11.5, s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
          c: s.contains(WidgetState.selected) ? tok.ink : tok.muted)),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(size: 24, color: s.contains(WidgetState.selected) ? tok.accent : tok.muted)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: accent, foregroundColor: onAccent, disabledBackgroundColor: tok.surface3, disabledForegroundColor: tok.muted,
        minimumSize: const Size(48, 50), padding: const EdgeInsets.symmetric(horizontal: 20), shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: t(15, FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: tok.ink, side: BorderSide(color: tok.line), backgroundColor: tok.surface2, minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 18), shape: RoundedRectangleBorder(borderRadius: radius), textStyle: t(14.5, FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: accent, textStyle: t(14.5, FontWeight.w600), shape: RoundedRectangleBorder(borderRadius: radius)),
    ),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(foregroundColor: tok.ink2)),
    inputDecorationTheme: InputDecorationTheme(
      filled: true, fillColor: tok.surface2, isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      hintStyle: t(15, FontWeight.w400, c: tok.muted),
      labelStyle: t(14, FontWeight.w500, c: tok.muted),
      floatingLabelStyle: t(13, FontWeight.w600, c: accent),
      border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: tok.line)),
      enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: tok.line)),
      focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: accent, width: 1.6)),
      errorBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: tok.bad)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: tok.bad, width: 1.6)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: tok.surface2, selectedColor: tok.accentSoft, side: BorderSide(color: tok.line), checkmarkColor: accent,
      labelStyle: t(13.5, FontWeight.w600, c: tok.ink2), secondaryLabelStyle: t(13.5, FontWeight.w700, c: accent),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)), padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? tok.accentSoft : tok.surface2),
        foregroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? accent : tok.ink2),
        side: WidgetStatePropertyAll(BorderSide(color: tok.line)),
        textStyle: WidgetStatePropertyAll(t(13.5, FontWeight.w600)),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? onAccent : tok.muted),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? accent : tok.surface3),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? accent : Colors.transparent),
      side: BorderSide(color: tok.muted, width: 1.6), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: accent, linearTrackColor: tok.surface3, circularTrackColor: tok.surface3),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating, backgroundColor: dark ? const Color(0xFF232A3B) : const Color(0xFF151A27),
      contentTextStyle: t(14.5, FontWeight.w500, c: Colors.white), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      insetPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: tok.surface, surfaceTintColor: Colors.transparent, showDragHandle: true, dragHandleColor: tok.surface3,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: tok.surface, surfaceTintColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
      titleTextStyle: d(20, FontWeight.w700), contentTextStyle: t(15, FontWeight.w400, c: tok.ink2),
    ),
    listTileTheme: ListTileThemeData(iconColor: tok.ink2, titleTextStyle: t(15, FontWeight.w600), subtitleTextStyle: t(13, FontWeight.w400, c: tok.muted)),
    tabBarTheme: TabBarThemeData(
      labelColor: tok.ink, unselectedLabelColor: tok.muted, indicatorColor: accent, dividerColor: tok.line, labelStyle: t(14.5, FontWeight.w700),
      unselectedLabelStyle: t(14.5, FontWeight.w500), tabAlignment: TabAlignment.start, indicatorSize: TabBarIndicatorSize.label,
    ),
    popupMenuTheme: PopupMenuThemeData(color: tok.surface2, surfaceTintColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
  );
}
