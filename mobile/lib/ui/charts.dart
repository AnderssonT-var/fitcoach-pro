// Gráficas sencillas (barras por semana y líneas de evolución).
import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import 'theme.dart';

class BarSeries extends StatelessWidget {
  final List<(String, double)> data;
  final String Function(double) format;
  final double? goal;
  const BarSeries({super.key, required this.data, required this.format, this.goal});

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final maxV = math.max(goal ?? 0, data.fold<double>(0, (m, e) => math.max(m, e.$2)));
    final top = maxV <= 0 ? 1.0 : maxV * 1.22;
    return SizedBox(
      height: 170,
      child: BarChart(
        BarChartData(
          maxY: top,
          minY: 0,
          alignment: BarChartAlignment.spaceAround,
          gridData: FlGridData(show: true, drawVerticalLine: false, horizontalInterval: top / 3, getDrawingHorizontalLine: (_) => FlLine(color: t.line, strokeWidth: 1)),
          borderData: FlBorderData(show: false),
          extraLinesData: goal != null && goal! > 0
              ? ExtraLinesData(horizontalLines: [HorizontalLine(y: goal!, color: t.ok.withValues(alpha: .7), strokeWidth: 1.5, dashArray: [5, 4])])
              : null,
          titlesData: FlTitlesData(
            leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 20,
                getTitlesWidget: (v, meta) {
                  final i = v.toInt();
                  if (i < 0 || i >= data.length || data[i].$2 <= 0) return const SizedBox();
                  return Text(format(data[i].$2), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: t.ink2));
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 24,
                getTitlesWidget: (v, meta) {
                  final i = v.toInt();
                  if (i < 0 || i >= data.length) return const SizedBox();
                  return Padding(padding: const EdgeInsets.only(top: 6), child: Text(data[i].$1, style: TextStyle(fontSize: 10.5, color: t.muted, fontWeight: FontWeight.w600)));
                },
              ),
            ),
          ),
          barTouchData: BarTouchData(enabled: false),
          barGroups: [
            for (var i = 0; i < data.length; i++)
              BarChartGroupData(x: i, barRods: [
                BarChartRodData(
                  toY: data[i].$2,
                  width: 18,
                  borderRadius: BorderRadius.circular(6),
                  color: i == data.length - 1 ? t.accent : t.accent.withValues(alpha: .45),
                  backDrawRodData: BackgroundBarChartRodData(show: true, toY: top, color: t.surface2),
                ),
              ]),
          ],
        ),
      ),
    );
  }
}

class LineSeries extends StatelessWidget {
  final List<(String, double)> points;
  final String Function(double) format;
  const LineSeries({super.key, required this.points, required this.format});

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final ys = points.map((p) => p.$2);
    final lo = ys.reduce(math.min), hi = ys.reduce(math.max);
    final pad = math.max((hi - lo) * .25, 1.0);
    final every = math.max(1, (points.length / 4).ceil());
    return SizedBox(
      height: 180,
      child: LineChart(
        LineChartData(
          minY: lo - pad,
          maxY: hi + pad,
          gridData: FlGridData(show: true, drawVerticalLine: false, getDrawingHorizontalLine: (_) => FlLine(color: t.line, strokeWidth: 1)),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 40,
                getTitlesWidget: (v, meta) {
                  if (v == meta.min || v == meta.max) return const SizedBox();
                  return Text(format(v), style: TextStyle(fontSize: 10, color: t.muted));
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: 1,
                reservedSize: 24,
                getTitlesWidget: (v, meta) {
                  final i = v.toInt();
                  if (i < 0 || i >= points.length || (i % every != 0 && i != points.length - 1)) return const SizedBox();
                  return Padding(padding: const EdgeInsets.only(top: 6), child: Text(points[i].$1, style: TextStyle(fontSize: 10, color: t.muted)));
                },
              ),
            ),
          ),
          lineTouchData: LineTouchData(
            touchTooltipData: LineTouchTooltipData(
              getTooltipColor: (_) => t.surface3,
              getTooltipItems: (spots) => spots.map((s) => LineTooltipItem('${format(s.y)}\n${points[s.x.toInt()].$1}', TextStyle(color: t.ink, fontWeight: FontWeight.w700, fontSize: 12))).toList(),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: [for (var i = 0; i < points.length; i++) FlSpot(i.toDouble(), points[i].$2)],
              isCurved: true,
              curveSmoothness: .25,
              color: t.accent,
              barWidth: 3,
              dotData: FlDotData(
                show: true,
                getDotPainter: (s, _, __, i) => FlDotCirclePainter(radius: i == points.length - 1 ? 5 : 3, color: t.accent, strokeWidth: 2, strokeColor: t.surface),
              ),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(colors: [t.accent.withValues(alpha: .25), t.accent.withValues(alpha: 0)], begin: Alignment.topCenter, end: Alignment.bottomCenter),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Anillo de progreso (descanso).
class Ring extends StatelessWidget {
  final double value;
  final double size;
  final double stroke;
  final Color? color;
  final Widget? child;
  const Ring({super.key, required this.value, this.size = 58, this.stroke = 6, this.color, this.child});
  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: Stack(alignment: Alignment.center, children: [
          SizedBox(
            width: size, height: size,
            child: CircularProgressIndicator(value: value.clamp(0, 1), strokeWidth: stroke, strokeCap: StrokeCap.round, color: color ?? context.tok.accent, backgroundColor: context.tok.surface3),
          ),
          if (child != null) child!,
        ]),
      );
}
