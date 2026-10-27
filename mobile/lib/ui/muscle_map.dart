// Mapa muscular anatómico (frente y espalda, silueta de hombre o mujer).
// Modos: ejercicio (principal/secundario), calor (series por músculo) y selector táctil.
// Trazos basados en react-native-body-highlighter © 2022 ELABBASSI Hicham — licencia MIT.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_drawing/path_drawing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/catalog.dart';
import '../core/json.dart';
import 'theme.dart';

class _Fig {
  final Rect vb;
  final Path outline;
  final List<Path> base;
  final Map<String, List<Path>> regions;
  _Fig(this.vb, this.outline, this.base, this.regions);
}

final Map<String, _Fig> _figs = {};

_Fig _fig(String sex, String side) {
  return _figs['$sex/$side'] ??= () {
    final v = Catalog.body.m(sex)?.m(side) ?? {};
    final nums = v.s('vb', '0 0 100 100').split(' ').map(double.parse).toList();
    final regions = <String, List<Path>>{};
    (v.m('regions') ?? {}).forEach((k, ds) => regions[k] = (ds as List).map((d) => parseSvgPathData(d as String)).toList());
    return _Fig(
      Rect.fromLTWH(nums[0], nums[1], nums[2], nums[3]),
      parseSvgPathData(v.s('outline')),
      v.l('base').map((d) => parseSvgPathData(d as String)).toList(),
      regions,
    );
  }();
}

class MmColors {
  final Color body, muscle, outline, gap, pri, sec, sel;
  final List<Color> heat;
  MmColors(this.body, this.muscle, this.outline, this.gap, this.pri, this.sec, this.heat, this.sel);
  factory MmColors.of(BuildContext c, Color gap) {
    final t = c.tok;
    return t.dark
        ? MmColors(const Color(0xFF34363D), const Color(0xFF4A4C55), Colors.white.withValues(alpha: .1), gap, const Color(0xFFFF5A47), const Color(0xFF9C4A3C),
            const [Color(0xFF6E3A31), Color(0xFFA9503F), Color(0xFFEE5B40), Color(0xFFFF9273)], t.ink)
        : MmColors(const Color(0xFFE6E7EC), const Color(0xFFC6C8D0), const Color(0x383C3C43), gap, const Color(0xFFFF3B30), const Color(0xFFFF9F8A),
            const [Color(0xFFFFD9CF), Color(0xFFFFA48C), Color(0xFFFF6243), Color(0xFFD7261A)], t.ink);
  }
}

const _rank = {'pri': 6, 'sec': 1, 'h1': 2, 'h2': 3, 'h3': 4, 'h4': 5};

class _BodyPainter extends CustomPainter {
  final _Fig fig;
  final Map<String, String> tone;
  final Set<String> selected;
  final MmColors c;
  _BodyPainter(this.fig, this.tone, this.selected, this.c);

  String regionTone(String r) {
    final ts = musclesOfRegion(r).map((m) => tone[m]).whereType<String>().toList()..sort((a, b) => (_rank[b] ?? 0) - (_rank[a] ?? 0));
    return ts.isEmpty ? '' : ts.first;
  }

  Color fillFor(String t) => switch (t) {
        'pri' => c.pri,
        'sec' => c.sec,
        'h1' => c.heat[0],
        'h2' => c.heat[1],
        'h3' => c.heat[2],
        'h4' => c.heat[3],
        _ => c.muscle,
      };

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / fig.vb.width;
    canvas.save();
    canvas.scale(s);
    canvas.translate(-fig.vb.left, -fig.vb.top);
    final bodyPaint = Paint()..color = c.body;
    canvas.drawPath(fig.outline, bodyPaint);
    canvas.drawPath(fig.outline, Paint()..color = c.outline..style = PaintingStyle.stroke..strokeWidth = 2 / s);
    for (final p in fig.base) {
      canvas.drawPath(p, bodyPaint);
    }
    final dim = selected.isNotEmpty;
    for (final e in fig.regions.entries) {
      final ms = musclesOfRegion(e.key);
      final isSel = ms.any(selected.contains);
      var fill = ms.isEmpty ? c.muscle.withValues(alpha: .75) : fillFor(regionTone(e.key));
      if (dim && !isSel && ms.isNotEmpty) fill = fill.withValues(alpha: .5);
      final fp = Paint()..color = fill;
      final gap = Paint()..color = c.gap..style = PaintingStyle.stroke..strokeWidth = 3..strokeJoin = StrokeJoin.round;
      for (final p in e.value) {
        canvas.drawPath(p, fp);
        canvas.drawPath(p, gap);
        if (isSel) canvas.drawPath(p, Paint()..color = c.sel.withValues(alpha: .8)..style = PaintingStyle.stroke..strokeWidth = 5..strokeJoin = StrokeJoin.round);
      }
    }
    canvas.restore();
  }

  String? hit(Offset local, Size size) {
    final s = size.width / fig.vb.width;
    final p = Offset(local.dx / s + fig.vb.left, local.dy / s + fig.vb.top);
    for (final e in fig.regions.entries) {
      if (musclesOfRegion(e.key).isEmpty) continue;
      if (e.value.any((path) => path.contains(p))) return musclesOfRegion(e.key).first;
    }
    return null;
  }

  @override
  bool shouldRepaint(_BodyPainter o) => o.tone != tone || o.selected != selected || o.fig != fig || o.c.gap != c.gap;
}

class MuscleMap extends StatefulWidget {
  final List<String> primary, secondary;
  final Map<String, int>? heat;
  final List<String> selected;
  final ValueChanged<String>? onSelect;
  final String Function(String m)? describe;
  final String? body;
  final bool bodyToggle;
  final double height;
  final String? hint;
  final bool showCaption;
  final Color? background;
  const MuscleMap({super.key, this.primary = const [], this.secondary = const [], this.heat, this.selected = const [], this.onSelect, this.describe, this.body, this.bodyToggle = false, this.height = 240, this.hint, this.showCaption = true, this.background});

  @override
  State<MuscleMap> createState() => _MuscleMapState();
}

class _MuscleMapState extends State<MuscleMap> {
  static String? _savedSex;
  String? _local;
  String? _focus;

  @override
  void initState() {
    super.initState();
    if (_savedSex == null) {
      SharedPreferences.getInstance().then((p) {
        final v = p.getString('vytrafit.mm.body');
        if (v != null && mounted) setState(() => _savedSex = v);
      });
    }
  }

  String get sex => _local ?? widget.body ?? _savedSex ?? 'm';

  Map<String, String> get tone {
    final t = <String, String>{};
    widget.heat?.forEach((m, lv) {
      if (lv > 0) t[m] = 'h${lv.clamp(1, 4)}';
    });
    for (final m in widget.secondary) {
      t[m] = 'sec';
    }
    for (final m in widget.primary) {
      t[m] = 'pri';
    }
    if (widget.heat == null) {
      for (final m in widget.selected) {
        t[m] = 'pri';
      }
    }
    return t;
  }

  String label(String m) {
    final extra = widget.describe?.call(m);
    final role = widget.primary.contains(m) ? 'principal' : widget.secondary.contains(m) ? 'secundario' : '';
    return [muscleName(m), if ((extra ?? role).isNotEmpty) extra ?? role].join(' · ');
  }

  Widget figure(String side, MmColors c, Map<String, String> tn) {
    final f = _fig(sex, side);
    final w = widget.height * f.vb.width / f.vb.height;
    final painter = _BodyPainter(f, tn, widget.selected.toSet(), c);
    return Column(mainAxisSize: MainAxisSize.min, children: [
      GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapUp: (d) {
          final m = painter.hit(d.localPosition, Size(w, widget.height));
          if (m == null) return;
          HapticFeedback.selectionClick();
          setState(() => _focus = m);
          widget.onSelect?.call(m);
        },
        child: CustomPaint(size: Size(w, widget.height), painter: painter),
      ),
      const SizedBox(height: 4),
      Text(side == 'front' ? 'Frente' : 'Espalda', style: context.tt.labelSmall),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final bg = widget.background ?? context.tok.surface;
    final c = MmColors.of(context, bg);
    final tn = tone;
    final focus = _focus ?? (widget.selected.isNotEmpty ? widget.selected.first : null);
    return Column(mainAxisSize: MainAxisSize.min, children: [
      if (widget.bodyToggle)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: SegmentedButton<String>(
            showSelectedIcon: false,
            segments: const [ButtonSegment(value: 'm', label: Text('Hombre')), ButtonSegment(value: 'f', label: Text('Mujer'))],
            selected: {sex},
            onSelectionChanged: (v) {
              setState(() => _local = v.first);
              _savedSex = v.first;
              SharedPreferences.getInstance().then((p) => p.setString('vytrafit.mm.body', v.first));
            },
          ),
        ),
      FittedBox(
        fit: BoxFit.scaleDown,
        child: Row(mainAxisSize: MainAxisSize.min, children: [figure('front', c, tn), const SizedBox(width: 10), figure('back', c, tn)]),
      ),
      if (widget.showCaption)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: focus != null
                ? Text(label(focus), key: ValueKey(focus), style: context.tt.titleSmall, textAlign: TextAlign.center)
                : Text(widget.hint ?? (widget.onSelect != null ? 'Toca un músculo' : 'Toca un músculo para ver su nombre'), key: const ValueKey('hint'), style: context.tt.bodySmall),
          ),
        ),
    ]);
  }
}

class MuscleLegend extends StatelessWidget {
  final List<String> primary, secondary;
  const MuscleLegend({super.key, this.primary = const [], this.secondary = const []});
  @override
  Widget build(BuildContext context) {
    final c = MmColors.of(context, context.tok.surface);
    Widget row(Color col, String label, List<String> ms, bool strong) => Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 12, height: 12, margin: const EdgeInsets.only(top: 3, right: 8), decoration: BoxDecoration(color: col, shape: BoxShape.circle)),
            Text('$label  ', style: context.tt.bodySmall),
            Expanded(child: Text(ms.map(muscleName).join(', '), style: strong ? context.tt.titleSmall : context.tt.bodyMedium)),
          ]),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (primary.isNotEmpty) row(c.pri, 'Principales', primary, true),
      if (secondary.isNotEmpty) row(c.sec, 'Secundarios', secondary, false),
    ]);
  }
}

/// Escala de colores del mapa de calor.
class HeatScale extends StatelessWidget {
  final List<(int, String)> levels;
  final String unit;
  const HeatScale({super.key, required this.levels, required this.unit});
  @override
  Widget build(BuildContext context) {
    final c = MmColors.of(context, context.tok.surface);
    return Wrap(spacing: 10, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, alignment: WrapAlignment.center, children: [
      Text(unit, style: context.tt.labelSmall),
      for (final (lv, l) in levels)
        Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 12, height: 12, margin: const EdgeInsets.only(right: 4), decoration: BoxDecoration(color: c.heat[lv - 1], borderRadius: BorderRadius.circular(3))),
          Text(l, style: context.tt.bodySmall),
        ]),
    ]);
  }
}

Color heatColor(BuildContext context, int lv) => MmColors.of(context, context.tok.surface).heat[(lv - 1).clamp(0, 3)];
