// Progreso del asesorado: cifras, músculos, gráficas, récords, medidas, fotos e historial.
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/format.dart';
import '../../core/store.dart';
import '../../ui/widgets.dart';
import '../shared/progress_widgets.dart';
import '../shared/tracking.dart';
import '../shell.dart';

class ProgressPage extends StatelessWidget {
  const ProgressPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final id = store.meId!;
      final s = QuickStats.of(id);
      final streak = store.weekStreak(id, s.goal);
      return TabPage(children: [
        PageHead('Tu progreso', subtitle: 'Todo sale de lo que registras al entrenar. Tu entrenador ve lo mismo.',
            trailing: IconButton.filledTonal(onPressed: () => showWeightSheet(context, id), icon: const Icon(Icons.monitor_weight_outlined), tooltip: 'Registrar peso')),
        Grid2(children: [
          StatTile(label: 'Entrenamientos', value: '${s.total}', sub: '${s.month} este mes', icon: Icons.fitness_center_rounded),
          StatTile(label: 'Esta semana', value: '${s.week}/${s.goal}', sub: 'de tu meta', tone: s.goal > 0 && s.week >= s.goal ? 'ok' : '', icon: Icons.calendar_today_rounded),
          StatTile(label: 'Racha', value: '$streak', sub: streak == 1 ? 'semana cumpliendo' : 'semanas cumpliendo', icon: Icons.local_fire_department_rounded, tone: streak > 0 ? 'warn' : ''),
          StatTile(label: 'Volumen del mes', value: tons(s.monthVolume), sub: '${s.avgMin} min por sesión', icon: Icons.trending_up_rounded),
        ]),
        MuscleLoadPanel(id),
        VolumeChart(id),
        WeightChart(id, action: TextButton(onPressed: () => showWeightSheet(context, id), child: const Text('Registrar'))),
        Records(id),
        AdherenceChart(id),
        Measurements(clientId: id),
        Photos(clientId: id, canUpload: true),
        Section(title: 'Historial', subtitle: 'Toca una sesión para ver cada serie', child: SessionList(sessions: store.workoutsOf(id))),
      ]);
    });
  }
}
