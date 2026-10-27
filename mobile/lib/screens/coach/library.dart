// Biblioteca del entrenador: más de 200 ejercicios, los propios y las plantillas.
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/catalog.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/muscle_map.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shared/exercise_ui.dart';
import '../shared/tracking.dart';

class LibraryPage extends StatelessWidget {
  const LibraryPage({super.key});
  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 2,
        child: Scaffold(
          appBar: AppBar(title: const Text('Biblioteca'), bottom: const TabBar(tabs: [Tab(text: 'Ejercicios'), Tab(text: 'Plantillas')])),
          body: const TabBarView(children: [_Exercises(), _Templates()]),
        ),
      );
}

class _Exercises extends StatefulWidget {
  const _Exercises();
  @override
  State<_Exercises> createState() => _ExercisesState();
}

class _ExercisesState extends State<_Exercises> {
  final f = ExFilters();
  @override
  void initState() {
    super.initState();
    f.addListener(() => setState(() {}));
  }

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final list = coachExercises();
      final shown = f.apply(list, store.meId!);
      return Stack(children: [
        CustomScrollView(slivers: [
          SliverPadding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 8), sliver: SliverToBoxAdapter(child: ExFilterBar(f: f, list: list, showMine: true))),
          SliverPadding(padding: const EdgeInsets.symmetric(horizontal: 16), sliver: SliverToBoxAdapter(child: Text('${shown.length} de ${list.length} ejercicios', style: context.tt.bodySmall))),
          if (shown.isEmpty)
            const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.all(16), child: Panel(child: EmptyState(icon: Icons.fitness_center_rounded, title: 'No hay ejercicios con esos filtros', text: 'Cambia la categoría o crea el ejercicio con tus propias indicaciones.'))))
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 100),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 220, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: .78),
                delegate: SliverChildBuilderDelegate((ctx, i) {
                  final ex = shown[i];
                  final mine = ex.inn('coachId') == store.meId;
                  return ExTile(
                    ex: ex,
                    onOpen: () => showExercise(
                      context,
                      ex,
                      footer: mine
                          ? (c) => Row(children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () async {
                                      Navigator.pop(c);
                                      _delete(context, ex);
                                    },
                                    icon: const Icon(Icons.delete_outline_rounded),
                                    label: const Text('Eliminar'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: FilledButton.icon(
                                    onPressed: () {
                                      Navigator.pop(c);
                                      exerciseEditor(context, ex);
                                    },
                                    icon: const Icon(Icons.edit_rounded),
                                    label: const Text('Editar'),
                                  ),
                                ),
                              ])
                          : null,
                    ),
                  );
                }, childCount: shown.length),
              ),
            ),
        ]),
        Positioned(
          right: 16,
          bottom: 16 + MediaQuery.of(context).padding.bottom,
          child: FloatingActionButton.extended(
            onPressed: () => exerciseEditor(context, null),
            icon: const Icon(Icons.add_rounded),
            label: const Text('Nuevo ejercicio'),
          ),
        ),
      ]);
    });
  }

  Future<void> _delete(BuildContext context, J ex) async {
    if (store.exerciseInUse(ex.i('id'))) {
      await confirm(context, title: 'No se puede eliminar', danger: false, confirmLabel: 'Entendido', text: '${ex.s('name')} está en la rutina de al menos un asesorado. Quítalo de esas rutinas primero.');
      return;
    }
    if (!context.mounted) return;
    if (await confirm(context, title: 'Eliminar ejercicio', confirmLabel: 'Eliminar', text: '${ex.s('name')} se quitará de tu biblioteca.') && context.mounted) {
      runAct(context, store.deleteExercise(ex.i('id')), 'Ejercicio eliminado', Icons.delete_rounded);
    }
  }
}

/// Crear o editar un ejercicio propio.
void exerciseEditor(BuildContext context, J? ex) {
  final f = <String, dynamic>{
    'id': ex?['id'], 'name': ex?.s('name') ?? '', 'muscle': ex?.s('muscle', 'Pecho') ?? 'Pecho', 'equipment': ex?.s('equipment', 'Mancuernas') ?? 'Mancuernas',
    'level': ex?.s('level', 'Intermedio') ?? 'Intermedio', 'primary': [...?ex?.l('primary').map((e) => '$e')], 'secondary': [...?ex?.l('secondary').map((e) => '$e')],
    'cues': ex?.s('cues') ?? '', 'sets': ex?.i('sets', 3) ?? 3, 'reps': ex?.s('reps', '12') ?? '12', 'rest': ex?.i('rest', 60) ?? 60, 'photo': ex?.sn('photo'),
  };
  final name = TextEditingController(text: f['name']), cues = TextEditingController(text: f['cues']), steps = TextEditingController(text: ex?.l('steps').join('\n') ?? '');
  final sets = TextEditingController(text: '${f['sets']}'), reps = TextEditingController(text: f['reps']), rest = TextEditingController(text: '${f['rest']}');
  showSheet(
    context,
    title: ex == null ? 'Nuevo ejercicio' : 'Editar ejercicio',
    full: true,
    builder: (ctx) => StatefulBuilder(builder: (ctx, setS) {
      final pri = (f['primary'] as List).cast<String>(), sec = (f['secondary'] as List).cast<String>();
      void toggle(String m) => setS(() {
            // ninguno → principal → secundario → ninguno
            if (!pri.contains(m) && !sec.contains(m)) {
              pri.add(m);
            } else if (pri.contains(m)) {
              pri.remove(m);
              sec.add(m);
            } else {
              sec.remove(m);
            }
          });
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Field('Nombre', controller: name, hint: 'Ej.: Sentadilla con pausa', caps: TextCapitalization.sentences),
        const Gap(12),
        Labeled('Categoría', ChoiceRow<String>(scroll: true, options: [for (final g in groups) (g, g)], value: f['muscle'], onChanged: (v) => setS(() => f['muscle'] = v))),
        const Gap(12),
        DropdownButtonFormField<String>(
          initialValue: equipmentList.contains(f['equipment']) ? f['equipment'] : 'Otro',
          decoration: const InputDecoration(labelText: 'Equipo'),
          items: [for (final e in equipmentList) DropdownMenuItem(value: e, child: Text(e))],
          onChanged: (v) => f['equipment'] = v,
        ),
        const Gap(12),
        Labeled('Nivel', ChoiceRow<String>(options: [for (final l in levels) (l, l)], value: f['level'], onChanged: (v) => setS(() => f['level'] = v))),
        const Gap(12),
        Row(children: [
          Expanded(child: Field('Series', controller: sets, keyboard: TextInputType.number)),
          const SizedBox(width: 8),
          Expanded(child: Field('Reps', controller: reps)),
          const SizedBox(width: 8),
          Expanded(child: Field('Desc. (s)', controller: rest, keyboard: TextInputType.number)),
        ]),
        const Gap(16),
        Text('Músculos trabajados', style: ctx.tt.titleMedium),
        Text('Toca el cuerpo o la lista: un toque principal, dos secundario, tres quita.', style: ctx.tt.bodySmall),
        const Gap(10),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: ctx.tok.surface2, borderRadius: BorderRadius.circular(20)),
          child: Column(children: [
            MuscleMap(primary: pri, secondary: sec, onSelect: toggle, height: 220, background: ctx.tok.surface2,
                describe: (m) => pri.contains(m) ? 'principal' : sec.contains(m) ? 'secundario' : 'toca para marcar'),
            if (pri.isNotEmpty || sec.isNotEmpty) MuscleLegend(primary: pri, secondary: sec),
          ]),
        ),
        const Gap(10),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final m in muscleKeys)
            FilterChip(
              label: Text(muscleName(m)),
              selected: pri.contains(m) || sec.contains(m),
              showCheckmark: false,
              selectedColor: pri.contains(m) ? ctx.tok.badSoft : ctx.tok.warnSoft,
              onSelected: (_) => toggle(m),
            ),
        ]),
        const Gap(14),
        Field('Pasos (uno por línea)', controller: steps, maxLines: 5),
        const Gap(12),
        Field('Consejo técnico', controller: cues),
        const Gap(14),
        Text('Imagen (opcional)', style: ctx.tt.titleSmall),
        const Gap(8),
        Row(children: [
          if (f['photo'] != null) ...[
            ClipRRect(borderRadius: BorderRadius.circular(12), child: SmartImage(f['photo'], width: 110, height: 80)),
            const SizedBox(width: 10),
            TextButton(onPressed: () => setS(() => f['photo'] = null), child: const Text('Quitar')),
          ] else
            OutlinedButton.icon(
              onPressed: () async {
                final img = await pickImages(ctx);
                if (img.isNotEmpty) setS(() => f['photo'] = img.first);
              },
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: const Text('Subir imagen'),
            ),
        ]),
        Padding(padding: const EdgeInsets.only(top: 6), child: Text('Si no subes una, se muestra el mapa muscular.', style: ctx.tt.bodySmall)),
      ]);
    }),
    footer: (ctx) => FilledButton(
      onPressed: () {
        if (name.text.trim().isEmpty) return toast(ctx, 'Escribe el nombre del ejercicio', error: true);
        final data = {
          ...f,
          'name': name.text.trim(),
          'cues': cues.text.trim(),
          'steps': steps.text.split('\n').map((x) => x.trim()).where((x) => x.isNotEmpty).toList(),
          'sets': int.tryParse(sets.text) ?? 3,
          'reps': reps.text.trim().isEmpty ? '12' : reps.text.trim(),
          'rest': int.tryParse(rest.text) ?? 60,
        };
        Navigator.pop(ctx);
        runAct(context, store.upsertExercise(data), ex == null ? 'Ejercicio creado' : 'Ejercicio actualizado');
      },
      child: Text(ex == null ? 'Crear ejercicio' : 'Guardar'),
    ),
  );
}

class _Templates extends StatelessWidget {
  const _Templates();
  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final list = store.templates.where((x) => x.i('coachId') == store.meId).toList();
      return PageList(onRefresh: store.reload, children: [
        if (list.isEmpty)
          const Panel(child: EmptyState(icon: Icons.layers_rounded, title: 'Sin plantillas', text: 'En la rutina de un asesorado, usa «Guardar como plantilla» para reutilizarla.'))
        else
          Panel(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Column(children: [
              for (final (i, tpl) in list.indexed) ...[
                if (i > 0) const Divider(height: 1),
                RowTile(
                  leading: const IconBadge(Icons.layers_rounded, tone: 'info'),
                  title: tpl.s('name'),
                  subtitle: '${tpl.s('goal')} · ${plural(tpl.lm('days').length, 'día', 'días')} · ${tpl.i('frequency')}×/semana · creada ${shortDate(tpl.d('createdAt'))}',
                  onTap: () => _view(context, tpl),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline_rounded),
                    onPressed: () async {
                      if (await confirm(context, title: 'Eliminar plantilla', confirmLabel: 'Eliminar', text: 'Se elimina «${tpl.s('name')}». Las rutinas que ya creaste con ella no cambian.') && context.mounted) {
                        runAct(context, store.deleteTemplate(tpl.s('id')), 'Plantilla eliminada', Icons.delete_rounded);
                      }
                    },
                  ),
                ),
              ],
            ]),
          ),
      ]);
    });
  }

  void _view(BuildContext context, J tpl) => showSheet(
        context,
        title: tpl.s('name'),
        builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('${tpl.s('goal')} · ${tpl.i('frequency')} entrenamientos por semana. Para usarla, abre la rutina de un asesorado y elige «Usar plantilla».', style: ctx.tt.bodySmall),
          for (final d in tpl.lm('days')) ...[
            const Gap(14),
            Text(d.s('name'), style: ctx.tt.titleMedium),
            for (final e in d.lm('exercises'))
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(children: [
                  Expanded(child: Text(store.exerciseById(e.i('exId')).s('name'), style: ctx.tt.bodyMedium)),
                  Text('${e.s('sets')}×${e.s('reps')} · ${clock(e.i('rest'))}', style: ctx.tt.bodySmall),
                ]),
              ),
          ],
        ]),
      );
}
