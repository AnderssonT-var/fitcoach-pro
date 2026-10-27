// Suscripción del entrenador: estado de la licencia, planes, datos de pago,
// envío del comprobante y canje de códigos. También la pantalla de licencia vencida.
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/format.dart';
import '../../core/json.dart';
import '../../core/store.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../shared/tracking.dart';

const _subLabel = {'pending': 'En revisión', 'approved': 'Aprobado', 'rejected': 'Rechazado'};
const _subTone = {'pending': 'warn', 'approved': 'ok', 'rejected': 'bad'};
const _licLabel = {'active': 'Activa', 'expiring': 'Por vencer', 'expired': 'Vencida', 'revoked': 'Revocada', 'available': 'Sin usar'};
const _licTone = {'active': 'ok', 'expiring': 'warn', 'expired': 'bad', 'revoked': '', 'available': 'info'};
const _methods = ['Transferencia', 'Depósito', 'Deuna / pago móvil', 'Efectivo', 'Otro'];

class SubscriptionPage extends StatelessWidget {
  const SubscriptionPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Suscripción')),
        body: Watch(builder: (context) {
          final t = context.tok;
          final lic = store.coachLicense(store.meId!);
          final st = lic == null ? null : AppStore.licenseStatus(lic);
          final exp = lic?.d('expiresAt');
          final left = exp == null ? 0 : daysUntil(exp);
          final unlimited = lic != null && st != 'revoked' && (lic.b('unlimited') || lic.s('expiresAt').startsWith('9999'));
          return PageList(onRefresh: store.reload, children: [
            Panel(
              child: Row(children: [
                IconBadge(Icons.workspace_premium_rounded, tone: st == 'active' ? 'ok' : st == 'expiring' ? 'warn' : 'bad', size: 52),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [Text('Licencia', style: context.tt.titleLarge), const SizedBox(width: 8), if (st != null) Pill(_licLabel[st]!, tone: _licTone[st]!)]),
                    const Gap(4),
                    Text(
                      lic == null
                          ? 'Aún no tienes una licencia.'
                          : unlimited
                              ? 'Tu licencia es indefinida: no vence y no necesitas renovarla.'
                          : ['active', 'expiring'].contains(st)
                              ? 'Vigente hasta el ${shortDate(exp)} · quedan ${plural(left, 'día', 'días')}. Lo que pagues ahora se suma a esa fecha.'
                              : 'Venció el ${shortDate(exp)}. Paga un plan para volver a trabajar; tus asesorados y su historial siguen guardados.',
                      style: context.tt.bodyMedium?.copyWith(color: t.ink2),
                    ),
                  ]),
                ),
              ]),
            ),
            if (!unlimited) const SubscriptionPanel(),
          ]);
        }),
      );
}

/// Pantalla para un entrenador sin licencia vigente.
class LicenseLock extends StatelessWidget {
  const LicenseLock({super.key});
  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final lic = store.coachLicense(store.meId!);
    final st = lic == null ? null : AppStore.licenseStatus(lic);
    final n = store.clients.where((c) => c.i('coachId') == store.meId).length;
    return SafeArea(
      child: PageList(onRefresh: store.reload, padding: const EdgeInsets.fromLTRB(16, 16, 16, 40), children: [
        Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const IconBadge(Icons.lock_rounded, tone: 'bad', size: 56),
            const Gap(14),
            Text(st == 'revoked' ? 'Tu licencia fue revocada' : lic != null ? 'Tu licencia venció' : 'Activa tu licencia', style: context.tt.displaySmall),
            const Gap(8),
            Text(
              '${lic?.d('expiresAt') != null && st != 'revoked' ? 'Venció el ${shortDate(lic!.d('expiresAt'))}. ' : ''}Tus $n ${n == 1 ? 'asesorado' : 'asesorados'}, sus rutinas y su historial siguen guardados. Mientras tanto ellos no pueden entrar. Elige un plan y envía tu comprobante, o canjea un código.',
              style: context.tt.bodyMedium?.copyWith(color: t.ink2),
            ),
            const Gap(10),
            TextButton.icon(onPressed: store.logout, icon: const Icon(Icons.logout_rounded, size: 18), label: const Text('Cerrar sesión')),
          ]),
        ),
        const SubscriptionPanel(),
      ]),
    );
  }
}

class SubscriptionPanel extends StatefulWidget {
  const SubscriptionPanel({super.key});
  @override
  State<SubscriptionPanel> createState() => _SubscriptionPanelState();
}

class _SubscriptionPanelState extends State<SubscriptionPanel> {
  int months = 1;
  String method = _methods.first;
  final ref = TextEditingController(), code = TextEditingController();
  String? receipt, error, codeError;
  bool busy = false;

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    final plans = store.plans();
    final pricing = store.settings.m('pricing') ?? {};
    final subs = store.subscriptions.where((s) => s.i('coachId') == store.meId).toList();
    final pending = subs.where((s) => s.s('status') == 'pending').firstOrNull;
    final plan = plans.where((p) => p.i('months') == months).firstOrNull;
    final bank = pricing.m('bank') ?? {};
    final hasBank = bank.s('name').isNotEmpty || bank.s('number').isNotEmpty;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (pending != null)
        NoteBox.text(
          'Tu pago de ${money(pending.n('amount'))} por ${plural(pending.i('months'), 'mes', 'meses')} está en revisión desde el ${shortDate(pending.d('createdAt'))}. Cuando el administrador lo apruebe, tu licencia se extiende sola.',
          icon: Icons.schedule_rounded,
        )
      else
        Section(
          title: 'Elige tu plan',
          subtitle: 'Precio en ${pricing.s('currency', 'USD')}',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Grid2(gap: 10, children: [
              for (final p in plans)
                GestureDetector(
                  onTap: () => setState(() => months = p.i('months')),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: months == p.i('months') ? t.accentSoft : t.surface2,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: months == p.i('months') ? t.accent : t.line, width: months == p.i('months') ? 2 : 1),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(p.s('label'), style: context.tt.labelMedium),
                      const Gap(4),
                      Text(money(p.n('price')), style: context.tt.headlineMedium),
                      Text('${money(p.n('price') / p.i('months'))} / mes', style: context.tt.bodySmall),
                      if (p.n('discount') > 0) Padding(padding: const EdgeInsets.only(top: 6), child: Pill('Ahorras ${p.n('discount').toInt()}%', tone: 'ok', small: true)),
                    ]),
                  ),
                ),
            ]),
            const Gap(16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(18)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Cómo pagar', style: context.tt.titleMedium),
                const Gap(8),
                if (hasBank)
                  for (final (k, l) in [('name', 'Banco'), ('type', 'Tipo de cuenta'), ('number', 'Número'), ('holder', 'Titular'), ('id', 'Cédula / RUC')])
                    if (bank.s(k).isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(children: [SizedBox(width: 120, child: Text(l, style: context.tt.bodySmall)), Expanded(child: SelectableText(bank.s(k), style: context.tt.titleSmall))]),
                      ),
                if (pricing.s('instructions').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(pricing.s('instructions'), style: context.tt.bodyMedium)),
                if (!hasBank && pricing.s('instructions').isEmpty) Text('El administrador aún no publicó los datos de pago. Escríbele para coordinar.', style: context.tt.bodySmall),
              ]),
            ),
            const Gap(14),
            DropdownButtonFormField<String>(
              initialValue: method,
              decoration: const InputDecoration(labelText: 'Forma de pago'),
              items: [for (final m in _methods) DropdownMenuItem(value: m, child: Text(m))],
              onChanged: (v) => setState(() => method = v ?? method),
            ),
            const Gap(12),
            Field('Número de comprobante (opcional)', controller: ref, maxLength: 120),
            const Gap(12),
            Text('Comprobante de pago', style: context.tt.labelMedium?.copyWith(color: t.ink2)),
            const Gap(8),
            Row(children: [
              if (receipt != null) ...[
                ClipRRect(borderRadius: BorderRadius.circular(12), child: SmartImage(receipt, width: 84, height: 84)),
                const SizedBox(width: 10),
                TextButton(onPressed: () => setState(() => receipt = null), child: const Text('Cambiar')),
              ] else
                OutlinedButton.icon(
                  onPressed: () async {
                    final img = await pickImages(context);
                    if (img.isNotEmpty) setState(() {
                      receipt = img.first;
                      error = null;
                    });
                  },
                  icon: const Icon(Icons.receipt_long_rounded),
                  label: const Text('Subir foto o captura'),
                ),
            ]),
            Padding(padding: const EdgeInsets.only(top: 4), child: Text('Solo lo ve el administrador.', style: context.tt.bodySmall)),
            if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: NoteBox.text(error!, icon: Icons.error_outline_rounded, tone: 'bad')),
            const Gap(14),
            FilledButton(
              onPressed: busy || plan == null
                  ? null
                  : () async {
                      if (receipt == null) return setState(() => error = 'Sube la foto o captura del comprobante.');
                      setState(() => busy = true);
                      final r = await store.requestSubscription({'months': months, 'method': method, 'reference': ref.text.trim(), 'receipt': receipt});
                      if (!mounted) return;
                      setState(() => busy = false);
                      if (!r.ok) return setState(() => error = r.error);
                      setState(() {
                        receipt = null;
                        ref.clear();
                      });
                      toast(context, 'Pago enviado. Te avisamos cuando el administrador lo apruebe.');
                    },
              child: Text(busy ? 'Enviando…' : 'Enviar pago de ${plan != null ? money(plan.n('price')) : ''}'),
            ),
          ]),
        ),
      if (subs.isNotEmpty) ...[
        const Gap(14),
        Section(
          title: 'Tus pagos',
          child: Column(children: [
            for (final (i, s) in subs.indexed) ...[
              if (i > 0) const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${money(s.n('amount'))} · ${plural(s.i('months'), 'mes', 'meses')}', style: context.tt.titleSmall),
                      Text('${shortDate(s.d('createdAt'))} · ${s.s('method')}${s.s('adminNote').isNotEmpty ? ' · ${s.s('adminNote')}' : ''}', style: context.tt.bodySmall),
                    ]),
                  ),
                  Pill(_subLabel[s.s('status')] ?? s.s('status'), tone: _subTone[s.s('status')] ?? ''),
                ]),
              ),
            ],
          ]),
        ),
      ],
      const Gap(14),
      Section(
        title: '¿Tienes un código de licencia?',
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Field('Código', controller: code, hint: 'FIT-XXXX-XXXX-XXXX', caps: TextCapitalization.characters, onChanged: (v) {
            final n = AppStore.normalizeCode(v);
            if (n != v) code.value = TextEditingValue(text: n, selection: TextSelection.collapsed(offset: n.length));
            setState(() => codeError = null);
          }),
          if (codeError != null) Padding(padding: const EdgeInsets.only(top: 8), child: NoteBox.text(codeError!, icon: Icons.error_outline_rounded, tone: 'bad')),
          const Gap(12),
          OutlinedButton(
            onPressed: code.text.length < 18
                ? null
                : () async {
                    final r = await store.redeemCode(code.text);
                    if (!mounted) return;
                    if (!r.ok) return setState(() => codeError = r.error);
                    code.clear();
                    toast(context, 'Código canjeado. Tu licencia se extendió.', icon: Icons.key_rounded);
                  },
            child: const Text('Canjear'),
          ),
        ]),
      ),
    ]);
  }
}
