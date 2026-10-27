// Archivos de la app en el celular: el estado completo y la cola de cambios sin subir.
// En archivos (no en SharedPreferences) para no tener límite de tamaño y no hacer
// lenta la app con un estado grande. En la versión web de prueba se usa SharedPreferences.
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class Disk {
  Disk._();
  static Directory? _dir;

  static Future<Directory?> _base() async {
    if (kIsWeb) return null;
    if (_dir != null) return _dir;
    try {
      final d = Directory('${(await getApplicationSupportDirectory()).path}/vytrafit');
      if (!await d.exists()) await d.create(recursive: true);
      return _dir = d;
    } catch (_) {
      return null;
    }
  }

  static Future<String?> read(String name) async {
    final d = await _base();
    if (d == null) {
      final p = await SharedPreferences.getInstance();
      return p.getString('vytrafit.file.$name');
    }
    try {
      final f = File('${d.path}/$name');
      return await f.exists() ? await f.readAsString() : null;
    } catch (_) {
      return null;
    }
  }

  /// Escribe de forma segura: primero a un archivo temporal y luego lo reemplaza
  /// (si la app se cierra a la mitad no queda un archivo dañado).
  static final Map<String, Future<void>> _chain = {};
  static Future<void> write(String name, String? text) {
    final prev = _chain[name] ?? Future.value();
    final next = prev.then((_) async {
      final d = await _base();
      if (d == null) {
        final p = await SharedPreferences.getInstance();
        if (text == null) {
          await p.remove('vytrafit.file.$name');
        } else if (text.length < 4000000) {
          await p.setString('vytrafit.file.$name', text);
        }
        return;
      }
      try {
        final f = File('${d.path}/$name');
        if (text == null) {
          if (await f.exists()) await f.delete();
          return;
        }
        final tmp = File('${d.path}/$name.tmp');
        await tmp.writeAsString(text, flush: true);
        await tmp.rename(f.path);
      } catch (_) {/* sin espacio: se reintenta en la próxima escritura */}
    });
    _chain[name] = next;
    return next;
  }
}
