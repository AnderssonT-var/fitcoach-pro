// Mi página: el entrenador arma su página de presentación (vytra.fit/<enlace>).
// Los campos y las secciones los define el servidor (el mismo esquema que usa la web),
// así ambos editores siempre ofrecen lo mismo.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app.dart';
import '../../core/api.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../core/format.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shared/tracking.dart';

String pageUrl(String slug) => '$apiBase/$slug';
String _img(String id) => '$apiBase/p/img/$id';
String _newId() => DateTime.now().microsecondsSinceEpoch.toRadixString(36);

const _icons = <String, IconData>{
  'sparkle': Icons.auto_awesome_rounded, 'image': Icons.image_rounded, 'chat': Icons.chat_bubble_rounded, 'community': Icons.public_rounded,
  'link': Icons.link_rounded, 'user': Icons.person_rounded, 'edit': Icons.notes_rounded, 'grid': Icons.grid_view_rounded,
  'chart': Icons.insights_rounded, 'wallet': Icons.sell_rounded, 'star': Icons.star_rounded, 'info': Icons.help_rounded,
  'play': Icons.play_circle_rounded, 'send': Icons.campaign_rounded,
};
IconData _ico(String? n) => _icons[n] ?? Icons.widgets_rounded;

class PageEditorPage extends StatefulWidget {
  const PageEditorPage({super.key});
  @override
  State<PageEditorPage> createState() => _PageEditorPageState();
}

class _PageEditorPageState extends State<PageEditorPage> {
  J? schema, page;
  String slug = '', sig = '', saved = '', error = '';
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final r = await Api.I.call('GET', '/api/coach/page');
    if (!mounted) return;
    if (!r.ok) return setState(() => error = r.offline ? 'Necesitas conexión a internet para editar tu página.' : r.error!);
    setState(() {
      schema = r.json.m('schema');
      page = r.json.m('page');
      slug = r.json.s('slug');
      sig = r.json.s('preview');
      saved = jsonEncode(page);
    });
  }

  bool get dirty => page != null && jsonEncode(page) != saved;
  void mark() => setState(() {});

  Future<bool> _save({bool? publish}) async {
    final body = {...page!, if (publish != null) 'published': publish};
    setState(() => busy = true);
    final r = await Api.I.call('PUT', '/api/coach/page', body);
    if (!mounted) return false;
    setState(() => busy = false);
    if (!r.ok) {
      toast(context, r.offline ? 'Sin conexión: guarda cuando vuelva el internet.' : r.error!, error: true);
      return false;
    }
    setState(() {
      page = r.json.m('page');
      saved = jsonEncode(page);
    });
    toast(context, publish == true ? '¡Tu página está publicada!' : publish == false ? 'Tu página ya no es pública' : 'Página guardada');
    return true;
  }

  Future<void> _view() async {
    if (dirty && !await _save()) return;
    final pub = page!['published'] == true;
    await launchUrl(Uri.parse(pub ? pageUrl(slug) : '${pageUrl(slug)}?preview=$sig'), mode: LaunchMode.externalApplication);
  }

  List<J> get sections => (page!['sections'] as List).cast<Map>().map((e) => e.cast<String, dynamic>()).toList();

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await confirm(context, title: '¿Salir sin guardar?', text: 'Tienes cambios en tu página que aún no guardas.', confirmLabel: 'Salir');
        if (leave && context.mounted) {
          saved = jsonEncode(page);
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Mi página'), actions: [
          if (page != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilledButton(onPressed: dirty && !busy ? () => _save() : null, child: Text(busy ? 'Guardando…' : 'Guardar')),
            ),
        ]),
        body: error.isNotEmpty
            ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(error, textAlign: TextAlign.center)))
            : page == null
                ? const Center(child: CircularProgressIndicator())
                : _body(context),
      ),
    );
  }

  Widget _body(BuildContext context) {
    final t = context.tok;
    final pub = page!['published'] == true;
    final groups = schema!.lm('groups');
    final defs = schema!.m('sections')!;
    final list = sections;
    return PageList(children: [
      Panel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, color: pub ? t.ok : t.surface3)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(pub ? 'Publicada' : 'Sin publicar', style: context.tt.titleSmall),
                Text(pageUrl(slug).replaceFirst(RegExp(r'^https?://'), ''), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.bodySmall),
              ]),
            ),
          ]),
          const Gap(12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            OutlinedButton.icon(
              onPressed: () { Clipboard.setData(ClipboardData(text: pageUrl(slug))); toast(context, 'Enlace copiado'); },
              icon: const Icon(Icons.copy_rounded, size: 18), label: const Text('Copiar'),
            ),
            OutlinedButton.icon(onPressed: () => SharePlus.instance.share(ShareParams(text: pageUrl(slug))), icon: const Icon(Icons.ios_share_rounded, size: 18), label: const Text('Compartir')),
            OutlinedButton.icon(onPressed: busy ? null : _view, icon: const Icon(Icons.visibility_rounded, size: 18), label: Text(pub ? 'Ver' : 'Vista previa')),
            pub
                ? OutlinedButton(onPressed: busy ? null : () => _save(publish: false), child: const Text('Despublicar'))
                : FilledButton.icon(onPressed: busy ? null : () => _save(publish: true), icon: const Icon(Icons.rocket_launch_rounded, size: 18), label: const Text('Publicar')),
          ]),
          const Gap(10),
          Text('Compártela en tus redes. El botón «Trabajemos juntos» abre tu WhatsApp e «Iniciar sesión» lleva a tu acceso con tu marca.', style: context.tt.bodySmall),
        ]),
      ),
      const _ClientReviews(),
      for (final g in groups)
        _Fold(
          icon: _ico(g.sn('icon')),
          title: g.s('label'),
          child: _Fields(fields: g.lm('fields'), value: page![g.s('k')] as Map<String, dynamic>, onChanged: mark),
        ),
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 10, 4, 0),
        child: Text('Secciones', style: context.tt.titleLarge),
      ),
      if (list.isEmpty) Text('Aún no tienes secciones. Agrega la primera.', style: context.tt.bodySmall),
      for (var i = 0; i < list.length; i++)
        if (defs[list[i].s('type')] != null) _sectionTile(context, list, i, (defs[list[i].s('type')] as Map).cast<String, dynamic>()),
      OutlinedButton.icon(
        onPressed: list.length >= (schema!.m('limits')?.i('sections') ?? 30) ? null : () => _addSection(context, defs),
        icon: const Icon(Icons.add_rounded), label: const Text('Agregar sección'),
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
      ),
    ]);
  }

  Widget _sectionTile(BuildContext context, List<J> list, int i, J def) {
    final s = list[i];
    final visible = s['visible'] != false;
    final title = s.s('title').isNotEmpty ? s.s('title') : def.s('label');
    void move(int d) {
      final raw = page!['sections'] as List;
      final j = i + d;
      if (j < 0 || j >= raw.length) return;
      final tmp = raw[i];
      raw[i] = raw[j];
      raw[j] = tmp;
      mark();
    }

    return Opacity(
      opacity: visible ? 1 : .55,
      child: Panel(
        padding: const EdgeInsets.fromLTRB(14, 10, 4, 10),
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => _SectionPage(section: s, def: def, onChanged: mark)));
          mark();
        },
        child: Row(children: [
          IconBadge(_ico(def.sn('icon'))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall),
              Text(visible ? def.s('label') : '${def.s('label')} · oculta', style: context.tt.bodySmall),
            ]),
          ),
          PopupMenuButton<String>(
            onSelected: (v) async {
              final raw = page!['sections'] as List;
              switch (v) {
                case 'up': move(-1);
                case 'down': move(1);
                case 'hide': s['visible'] = !visible; mark();
                case 'dup':
                  final copy = (jsonDecode(jsonEncode(s)) as Map).cast<String, dynamic>();
                  copy['id'] = _newId();
                  for (final it in (copy['items'] as List? ?? [])) { (it as Map)['id'] = _newId(); }
                  raw.insert(i + 1, copy);
                  mark();
                case 'del':
                  if (await confirm(context, title: '¿Eliminar?', text: 'Se quita «$title» de tu página (se aplica al guardar).', confirmLabel: 'Eliminar')) {
                    raw.removeAt(i);
                    mark();
                  }
              }
            },
            itemBuilder: (_) => [
              if (i > 0) const PopupMenuItem(value: 'up', child: Text('Subir')),
              if (i < sections.length - 1) const PopupMenuItem(value: 'down', child: Text('Bajar')),
              PopupMenuItem(value: 'hide', child: Text(visible ? 'Ocultar' : 'Mostrar')),
              const PopupMenuItem(value: 'dup', child: Text('Duplicar')),
              const PopupMenuItem(value: 'del', child: Text('Eliminar')),
            ],
          ),
        ]),
      ),
    );
  }

  Future<void> _addSection(BuildContext context, J defs) async {
    final type = await showSheet<String>(context, title: 'Agregar sección', builder: (ctx) => Column(children: [
          for (final e in defs.entries)
            ListTile(
              leading: IconBadge(_ico((e.value as Map)['icon'] as String?)),
              title: Text((e.value as Map)['label'] as String),
              subtitle: Text((e.value as Map)['hint'] as String? ?? ''),
              onTap: () => Navigator.pop(ctx, e.key),
            ),
        ]));
    if (type == null || !mounted) return;
    final def = (defs[type] as Map).cast<String, dynamic>();
    final s = <String, dynamic>{'id': _newId(), 'type': type, 'visible': true, 'bg': 'default', if (def['item'] != null) 'items': [<String, dynamic>{'id': _newId()}]};
    (page!['sections'] as List).add(s);
    mark();
    if (!context.mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => _SectionPage(section: s, def: def, onChanged: mark)));
    mark();
  }
}

/* ------------------------------------------------------------ Sección */
class _SectionPage extends StatefulWidget {
  final J section, def;
  final VoidCallback onChanged;
  const _SectionPage({required this.section, required this.def, required this.onChanged});
  @override
  State<_SectionPage> createState() => _SectionPageState();
}

class _SectionPageState extends State<_SectionPage> {
  String? open;
  void mark() { setState(() {}); widget.onChanged(); }

  @override
  Widget build(BuildContext context) {
    final s = widget.section, def = widget.def;
    final item = def.m('item');
    final items = (s['items'] as List?) ?? [];
    return Scaffold(
      appBar: AppBar(title: Text(def.s('label')), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Listo'))]),
      body: PageList(children: [
        Panel(child: _Fields(fields: def.lm('fields'), value: s, onChanged: mark)),
        if (item != null) ...[
          Padding(padding: const EdgeInsets.fromLTRB(4, 8, 4, 0), child: Text('${item.s('label')}s', style: context.tt.titleMedium)),
          for (var i = 0; i < items.length; i++) _itemTile(context, items, i, item),
          if (items.length < item.i('max'))
            OutlinedButton.icon(
              onPressed: () { final it = <String, dynamic>{'id': _newId()}; items.add(it); s['items'] = items; open = it['id'] as String; mark(); },
              icon: const Icon(Icons.add_rounded), label: Text('Agregar ${item.s('label').toLowerCase()}'),
            )
          else
            Text('Máximo ${item.i('max')}.', style: context.tt.bodySmall),
        ],
      ]),
    );
  }

  Widget _itemTile(BuildContext context, List items, int i, J item) {
    final it = (items[i] as Map).cast<String, dynamic>();
    items[i] = it;
    final id = it.s('id');
    final isOpen = open == id;
    final label = it.s('title').isNotEmpty ? it.s('title') : it.s('value').isNotEmpty ? it.s('value') : '${item.s('label')} ${i + 1}';
    return Panel(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        InkWell(
          onTap: () => setState(() => open = isOpen ? null : id),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 4, 8),
            child: Row(children: [
              if (it.s('image').isNotEmpty)
                ClipRRect(borderRadius: BorderRadius.circular(8), child: SmartImage(_img(it.s('image')), width: 34, height: 34))
              else
                CircleAvatar(radius: 17, backgroundColor: context.tok.surface3, child: Text('${i + 1}', style: context.tt.labelMedium)),
              const SizedBox(width: 12),
              Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.tt.titleSmall)),
              IconButton(tooltip: 'Subir', onPressed: i == 0 ? null : () { final x = items.removeAt(i); items.insert(i - 1, x); mark(); }, icon: const Icon(Icons.arrow_upward_rounded, size: 20)),
              IconButton(tooltip: 'Quitar', onPressed: () { items.removeAt(i); mark(); }, icon: const Icon(Icons.delete_outline_rounded, size: 20)),
              Icon(isOpen ? Icons.expand_less_rounded : Icons.expand_more_rounded),
              const SizedBox(width: 8),
            ]),
          ),
        ),
        if (isOpen) Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 16), child: _Fields(fields: item.lm('fields'), value: it, onChanged: mark)),
      ]),
    );
  }
}

/* ------------------------------------------------------------ Bloques */
class _Fold extends StatefulWidget {
  final IconData icon;
  final String title;
  final Widget child;
  const _Fold({required this.icon, required this.title, required this.child});
  @override
  State<_Fold> createState() => _FoldState();
}

class _FoldState extends State<_Fold> {
  bool open = false;
  @override
  Widget build(BuildContext context) => Panel(
        padding: EdgeInsets.zero,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          InkWell(
            onTap: () => setState(() => open = !open),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                IconBadge(widget.icon),
                const SizedBox(width: 12),
                Expanded(child: Text(widget.title, style: context.tt.titleSmall)),
                Icon(open ? Icons.expand_less_rounded : Icons.expand_more_rounded),
              ]),
            ),
          ),
          if (open) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: widget.child),
        ]),
      );
}

class _Fields extends StatelessWidget {
  final List<J> fields;
  final Map<String, dynamic> value;
  final VoidCallback onChanged;
  const _Fields({required this.fields, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final f in fields) Padding(padding: const EdgeInsets.only(top: 12), child: _field(context, f)),
    ]);
  }

  Widget _field(BuildContext context, J f) {
    final k = f.s('k');
    final type = f.s('type');
    void set(dynamic v) { value[k] = v; onChanged(); }
    final v = value[k];
    switch (type) {
      case 'toggle':
        return SwitchRow(value: v == true, title: f.s('label'), onChanged: set);
      case 'select':
        final opts = f.lm('options');
        return Labeled(f.s('label'), ChoiceRow<String>(options: [for (final o in opts) (o.s('v'), o.s('l'))], value: (v as String?) ?? opts.first.s('v'), onChanged: set));
      case 'range':
        final min = f.n('min'), max = f.n('max');
        final cur = ((v as num?) ?? min).toDouble().clamp(min, max);
        return Labeled('${f.s('label')} · ${cur.round()}${f.s('unit')}', Slider(value: cur, min: min, max: max, divisions: ((max - min) / (f.n('step', 1))).round(), onChanged: (x) => set(x.round())));
      case 'stars':
        final n = (v as num?)?.toInt() ?? 5;
        return Labeled(f.s('label'), Row(children: [
          for (var i = 1; i <= 5; i++)
            IconButton(onPressed: () => set(i), icon: Icon(Icons.star_rounded, size: 30, color: i <= n ? const Color(0xFFF5B301) : context.tok.surface3)),
        ]));
      case 'color':
        return Labeled(f.s('label'), Wrap(spacing: 10, runSpacing: 10, children: [
          _swatch(context, null, (v as String? ?? '').isEmpty, () => set('')),
          for (final (_, hex) in brandColors) _swatch(context, parseHex(hex), v == hex, () => set(hex)),
        ]));
      case 'image':
        return _ImageField(f: f, id: (v as String?) ?? '', onChanged: set);
      default:
        return Field(
          f.s('label'),
          key: ValueKey('$k-${identityHashCode(value)}'),
          initial: (v ?? '').toString(),
          hint: f.sn('placeholder'),
          helper: f.sn('hint'),
          maxLength: f.i('max') == 0 ? null : f.i('max'),
          maxLines: type == 'textarea' ? (f.i('max') > 1000 ? 8 : 4) : 1,
          keyboard: type == 'tel' ? TextInputType.phone : type == 'url' ? TextInputType.url : type == 'textarea' ? TextInputType.multiline : TextInputType.text,
          caps: type == 'textarea' || type == 'text' ? TextCapitalization.sentences : TextCapitalization.none,
          onChanged: set,
        );
    }
  }

  Widget _swatch(BuildContext context, Color? c, bool on, VoidCallback onTap) => InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 38, height: 38,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: c,
            gradient: c == null ? const SweepGradient(colors: [Color(0xFFFF3B30), Color(0xFFFF9500), Color(0xFF34C759), Color(0xFF007AFF), Color(0xFFAF52DE), Color(0xFFFF3B30)]) : null,
            border: Border.all(color: on ? context.tok.ink : Colors.transparent, width: 2.5),
          ),
          child: on ? const Icon(Icons.check_rounded, color: Colors.white, size: 18) : null,
        ),
      );
}

class _ImageField extends StatefulWidget {
  final J f;
  final String id;
  final ValueChanged<String> onChanged;
  const _ImageField({required this.f, required this.id, required this.onChanged});
  @override
  State<_ImageField> createState() => _ImageFieldState();
}

class _ImageFieldState extends State<_ImageField> {
  bool busy = false;

  Future<void> _pick() async {
    final wide = widget.f['wide'] == true, square = widget.f['square'] == true;
    final imgs = await pickImages(context, max: wide ? 1800 : square ? 400 : 1200, quality: 80);
    if (imgs.isEmpty || !mounted) return;
    setState(() => busy = true);
    final r = await Api.I.call('POST', '/api/coach/page/image', {'data': imgs.first}, false, null, null, null, const Duration(seconds: 60));
    if (!mounted) return;
    setState(() => busy = false);
    if (!r.ok) return toast(context, r.offline ? 'Necesitas conexión para subir fotos.' : r.error!, error: true);
    widget.onChanged(r.json.s('id'));
  }

  @override
  Widget build(BuildContext context) {
    final wide = widget.f['wide'] == true, square = widget.f['square'] == true;
    final w = wide ? 180.0 : square ? 72.0 : 120.0, h = wide ? 96.0 : square ? 72.0 : 80.0;
    return Labeled(widget.f.s('label'), Row(children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(square ? 40 : 12),
        child: widget.id.isEmpty
            ? Container(width: w, height: h, color: context.tok.surface3, child: Icon(Icons.image_outlined, color: context.tok.muted))
            : SmartImage(_img(widget.id), width: w, height: h),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Wrap(spacing: 8, runSpacing: 8, children: [
          OutlinedButton.icon(
            onPressed: busy ? null : _pick,
            icon: busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.add_photo_alternate_outlined, size: 18),
            label: Text(busy ? 'Subiendo…' : widget.id.isEmpty ? 'Subir' : 'Cambiar'),
          ),
          if (widget.id.isNotEmpty) TextButton(onPressed: () => widget.onChanged(''), child: const Text('Quitar')),
        ]),
      ),
    ]));
  }
}

/* ------------------------------------------------------------ Reseñas de asesorados */
class _ClientReviews extends StatelessWidget {
  const _ClientReviews();

  Future<void> _run(BuildContext context, Future<ApiResult> f, String ok) async {
    final r = await f;
    if (!context.mounted) return;
    r.ok ? toast(context, ok) : toast(context, r.error!, error: true);
  }

  Widget _item(BuildContext context, J r) {
    final u = store.userById(r.i('clientId'));
    final pending = r.s('status') == 'pending';
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: pending ? const Color(0xFFF5B301).withValues(alpha: .6) : context.tok.line),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Avatar.of(u, size: 36),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(u?.s('name') ?? 'Asesorado', style: context.tt.titleSmall),
              Text('${'★' * r.i('rating')}${'☆' * (5 - r.i('rating'))} · ${shortDate(r.d('createdAt'))}', style: context.tt.bodySmall),
            ]),
          ),
        ]),
        const Gap(8),
        Text('“${r.s('text')}”'),
        if (r.s('detail').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(r.s('detail'), style: context.tt.titleSmall)),
        const Gap(8),
        Wrap(spacing: 8, children: [
          if (pending) FilledButton.icon(onPressed: () => _run(context, store.approveReview(r.s('id')), 'Reseña aprobada: ya está en tu página'), icon: const Icon(Icons.check_rounded, size: 18), label: const Text('Aprobar')),
          OutlinedButton(
            onPressed: () async {
              if (!await confirm(context, title: pending ? '¿Rechazar la reseña?' : '¿Quitar la reseña?', text: 'Se borra y deja de verse en tu página. Tu asesorado puede escribir otra cuando quiera.', confirmLabel: pending ? 'Rechazar' : 'Quitar')) return;
              if (context.mounted) _run(context, store.rejectReview(r.s('id')), 'Reseña eliminada');
            },
            child: Text(pending ? 'Rechazar' : 'Quitar de la página'),
          ),
        ]),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Watch(builder: (context) {
      final list = store.reviews;
      if (list.isEmpty) return const SizedBox.shrink();
      final pending = list.where((r) => r.s('status') == 'pending').toList();
      final approved = list.where((r) => r.s('status') == 'approved').toList();
      return Section(
        title: 'Reseñas de tus asesorados',
        trailing: pending.isEmpty ? null : Pill('${pending.length} por aprobar', tone: 'warn'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Las escriben desde su perfil. Al aprobarlas salen en el carrusel de reseñas de tu página; al rechazarlas se borran.', style: context.tt.bodySmall),
          for (final r in pending) _item(context, r),
          if (approved.isNotEmpty)
            Theme(
              data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: Text('Publicadas (${approved.length})', style: context.tt.titleSmall),
                children: [for (final r in approved) _item(context, r)],
              ),
            ),
        ]),
      );
    });
  }
}
