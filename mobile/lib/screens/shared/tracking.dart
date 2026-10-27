// Seguimiento del asesorado: peso, medidas corporales, fotos de progreso y notas privadas.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../app.dart';
import '../../core/catalog.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/charts.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// Elige imágenes de la galería o la cámara y las devuelve como data URL (JPEG reducido).
Future<List<String>> pickImages(BuildContext context, {bool multiple = false, double max = 900, int quality = 78, bool allowCamera = true}) async {
  final picker = ImagePicker();
  ImageSource? source = ImageSource.gallery;
  if (allowCamera) {
    source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            ListTile(leading: const Icon(Icons.photo_library_rounded), title: const Text('Elegir de la galería'), onTap: () => Navigator.pop(ctx, ImageSource.gallery)),
            ListTile(leading: const Icon(Icons.photo_camera_rounded), title: const Text('Tomar una foto'), onTap: () => Navigator.pop(ctx, ImageSource.camera)),
          ]),
        ),
      ),
    );
    if (source == null) return [];
  }
  try {
    final files = <XFile>[];
    if (multiple && source == ImageSource.gallery) {
      files.addAll(await picker.pickMultiImage(maxWidth: max, maxHeight: max, imageQuality: quality, limit: 6));
    } else {
      final f = await picker.pickImage(source: source, maxWidth: max, maxHeight: max, imageQuality: quality);
      if (f != null) files.add(f);
    }
    final out = <String>[];
    for (final f in files.take(6)) {
      final bytes = await f.readAsBytes();
      if (bytes.length > 8 * 1024 * 1024) continue;
      final mime = f.mimeType ?? (f.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      out.add('data:$mime;base64,${base64Encode(bytes)}');
    }
    return out;
  } catch (e) {
    if (context.mounted) toast(context, 'No se pudo abrir la imagen.', error: true);
    return [];
  }
}

/* ------------------------------------------------------------ Peso */
Future<void> showWeightSheet(BuildContext context, int clientId) {
  final ws = store.clientById(clientId)?.lm('weights') ?? const <J>[];
  final last = ws.isEmpty ? null : ws.last;
  final c = TextEditingController(text: last != null ? kg(last.n('kg')).replaceAll(',', '.') : '');
  return showSheet(
    context,
    title: 'Registrar peso',
    builder: (ctx) => Field('Peso de hoy (kg)', controller: c, autofocus: true, keyboard: const TextInputType.numberWithOptions(decimal: true),
        helper: last != null ? 'Último: ${kg(last.n('kg'))} kg, ${shortDate(last.d('date'))}' : null),
    footer: (ctx) => FilledButton(
      onPressed: () async {
        final v = double.tryParse(c.text.replaceAll(',', '.')) ?? 0;
        if (v <= 20 || v >= 400) return toast(ctx, 'Escribe un peso válido', error: true);
        Navigator.pop(ctx);
        await runAct(context, store.addBodyWeight(clientId, v), '${kg(v)} kg registrados', Icons.monitor_weight_rounded);
      },
      child: const Text('Guardar'),
    ),
  );
}

/* ------------------------------------------------------------ Medidas */
const metrics = [
  ('weight', 'Peso', 'kg', true), ('fat', '% grasa', '%', true), ('waist', 'Cintura', 'cm', true), ('hip', 'Cadera', 'cm', false),
  ('chest', 'Pecho', 'cm', false), ('arm', 'Brazo', 'cm', false), ('thigh', 'Muslo', 'cm', false),
];

class Measurements extends StatefulWidget {
  final int clientId;
  final bool canEdit;
  const Measurements({super.key, required this.clientId, this.canEdit = false});
  @override
  State<Measurements> createState() => _MeasurementsState();
}

class _MeasurementsState extends State<Measurements> {
  String metric = 'waist';

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final c = store.clientById(widget.clientId) ?? {};
    final first = firstName(store.userById(widget.clientId)?.s('name') ?? '');
    final rows = c.lm('measurements');
    final m = metrics.firstWhere((x) => x.$1 == metric);
    final series = rows.where((r) => r[metric] != null).toList();
    final delta = series.length > 1 ? series.last.n(metric) - series.first.n(metric) : null;
    final good = delta != null && (m.$4 ? delta < 0 : delta > 0);
    String fmt(num? v, String unit) => v == null ? '—' : '${kg(v)}${unit == '%' ? ' %' : ' $unit'}';
    return Section(
      title: 'Medidas corporales',
      subtitle: rows.isEmpty ? 'Sin registros' : '${rows.length} registros · último ${shortDate(rows.last.d('date'))}',
      trailing: widget.canEdit ? IconButton.filledTonal(onPressed: () => _add(context, rows.isEmpty ? null : rows.last), icon: const Icon(Icons.add_rounded), tooltip: 'Registrar medidas') : null,
      child: rows.isEmpty
          ? EmptyState(icon: Icons.straighten_rounded, title: 'Aún no hay medidas', text: widget.canEdit ? 'Registra peso, % de grasa y perímetros de $first para ver su evolución.' : 'Tu entrenador registrará aquí tus medidas.')
          : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              ChoiceRow<String>(scroll: true, options: [for (final x in metrics) (x.$1, x.$2)], value: metric, onChanged: (v) => setState(() => metric = v)),
              const Gap(12),
              if (series.length > 1) ...[
                Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(fmt(series.last.nn(metric), m.$3), style: context.tt.headlineMedium),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('${delta! > 0 ? '+' : ''}${kg(delta)} ${m.$3} desde ${shortDate(series.first.d('date'))}',
                        style: TextStyle(color: good ? t.ok : t.muted, fontWeight: good ? FontWeight.w700 : FontWeight.w500, fontSize: 13)),
                  ),
                ]),
                const Gap(8),
                LineSeries(points: [for (final r in series) (shortDate(r.d('date')), r.n(metric))], format: (v) => kg((v * 10).round() / 10)),
              ] else
                Text('Con dos registros de ${m.$2.toLowerCase()} o más se dibuja la evolución.', style: context.tt.bodySmall),
              const Gap(12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  headingRowHeight: 36,
                  dataRowMinHeight: 40,
                  dataRowMaxHeight: 56,
                  columnSpacing: 18,
                  horizontalMargin: 4,
                  headingTextStyle: context.tt.labelSmall,
                  columns: [const DataColumn(label: Text('Fecha')), for (final x in metrics) DataColumn(label: Text(x.$2), numeric: true), if (widget.canEdit) const DataColumn(label: Text(''))],
                  rows: [
                    for (final r in rows.reversed)
                      DataRow(cells: [
                        DataCell(Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(shortDate(r.d('date')), style: context.tt.titleSmall),
                          if (r.s('note').isNotEmpty) Text(r.s('note'), style: context.tt.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                        ])),
                        for (final x in metrics) DataCell(Text(r[x.$1] != null ? kg(r.n(x.$1)) : '—')),
                        if (widget.canEdit)
                          DataCell(IconButton(
                            icon: const Icon(Icons.delete_outline_rounded, size: 19),
                            onPressed: () async {
                              if (await confirm(context, title: 'Eliminar registro', text: 'Se eliminan las medidas del ${shortDate(r.d('date'))}.', confirmLabel: 'Eliminar') && context.mounted) {
                                runAct(context, store.deleteMeasurement(widget.clientId, r.s('id')), 'Registro eliminado', Icons.delete_rounded);
                              }
                            },
                          )),
                      ]),
                  ],
                ),
              ),
              Text('Peso en kg, perímetros en cm.', style: context.tt.bodySmall),
            ]),
    );
  }

  void _add(BuildContext context, J? last) {
    final ctrls = {for (final x in metrics) x.$1: TextEditingController()};
    final note = TextEditingController();
    var date = DateTime.now();
    showSheet(
      context,
      title: 'Registrar medidas',
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          OutlinedButton.icon(
            onPressed: () async {
              final d = await showDatePicker(context: ctx, initialDate: date, firstDate: DateTime(2020), lastDate: DateTime.now());
              if (d != null) setS(() => date = d);
            },
            icon: const Icon(Icons.event_rounded),
            label: Text('Fecha: ${fullDate(date)}'),
          ),
          const Gap(12),
          Wrap(spacing: 10, runSpacing: 12, children: [
            for (final x in metrics)
              SizedBox(
                width: (MediaQuery.of(ctx).size.width - 50) / 2,
                child: Field('${x.$2} (${x.$3})', controller: ctrls[x.$1], keyboard: const TextInputType.numberWithOptions(decimal: true),
                    helper: last?[x.$1] != null ? 'Antes: ${kg(last!.n(x.$1))}' : null),
              ),
          ]),
          const Gap(12),
          Field('Nota (opcional)', controller: note, hint: 'Ej.: medido en ayunas'),
          const Gap(8),
          Text('Llena solo las medidas que tomaste. El peso también se suma a la gráfica de peso corporal.', style: ctx.tt.bodySmall),
        ]),
      ),
      footer: (ctx) => FilledButton(
        onPressed: () {
          final body = <String, dynamic>{'date': isoDay(date), 'note': note.text.trim()};
          var any = false;
          for (final x in metrics) {
            final v = double.tryParse(ctrls[x.$1]!.text.replaceAll(',', '.'));
            body[x.$1] = v == null ? '' : v.toString();
            if (v != null) any = true;
          }
          if (!any) return toast(ctx, 'Escribe al menos una medida', error: true);
          Navigator.pop(ctx);
          runAct(context, store.addMeasurement(widget.clientId, body), 'Medidas registradas', Icons.straighten_rounded);
        },
        child: const Text('Guardar'),
      ),
    );
  }
}

/* ------------------------------------------------------------ Fotos */
class Photos extends StatelessWidget {
  final int clientId;
  final bool canUpload, canDelete;
  const Photos({super.key, required this.clientId, this.canUpload = false, this.canDelete = false});

  @override
  Widget build(BuildContext context) {
    final c = store.clientById(clientId) ?? {};
    final photos = c.lm('photos');
    final allowed = c.b('photoConsent');
    final first = firstName(store.userById(clientId)?.s('name') ?? '');
    final upload = canUpload && allowed;
    final groupsMap = <String, List<J>>{};
    for (final p in photos) {
      groupsMap.putIfAbsent(p.s('date').substring(0, p.s('date').length >= 10 ? 10 : p.s('date').length), () => []).add(p);
    }
    final groups = groupsMap.entries.toList()..sort((a, b) => b.key.compareTo(a.key));
    return Section(
      title: 'Fotos de progreso',
      subtitle: photos.isEmpty ? 'Sin fotos' : '${photos.length} fotos · ${groups.length} ${groups.length == 1 ? 'fecha' : 'fechas'}',
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        if (photos.length > 1) TextButton(onPressed: () => _compare(context, photos), child: const Text('Comparar')),
        if (upload) IconButton.filledTonal(onPressed: () => _upload(context), icon: const Icon(Icons.add_a_photo_rounded), tooltip: 'Subir fotos'),
      ]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (!allowed)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: NoteBox.text(
              store.isCoach
                  ? '$first no ha dado permiso para guardar fotos de su cuerpo. Puede activarlo desde «Mi perfil» en su app.'
                  : 'Las fotos de tu cuerpo son información sensible. Para guardarlas activa el permiso en Mi perfil → Privacidad; puedes retirarlo cuando quieras.',
              icon: Icons.lock_outline_rounded,
              tone: 'neutral',
            ),
          ),
        if (photos.isEmpty)
          EmptyState(
            icon: Icons.photo_camera_back_rounded,
            title: 'Todavía no hay fotos',
            text: upload ? 'Sube fotos de frente, perfil y espalda para comparar el antes y el después.' : 'Aquí aparecerán las fotos de progreso.',
            action: upload ? FilledButton(onPressed: () => _upload(context), child: const Text('Subir fotos')) : null,
          )
        else
          for (final g in groups) ...[
            Padding(padding: const EdgeInsets.only(bottom: 8, top: 4), child: Text(capitalize(fullDate(parseDate(g.value.first.s('date')) ?? DateTime.now())), style: context.tt.titleSmall)),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 3 / 4,
              children: [
                for (final p in g.value)
                  GestureDetector(
                    onTap: () => _view(context, photos, p),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Stack(fit: StackFit.expand, children: [
                        SmartImage(p.s('src')),
                        Positioned(
                          left: 0, right: 0, bottom: 0,
                          child: Container(
                            padding: const EdgeInsets.fromLTRB(8, 14, 8, 6),
                            decoration: const BoxDecoration(gradient: LinearGradient(colors: [Colors.transparent, Colors.black54], begin: Alignment.topCenter, end: Alignment.bottomCenter)),
                            child: Text(p.s('pose'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                          ),
                        ),
                      ]),
                    ),
                  ),
              ],
            ),
            const Gap(8),
          ],
      ]),
    );
  }

  Future<void> _upload(BuildContext context) async {
    final imgs = await pickImages(context, multiple: true);
    if (imgs.isEmpty || !context.mounted) return;
    final items = [for (final (i, src) in imgs.indexed) {'src': src, 'pose': poses[i % 3]}];
    var date = DateTime.now();
    final note = TextEditingController();
    await showSheet(
      context,
      title: 'Subir fotos de progreso',
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (final (i, it) in items.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                ClipRRect(borderRadius: BorderRadius.circular(12), child: SmartImage(it['src'], width: 64, height: 84)),
                const SizedBox(width: 12),
                Expanded(child: ChoiceRow<String>(options: [for (final p in poses) (p, p)], value: it['pose'], onChanged: (v) => setS(() => items[i]['pose'] = v))),
              ]),
            ),
          OutlinedButton.icon(
            onPressed: () async {
              final d = await showDatePicker(context: ctx, initialDate: date, firstDate: DateTime(2020), lastDate: DateTime.now());
              if (d != null) setS(() => date = d);
            },
            icon: const Icon(Icons.event_rounded),
            label: Text('Fecha: ${fullDate(date)}'),
          ),
          const Gap(12),
          Field('Nota (opcional)', controller: note, hint: 'Ej.: semana 6, en ayunas'),
          const Gap(8),
          Text('Las fotos solo las ven el entrenador y su asesorado.', style: ctx.tt.bodySmall),
        ]),
      ),
      footer: (ctx) => FilledButton(
        onPressed: () {
          Navigator.pop(ctx);
          runAct(context, store.addPhotos(clientId, [for (final it in items) {'src': it['src'], 'pose': it['pose'], 'note': note.text.trim(), 'date': isoDay(date)}]),
              items.length == 1 ? 'Foto guardada' : '${items.length} fotos guardadas');
        },
        child: Text('Guardar ${items.length} ${items.length == 1 ? 'foto' : 'fotos'}'),
      ),
    );
  }

  void _view(BuildContext context, List<J> photos, J start) {
    push(context, _Lightbox(photos: photos, start: photos.indexWhere((p) => p.s('id') == start.s('id')), canDelete: canDelete, clientId: clientId));
  }

  void _compare(BuildContext context, List<J> photos) {
    push(context, _Compare(photos: photos));
  }
}

class _Lightbox extends StatefulWidget {
  final List<J> photos;
  final int start, clientId;
  final bool canDelete;
  const _Lightbox({required this.photos, required this.start, required this.canDelete, required this.clientId});
  @override
  State<_Lightbox> createState() => _LightboxState();
}

class _LightboxState extends State<_Lightbox> {
  late final PageController pc = PageController(initialPage: widget.start.clamp(0, widget.photos.length - 1));
  late int i = widget.start.clamp(0, widget.photos.length - 1);
  @override
  Widget build(BuildContext context) {
    final p = widget.photos[i];
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text('${p.s('pose')} · ${shortDate(p.d('date'))}', style: const TextStyle(color: Colors.white)),
        actions: [
          if (widget.canDelete)
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded),
              onPressed: () async {
                if (await confirm(context, title: 'Eliminar foto', text: 'La foto se elimina para el entrenador y el asesorado.', confirmLabel: 'Eliminar') && context.mounted) {
                  Navigator.pop(context);
                  runAct(context, store.deletePhoto(widget.clientId, p.s('id')), 'Foto eliminada', Icons.delete_rounded);
                }
              },
            ),
        ],
      ),
      body: Column(children: [
        Expanded(
          child: PageView.builder(
            controller: pc,
            itemCount: widget.photos.length,
            onPageChanged: (v) => setState(() => i = v),
            itemBuilder: (_, k) => InteractiveViewer(child: Center(child: SmartImage(widget.photos[k].s('src'), fit: BoxFit.contain))),
          ),
        ),
        if (p.s('note').isNotEmpty) SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(14), child: Text(p.s('note'), style: const TextStyle(color: Colors.white70)))),
      ]),
    );
  }
}

class _Compare extends StatefulWidget {
  final List<J> photos;
  const _Compare({required this.photos});
  @override
  State<_Compare> createState() => _CompareState();
}

class _CompareState extends State<_Compare> {
  late final List<J> chrono = [...widget.photos]..sort((a, b) => a.s('date').compareTo(b.s('date')));
  late String a = (chrono.where((p) => p.s('pose') == chrono.last.s('pose') && p.s('id') != chrono.last.s('id')).firstOrNull ?? chrono.first).s('id');
  late String b = chrono.last.s('id');

  @override
  Widget build(BuildContext context) {
    final pa = chrono.firstWhere((p) => p.s('id') == a), pb = chrono.firstWhere((p) => p.s('id') == b);
    final days = (pb.d('date') ?? DateTime.now()).difference(pa.d('date') ?? DateTime.now()).inDays.abs();
    Widget col(J p, String value, ValueChanged<String> on, String label) => Expanded(
          child: Column(children: [
            DropdownButtonFormField<String>(
              initialValue: value,
              isExpanded: true,
              decoration: InputDecoration(labelText: label),
              items: [for (final x in chrono) DropdownMenuItem(value: x.s('id'), child: Text('${shortDate(x.d('date'))} · ${x.s('pose')}', overflow: TextOverflow.ellipsis))],
              onChanged: (v) => v == null ? null : on(v),
            ),
            const Gap(10),
            Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(18), child: SmartImage(p.s('src'), fit: BoxFit.cover))),
          ]),
        );
    return Scaffold(
      appBar: AppBar(title: const Text('Antes y después')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(children: [
            Expanded(child: Row(children: [col(pa, a, (v) => setState(() => a = v), 'Antes'), const SizedBox(width: 10), col(pb, b, (v) => setState(() => b = v), 'Después')])),
            const Gap(12),
            Text(days == 0 ? 'Mismo día' : '$days ${days == 1 ? 'día' : 'días'} entre las dos fotos', style: context.tt.bodyMedium),
          ]),
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------ Notas privadas del entrenador */
const _catTone = {'General': '', 'Técnica': 'info', 'Lesión': 'bad', 'Nutrición': 'ok', 'Pagos': 'warn'};

class Notes extends StatefulWidget {
  final int clientId;
  const Notes({super.key, required this.clientId});
  @override
  State<Notes> createState() => _NotesState();
}

class _NotesState extends State<Notes> {
  final text = TextEditingController();
  String cat = 'General', filter = 'Todas';

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final c = store.clientById(widget.clientId) ?? {};
    final first = firstName(store.userById(widget.clientId)?.s('name') ?? '');
    final notes = [...c.lm('notes')]..sort((a, b) => a.b('pinned') != b.b('pinned') ? (b.b('pinned') ? 1 : -1) : b.s('at').compareTo(a.s('at')));
    final shown = notes.where((n) => filter == 'Todas' || n.s('category') == filter).toList();
    return Section(
      title: 'Notas privadas',
      subtitle: 'Solo tú las ves. $first no tiene acceso.',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        TextField(controller: text, minLines: 2, maxLines: 5, decoration: InputDecoration(hintText: 'Ej.: $first siente molestia en el hombro al hacer press militar'), onChanged: (_) => setState(() {})),
        const Gap(10),
        ChoiceRow<String>(scroll: true, options: [for (final x in noteCats) (x, x)], value: cat, onChanged: (v) => setState(() => cat = v)),
        const Gap(10),
        FilledButton(
          onPressed: text.text.trim().isEmpty
              ? null
              : () {
                  runAct(context, store.addNote(widget.clientId, {'text': text.text.trim(), 'category': cat}), 'Nota guardada', Icons.sticky_note_2_rounded);
                  text.clear();
                  setState(() {});
                },
          child: const Text('Guardar nota'),
        ),
        if (notes.isNotEmpty) ...[
          const Gap(14),
          ChoiceRow<String>(scroll: true, options: [for (final x in ['Todas', ...noteCats]) (x, x)], value: filter, onChanged: (v) => setState(() => filter = v)),
        ],
        const Gap(8),
        if (shown.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(notes.isNotEmpty ? 'No hay notas en esta categoría.' : 'Anota lesiones, ajustes de técnica o lo que hablaron en la última sesión.', style: context.tt.bodyMedium),
          ),
        for (final n in shown)
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.fromLTRB(14, 8, 6, 12),
            decoration: BoxDecoration(color: n.b('pinned') ? t.goldSoft : t.surface2, borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Pill(n.s('category'), tone: _catTone[n.s('category')] ?? '', small: true),
                if (n.b('pinned')) Padding(padding: const EdgeInsets.only(left: 6), child: Text('Fijada', style: TextStyle(color: t.gold, fontWeight: FontWeight.w700, fontSize: 12))),
                const SizedBox(width: 8),
                Expanded(child: Text(ago(n.d('at')), style: context.tt.bodySmall)),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: Icon(n.b('pinned') ? Icons.push_pin_rounded : Icons.push_pin_outlined, size: 19),
                  onPressed: () => runAct(context, store.updateNote(widget.clientId, n.s('id'), {'pinned': !n.b('pinned')})),
                ),
                IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.edit_outlined, size: 19), onPressed: () => _edit(context, n)),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.delete_outline_rounded, size: 19),
                  onPressed: () async {
                    if (await confirm(context, title: 'Eliminar nota', text: 'La nota se elimina definitivamente.', confirmLabel: 'Eliminar') && context.mounted) {
                      runAct(context, store.deleteNote(widget.clientId, n.s('id')), 'Nota eliminada', Icons.delete_rounded);
                    }
                  },
                ),
              ]),
              Padding(padding: const EdgeInsets.only(right: 8), child: Text(n.s('text'), style: context.tt.bodyLarge)),
            ]),
          ),
      ]),
    );
  }

  void _edit(BuildContext context, J n) {
    final c = TextEditingController(text: n.s('text'));
    var category = n.s('category', 'General');
    showSheet(
      context,
      title: 'Editar nota',
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(controller: c, minLines: 3, maxLines: 8),
          const Gap(12),
          ChoiceRow<String>(options: [for (final x in noteCats) (x, x)], value: category, onChanged: (v) => setS(() => category = v)),
        ]),
      ),
      footer: (ctx) => FilledButton(
        onPressed: () {
          if (c.text.trim().isEmpty) return;
          Navigator.pop(ctx);
          runAct(context, store.updateNote(widget.clientId, n.s('id'), {'text': c.text.trim(), 'category': category}), 'Nota actualizada');
        },
        child: const Text('Guardar'),
      ),
    );
  }
}
