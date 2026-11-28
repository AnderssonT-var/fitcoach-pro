// Notas de voz del chat: grabar (hasta 3 minutos) y reproducir.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../core/format.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

const _maxSec = 180;
String _mmss(int s) => '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';

/// Barra de grabación que reemplaza al campo de texto mientras se graba.
class VoiceRecorder extends StatefulWidget {
  final Future<void> Function(String dataUrl, int seconds) onSend;
  final VoidCallback onClose;
  const VoiceRecorder({super.key, required this.onSend, required this.onClose});
  @override
  State<VoiceRecorder> createState() => _VoiceRecorderState();
}

class _VoiceRecorderState extends State<VoiceRecorder> {
  final rec = AudioRecorder();
  Timer? timer;
  int sec = 0;
  bool ready = false, busy = false;
  String? path;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      if (!await rec.hasPermission()) {
        if (mounted) toast(context, 'Activa el permiso del micrófono para grabar notas de voz.', error: true);
        widget.onClose();
        return;
      }
      final dir = await getTemporaryDirectory();
      path = '${dir.path}/nota-${DateTime.now().millisecondsSinceEpoch}.m4a';
      await rec.start(const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 64000, sampleRate: 44100, numChannels: 1), path: path!);
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      setState(() => ready = true);
      timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(() => sec++);
        if (sec >= _maxSec) _send();
      });
    } catch (_) {
      if (mounted) toast(context, 'No se pudo usar el micrófono.', error: true);
      widget.onClose();
    }
  }

  Future<void> _send() async {
    if (busy) return;
    setState(() => busy = true);
    timer?.cancel();
    try {
      final p = await rec.stop();
      if (p == null || sec < 1) {
        if (mounted) toast(context, 'Mantén la grabación al menos un segundo.', error: true);
        widget.onClose();
        return;
      }
      final bytes = await File(p).readAsBytes();
      unawaited(File(p).delete().catchError((_) => File(p)));
      await widget.onSend('data:audio/mp4;base64,${base64Encode(bytes)}', sec);
    } catch (_) {
      if (mounted) toast(context, 'No se pudo enviar la nota de voz.', error: true);
    }
    widget.onClose();
  }

  Future<void> _cancel() async {
    timer?.cancel();
    try {
      await rec.cancel();
    } catch (_) {}
    widget.onClose();
  }

  @override
  void dispose() {
    timer?.cancel();
    rec.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tok;
    return Row(children: [
      IconButton(onPressed: busy ? null : _cancel, icon: Icon(Icons.delete_outline_rounded, color: t.bad), tooltip: 'Descartar'),
      Expanded(
        child: Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(color: t.surface2, borderRadius: BorderRadius.circular(24)),
          child: Row(children: [
            _Pulse(active: ready && !busy),
            const SizedBox(width: 10),
            Text(busy ? 'Enviando…' : ready ? 'Grabando ${_mmss(sec)}' : 'Preparando…', style: context.tt.titleSmall),
            const Spacer(),
            Text('máx. ${_mmss(_maxSec)}', style: context.tt.bodySmall),
          ]),
        ),
      ),
      const SizedBox(width: 6),
      IconButton.filled(
        onPressed: ready && !busy ? _send : null,
        icon: const Icon(Icons.send_rounded),
        style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
        tooltip: 'Enviar nota de voz',
      ),
    ]);
  }
}

class _Pulse extends StatefulWidget {
  final bool active;
  const _Pulse({required this.active});
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);
  @override
  void dispose() {
    c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
        opacity: widget.active ? Tween(begin: .35, end: 1.0).animate(c) : const AlwaysStoppedAnimation(.35),
        child: Container(width: 10, height: 10, decoration: BoxDecoration(color: context.tok.bad, shape: BoxShape.circle)),
      );
}

/// Reproductor compacto dentro de la burbuja del mensaje.
class VoiceNote extends StatefulWidget {
  final String url;
  final int seconds;
  final Color color;
  const VoiceNote({super.key, required this.url, required this.seconds, required this.color});
  @override
  State<VoiceNote> createState() => _VoiceNoteState();
}

class _VoiceNoteState extends State<VoiceNote> {
  AudioPlayer? player;
  bool loading = false, error = false;

  Future<void> _toggle() async {
    try {
      if (player == null) {
        setState(() => loading = true);
        player = AudioPlayer();
        await player!.setUrl(widget.url);
        player!.playerStateStream.listen((s) {
          if (s.processingState == ProcessingState.completed) {
            player!.pause();
            player!.seek(Duration.zero);
          }
          if (mounted) setState(() {});
        });
        if (mounted) setState(() => loading = false);
      }
      player!.playing ? await player!.pause() : await player!.play();
    } catch (_) {
      if (mounted) setState(() { loading = false; error = true; });
    }
  }

  @override
  void dispose() {
    player?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = player;
    final total = p?.duration?.inMilliseconds ?? widget.seconds * 1000;
    return SizedBox(
      width: 220,
      child: Row(children: [
        IconButton(
          onPressed: error ? null : _toggle,
          icon: loading
              ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: widget.color))
              : Icon(error ? Icons.error_outline_rounded : (p?.playing ?? false) ? Icons.pause_rounded : Icons.play_arrow_rounded, color: widget.color),
          tooltip: (p?.playing ?? false) ? 'Pausar' : 'Reproducir nota de voz',
        ),
        Expanded(
          child: StreamBuilder<Duration>(
            stream: p?.positionStream ?? const Stream.empty(),
            builder: (context, snap) {
              final pos = snap.data?.inMilliseconds ?? 0;
              return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: LinearProgressIndicator(value: total > 0 ? (pos / total).clamp(0.0, 1.0) : 0, minHeight: 4, color: widget.color, backgroundColor: widget.color.withValues(alpha: .25)),
                ),
                const Gap(4),
                Text(error ? 'No se pudo reproducir' : clock(((pos > 0 ? pos : total) / 1000).round()), style: TextStyle(color: widget.color.withValues(alpha: .85), fontSize: 11.5, fontWeight: FontWeight.w600)),
              ]);
            },
          ),
        ),
      ]),
    );
  }
}
