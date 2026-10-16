/* Biblioteca de ejercicios precargada.
   Datos e imágenes: Free Exercise DB (https://github.com/yuhonas/free-exercise-db),
   dominio público (Unlicense). Nombres, pasos y consejos traducidos y adaptados al español.
   Las imágenes están en public/ejercicios/<id>-0.webp (inicio) y -1.webp (final). */

export const EXERCISE_LIBRARY = [
 {
  "id": 1,
  "name": "Press banca con barra",
  "muscle": "Pecho",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Escápulas juntas y pies firmes en el piso.",
  "steps": [
   "Acuéstate en el banco con los ojos bajo la barra y agárrala un poco más abierto que los hombros.",
   "Baja la barra controlada hasta tocar la parte media del pecho.",
   "Empuja hacia arriba hasta estirar los brazos sin despegar la espalda del banco."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Bench_Press_-_Medium_Grip"
 },
 {
  "id": 2,
  "name": "Sentadilla trasera con barra",
  "muscle": "Cuádriceps",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings",
   "lower back"
  ],
  "cues": "Rodillas en la línea de la punta de los pies.",
  "steps": [
   "Apoya la barra sobre los trapecios y separa los pies al ancho de los hombros.",
   "Baja llevando la cadera atrás hasta que los muslos queden paralelos al piso.",
   "Sube empujando el piso con todo el pie y el pecho alto."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Squat"
 },
 {
  "id": 3,
  "name": "Dominadas",
  "muscle": "Espalda",
  "equipment": "Barra fija",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [
   "biceps",
   "middle back"
  ],
  "cues": "Pecho hacia la barra, sin balancearte.",
  "steps": [
   "Cuélgate de la barra con agarre prono, un poco más abierto que los hombros.",
   "Tira de los codos hacia abajo hasta pasar la barbilla sobre la barra.",
   "Baja lento hasta estirar los brazos por completo."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Pullups"
 },
 {
  "id": 4,
  "name": "Press militar con barra",
  "muscle": "Hombros",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "chest",
   "triceps"
  ],
  "cues": "Glúteos y abdomen apretados para no arquear la espalda.",
  "steps": [
   "Sostén la barra a la altura de las clavículas con agarre al ancho de hombros.",
   "Empuja la barra en línea recta sobre la cabeza hasta estirar los brazos.",
   "Baja controlando hasta la posición inicial."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Shoulder_Press"
 },
 {
  "id": 5,
  "name": "Curl de bíceps con mancuernas",
  "muscle": "Bíceps",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [
   "forearms"
  ],
  "cues": "Codos pegados al cuerpo; no balancees la espalda.",
  "steps": [
   "De pie, sostén una mancuerna en cada mano con los brazos estirados.",
   "Flexiona los codos girando las palmas hacia arriba hasta los hombros.",
   "Baja lento hasta estirar los brazos."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Dumbbell_Bicep_Curl"
 },
 {
  "id": 6,
  "name": "Extensión de tríceps en polea",
  "muscle": "Tríceps",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [],
  "cues": "Codos fijos a los costados.",
  "steps": [
   "Frente a la polea alta, toma la barra con agarre prono.",
   "Empuja hacia abajo hasta estirar los brazos por completo.",
   "Regresa hasta que los antebrazos queden paralelos al piso."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Triceps_Pushdown"
 },
 {
  "id": 7,
  "name": "Peso muerto con barra",
  "muscle": "Espalda",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "lower back"
  ],
  "secondary": [
   "calves",
   "forearms",
   "glutes",
   "hamstrings",
   "lats",
   "middle back",
   "quadriceps",
   "traps"
  ],
  "cues": "Espalda neutra; la barra roza las piernas.",
  "steps": [
   "Pies bajo la barra, agárrala justo por fuera de las rodillas.",
   "Empuja el piso y extiende cadera y rodillas a la vez hasta quedar erguido.",
   "Baja llevando la cadera atrás y la barra pegada al cuerpo."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Deadlift"
 },
 {
  "id": 8,
  "name": "Hip thrust con barra",
  "muscle": "Glúteos",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "glutes"
  ],
  "secondary": [
   "calves",
   "hamstrings"
  ],
  "cues": "Barbilla al pecho y pausa de 1 s arriba.",
  "steps": [
   "Apoya la parte alta de la espalda en un banco y la barra sobre la cadera.",
   "Empuja con los talones hasta alinear rodillas, cadera y hombros.",
   "Baja la cadera controlando sin tocar el piso."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Hip_Thrust"
 },
 {
  "id": 9,
  "name": "Remo con barra",
  "muscle": "Espalda",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "biceps",
   "lats",
   "shoulders"
  ],
  "cues": "Torso a 45° y espalda recta.",
  "steps": [
   "Inclina el torso con las rodillas un poco flexionadas y la barra colgando.",
   "Lleva la barra hacia el ombligo juntando las escápulas.",
   "Baja la barra hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Bent_Over_Barbell_Row"
 },
 {
  "id": 10,
  "name": "Fondos en paralelas (pecho)",
  "muscle": "Pecho",
  "equipment": "Paralelas",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Inclínate un poco hacia adelante.",
  "steps": [
   "Sostente en las paralelas con los brazos estirados.",
   "Baja inclinando el torso hasta que los codos lleguen a 90°.",
   "Empuja hasta estirar los brazos de nuevo."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Dips_-_Chest_Version"
 },
 {
  "id": 11,
  "name": "Press inclinado con mancuernas",
  "muscle": "Pecho",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Banco a 30° para enfocar la parte alta del pecho.",
  "steps": [
   "Acuéstate en el banco inclinado con una mancuerna en cada mano a la altura del pecho.",
   "Empuja hacia arriba hasta casi juntar las mancuernas.",
   "Baja lento abriendo los codos a unos 45°."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Incline_Dumbbell_Press"
 },
 {
  "id": 12,
  "name": "Jalón al pecho",
  "muscle": "Espalda",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [
   "biceps",
   "middle back",
   "shoulders"
  ],
  "cues": "Saca el pecho y lleva la barra a la clavícula.",
  "steps": [
   "Siéntate con los muslos fijos y toma la barra con agarre abierto.",
   "Tira de la barra hacia la parte alta del pecho bajando los codos.",
   "Sube controlando hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Wide-Grip_Lat_Pulldown"
 },
 {
  "id": 13,
  "name": "Elevaciones laterales",
  "muscle": "Hombros",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [],
  "cues": "Codos un poco flexionados; sube solo hasta los hombros.",
  "steps": [
   "De pie, sostén las mancuernas a los costados.",
   "Eleva los brazos hacia los lados hasta la altura de los hombros.",
   "Baja lento sin dejar caer las mancuernas."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Side_Lateral_Raise"
 },
 {
  "id": 14,
  "name": "Peso muerto rumano",
  "muscle": "Isquiotibiales",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "calves",
   "glutes",
   "lower back"
  ],
  "cues": "Cadera atrás; rodillas apenas flexionadas.",
  "steps": [
   "De pie con la barra frente a los muslos.",
   "Lleva la cadera atrás bajando la barra pegada a las piernas hasta media tibia.",
   "Vuelve a subir apretando glúteos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Romanian_Deadlift"
 },
 {
  "id": 15,
  "name": "Prensa de piernas",
  "muscle": "Cuádriceps",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "No bloquees las rodillas arriba.",
  "steps": [
   "Siéntate en la máquina con los pies al ancho de la cadera en la plataforma.",
   "Baja la plataforma flexionando rodillas hasta unos 90°.",
   "Empuja hasta casi estirar las piernas."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Leg_Press"
 },
 {
  "id": 16,
  "name": "Zancadas con mancuernas",
  "muscle": "Cuádriceps",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Paso largo; rodilla trasera casi al piso.",
  "steps": [
   "De pie con una mancuerna en cada mano.",
   "Da un paso adelante y baja hasta que ambas rodillas formen 90°.",
   "Empuja con la pierna de adelante para volver y alterna."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Dumbbell_Lunges"
 },
 {
  "id": 17,
  "name": "Curl femoral acostado",
  "muscle": "Isquiotibiales",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [],
  "cues": "Baja en 3 segundos.",
  "steps": [
   "Acuéstate boca abajo con el rodillo sobre los tobillos.",
   "Flexiona las rodillas llevando los talones hacia los glúteos.",
   "Baja lento hasta casi estirar las piernas."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Lying_Leg_Curls"
 },
 {
  "id": 18,
  "name": "Elevación de talones de pie",
  "muscle": "Pantorrillas",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "calves"
  ],
  "secondary": [],
  "cues": "Pausa abajo con estiramiento completo.",
  "steps": [
   "Coloca los hombros bajo los apoyos y la punta de los pies en el borde.",
   "Sube los talones lo más alto que puedas.",
   "Baja hasta sentir el estiramiento en las pantorrillas."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Standing_Calf_Raises"
 },
 {
  "id": 19,
  "name": "Plancha",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Cuerpo en línea recta; no subas la cadera.",
  "steps": [
   "Apoya antebrazos y puntas de los pies en el piso.",
   "Mantén el abdomen y los glúteos apretados.",
   "Sostén la posición el tiempo indicado respirando normal."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Plank"
 },
 {
  "id": 20,
  "name": "Face pull",
  "muscle": "Hombros",
  "equipment": "Polea",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "middle back"
  ],
  "cues": "Tira hacia la frente abriendo los codos.",
  "steps": [
   "Toma la cuerda de la polea alta con las palmas hacia adentro.",
   "Tira hacia tu cara separando las manos y abriendo los codos.",
   "Regresa controlando hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Face_Pull"
 },
 {
  "id": 21,
  "name": "Remo con mancuerna a una mano",
  "muscle": "Espalda",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "biceps",
   "lats",
   "shoulders"
  ],
  "cues": "Lleva el codo hacia la cadera.",
  "steps": [
   "Apoya una rodilla y una mano en el banco con la espalda plana.",
   "Sube la mancuerna hacia la cadera juntando la escápula.",
   "Baja hasta estirar el brazo y repite."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "One-Arm_Dumbbell_Row"
 },
 {
  "id": 22,
  "name": "Sentadilla goblet",
  "muscle": "Cuádriceps",
  "equipment": "Kettlebell",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings",
   "shoulders"
  ],
  "cues": "Mancuerna pegada al pecho, torso erguido.",
  "steps": [
   "Sostén una mancuerna vertical frente al pecho.",
   "Baja en sentadilla con los codos por dentro de las rodillas.",
   "Sube empujando con los talones."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Goblet_Squat"
 },
 {
  "id": 23,
  "name": "Rueda abdominal",
  "muscle": "Abdomen",
  "equipment": "Rueda abdominal",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [
   "shoulders"
  ],
  "cues": "No arquees la zona lumbar.",
  "steps": [
   "De rodillas, sostén la rueda bajo los hombros.",
   "Rueda hacia adelante estirando el cuerpo lo más que controles.",
   "Regresa contrayendo el abdomen."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Ab_Roller"
 },
 {
  "id": 24,
  "name": "Bicicleta estática",
  "muscle": "Cardio",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Cardio",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Ritmo constante en el que puedas hablar.",
  "steps": [
   "Ajusta el asiento a la altura de la cadera.",
   "Pedalea manteniendo la espalda erguida.",
   "Mantén la intensidad indicada el tiempo de la sesión."
  ],
  "sets": 1,
  "reps": "10 min",
  "rest": 60,
  "images": 2,
  "source": "Bicycling_Stationary"
 },
 {
  "id": 25,
  "name": "Press inclinado con barra",
  "muscle": "Pecho",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Baja la barra a la parte alta del pecho.",
  "steps": [
   "Acuéstate en banco inclinado y toma la barra al ancho de hombros.",
   "Baja controlando hasta la parte alta del pecho.",
   "Empuja hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Incline_Bench_Press_-_Medium_Grip"
 },
 {
  "id": 26,
  "name": "Press banca con mancuernas",
  "muscle": "Pecho",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Mayor recorrido que con barra; baja controlado.",
  "steps": [
   "Acuéstate con una mancuerna en cada mano a la altura del pecho.",
   "Empuja hacia arriba juntando ligeramente las mancuernas.",
   "Baja lento hasta sentir el estiramiento del pecho."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Dumbbell_Bench_Press"
 },
 {
  "id": 27,
  "name": "Press declinado con mancuernas",
  "muscle": "Pecho",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Enfoca la parte baja del pecho.",
  "steps": [
   "Acuéstate en banco declinado con las piernas aseguradas.",
   "Empuja las mancuernas hacia arriba.",
   "Baja controlando hasta el pecho."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Decline_Dumbbell_Bench_Press"
 },
 {
  "id": 28,
  "name": "Aperturas con mancuernas",
  "muscle": "Pecho",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [],
  "cues": "Codos un poco flexionados todo el recorrido.",
  "steps": [
   "Acuéstate con las mancuernas arriba y las palmas enfrentadas.",
   "Abre los brazos en arco hasta sentir el estiramiento.",
   "Ciérralos de nuevo apretando el pecho."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Dumbbell_Flyes"
 },
 {
  "id": 29,
  "name": "Aperturas inclinadas",
  "muscle": "Pecho",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders"
  ],
  "cues": "Movimiento en arco, sin empujar.",
  "steps": [
   "En banco inclinado, mancuernas arriba con palmas enfrentadas.",
   "Abre los brazos hacia los lados en arco.",
   "Ciérralos sobre el pecho."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Incline_Dumbbell_Flyes"
 },
 {
  "id": 30,
  "name": "Cruce de poleas",
  "muscle": "Pecho",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders"
  ],
  "cues": "Junta las manos frente al pecho y aprieta 1 s.",
  "steps": [
   "De pie entre las poleas altas, un pie adelante.",
   "Lleva las manos hacia abajo y al centro en arco.",
   "Regresa controlando hasta abrir los brazos."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Cable_Crossover"
 },
 {
  "id": 31,
  "name": "Flexiones de pecho",
  "muscle": "Pecho",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Cuerpo recto de cabeza a talones.",
  "steps": [
   "Manos un poco más abiertas que los hombros y cuerpo en línea.",
   "Baja el pecho hasta casi tocar el piso.",
   "Empuja hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Pushups"
 },
 {
  "id": 32,
  "name": "Pec deck (mariposa)",
  "muscle": "Pecho",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [],
  "cues": "No dejes que los brazos se vayan muy atrás.",
  "steps": [
   "Siéntate con la espalda apoyada y toma los agarres.",
   "Junta los brazos frente al pecho.",
   "Regresa lento hasta abrir."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Butterfly"
 },
 {
  "id": 33,
  "name": "Press de pecho en máquina",
  "muscle": "Pecho",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Buen ejercicio para empezar o terminar con volumen.",
  "steps": [
   "Ajusta el asiento para que los agarres queden a la altura del pecho.",
   "Empuja hasta estirar los brazos.",
   "Regresa sin dejar que las placas choquen."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Machine_Bench_Press"
 },
 {
  "id": 34,
  "name": "Dominadas supinas",
  "muscle": "Espalda",
  "equipment": "Barra fija",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [
   "biceps",
   "forearms",
   "middle back"
  ],
  "cues": "Agarre con palmas hacia ti; trabaja mucho el bíceps.",
  "steps": [
   "Cuélgate con agarre supino al ancho de hombros.",
   "Sube hasta pasar la barbilla sobre la barra.",
   "Baja lento hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Chin-Up"
 },
 {
  "id": 35,
  "name": "Jalón agarre cerrado",
  "muscle": "Espalda",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [
   "biceps",
   "middle back",
   "shoulders"
  ],
  "cues": "Lleva los codos hacia las costillas.",
  "steps": [
   "Siéntate y toma la barra con agarre cerrado.",
   "Tira hacia el pecho bajando los codos pegados.",
   "Sube controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Close-Grip_Front_Lat_Pulldown"
 },
 {
  "id": 36,
  "name": "Remo sentado en polea",
  "muscle": "Espalda",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "biceps",
   "lats",
   "shoulders"
  ],
  "cues": "Pecho alto; no te balancees.",
  "steps": [
   "Siéntate con las rodillas un poco flexionadas y toma el agarre.",
   "Tira hacia el abdomen juntando las escápulas.",
   "Estira los brazos sin redondear la espalda."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Seated_Cable_Rows"
 },
 {
  "id": 37,
  "name": "Remo en T",
  "muscle": "Espalda",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "biceps",
   "lats"
  ],
  "cues": "Espalda neutra y abdomen firme.",
  "steps": [
   "Párate sobre la barra con el torso inclinado y toma el agarre.",
   "Tira hacia el pecho llevando los codos atrás.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "T-Bar_Row_with_Handle"
 },
 {
  "id": 38,
  "name": "Pullover en polea",
  "muscle": "Espalda",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [],
  "cues": "Brazos casi rectos; el movimiento sale del hombro.",
  "steps": [
   "Frente a la polea alta, toma la barra con brazos estirados.",
   "Lleva la barra hacia los muslos en arco.",
   "Regresa hasta la altura de los ojos."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Straight-Arm_Pulldown"
 },
 {
  "id": 39,
  "name": "Hiperextensiones",
  "muscle": "Espalda",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lower back"
  ],
  "secondary": [
   "glutes",
   "hamstrings"
  ],
  "cues": "Sube hasta alinear el cuerpo, no más.",
  "steps": [
   "Colócate en el banco romano con la cadera en el borde.",
   "Baja el torso doblando la cadera.",
   "Sube hasta quedar en línea recta."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Hyperextensions_Back_Extensions"
 },
 {
  "id": 40,
  "name": "Remo invertido",
  "muscle": "Espalda",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "lats"
  ],
  "cues": "Ideal para preparar las dominadas.",
  "steps": [
   "Cuélgate bajo una barra baja con el cuerpo recto.",
   "Lleva el pecho hacia la barra.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Inverted_Row"
 },
 {
  "id": 41,
  "name": "Encogimientos con barra",
  "muscle": "Espalda",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "traps"
  ],
  "secondary": [],
  "cues": "Sube los hombros hacia las orejas, sin girarlos.",
  "steps": [
   "De pie con la barra frente a los muslos.",
   "Eleva los hombros lo más alto posible.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Barbell_Shrug"
 },
 {
  "id": 42,
  "name": "Encogimientos con mancuernas",
  "muscle": "Espalda",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "traps"
  ],
  "secondary": [],
  "cues": "Pausa de 1 s arriba.",
  "steps": [
   "De pie con una mancuerna en cada mano.",
   "Eleva los hombros hacia las orejas.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Dumbbell_Shrug"
 },
 {
  "id": 43,
  "name": "Press de hombros con mancuernas",
  "muscle": "Hombros",
  "equipment": "Mancuernas",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "triceps"
  ],
  "cues": "No choques las mancuernas arriba.",
  "steps": [
   "Sostén las mancuernas a la altura de los hombros.",
   "Empuja hacia arriba hasta estirar los brazos.",
   "Baja hasta la altura de las orejas."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Dumbbell_Shoulder_Press"
 },
 {
  "id": 44,
  "name": "Press Arnold",
  "muscle": "Hombros",
  "equipment": "Mancuernas",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "triceps"
  ],
  "cues": "Gira las palmas durante la subida.",
  "steps": [
   "Mancuernas frente a los hombros con las palmas hacia ti.",
   "Empuja hacia arriba girando las palmas hacia afuera.",
   "Baja girando de nuevo."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Arnold_Dumbbell_Press"
 },
 {
  "id": 45,
  "name": "Elevaciones frontales",
  "muscle": "Hombros",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [],
  "cues": "Sube hasta la altura de los ojos.",
  "steps": [
   "De pie con mancuernas frente a los muslos.",
   "Eleva un brazo al frente con el codo casi recto.",
   "Baja lento y alterna."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Front_Dumbbell_Raise"
 },
 {
  "id": 46,
  "name": "Pájaros (aperturas invertidas)",
  "muscle": "Hombros",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [],
  "cues": "Trabaja el deltoide posterior.",
  "steps": [
   "Inclina el torso con mancuernas colgando.",
   "Abre los brazos hacia los lados juntando las escápulas.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Reverse_Flyes"
 },
 {
  "id": 47,
  "name": "Remo al mentón",
  "muscle": "Hombros",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "traps"
  ],
  "cues": "No subas los codos por encima de los hombros.",
  "steps": [
   "De pie con la barra frente a los muslos y agarre medio.",
   "Sube la barra pegada al cuerpo llevando los codos arriba.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Upright_Barbell_Row"
 },
 {
  "id": 48,
  "name": "Press de hombros en máquina",
  "muscle": "Hombros",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "triceps"
  ],
  "cues": "Espalda apoyada todo el tiempo.",
  "steps": [
   "Ajusta el asiento con los agarres a la altura de los hombros.",
   "Empuja hacia arriba.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Machine_Shoulder_Military_Press"
 },
 {
  "id": 49,
  "name": "Curl con barra",
  "muscle": "Bíceps",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [
   "forearms"
  ],
  "cues": "Sin impulso con la cadera.",
  "steps": [
   "De pie, toma la barra con agarre supino al ancho de hombros.",
   "Sube la barra flexionando los codos.",
   "Baja hasta estirar los brazos."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Barbell_Curl"
 },
 {
  "id": 50,
  "name": "Curl martillo",
  "muscle": "Bíceps",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "Palmas enfrentadas todo el recorrido.",
  "steps": [
   "De pie con mancuernas a los lados y palmas hacia el cuerpo.",
   "Sube las mancuernas sin girar las muñecas.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Hammer_Curls"
 },
 {
  "id": 51,
  "name": "Curl predicador",
  "muscle": "Bíceps",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "No estires del todo abajo para cuidar el codo.",
  "steps": [
   "Apoya los brazos sobre el banco predicador.",
   "Sube la barra hacia los hombros.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Preacher_Curl"
 },
 {
  "id": 52,
  "name": "Curl concentrado",
  "muscle": "Bíceps",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [
   "forearms"
  ],
  "cues": "Apoya el codo en la cara interna del muslo.",
  "steps": [
   "Sentado, apoya el codo en el muslo con la mancuerna abajo.",
   "Sube la mancuerna hacia el hombro.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Concentration_Curls"
 },
 {
  "id": 53,
  "name": "Curl martillo en polea con cuerda",
  "muscle": "Bíceps",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "Tensión constante todo el recorrido.",
  "steps": [
   "Frente a la polea baja, toma la cuerda.",
   "Sube flexionando los codos.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Cable_Hammer_Curls_-_Rope_Attachment"
 },
 {
  "id": 54,
  "name": "Curl inclinado con mancuernas",
  "muscle": "Bíceps",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "Estira bien el bíceps abajo.",
  "steps": [
   "Siéntate en banco inclinado con los brazos colgando.",
   "Sube las mancuernas girando las palmas.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Incline_Dumbbell_Curl"
 },
 {
  "id": 55,
  "name": "Curl con barra Z",
  "muscle": "Bíceps",
  "equipment": "Barra Z",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "Más cómodo para las muñecas.",
  "steps": [
   "Toma la barra Z por los agarres inclinados.",
   "Sube flexionando los codos.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "EZ-Bar_Curl"
 },
 {
  "id": 56,
  "name": "Curl de bíceps en polea",
  "muscle": "Bíceps",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "Codos quietos a los costados.",
  "steps": [
   "Frente a la polea baja, toma la barra recta.",
   "Sube hasta los hombros.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Standing_Biceps_Cable_Curl"
 },
 {
  "id": 57,
  "name": "Extensión de tríceps con cuerda",
  "muscle": "Tríceps",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [],
  "cues": "Separa la cuerda abajo.",
  "steps": [
   "Frente a la polea alta, toma la cuerda.",
   "Empuja hacia abajo separando las manos al final.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Triceps_Pushdown_-_Rope_Attachment"
 },
 {
  "id": 58,
  "name": "Press francés",
  "muscle": "Tríceps",
  "equipment": "Barra Z",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [],
  "cues": "Baja la barra hacia la frente, codos quietos.",
  "steps": [
   "Acostado, sostén la barra sobre el pecho con brazos estirados.",
   "Flexiona los codos bajando la barra hacia la frente.",
   "Estira los brazos de nuevo."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Lying_Triceps_Press"
 },
 {
  "id": 59,
  "name": "Fondos en paralelas (tríceps)",
  "muscle": "Tríceps",
  "equipment": "Paralelas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [
   "chest",
   "shoulders"
  ],
  "cues": "Torso recto para enfocar el tríceps.",
  "steps": [
   "Sostente en las paralelas con el torso vertical.",
   "Baja hasta 90° en los codos.",
   "Empuja hasta estirar."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Dips_-_Triceps_Version"
 },
 {
  "id": 60,
  "name": "Press banca agarre cerrado",
  "muscle": "Tríceps",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [
   "chest",
   "shoulders"
  ],
  "cues": "Codos pegados al cuerpo.",
  "steps": [
   "Acostado, toma la barra al ancho de los hombros.",
   "Baja hacia la parte baja del pecho.",
   "Empuja hasta estirar."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Close-Grip_Barbell_Bench_Press"
 },
 {
  "id": 61,
  "name": "Extensión de tríceps sobre la cabeza",
  "muscle": "Tríceps",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [],
  "cues": "Codos apuntando al techo.",
  "steps": [
   "Sostén una mancuerna con ambas manos sobre la cabeza.",
   "Bájala detrás de la cabeza flexionando los codos.",
   "Súbela estirando los brazos."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Standing_Dumbbell_Triceps_Extension"
 },
 {
  "id": 62,
  "name": "Patada de tríceps",
  "muscle": "Tríceps",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [],
  "cues": "El brazo queda paralelo al torso.",
  "steps": [
   "Inclina el torso con el codo a 90° pegado al cuerpo.",
   "Estira el brazo hacia atrás.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Tricep_Dumbbell_Kickback"
 },
 {
  "id": 63,
  "name": "Fondos en banco",
  "muscle": "Tríceps",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [
   "chest",
   "shoulders"
  ],
  "cues": "Mantén la espalda cerca del banco.",
  "steps": [
   "Apoya las manos en el banco detrás de ti y las piernas al frente.",
   "Baja flexionando los codos.",
   "Empuja hasta estirar."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Bench_Dips"
 },
 {
  "id": 64,
  "name": "Extensión de tríceps en polea sobre la cabeza",
  "muscle": "Tríceps",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [],
  "cues": "Gran estiramiento de la cabeza larga.",
  "steps": [
   "De espaldas a la polea, cuerda detrás de la cabeza.",
   "Estira los brazos hacia adelante y arriba.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Cable_Rope_Overhead_Triceps_Extension"
 },
 {
  "id": 65,
  "name": "Sentadilla frontal",
  "muscle": "Cuádriceps",
  "equipment": "Barra",
  "level": "Avanzado",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Codos altos y torso vertical.",
  "steps": [
   "Apoya la barra sobre los hombros delanteros con los codos altos.",
   "Baja manteniendo el torso erguido.",
   "Sube empujando con todo el pie."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Front_Barbell_Squat"
 },
 {
  "id": 66,
  "name": "Sentadilla hack",
  "muscle": "Cuádriceps",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Espalda apoyada todo el recorrido.",
  "steps": [
   "Colócate en la máquina con los hombros bajo los apoyos.",
   "Baja hasta 90° en las rodillas.",
   "Empuja hasta casi estirar."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Hack_Squat"
 },
 {
  "id": 67,
  "name": "Sentadilla en máquina Smith",
  "muscle": "Cuádriceps",
  "equipment": "Máquina Smith",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings",
   "lower back"
  ],
  "cues": "Pies un poco adelantados.",
  "steps": [
   "Barra sobre los trapecios con los pies algo adelantados.",
   "Baja hasta que los muslos queden paralelos.",
   "Sube empujando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Smith_Machine_Squat"
 },
 {
  "id": 68,
  "name": "Sentadilla libre",
  "muscle": "Cuádriceps",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "glutes",
   "hamstrings"
  ],
  "cues": "Ideal para calentar y aprender la técnica.",
  "steps": [
   "Pies al ancho de hombros y brazos al frente.",
   "Baja llevando la cadera atrás.",
   "Sube apretando glúteos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Bodyweight_Squat"
 },
 {
  "id": 69,
  "name": "Extensión de cuádriceps",
  "muscle": "Cuádriceps",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [],
  "cues": "Pausa de 1 s arriba.",
  "steps": [
   "Siéntate con el rodillo sobre los tobillos.",
   "Estira las piernas por completo.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Leg_Extensions"
 },
 {
  "id": 70,
  "name": "Zancadas caminando con barra",
  "muscle": "Cuádriceps",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Paso largo y torso recto.",
  "steps": [
   "Barra sobre los trapecios.",
   "Avanza dando zancadas alternas.",
   "Baja la rodilla de atrás casi al piso en cada paso."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Walking_Lunge"
 },
 {
  "id": 71,
  "name": "Sentadilla búlgara",
  "muscle": "Cuádriceps",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "glutes",
   "hamstrings"
  ],
  "cues": "El peso va en la pierna de adelante.",
  "steps": [
   "Apoya el pie de atrás en un banco con mancuernas en las manos.",
   "Baja hasta que la rodilla de atrás casi toque el piso.",
   "Sube con la pierna de adelante."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Split_Squat_with_Dumbbells"
 },
 {
  "id": 72,
  "name": "Subidas al cajón",
  "muscle": "Cuádriceps",
  "equipment": "Mancuernas",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Empuja con el talón del pie de arriba.",
  "steps": [
   "Frente a un cajón con mancuernas en las manos.",
   "Sube apoyando todo el pie sobre el cajón.",
   "Baja controlando y alterna."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Dumbbell_Step_Ups"
 },
 {
  "id": 73,
  "name": "Curl femoral sentado",
  "muscle": "Isquiotibiales",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [],
  "cues": "Espalda apoyada.",
  "steps": [
   "Siéntate con el rodillo detrás de los tobillos.",
   "Flexiona las rodillas.",
   "Regresa lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Seated_Leg_Curl"
 },
 {
  "id": 74,
  "name": "Peso muerto piernas rígidas con mancuernas",
  "muscle": "Isquiotibiales",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "glutes",
   "lower back"
  ],
  "cues": "Siente el estiramiento detrás del muslo.",
  "steps": [
   "De pie con mancuernas frente a los muslos.",
   "Baja con las rodillas casi rectas llevando la cadera atrás.",
   "Sube apretando glúteos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Stiff-Legged_Dumbbell_Deadlift"
 },
 {
  "id": 75,
  "name": "Buenos días",
  "muscle": "Isquiotibiales",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "abdominals",
   "glutes",
   "lower back"
  ],
  "cues": "Usa poco peso y espalda neutra.",
  "steps": [
   "Barra sobre los trapecios y rodillas un poco flexionadas.",
   "Inclina el torso llevando la cadera atrás.",
   "Vuelve a subir."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Good_Morning"
 },
 {
  "id": 76,
  "name": "Curl nórdico (GHR)",
  "muscle": "Isquiotibiales",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "calves",
   "glutes"
  ],
  "cues": "Avanzado: baja lo más lento que puedas.",
  "steps": [
   "Colócate en el banco GHR con los pies sujetos.",
   "Baja el torso al frente controlando con los isquiotibiales.",
   "Sube flexionando las rodillas."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Glute_Ham_Raise"
 },
 {
  "id": 77,
  "name": "Peso muerto sumo",
  "muscle": "Glúteos",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "adductors",
   "forearms",
   "glutes",
   "lower back",
   "middle back",
   "quadriceps",
   "traps"
  ],
  "cues": "Pies abiertos y rodillas hacia afuera.",
  "steps": [
   "Pies muy abiertos y manos dentro de las piernas.",
   "Sube empujando el piso hacia los lados.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Sumo_Deadlift"
 },
 {
  "id": 78,
  "name": "Puente de glúteo con barra",
  "muscle": "Glúteos",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "glutes"
  ],
  "secondary": [
   "calves",
   "hamstrings"
  ],
  "cues": "Aprieta glúteos arriba.",
  "steps": [
   "Acostado en el piso con la barra sobre la cadera.",
   "Eleva la cadera empujando con los talones.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Glute_Bridge"
 },
 {
  "id": 79,
  "name": "Puente de glúteo",
  "muscle": "Glúteos",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "glutes"
  ],
  "secondary": [
   "hamstrings"
  ],
  "cues": "Perfecto para principiantes.",
  "steps": [
   "Acostado boca arriba con rodillas flexionadas.",
   "Eleva la cadera hasta alinear el cuerpo.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Butt_Lift_Bridge"
 },
 {
  "id": 80,
  "name": "Patada de glúteo",
  "muscle": "Glúteos",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "glutes"
  ],
  "secondary": [
   "hamstrings"
  ],
  "cues": "No arquees la espalda baja.",
  "steps": [
   "En cuatro apoyos.",
   "Lleva una pierna hacia atrás y arriba.",
   "Regresa y alterna."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Glute_Kickback"
 },
 {
  "id": 81,
  "name": "Abductores en máquina",
  "muscle": "Glúteos",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abductors"
  ],
  "secondary": [
   "glutes"
  ],
  "cues": "Movimiento controlado, sin rebotes.",
  "steps": [
   "Siéntate con las piernas dentro de los apoyos.",
   "Abre las piernas hacia afuera.",
   "Regresa lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Thigh_Abductor"
 },
 {
  "id": 82,
  "name": "Aductores en máquina",
  "muscle": "Cuádriceps",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "adductors"
  ],
  "secondary": [
   "glutes",
   "hamstrings"
  ],
  "cues": "Trabaja la cara interna del muslo.",
  "steps": [
   "Siéntate con las piernas abiertas en los apoyos.",
   "Junta las piernas.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Thigh_Adductor"
 },
 {
  "id": 83,
  "name": "Elevación de talones sentado",
  "muscle": "Pantorrillas",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "calves"
  ],
  "secondary": [],
  "cues": "Enfoca el sóleo.",
  "steps": [
   "Siéntate con las rodillas bajo el apoyo.",
   "Sube los talones.",
   "Baja hasta el estiramiento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Seated_Calf_Raise"
 },
 {
  "id": 84,
  "name": "Pantorrilla en prensa",
  "muscle": "Pantorrillas",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "calves"
  ],
  "secondary": [],
  "cues": "No bloquees las rodillas.",
  "steps": [
   "En la prensa, apoya solo la punta de los pies.",
   "Empuja con los tobillos.",
   "Regresa lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Calf_Press_On_The_Leg_Press_Machine"
 },
 {
  "id": 85,
  "name": "Pantorrilla tipo burro",
  "muscle": "Pantorrillas",
  "equipment": "Otro",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "calves"
  ],
  "secondary": [],
  "cues": "Gran estiramiento abajo.",
  "steps": [
   "Inclina el torso con la punta de los pies en un escalón.",
   "Sube los talones.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Donkey_Calf_Raises"
 },
 {
  "id": 86,
  "name": "Abdominales (crunch)",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Sube despegando solo los hombros.",
  "steps": [
   "Acostado con rodillas flexionadas y manos al pecho.",
   "Despega los hombros contrayendo el abdomen.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Crunches"
 },
 {
  "id": 87,
  "name": "Elevación de piernas colgado",
  "muscle": "Abdomen",
  "equipment": "Barra fija",
  "level": "Avanzado",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Sin balanceo.",
  "steps": [
   "Cuélgate de una barra.",
   "Sube las piernas hasta la altura de la cadera o más.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Hanging_Leg_Raise"
 },
 {
  "id": 88,
  "name": "Giro ruso",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [
   "lower back"
  ],
  "cues": "Gira desde el torso, no solo los brazos.",
  "steps": [
   "Sentado con el torso inclinado atrás y pies elevados.",
   "Gira el torso de un lado al otro.",
   "Mantén el abdomen firme."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Russian_Twist"
 },
 {
  "id": 89,
  "name": "Crunch en polea",
  "muscle": "Abdomen",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "La cadera queda quieta.",
  "steps": [
   "De rodillas frente a la polea alta con la cuerda junto a la cabeza.",
   "Flexiona el torso hacia el piso.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Cable_Crunch"
 },
 {
  "id": 90,
  "name": "Bicicleta abdominal",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Codo hacia la rodilla contraria.",
  "steps": [
   "Acostado con las manos detrás de la cabeza.",
   "Lleva un codo hacia la rodilla contraria pedaleando.",
   "Alterna de forma continua."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Air_Bike"
 },
 {
  "id": 91,
  "name": "Escaladores",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Pliometría",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "chest",
   "hamstrings",
   "shoulders"
  ],
  "cues": "Cadera baja y ritmo constante.",
  "steps": [
   "En posición de plancha alta.",
   "Lleva una rodilla al pecho.",
   "Alterna rápido."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Mountain_Climbers"
 },
 {
  "id": 92,
  "name": "Plancha lateral",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [
   "shoulders"
  ],
  "cues": "Cuerpo en línea recta.",
  "steps": [
   "Apoya un antebrazo y el borde del pie.",
   "Eleva la cadera.",
   "Sostén y cambia de lado."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Side_Bridge"
 },
 {
  "id": 93,
  "name": "Elevación de piernas en banco",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Espalda baja pegada al banco.",
  "steps": [
   "Acostado en un banco sujetándote detrás de la cabeza.",
   "Sube las piernas rectas hasta 90°.",
   "Baja lento sin tocar el banco."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Flat_Bench_Lying_Leg_Raise"
 },
 {
  "id": 94,
  "name": "Dead bug",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Zona lumbar siempre pegada al piso.",
  "steps": [
   "Boca arriba con brazos y piernas elevados.",
   "Estira un brazo y la pierna contraria.",
   "Regresa y alterna."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Dead_Bug"
 },
 {
  "id": 95,
  "name": "Press Pallof",
  "muscle": "Abdomen",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [
   "chest",
   "shoulders",
   "triceps"
  ],
  "cues": "Resiste el giro.",
  "steps": [
   "De lado a la polea, agarre frente al pecho.",
   "Empuja los brazos al frente sin girar.",
   "Regresa al pecho."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Pallof_Press"
 },
 {
  "id": 96,
  "name": "Crunch declinado",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Más difícil que el crunch normal.",
  "steps": [
   "Acostado en banco declinado con los pies sujetos.",
   "Sube el torso contrayendo el abdomen.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Decline_Crunch"
 },
 {
  "id": 97,
  "name": "Swing con kettlebell",
  "muscle": "Cuerpo completo",
  "equipment": "Kettlebell",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "calves",
   "glutes",
   "lower back",
   "shoulders"
  ],
  "cues": "El impulso sale de la cadera.",
  "steps": [
   "Kettlebell entre las piernas y cadera atrás.",
   "Empuja la cadera adelante para balancearla al pecho.",
   "Deja que baje y repite."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "One-Arm_Kettlebell_Swings"
 },
 {
  "id": 98,
  "name": "Remo alto sumo con kettlebell",
  "muscle": "Cuerpo completo",
  "equipment": "Kettlebell",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "traps"
  ],
  "secondary": [
   "adductors",
   "glutes",
   "hamstrings",
   "quadriceps",
   "shoulders"
  ],
  "cues": "Codos arriba al final.",
  "steps": [
   "Pies abiertos con la kettlebell al centro.",
   "Sube extendiendo piernas y tirando hasta el pecho.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Kettlebell_Sumo_High_Pull"
 },
 {
  "id": 99,
  "name": "Thruster con kettlebell",
  "muscle": "Cuerpo completo",
  "equipment": "Kettlebell",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "quadriceps",
   "triceps"
  ],
  "cues": "Une sentadilla y press en un solo movimiento.",
  "steps": [
   "Kettlebells a la altura de los hombros.",
   "Baja en sentadilla.",
   "Al subir, empuja las pesas sobre la cabeza."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Kettlebell_Thruster"
 },
 {
  "id": 100,
  "name": "Paseo del granjero",
  "muscle": "Cuerpo completo",
  "equipment": "Mancuernas",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "forearms"
  ],
  "secondary": [
   "abdominals",
   "glutes",
   "hamstrings",
   "lower back",
   "quadriceps",
   "traps"
  ],
  "cues": "Hombros atrás y pasos cortos.",
  "steps": [
   "Toma un peso pesado en cada mano.",
   "Camina erguido la distancia indicada.",
   "No dejes caer los hombros."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Farmers_Walk"
 },
 {
  "id": 101,
  "name": "Cargada y press",
  "muscle": "Cuerpo completo",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "abdominals",
   "calves",
   "glutes",
   "hamstrings",
   "lower back",
   "middle back",
   "quadriceps",
   "traps",
   "triceps"
  ],
  "cues": "Técnico: empieza con poco peso.",
  "steps": [
   "Barra en el piso, agarre al ancho de hombros.",
   "Súbela explosivamente a los hombros.",
   "Empújala sobre la cabeza."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Clean_and_Press"
 },
 {
  "id": 102,
  "name": "Cargada de potencia",
  "muscle": "Cuerpo completo",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "calves",
   "forearms",
   "glutes",
   "lower back",
   "middle back",
   "quadriceps",
   "shoulders",
   "traps",
   "triceps"
  ],
  "cues": "Explosivo; recibe la barra en los hombros.",
  "steps": [
   "Barra en el piso como en el peso muerto.",
   "Extiende cadera y rodillas de forma explosiva.",
   "Recibe la barra en los hombros con los codos al frente."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Power_Clean"
 },
 {
  "id": 103,
  "name": "Pase de pecho con balón",
  "muscle": "Cuerpo completo",
  "equipment": "Balón medicinal",
  "level": "Principiante",
  "type": "Pliometría",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Lánzalo con fuerza y atrápalo controlado.",
  "steps": [
   "Sostén el balón frente al pecho.",
   "Lánzalo hacia una pared o compañero.",
   "Atrápalo y repite."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Medicine_Ball_Chest_Pass"
 },
 {
  "id": 104,
  "name": "Separación de banda",
  "muscle": "Hombros",
  "equipment": "Banda elástica",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "middle back",
   "traps"
  ],
  "cues": "Excelente para la postura.",
  "steps": [
   "Sostén una banda frente a ti con brazos estirados.",
   "Sepárala llevando las manos a los lados.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Band_Pull_Apart"
 },
 {
  "id": 105,
  "name": "Saltos en estrella",
  "muscle": "Cardio",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Cardio",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings",
   "shoulders"
  ],
  "cues": "Aterriza suave.",
  "steps": [
   "De pie con los pies juntos.",
   "Salta abriendo brazos y piernas.",
   "Cae suave y repite."
  ],
  "sets": 1,
  "reps": "10 min",
  "rest": 60,
  "images": 2,
  "source": "Star_Jump"
 },
 {
  "id": 106,
  "name": "Salto al cajón",
  "muscle": "Cardio",
  "equipment": "Cajón",
  "level": "Principiante",
  "type": "Cardio",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "abductors",
   "adductors",
   "calves",
   "glutes",
   "quadriceps"
  ],
  "cues": "Aterriza con las rodillas suaves.",
  "steps": [
   "Frente a un cajón estable.",
   "Salta y cae con ambos pies sobre el cajón.",
   "Baja caminando y repite."
  ],
  "sets": 1,
  "reps": "10 min",
  "rest": 60,
  "images": 2,
  "source": "Box_Jump_Multiple_Response"
 },
 {
  "id": 107,
  "name": "Remo ergómetro",
  "muscle": "Cardio",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Cardio",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "biceps",
   "calves",
   "glutes",
   "hamstrings",
   "lower back",
   "middle back"
  ],
  "cues": "Piernas, luego espalda, luego brazos.",
  "steps": [
   "Siéntate y sujeta el manillar con los pies firmes.",
   "Empuja con las piernas y tira llevando el manillar al pecho.",
   "Regresa en orden inverso."
  ],
  "sets": 1,
  "reps": "10 min",
  "rest": 60,
  "images": 2,
  "source": "Rowing_Stationary"
 },
 {
  "id": 108,
  "name": "Trote en caminadora",
  "muscle": "Cardio",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Cardio",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "glutes",
   "hamstrings"
  ],
  "cues": "Zancada corta y relajada.",
  "steps": [
   "Ajusta la velocidad a un ritmo cómodo.",
   "Trota con los brazos relajados.",
   "Mantén el tiempo indicado."
  ],
  "sets": 1,
  "reps": "10 min",
  "rest": 60,
  "images": 2,
  "source": "Jogging_Treadmill"
 },
 {
  "id": 109,
  "name": "Elíptica",
  "muscle": "Cardio",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Cardio",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Bajo impacto para las rodillas.",
  "steps": [
   "Sube a la máquina y toma los agarres.",
   "Pedalea empujando y tirando con los brazos.",
   "Mantén la intensidad indicada."
  ],
  "sets": 1,
  "reps": "10 min",
  "rest": 60,
  "images": 2,
  "source": "Elliptical_Trainer"
 },
 {
  "id": 110,
  "name": "Saltar la cuerda",
  "muscle": "Cardio",
  "equipment": "Cuerda",
  "level": "Intermedio",
  "type": "Cardio",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "hamstrings"
  ],
  "cues": "Saltos bajos sobre la punta de los pies.",
  "steps": [
   "Sostén la cuerda con los codos cerca del cuerpo.",
   "Gira con las muñecas y salta bajo.",
   "Mantén el ritmo."
  ],
  "sets": 1,
  "reps": "10 min",
  "rest": 60,
  "images": 2,
  "source": "Rope_Jumping"
 },
 {
  "id": 111,
  "name": "Curl de muñeca",
  "muscle": "Antebrazos",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "forearms"
  ],
  "secondary": [],
  "cues": "Solo se mueve la muñeca.",
  "steps": [
   "Arrodillado con los antebrazos sobre el banco y palmas arriba.",
   "Sube la barra flexionando las muñecas.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Palms-Up_Barbell_Wrist_Curl_Over_A_Bench"
 },
 {
  "id": 112,
  "name": "Curl de muñeca invertido",
  "muscle": "Antebrazos",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "forearms"
  ],
  "secondary": [],
  "cues": "Usa poco peso.",
  "steps": [
   "Antebrazos sobre el banco con palmas hacia abajo.",
   "Sube la barra extendiendo las muñecas.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Palms-Down_Wrist_Curl_Over_A_Bench"
 },
 {
  "id": 113,
  "name": "Estiramiento de isquiotibiales",
  "muscle": "Estiramiento",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Estiramiento",
  "primary": [
   "hamstrings"
  ],
  "secondary": [],
  "cues": "Sin rebotes; respira profundo.",
  "steps": [
   "Acostado, sube una pierna estirada.",
   "Tira suave de ella hacia ti.",
   "Sostén 20–30 s y cambia."
  ],
  "sets": 2,
  "reps": "30 s",
  "rest": 15,
  "images": 2,
  "source": "Hamstring_Stretch"
 },
 {
  "id": 114,
  "name": "Estiramiento de cuádriceps",
  "muscle": "Estiramiento",
  "equipment": "Otro",
  "level": "Intermedio",
  "type": "Estiramiento",
  "primary": [
   "quadriceps"
  ],
  "secondary": [],
  "cues": "Rodillas juntas.",
  "steps": [
   "De pie, toma un tobillo detrás de ti.",
   "Lleva el talón hacia el glúteo.",
   "Sostén 20–30 s y cambia."
  ],
  "sets": 2,
  "reps": "30 s",
  "rest": 15,
  "images": 2,
  "source": "Quad_Stretch"
 },
 {
  "id": 115,
  "name": "Postura del niño",
  "muscle": "Estiramiento",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Estiramiento",
  "primary": [
   "lower back"
  ],
  "secondary": [
   "glutes",
   "middle back"
  ],
  "cues": "Relaja la espalda baja.",
  "steps": [
   "De rodillas, siéntate sobre los talones.",
   "Estira los brazos al frente apoyando la frente.",
   "Respira profundo 30 s."
  ],
  "sets": 2,
  "reps": "30 s",
  "rest": 15,
  "images": 2,
  "source": "Childs_Pose"
 },
 {
  "id": 116,
  "name": "Gato-camello",
  "muscle": "Estiramiento",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Estiramiento",
  "primary": [
   "lower back"
  ],
  "secondary": [
   "middle back",
   "traps"
  ],
  "cues": "Movimiento lento y fluido.",
  "steps": [
   "En cuatro apoyos.",
   "Redondea la espalda hacia arriba.",
   "Luego hunde la espalda y alterna."
  ],
  "sets": 2,
  "reps": "30 s",
  "rest": 15,
  "images": 2,
  "source": "Cat_Stretch"
 },
 {
  "id": 117,
  "name": "Estiramiento de flexor de cadera",
  "muscle": "Estiramiento",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Estiramiento",
  "primary": [
   "quadriceps"
  ],
  "secondary": [],
  "cues": "Aprieta el glúteo de la pierna de atrás.",
  "steps": [
   "Una rodilla en el piso y la otra pierna al frente.",
   "Empuja la cadera hacia adelante.",
   "Sostén 20–30 s por lado."
  ],
  "sets": 2,
  "reps": "30 s",
  "rest": 15,
  "images": 2,
  "source": "Kneeling_Hip_Flexor"
 },
 {
  "id": 118,
  "name": "Estiramiento de pecho",
  "muscle": "Estiramiento",
  "equipment": "Otro",
  "level": "Principiante",
  "type": "Estiramiento",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders"
  ],
  "cues": "Ideal al terminar el día de empuje.",
  "steps": [
   "De pie junto a un marco o pared.",
   "Apoya el antebrazo y gira el torso al lado contrario.",
   "Sostén 20–30 s."
  ],
  "sets": 2,
  "reps": "30 s",
  "rest": 15,
  "images": 2,
  "source": "Chest_And_Front_Of_Shoulder_Stretch"
 },
 {
  "id": 119,
  "name": "Estiramiento de pantorrilla",
  "muscle": "Estiramiento",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Estiramiento",
  "primary": [
   "calves"
  ],
  "secondary": [],
  "cues": "Talón de atrás en el piso.",
  "steps": [
   "Manos en la pared y un pie atrás.",
   "Inclínate hacia la pared con la pierna de atrás recta.",
   "Sostén 20–30 s y cambia."
  ],
  "sets": 2,
  "reps": "30 s",
  "rest": 15,
  "images": 2,
  "source": "Calf_Stretch_Hands_Against_Wall"
 },
 {
  "id": 120,
  "name": "Press de pecho en Hammer",
  "muscle": "Pecho",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Cada brazo trabaja por separado: empuja parejo con los dos.",
  "steps": [
   "Ajusta el asiento para que los agarres queden a la altura del pecho.",
   "Empuja los agarres al frente hasta casi estirar los brazos.",
   "Regresa lento hasta sentir el estiramiento en el pecho."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Leverage_Chest_Press"
 },
 {
  "id": 121,
  "name": "Press inclinado en Hammer",
  "muscle": "Pecho",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Pecho alto y escápulas pegadas al respaldo.",
  "steps": [
   "Siéntate con la espalda apoyada y toma los agarres a la altura de la parte alta del pecho.",
   "Empuja hacia arriba y al frente sin bloquear los codos.",
   "Baja controlando el recorrido completo."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Leverage_Incline_Chest_Press"
 },
 {
  "id": 122,
  "name": "Press declinado en Hammer",
  "muscle": "Pecho",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Enfoca la parte baja del pecho; codos a 45°.",
  "steps": [
   "Siéntate y toma los agarres a la altura de la parte baja del pecho.",
   "Empuja hacia abajo y al frente hasta estirar los brazos.",
   "Regresa lento sin despegar la espalda."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Leverage_Decline_Chest_Press"
 },
 {
  "id": 123,
  "name": "Press banca en Smith",
  "muscle": "Pecho",
  "equipment": "Máquina Smith",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Coloca el banco para que la barra baje a la mitad del pecho.",
  "steps": [
   "Acuéstate bajo la barra y gírala para soltar los seguros.",
   "Baja la barra controlada hasta rozar el pecho.",
   "Empuja hasta estirar los brazos y vuelve a asegurar al final."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Smith_Machine_Bench_Press"
 },
 {
  "id": 124,
  "name": "Press inclinado en Smith",
  "muscle": "Pecho",
  "equipment": "Máquina Smith",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Banco a 30°; la barra cae en la parte alta del pecho.",
  "steps": [
   "Coloca el banco inclinado bajo la barra.",
   "Libera la barra y bájala a la parte alta del pecho.",
   "Empuja hacia arriba sin bloquear los codos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Smith_Machine_Incline_Bench_Press"
 },
 {
  "id": 125,
  "name": "Press declinado con barra",
  "muscle": "Pecho",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Pide ayuda para sacar la barra del soporte.",
  "steps": [
   "Asegura los pies en el banco declinado y toma la barra al ancho de hombros.",
   "Baja la barra a la parte baja del pecho.",
   "Empuja hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Decline_Barbell_Bench_Press"
 },
 {
  "id": 126,
  "name": "Press inclinado con agarre neutro",
  "muscle": "Pecho",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Palmas mirándose: más cómodo para los hombros.",
  "steps": [
   "En banco inclinado, sostén las mancuernas con las palmas enfrentadas.",
   "Empuja hacia arriba hasta casi juntarlas.",
   "Baja lento con los codos cerca del cuerpo."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Hammer_Grip_Incline_DB_Bench_Press"
 },
 {
  "id": 127,
  "name": "Aperturas inclinadas en polea",
  "muscle": "Pecho",
  "equipment": "Polea",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders"
  ],
  "cues": "Codos un poco flexionados y fijos todo el movimiento.",
  "steps": [
   "Coloca un banco inclinado entre dos poleas bajas.",
   "Con los brazos abiertos, junta las manos sobre el pecho en arco.",
   "Abre lento hasta sentir el estiramiento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Incline_Cable_Flye"
 },
 {
  "id": 128,
  "name": "Cruce de poleas bajo",
  "muscle": "Pecho",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders"
  ],
  "cues": "Sube las manos hasta la altura de la barbilla.",
  "steps": [
   "Toma las poleas bajas y da un paso al frente.",
   "Lleva las manos hacia arriba y al centro en arco.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Low_Cable_Crossover"
 },
 {
  "id": 129,
  "name": "Aperturas en polea en banco plano",
  "muscle": "Pecho",
  "equipment": "Polea",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [],
  "cues": "Tensión constante gracias a la polea.",
  "steps": [
   "Acuéstate en un banco plano entre dos poleas bajas.",
   "Junta las manos sobre el pecho con los codos suaves.",
   "Abre lento hasta la altura del pecho."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Flat_Bench_Cable_Flyes"
 },
 {
  "id": 130,
  "name": "Press de pecho de pie en polea",
  "muscle": "Pecho",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Abdomen firme para no arquear la espalda.",
  "steps": [
   "De espaldas a la polea, toma los agarres a la altura del pecho.",
   "Empuja al frente hasta estirar los brazos.",
   "Regresa controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Standing_Cable_Chest_Press"
 },
 {
  "id": 131,
  "name": "Pullover con mancuerna",
  "muscle": "Pecho",
  "equipment": "Mancuernas",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "lats",
   "shoulders",
   "triceps"
  ],
  "cues": "Baja solo hasta donde controles con los hombros.",
  "steps": [
   "Acuéstate en el banco con una mancuerna sobre el pecho, brazos casi estirados.",
   "Lleva la mancuerna hacia atrás de la cabeza en arco.",
   "Regresa a la posición inicial."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Straight-Arm_Dumbbell_Pullover"
 },
 {
  "id": 132,
  "name": "Flexiones inclinadas",
  "muscle": "Pecho",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Buena opción para empezar con las flexiones.",
  "steps": [
   "Apoya las manos en un banco con el cuerpo en línea recta.",
   "Baja el pecho hasta el borde del banco.",
   "Empuja hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Incline_Push-Up"
 },
 {
  "id": 133,
  "name": "Flexiones declinadas",
  "muscle": "Pecho",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Pies elevados: más trabajo en la parte alta del pecho.",
  "steps": [
   "Pies sobre un banco y manos en el piso.",
   "Baja el pecho manteniendo el cuerpo recto.",
   "Empuja hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Decline_Push-Up"
 },
 {
  "id": 134,
  "name": "Remo en Hammer (Iso-Lateral)",
  "muscle": "Espalda",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [
   "biceps",
   "middle back"
  ],
  "cues": "Pecho contra el apoyo; tira con los codos.",
  "steps": [
   "Siéntate con el pecho apoyado y toma los agarres.",
   "Tira hacia atrás juntando las escápulas.",
   "Estira los brazos lento sin despegar el pecho."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Leverage_Iso_Row"
 },
 {
  "id": 135,
  "name": "Remo alto en Hammer",
  "muscle": "Espalda",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "lats"
  ],
  "cues": "Lleva los codos hacia abajo y atrás.",
  "steps": [
   "Siéntate con los muslos fijos y toma los agarres altos.",
   "Tira hacia la parte alta del pecho bajando los codos.",
   "Sube controlando hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Leverage_High_Row"
 },
 {
  "id": 136,
  "name": "Peso muerto en Hammer",
  "muscle": "Cuerpo completo",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps",
   "glutes"
  ],
  "secondary": [
   "hamstrings",
   "lower back",
   "traps"
  ],
  "cues": "Espalda neutra, empuja el piso con las piernas.",
  "steps": [
   "Párate dentro de la máquina y toma los agarres.",
   "Sube extendiendo cadera y rodillas a la vez.",
   "Baja controlando con la espalda recta."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Leverage_Deadlift"
 },
 {
  "id": 137,
  "name": "Encogimientos en Hammer",
  "muscle": "Espalda",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "traps"
  ],
  "secondary": [
   "forearms"
  ],
  "cues": "Sube recto hacia las orejas y pausa arriba.",
  "steps": [
   "Párate en la máquina y toma los agarres a los costados.",
   "Sube los hombros lo más alto posible.",
   "Baja lento hasta estirar los trapecios."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Leverage_Shrug"
 },
 {
  "id": 138,
  "name": "Remo en T con pecho apoyado",
  "muscle": "Espalda",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "biceps",
   "lats"
  ],
  "cues": "Sin impulso: el apoyo protege la espalda baja.",
  "steps": [
   "Acuéstate boca abajo en la máquina y toma los agarres.",
   "Tira hacia el pecho juntando las escápulas.",
   "Baja hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Lying_T-Bar_Row"
 },
 {
  "id": 139,
  "name": "Remo en Smith",
  "muscle": "Espalda",
  "equipment": "Máquina Smith",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "biceps",
   "lats",
   "shoulders"
  ],
  "cues": "Torso inclinado y espalda recta.",
  "steps": [
   "Inclina el torso con la barra colgando frente a las rodillas.",
   "Lleva la barra hacia el ombligo.",
   "Baja hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Smith_Machine_Bent_Over_Row"
 },
 {
  "id": 140,
  "name": "Remo en polea a una mano",
  "muscle": "Espalda",
  "equipment": "Polea",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "biceps",
   "lats",
   "traps"
  ],
  "cues": "Gira un poco el torso al estirar para mayor recorrido.",
  "steps": [
   "Sentado frente a la polea, toma el agarre con una mano.",
   "Tira hacia la cadera llevando el codo atrás.",
   "Estira el brazo controlando y cambia de lado."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Seated_One-arm_Cable_Pulley_Rows"
 },
 {
  "id": 141,
  "name": "Jalón supino",
  "muscle": "Espalda",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [
   "biceps",
   "middle back",
   "shoulders"
  ],
  "cues": "Palmas hacia ti y codos al frente del cuerpo.",
  "steps": [
   "Siéntate y toma la barra con agarre supino al ancho de hombros.",
   "Tira hacia la parte alta del pecho.",
   "Sube controlando hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Underhand_Cable_Pulldowns"
 },
 {
  "id": 142,
  "name": "Remo con mancuernas en banco inclinado",
  "muscle": "Espalda",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "biceps",
   "forearms",
   "lats",
   "shoulders"
  ],
  "cues": "Pecho apoyado: aísla la espalda alta.",
  "steps": [
   "Acuéstate boca abajo en un banco inclinado con una mancuerna en cada mano.",
   "Tira de las mancuernas juntando las escápulas.",
   "Baja hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Dumbbell_Incline_Row"
 },
 {
  "id": 143,
  "name": "Remo con barra agarre supino",
  "muscle": "Espalda",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "middle back"
  ],
  "secondary": [
   "biceps",
   "lats",
   "shoulders"
  ],
  "cues": "Codos pegados al cuerpo.",
  "steps": [
   "Inclina el torso y toma la barra con las palmas hacia adelante.",
   "Tira hacia el ombligo.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Reverse_Grip_Bent-Over_Rows"
 },
 {
  "id": 144,
  "name": "Hiperextensión inversa",
  "muscle": "Isquiotibiales",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "calves",
   "glutes"
  ],
  "cues": "Sube con glúteos, no con impulso.",
  "steps": [
   "Acuéstate boca abajo con la cadera en el borde de la máquina.",
   "Sube las piernas hasta alinearlas con el torso.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Reverse_Hyperextension"
 },
 {
  "id": 145,
  "name": "Press de hombros en Hammer",
  "muscle": "Hombros",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "triceps"
  ],
  "cues": "Espalda pegada al respaldo.",
  "steps": [
   "Ajusta el asiento para que los agarres queden a la altura de los hombros.",
   "Empuja hacia arriba sin bloquear los codos.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Leverage_Shoulder_Press"
 },
 {
  "id": 146,
  "name": "Press de hombros en Smith",
  "muscle": "Hombros",
  "equipment": "Máquina Smith",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "triceps"
  ],
  "cues": "La barra baja frente a la cara, no detrás.",
  "steps": [
   "Siéntate bajo la barra con el banco vertical.",
   "Empuja la barra sobre la cabeza.",
   "Baja hasta la altura de la barbilla."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Smith_Machine_Overhead_Shoulder_Press"
 },
 {
  "id": 147,
  "name": "Press militar sentado",
  "muscle": "Hombros",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "triceps"
  ],
  "cues": "Abdomen firme y sin arquear la espalda.",
  "steps": [
   "Siéntate con la barra a la altura de las clavículas.",
   "Empuja la barra sobre la cabeza.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Seated_Barbell_Military_Press"
 },
 {
  "id": 148,
  "name": "Elevación lateral en polea",
  "muscle": "Hombros",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "middle back",
   "traps"
  ],
  "cues": "La polea mantiene la tensión abajo.",
  "steps": [
   "Toma el agarre de una polea baja con la mano contraria.",
   "Eleva el brazo hacia el lado hasta la altura del hombro.",
   "Baja lento y cambia de lado."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Cable_Seated_Lateral_Raise"
 },
 {
  "id": 149,
  "name": "Elevación frontal en polea",
  "muscle": "Hombros",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [],
  "cues": "Sube solo hasta los ojos.",
  "steps": [
   "De espaldas a la polea baja, toma el agarre entre las piernas.",
   "Eleva el brazo al frente hasta la altura de los hombros.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Front_Cable_Raise"
 },
 {
  "id": 150,
  "name": "Pájaros en máquina",
  "muscle": "Hombros",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [],
  "cues": "Abre con los brazos casi estirados.",
  "steps": [
   "Siéntate de frente al respaldo del pec deck y toma los agarres.",
   "Abre los brazos hacia atrás juntando las escápulas.",
   "Regresa lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Reverse_Machine_Flyes"
 },
 {
  "id": 151,
  "name": "Aperturas posteriores en polea",
  "muscle": "Hombros",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [],
  "cues": "Cruza los cables y abre hacia afuera.",
  "steps": [
   "Toma las poleas altas cruzadas frente a ti.",
   "Abre los brazos hacia los lados y atrás.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Cable_Rear_Delt_Fly"
 },
 {
  "id": 152,
  "name": "Pájaros sentado",
  "muscle": "Hombros",
  "equipment": "Mancuernas",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [],
  "cues": "Torso pegado a los muslos.",
  "steps": [
   "Sentado e inclinado, sostén las mancuernas bajo las piernas.",
   "Abre los brazos hacia los lados.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Seated_Bent-Over_Rear_Delt_Raise"
 },
 {
  "id": 153,
  "name": "Elevaciones laterales sentado",
  "muscle": "Hombros",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [],
  "cues": "Sentado no hay impulso con las piernas.",
  "steps": [
   "Sentado con una mancuerna en cada mano.",
   "Eleva los brazos a los lados hasta los hombros.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Seated_Side_Lateral_Raise"
 },
 {
  "id": 154,
  "name": "Elevación frontal con disco",
  "muscle": "Hombros",
  "equipment": "Disco",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [],
  "cues": "Brazos casi estirados.",
  "steps": [
   "Sostén un disco con ambas manos frente a los muslos.",
   "Elévalo al frente hasta la altura de los ojos.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Front_Plate_Raise"
 },
 {
  "id": 155,
  "name": "Remo al mentón con mancuernas",
  "muscle": "Hombros",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "traps"
  ],
  "secondary": [
   "biceps",
   "shoulders"
  ],
  "cues": "Codos por encima de las manos.",
  "steps": [
   "De pie con las mancuernas frente a los muslos.",
   "Súbelas pegadas al cuerpo hasta el pecho.",
   "Baja lento."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Standing_Dumbbell_Upright_Row"
 },
 {
  "id": 156,
  "name": "Rotación externa en polea",
  "muscle": "Hombros",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [],
  "cues": "Codo pegado al costado; poco peso.",
  "steps": [
   "De lado a la polea, toma el agarre con el codo a 90°.",
   "Gira el antebrazo hacia afuera.",
   "Regresa lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "External_Rotation_with_Cable"
 },
 {
  "id": 157,
  "name": "Curl de bíceps en máquina",
  "muscle": "Bíceps",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "Codos alineados con el eje de la máquina.",
  "steps": [
   "Siéntate con los brazos sobre el apoyo y toma los agarres.",
   "Flexiona los codos hasta arriba.",
   "Baja lento hasta casi estirar."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Machine_Bicep_Curl"
 },
 {
  "id": 158,
  "name": "Curl predicador en máquina",
  "muscle": "Bíceps",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "No despegues los brazos del apoyo.",
  "steps": [
   "Siéntate con la parte de atrás de los brazos sobre el apoyo.",
   "Sube flexionando los codos.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Machine_Preacher_Curls"
 },
 {
  "id": 159,
  "name": "Curl araña",
  "muscle": "Bíceps",
  "equipment": "Barra Z",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "Brazos colgando: elimina el impulso.",
  "steps": [
   "Acuéstate boca abajo en un banco inclinado con la barra colgando.",
   "Flexiona los codos hasta arriba.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Spider_Curl"
 },
 {
  "id": 160,
  "name": "Curl en polea alta",
  "muscle": "Bíceps",
  "equipment": "Polea",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "Pose de doble bíceps; codos fijos.",
  "steps": [
   "Entre dos poleas altas, toma un agarre en cada mano.",
   "Lleva las manos hacia la cabeza flexionando los codos.",
   "Regresa lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Overhead_Cable_Curl"
 },
 {
  "id": 161,
  "name": "Curl invertido con barra",
  "muscle": "Bíceps",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [
   "forearms"
  ],
  "cues": "Trabaja también los antebrazos.",
  "steps": [
   "Toma la barra con las palmas hacia abajo.",
   "Flexiona los codos hasta arriba.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Reverse_Barbell_Curl"
 },
 {
  "id": 162,
  "name": "Curl martillo inclinado",
  "muscle": "Bíceps",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [],
  "cues": "Palmas enfrentadas todo el recorrido.",
  "steps": [
   "Recostado en un banco inclinado con las mancuernas colgando.",
   "Sube con agarre neutro.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Incline_Hammer_Curls"
 },
 {
  "id": 163,
  "name": "Curl martillo cruzado",
  "muscle": "Bíceps",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [
   "forearms"
  ],
  "cues": "Lleva la mancuerna hacia el hombro contrario.",
  "steps": [
   "De pie con las mancuernas a los costados.",
   "Sube una mancuerna cruzando hacia el hombro contrario.",
   "Baja y alterna."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Cross_Body_Hammer_Curl"
 },
 {
  "id": 164,
  "name": "Extensión de tríceps en máquina",
  "muscle": "Tríceps",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [],
  "cues": "Estira por completo los brazos.",
  "steps": [
   "Siéntate con los codos sobre el apoyo.",
   "Extiende los brazos empujando los agarres.",
   "Regresa lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Machine_Triceps_Extension"
 },
 {
  "id": 165,
  "name": "Fondos en máquina",
  "muscle": "Tríceps",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [
   "chest",
   "shoulders"
  ],
  "cues": "Torso erguido para enfocar tríceps.",
  "steps": [
   "Siéntate y toma los agarres a los costados.",
   "Empuja hacia abajo hasta estirar los brazos.",
   "Sube controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Dip_Machine"
 },
 {
  "id": 166,
  "name": "Extensión en polea agarre supino",
  "muscle": "Tríceps",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [],
  "cues": "Palmas hacia arriba; poco peso.",
  "steps": [
   "Toma la barra de la polea alta con las palmas hacia arriba.",
   "Empuja hacia abajo hasta estirar los brazos.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Reverse_Grip_Triceps_Pushdown"
 },
 {
  "id": 167,
  "name": "Rompecráneos con barra Z",
  "muscle": "Tríceps",
  "equipment": "Barra Z",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [
   "forearms"
  ],
  "cues": "Codos apuntando al techo.",
  "steps": [
   "Acostado, sostén la barra Z sobre el pecho.",
   "Baja la barra hacia la frente flexionando los codos.",
   "Extiende los brazos."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "EZ-Bar_Skullcrusher"
 },
 {
  "id": 168,
  "name": "Press cerrado en Smith",
  "muscle": "Tríceps",
  "equipment": "Máquina Smith",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [
   "chest",
   "shoulders"
  ],
  "cues": "Manos al ancho de hombros.",
  "steps": [
   "Acuéstate bajo la barra con agarre cerrado.",
   "Baja con los codos pegados al cuerpo.",
   "Empuja hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Smith_Machine_Close-Grip_Bench_Press"
 },
 {
  "id": 169,
  "name": "Extensión de tríceps a una mano",
  "muscle": "Tríceps",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [],
  "cues": "Codo fijo al costado.",
  "steps": [
   "Toma el agarre de la polea alta con una mano.",
   "Extiende el brazo hacia abajo.",
   "Regresa lento y cambia."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Cable_One_Arm_Tricep_Extension"
 },
 {
  "id": 170,
  "name": "Flexiones diamante",
  "muscle": "Tríceps",
  "equipment": "Peso corporal",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [
   "chest",
   "shoulders"
  ],
  "cues": "Manos juntas bajo el pecho.",
  "steps": [
   "Coloca las manos juntas bajo el pecho.",
   "Baja manteniendo los codos pegados.",
   "Empuja hasta estirar los brazos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Push-Ups_-_Close_Triceps_Position"
 },
 {
  "id": 171,
  "name": "Sentadilla hack pies juntos",
  "muscle": "Cuádriceps",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Más trabajo en el vasto externo.",
  "steps": [
   "Apoya la espalda en la máquina con los pies juntos.",
   "Baja hasta 90° o más si controlas.",
   "Empuja con todo el pie."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Narrow_Stance_Hack_Squats"
 },
 {
  "id": 172,
  "name": "Sentadilla en máquina inclinada",
  "muscle": "Cuádriceps",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Espalda apoyada todo el recorrido.",
  "steps": [
   "Acuéstate en la máquina con los hombros bajo los apoyos.",
   "Baja flexionando las rodillas.",
   "Empuja hasta casi estirar."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Lying_Machine_Squat"
 },
 {
  "id": 173,
  "name": "Sentadilla hack con barra",
  "muscle": "Cuádriceps",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "forearms",
   "hamstrings"
  ],
  "cues": "Barra detrás de las piernas, pecho alto.",
  "steps": [
   "Sostén la barra detrás de las piernas.",
   "Sube extendiendo cadera y rodillas.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Hack_Squat"
 },
 {
  "id": 174,
  "name": "Zancada con barra",
  "muscle": "Cuádriceps",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Torso erguido.",
  "steps": [
   "Con la barra sobre la espalda, da un paso al frente.",
   "Baja hasta que ambas rodillas formen 90°.",
   "Regresa y alterna."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Lunge"
 },
 {
  "id": 175,
  "name": "Zancada atrás con mancuernas",
  "muscle": "Cuádriceps",
  "equipment": "Mancuernas",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Más amable con las rodillas.",
  "steps": [
   "De pie con mancuernas a los costados.",
   "Da un paso atrás y baja la rodilla.",
   "Regresa y alterna."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Dumbbell_Rear_Lunge"
 },
 {
  "id": 176,
  "name": "Zancada estática en Smith",
  "muscle": "Cuádriceps",
  "equipment": "Máquina Smith",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Peso en la pierna de adelante.",
  "steps": [
   "Con la barra sobre la espalda, coloca un pie adelante y otro atrás.",
   "Baja la rodilla de atrás hacia el piso.",
   "Sube y repite antes de cambiar."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Smith_Single-Leg_Split_Squat"
 },
 {
  "id": 177,
  "name": "Subidas al cajón con barra",
  "muscle": "Cuádriceps",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "glutes",
   "hamstrings"
  ],
  "cues": "Empuja con la pierna de arriba.",
  "steps": [
   "Con la barra sobre la espalda, frente a un cajón.",
   "Sube un pie y empuja hasta quedar de pie.",
   "Baja y alterna."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Barbell_Step_Ups"
 },
 {
  "id": 178,
  "name": "Peso muerto rumano en Smith",
  "muscle": "Isquiotibiales",
  "equipment": "Máquina Smith",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "glutes",
   "lower back"
  ],
  "cues": "Cadera atrás y espalda neutra.",
  "steps": [
   "Sostén la barra frente a los muslos.",
   "Baja llevando la cadera atrás.",
   "Sube apretando glúteos."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Smith_Machine_Stiff-Legged_Deadlift"
 },
 {
  "id": 179,
  "name": "Pull through en polea",
  "muscle": "Glúteos",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "glutes"
  ],
  "secondary": [
   "hamstrings",
   "lower back"
  ],
  "cues": "Movimiento de bisagra de cadera.",
  "steps": [
   "De espaldas a la polea baja, toma la cuerda entre las piernas.",
   "Extiende la cadera hasta quedar erguido.",
   "Baja llevando la cadera atrás."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Pull_Through"
 },
 {
  "id": 180,
  "name": "Patada de glúteo en polea",
  "muscle": "Glúteos",
  "equipment": "Polea",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "glutes"
  ],
  "secondary": [
   "hamstrings"
  ],
  "cues": "No arquees la espalda.",
  "steps": [
   "Coloca la tobillera de la polea baja.",
   "Lleva la pierna hacia atrás.",
   "Regresa lento y cambia."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "One-Legged_Cable_Kickback"
 },
 {
  "id": 181,
  "name": "Puente de glúteo a una pierna",
  "muscle": "Glúteos",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "glutes"
  ],
  "secondary": [
   "hamstrings"
  ],
  "cues": "Pausa arriba.",
  "steps": [
   "Acostado, apoya un pie y estira la otra pierna.",
   "Sube la cadera empujando con el talón.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Single_Leg_Glute_Bridge"
 },
 {
  "id": 182,
  "name": "Aductores en polea",
  "muscle": "Cuádriceps",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "adductors"
  ],
  "secondary": [
   "glutes"
  ],
  "cues": "Movimiento lento.",
  "steps": [
   "Con la tobillera en la polea baja, de lado.",
   "Lleva la pierna hacia adentro cruzando.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Cable_Hip_Adduction"
 },
 {
  "id": 183,
  "name": "Pantorrilla en Smith",
  "muscle": "Pantorrillas",
  "equipment": "Máquina Smith",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "calves"
  ],
  "secondary": [],
  "cues": "Recorrido completo.",
  "steps": [
   "De pie sobre un escalón con la barra en la espalda.",
   "Sube los talones al máximo.",
   "Baja estirando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Smith_Machine_Calf_Raise"
 },
 {
  "id": 184,
  "name": "Pantorrilla sentado a una pierna",
  "muscle": "Pantorrillas",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "calves"
  ],
  "secondary": [],
  "cues": "Mancuerna sobre la rodilla.",
  "steps": [
   "Sentado con la punta del pie en un disco.",
   "Sube el talón.",
   "Baja lento y cambia."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 2,
  "source": "Dumbbell_Seated_One-Leg_Calf_Raise"
 },
 {
  "id": 185,
  "name": "Empuje de trineo",
  "muscle": "Cuerpo completo",
  "equipment": "Trineo",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "chest",
   "glutes",
   "hamstrings",
   "triceps"
  ],
  "cues": "Brazos estirados y pasos cortos.",
  "steps": [
   "Toma los postes del trineo inclinado.",
   "Empuja con pasos cortos y potentes.",
   "Mantén la distancia indicada."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Sled_Push"
 },
 {
  "id": 186,
  "name": "Crunch en máquina",
  "muscle": "Abdomen",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Redondea la espalda; no tires con los brazos.",
  "steps": [
   "Siéntate y toma los agarres.",
   "Flexiona el tronco hacia adelante.",
   "Regresa lento."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Ab_Crunch_Machine"
 },
 {
  "id": 187,
  "name": "Crunch inverso",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Sube la cadera, no balancees las piernas.",
  "steps": [
   "Acostado con las rodillas flexionadas.",
   "Lleva las rodillas al pecho subiendo la cadera.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Reverse_Crunch"
 },
 {
  "id": 188,
  "name": "Crunch oblicuo",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Codo hacia la cadera.",
  "steps": [
   "Acostado de lado con las rodillas flexionadas.",
   "Sube el torso de lado.",
   "Baja y cambia."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Oblique_Crunches_-_On_The_Floor"
 },
 {
  "id": 189,
  "name": "Leñador en polea",
  "muscle": "Abdomen",
  "equipment": "Polea",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [
   "shoulders"
  ],
  "cues": "Gira desde el torso.",
  "steps": [
   "De lado a la polea alta, toma el agarre con ambas manos.",
   "Tira en diagonal hacia la rodilla contraria.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Standing_Cable_Wood_Chop"
 },
 {
  "id": 190,
  "name": "Abdominales completos",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Sin tirar del cuello.",
  "steps": [
   "Acostado con las rodillas flexionadas.",
   "Sube el torso hasta quedar sentado.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Sit-Up"
 },
 {
  "id": 191,
  "name": "Pike colgado",
  "muscle": "Abdomen",
  "equipment": "Barra fija",
  "level": "Avanzado",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [],
  "cues": "Avanzado: lleva los pies a la barra.",
  "steps": [
   "Cuélgate de la barra.",
   "Sube las piernas estiradas hasta la barra.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Hanging_Pike"
 },
 {
  "id": 192,
  "name": "Landmine 180°",
  "muscle": "Abdomen",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "abdominals"
  ],
  "secondary": [
   "glutes",
   "lower back",
   "shoulders"
  ],
  "cues": "Gira con los brazos estirados.",
  "steps": [
   "Sostén la punta de la barra frente a ti.",
   "Llévala de un lado a otro en arco.",
   "Mantén la cadera estable."
  ],
  "sets": 3,
  "reps": "15",
  "rest": 45,
  "images": 2,
  "source": "Landmine_180s"
 },
 {
  "id": 193,
  "name": "Cargada colgante",
  "muscle": "Cuerpo completo",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Halterofilia",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "calves",
   "forearms",
   "glutes",
   "hamstrings",
   "lower back",
   "shoulders",
   "traps"
  ],
  "cues": "La barra sube pegada al cuerpo.",
  "steps": [
   "Sostén la barra a la altura de los muslos.",
   "Extiende la cadera con fuerza y recibe la barra en los hombros.",
   "Regresa controlando."
  ],
  "sets": 4,
  "reps": "8-10",
  "rest": 90,
  "images": 2,
  "source": "Hang_Clean"
 },
 {
  "id": 194,
  "name": "Sentadilla péndulo",
  "muscle": "Cuádriceps",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "glutes",
   "adductors"
  ],
  "cues": "Rodillas pasan la punta de los pies; espalda pegada.",
  "steps": [
   "Apoya la espalda y los hombros en la máquina péndulo.",
   "Baja profundo controlando el arco del péndulo.",
   "Empuja con todo el pie hasta casi estirar."
  ],
  "sets": 4,
  "reps": "8-12",
  "rest": 120,
  "images": 0,
  "source": null
 },
 {
  "id": 195,
  "name": "Belt squat",
  "muscle": "Cuádriceps",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps",
   "glutes"
  ],
  "secondary": [
   "adductors",
   "hamstrings"
  ],
  "cues": "Carga en la cadera: cero presión en la espalda.",
  "steps": [
   "Coloca el cinturón en la cadera y párate en la plataforma.",
   "Baja en sentadilla con el torso erguido.",
   "Sube empujando el piso."
  ],
  "sets": 4,
  "reps": "10",
  "rest": 120,
  "images": 0,
  "source": null
 },
 {
  "id": 196,
  "name": "V-squat",
  "muscle": "Cuádriceps",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "glutes"
  ],
  "cues": "Pies en la parte baja para más cuádriceps.",
  "steps": [
   "Coloca los hombros bajo los apoyos.",
   "Baja hasta 90° o más.",
   "Empuja sin bloquear las rodillas."
  ],
  "sets": 4,
  "reps": "10",
  "rest": 90,
  "images": 0,
  "source": null
 },
 {
  "id": 197,
  "name": "Hack squat inverso",
  "muscle": "Glúteos",
  "equipment": "Máquina",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "glutes",
   "hamstrings"
  ],
  "secondary": [
   "quadriceps"
  ],
  "cues": "Pecho contra el respaldo y cadera atrás.",
  "steps": [
   "Párate de frente al respaldo de la hack.",
   "Baja llevando la cadera atrás.",
   "Sube apretando glúteos."
  ],
  "sets": 3,
  "reps": "10",
  "rest": 90,
  "images": 0,
  "source": null
 },
 {
  "id": 198,
  "name": "Sentadilla sissy",
  "muscle": "Cuádriceps",
  "equipment": "Peso corporal",
  "level": "Avanzado",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [],
  "cues": "Cadera estirada; rodillas al frente.",
  "steps": [
   "Sujétate de un soporte y ponte en puntas.",
   "Inclina el torso atrás y baja llevando las rodillas al frente.",
   "Sube controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 0,
  "source": null
 },
 {
  "id": 199,
  "name": "Sentadilla con safety bar",
  "muscle": "Cuádriceps",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "quadriceps",
   "glutes"
  ],
  "secondary": [
   "hamstrings",
   "lower back"
  ],
  "cues": "Torso erguido gracias a la barra.",
  "steps": [
   "Coloca la barra de seguridad sobre los trapecios.",
   "Baja en sentadilla.",
   "Sube empujando el piso."
  ],
  "sets": 4,
  "reps": "6-8",
  "rest": 150,
  "images": 0,
  "source": null
 },
 {
  "id": 200,
  "name": "Peso muerto con barra hexagonal",
  "muscle": "Cuerpo completo",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps",
   "glutes"
  ],
  "secondary": [
   "hamstrings",
   "lower back",
   "traps"
  ],
  "cues": "Más amable con la espalda que el convencional.",
  "steps": [
   "Párate dentro de la barra y toma los agarres.",
   "Sube extendiendo cadera y rodillas.",
   "Baja controlando."
  ],
  "sets": 4,
  "reps": "5-8",
  "rest": 150,
  "images": 0,
  "source": null
 },
 {
  "id": 201,
  "name": "Prensa horizontal",
  "muscle": "Cuádriceps",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "quadriceps"
  ],
  "secondary": [
   "glutes",
   "hamstrings"
  ],
  "cues": "Espalda baja pegada al respaldo.",
  "steps": [
   "Siéntate con los pies en la plataforma.",
   "Flexiona las rodillas hasta 90°.",
   "Empuja sin bloquear."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 90,
  "images": 0,
  "source": null
 },
 {
  "id": 202,
  "name": "Hip thrust en máquina",
  "muscle": "Glúteos",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "glutes"
  ],
  "secondary": [
   "hamstrings"
  ],
  "cues": "Pausa de 1 s arriba.",
  "steps": [
   "Apoya la espalda alta y coloca el cinturón sobre la cadera.",
   "Empuja con los talones hasta alinear el cuerpo.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "10",
  "rest": 90,
  "images": 0,
  "source": null
 },
 {
  "id": 203,
  "name": "Curl femoral de pie",
  "muscle": "Isquiotibiales",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "hamstrings"
  ],
  "secondary": [
   "calves"
  ],
  "cues": "Cadera fija contra el apoyo.",
  "steps": [
   "Coloca el talón bajo el rodillo.",
   "Flexiona la rodilla llevando el talón al glúteo.",
   "Baja lento y cambia."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 0,
  "source": null
 },
 {
  "id": 204,
  "name": "Jalón al pecho en Hammer",
  "muscle": "Espalda",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [
   "biceps",
   "middle back"
  ],
  "cues": "Cada brazo trabaja por separado.",
  "steps": [
   "Siéntate con los muslos fijos y toma los agarres.",
   "Tira hacia abajo llevando los codos a los costados.",
   "Sube controlando."
  ],
  "sets": 3,
  "reps": "10",
  "rest": 90,
  "images": 0,
  "source": null
 },
 {
  "id": 205,
  "name": "Remo bajo en Hammer",
  "muscle": "Espalda",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats",
   "middle back"
  ],
  "secondary": [
   "biceps"
  ],
  "cues": "Pecho apoyado y codos pegados.",
  "steps": [
   "Siéntate con el pecho contra el apoyo.",
   "Tira de los agarres hacia la cadera.",
   "Estira los brazos lento."
  ],
  "sets": 3,
  "reps": "10",
  "rest": 90,
  "images": 0,
  "source": null
 },
 {
  "id": 206,
  "name": "Remo con pecho apoyado en máquina",
  "muscle": "Espalda",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "middle back",
   "lats"
  ],
  "secondary": [
   "biceps",
   "shoulders"
  ],
  "cues": "No despegues el pecho.",
  "steps": [
   "Ajusta el asiento y apoya el pecho.",
   "Tira juntando las escápulas.",
   "Regresa controlando."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 75,
  "images": 0,
  "source": null
 },
 {
  "id": 207,
  "name": "Pullover en máquina",
  "muscle": "Espalda",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [
   "chest",
   "triceps"
  ],
  "cues": "Codos hacia abajo en arco.",
  "steps": [
   "Siéntate con los codos sobre los apoyos.",
   "Lleva los brazos hacia abajo en arco.",
   "Regresa lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 75,
  "images": 0,
  "source": null
 },
 {
  "id": 208,
  "name": "Remo Meadows",
  "muscle": "Espalda",
  "equipment": "Barra",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [
   "middle back",
   "biceps"
  ],
  "cues": "Codo hacia atrás y arriba.",
  "steps": [
   "Toma la punta de una barra anclada (landmine) con una mano.",
   "Tira hacia la cadera.",
   "Baja y cambia."
  ],
  "sets": 3,
  "reps": "10",
  "rest": 75,
  "images": 0,
  "source": null
 },
 {
  "id": 209,
  "name": "Remo Pendlay",
  "muscle": "Espalda",
  "equipment": "Barra",
  "level": "Avanzado",
  "type": "Fuerza",
  "primary": [
   "middle back",
   "lats"
  ],
  "secondary": [
   "biceps",
   "lower back"
  ],
  "cues": "La barra vuelve al piso en cada repetición.",
  "steps": [
   "Torso paralelo al piso y barra apoyada.",
   "Tira explosivo hacia el pecho bajo.",
   "Regresa la barra al piso."
  ],
  "sets": 4,
  "reps": "6",
  "rest": 120,
  "images": 0,
  "source": null
 },
 {
  "id": 210,
  "name": "Dominadas asistidas en máquina",
  "muscle": "Espalda",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "lats"
  ],
  "secondary": [
   "biceps",
   "middle back"
  ],
  "cues": "Usa la asistencia mínima posible.",
  "steps": [
   "Arrodíllate en la plataforma y toma la barra.",
   "Sube hasta pasar la barbilla.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "8-10",
  "rest": 90,
  "images": 0,
  "source": null
 },
 {
  "id": 211,
  "name": "Fondos asistidos en máquina",
  "muscle": "Tríceps",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "triceps"
  ],
  "secondary": [
   "chest",
   "shoulders"
  ],
  "cues": "Hombros abajo y atrás.",
  "steps": [
   "Arrodíllate en la plataforma y toma las paralelas.",
   "Baja hasta 90° en los codos.",
   "Empuja hasta arriba."
  ],
  "sets": 3,
  "reps": "10",
  "rest": 75,
  "images": 0,
  "source": null
 },
 {
  "id": 212,
  "name": "Elevaciones laterales en máquina",
  "muscle": "Hombros",
  "equipment": "Máquina",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "traps"
  ],
  "cues": "Sube con los codos.",
  "steps": [
   "Siéntate con los brazos contra los apoyos.",
   "Eleva los brazos a los lados.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12-15",
  "rest": 60,
  "images": 0,
  "source": null
 },
 {
  "id": 213,
  "name": "Press landmine",
  "muscle": "Hombros",
  "equipment": "Barra",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "chest",
   "triceps"
  ],
  "cues": "Amable con los hombros.",
  "steps": [
   "Sostén la punta de la barra anclada frente al hombro.",
   "Empuja hacia arriba y al frente.",
   "Baja controlando."
  ],
  "sets": 3,
  "reps": "10",
  "rest": 75,
  "images": 0,
  "source": null
 },
 {
  "id": 214,
  "name": "Elevación Y en banco inclinado",
  "muscle": "Hombros",
  "equipment": "Mancuernas",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "shoulders"
  ],
  "secondary": [
   "traps",
   "middle back"
  ],
  "cues": "Poco peso, pulgares arriba.",
  "steps": [
   "Boca abajo en un banco inclinado.",
   "Eleva los brazos formando una Y.",
   "Baja lento."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 0,
  "source": null
 },
 {
  "id": 215,
  "name": "Curl bayesiano en polea",
  "muscle": "Bíceps",
  "equipment": "Polea",
  "level": "Intermedio",
  "type": "Fuerza",
  "primary": [
   "biceps"
  ],
  "secondary": [
   "forearms"
  ],
  "cues": "Brazo detrás del cuerpo para estirar el bíceps.",
  "steps": [
   "De espaldas a la polea baja, toma el agarre.",
   "Flexiona el codo manteniéndolo atrás.",
   "Baja lento y cambia."
  ],
  "sets": 3,
  "reps": "12",
  "rest": 60,
  "images": 0,
  "source": null
 },
 {
  "id": 216,
  "name": "Press de pecho en Hammer agarre ancho",
  "muscle": "Pecho",
  "equipment": "Hammer Strength",
  "level": "Principiante",
  "type": "Fuerza",
  "primary": [
   "chest"
  ],
  "secondary": [
   "shoulders",
   "triceps"
  ],
  "cues": "Codos abiertos a unos 60°.",
  "steps": [
   "Toma los agarres anchos a la altura del pecho.",
   "Empuja al frente.",
   "Regresa estirando el pecho."
  ],
  "sets": 3,
  "reps": "10",
  "rest": 90,
  "images": 0,
  "source": null
 },
 {
  "id": 217,
  "name": "Plancha Copenhague",
  "muscle": "Abdomen",
  "equipment": "Peso corporal",
  "level": "Avanzado",
  "type": "Fuerza",
  "primary": [
   "adductors",
   "abdominals"
  ],
  "secondary": [],
  "cues": "Cuerpo en línea recta.",
  "steps": [
   "De lado, apoya el antebrazo y la pierna de arriba en un banco.",
   "Sube la cadera.",
   "Sostén el tiempo indicado."
  ],
  "sets": 3,
  "reps": "20 s",
  "rest": 45,
  "images": 0,
  "source": null
 }
];
