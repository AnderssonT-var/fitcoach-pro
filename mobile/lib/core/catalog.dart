// Biblioteca de ejercicios precargada, nombres de músculos y siluetas.
// Datos e imágenes: Free Exercise DB (dominio público), traducidos al español.
import 'dart:convert';

import 'package:flutter/services.dart';

import 'json.dart';

class Catalog {
  static List<J> library = const [];
  static J body = const {};

  static Future<void> load() async {
    final ex = await rootBundle.loadString('assets/data/exercises.json');
    library = (jsonDecode(ex) as List).cast<Map>().map((e) => e.cast<String, dynamic>()..['coachId'] = null).toList();
    final b = await rootBundle.loadString('assets/data/body.json');
    body = (jsonDecode(b) as Map).cast<String, dynamic>();
  }
}

const muscleEs = <String, String>{
  'chest': 'Pecho', 'shoulders': 'Hombros', 'biceps': 'Bíceps', 'triceps': 'Tríceps', 'forearms': 'Antebrazos',
  'abdominals': 'Abdomen', 'quadriceps': 'Cuádriceps', 'hamstrings': 'Isquiotibiales', 'glutes': 'Glúteos',
  'calves': 'Pantorrillas', 'lats': 'Dorsales', 'middle back': 'Espalda media', 'lower back': 'Espalda baja',
  'traps': 'Trapecios', 'adductors': 'Aductores', 'abductors': 'Abductores', 'neck': 'Cuello',
};
String muscleName(String m) => muscleEs[m] ?? m;
final allMuscles = muscleEs.keys.toList();

const muscleKeys = ['chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abdominals', 'lats', 'middle back', 'lower back', 'traps', 'glutes', 'quadriceps', 'hamstrings', 'adductors', 'abductors', 'calves', 'neck'];
const groups = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazos', 'Abdomen', 'Glúteos', 'Cuádriceps', 'Isquiotibiales', 'Pantorrillas', 'Cuerpo completo', 'Cardio', 'Estiramiento'];
const levels = ['Principiante', 'Intermedio', 'Avanzado'];
const equipmentList = ['Barra', 'Barra Z', 'Mancuernas', 'Polea', 'Máquina', 'Hammer Strength', 'Máquina Smith', 'Peso corporal', 'Barra fija', 'Paralelas', 'Kettlebell', 'Banda elástica', 'Balón medicinal', 'Fitball', 'Cajón', 'Cuerda', 'Disco', 'Trineo', 'Otro'];
const goals = ['Hipertrofia', 'Fuerza', 'Pérdida de grasa', 'Tonificación', 'Recomposición', 'Rendimiento', 'Salud general'];
const payMethods = ['Transferencia', 'Efectivo', 'Tarjeta', 'Depósito', 'PayPal', 'Otro'];
const noteCats = ['General', 'Técnica', 'Lesión', 'Nutrición', 'Pagos'];
const poses = ['Frente', 'Perfil', 'Espalda', 'Otra'];
const trialOptions = [7, 14, 21, 30];
const rests = [30, 45, 60, 75, 90, 120, 150, 180, 240];

/// Región del dibujo → músculo de la base de datos
const regionMuscle = <String, String>{
  'chest': 'chest', 'deltoids': 'shoulders', 'biceps': 'biceps', 'triceps': 'triceps', 'forearm': 'forearms',
  'abs': 'abdominals', 'obliques': 'abdominals', 'lats': 'lats', 'midback': 'middle back', 'lower-back': 'lower back',
  'trapezius': 'traps', 'gluteal': 'glutes', 'quadriceps': 'quadriceps', 'hamstring': 'hamstrings',
  'adductors': 'adductors', 'calves': 'calves', 'neck': 'neck',
};
const regionAlso = <String, List<String>>{'gluteal': ['abductors']};
List<String> musclesOfRegion(String r) => [if (regionMuscle[r] != null) regionMuscle[r]!, ...?regionAlso[r]];

/// Imagen local del ejercicio (o la foto subida por el entrenador).
String? exerciseAsset(J ex, [int frame = 0]) {
  final imgs = ex.i('images');
  if (imgs <= 0) return null;
  return 'assets/ejercicios/${ex.i('id')}-${frame.clamp(0, imgs - 1)}.webp';
}
