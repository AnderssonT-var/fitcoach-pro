package com.atdev.vytrafit

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/** Alarma de fin de descanso: suena (volumen de alarma) y vibra, aunque las notificaciones estén apagadas. */
class MainActivity : FlutterActivity() {
    private var player: MediaPlayer? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "vytrafit/alarm").setMethodCallHandler { call, result ->
            when (call.method) {
                "ring" -> {
                    val sound = call.argument<Boolean>("sound") ?: true
                    val vibrate = call.argument<Boolean>("vibrate") ?: true
                    if (sound) ring()
                    if (vibrate) vibrate()
                    result.success(true)
                }
                "stop" -> { stop(); result.success(true) }
                else -> result.notImplemented()
            }
        }
    }

    private fun ring() {
        try {
            stop()
            val p = MediaPlayer()
            p.setAudioAttributes(AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
            val afd = resources.openRawResourceFd(R.raw.descanso)
            p.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            p.setOnCompletionListener { it.release(); if (player === it) player = null }
            p.prepare()
            p.start()
            player = p
        } catch (_: Exception) { }
    }

    private fun stop() {
        try { player?.stop(); player?.release() } catch (_: Exception) { }
        player = null
    }

    private fun vibrate() {
        try {
            val v: Vibrator = if (Build.VERSION.SDK_INT >= 31) {
                (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION") getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            val pattern = longArrayOf(0, 450, 180, 450, 180, 700)
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, -1))
            else @Suppress("DEPRECATION") v.vibrate(pattern, -1)
        } catch (_: Exception) { }
    }

    override fun onDestroy() { stop(); super.onDestroy() }
}
