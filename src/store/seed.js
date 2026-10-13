/* ============================================================
   Datos de demostración. Todas las fechas son relativas a hoy,
   así el demo siempre se ve actual.
   ============================================================ */
import { DAY, addDays, addMonths, planPrice, startOfDay, weekStart } from "../lib/format";

export const EXERCISES = [
  { id: 1,  name: "Press banca",                 muscle: "Pecho",          equipment: "Barra",          cues: "Escápulas juntas y pies firmes. Baja la barra al esternón." },
  { id: 2,  name: "Sentadilla trasera",          muscle: "Piernas",        equipment: "Barra",          cues: "Rodillas siguen la punta del pie. Baja hasta el paralelo." },
  { id: 3,  name: "Dominadas",                   muscle: "Espalda",        equipment: "Peso corporal",  cues: "Pecho hacia la barra, sin balanceo." },
  { id: 4,  name: "Press militar",               muscle: "Hombros",        equipment: "Barra",          cues: "Glúteos apretados, la barra sube en línea recta." },
  { id: 5,  name: "Curl de bíceps",              muscle: "Brazos",         equipment: "Mancuernas",     cues: "Codos pegados, sin impulso con la espalda." },
  { id: 6,  name: "Extensión de tríceps en polea", muscle: "Brazos",       equipment: "Polea",          cues: "Codos fijos, extiende por completo." },
  { id: 7,  name: "Peso muerto",                 muscle: "Cadena posterior", equipment: "Barra",        cues: "Espalda neutra, empuja el piso con las piernas." },
  { id: 8,  name: "Hip thrust",                  muscle: "Glúteos",        equipment: "Barra",          cues: "Barbilla al pecho, pausa de 1 s arriba." },
  { id: 9,  name: "Remo con barra",              muscle: "Espalda",        equipment: "Barra",          cues: "Torso a 45°, lleva la barra al ombligo." },
  { id: 10, name: "Fondos en paralelas",         muscle: "Pecho",          equipment: "Peso corporal",  cues: "Inclínate un poco adelante, baja a 90°." },
  { id: 11, name: "Press inclinado con mancuernas", muscle: "Pecho",       equipment: "Mancuernas",     cues: "Banco a 30°, baja controlado." },
  { id: 12, name: "Jalón al pecho",              muscle: "Espalda",        equipment: "Polea",          cues: "Saca el pecho y lleva la barra a la clavícula." },
  { id: 13, name: "Elevaciones laterales",       muscle: "Hombros",        equipment: "Mancuernas",     cues: "Codos un poco flexionados, sube hasta los hombros." },
  { id: 14, name: "Peso muerto rumano",          muscle: "Isquiotibiales", equipment: "Barra",          cues: "Cadera atrás, la barra roza los muslos." },
  { id: 15, name: "Prensa de piernas",           muscle: "Piernas",        equipment: "Máquina",        cues: "No bloquees las rodillas arriba." },
  { id: 16, name: "Zancadas con mancuernas",     muscle: "Piernas",        equipment: "Mancuernas",     cues: "Paso largo, rodilla trasera casi al piso." },
  { id: 17, name: "Curl femoral",                muscle: "Isquiotibiales", equipment: "Máquina",        cues: "Baja en 3 segundos." },
  { id: 18, name: "Elevación de talones",        muscle: "Pantorrillas",   equipment: "Máquina",        cues: "Pausa abajo con estiramiento completo." },
  { id: 19, name: "Plancha",                     muscle: "Core",           equipment: "Peso corporal",  cues: "Cuerpo en línea recta, abdomen activo." },
  { id: 20, name: "Face pull",                   muscle: "Hombros",        equipment: "Polea",          cues: "Tira hacia la frente abriendo los codos." },
  { id: 21, name: "Remo con mancuerna",          muscle: "Espalda",        equipment: "Mancuernas",     cues: "Apoya rodilla y mano, codo hacia la cadera." },
  { id: 22, name: "Sentadilla goblet",           muscle: "Piernas",        equipment: "Mancuernas",     cues: "Mancuerna pegada al pecho, torso erguido." },
  { id: 23, name: "Rueda abdominal",             muscle: "Core",           equipment: "Accesorio",      cues: "No arquees la zona lumbar." },
  { id: 24, name: "Bicicleta estática",          muscle: "Cardio",         equipment: "Máquina",        cues: "Ritmo constante, puedes hablar sin ahogarte." },
].map((e) => ({ ...e, coachId: null }));

let n = 0;
const id = (p) => `${p}${++n}`;
const ex = (exId, sets, reps, rest, notes = "") => ({ uid: id("re"), exId, sets, reps, rest, notes });

function routineSofia() {
  return {
    name: "Torso / Pierna", goal: "Hipertrofia", frequency: 4,
    notes: "Alterna Torso y Pierna. Si completas todas las reps con buena técnica, sube 2.5 kg la próxima sesión.",
    days: [
      { id: "d-s-a", name: "Torso", exercises: [
        ex(1, 4, "8-10", 90, "Escápulas juntas, baja controlado"),
        ex(9, 4, "10", 90),
        ex(4, 3, "8-10", 90),
        ex(13, 3, "12-15", 60),
        ex(5, 3, "12", 60),
      ] },
      { id: "d-s-b", name: "Pierna", exercises: [
        ex(2, 4, "6-8", 150, "Profundidad: muslo paralelo al piso"),
        ex(14, 3, "10", 120),
        ex(8, 4, "10-12", 90, "Pausa de 1 s arriba"),
        ex(18, 3, "15", 60),
      ] },
    ],
  };
}
function routineMario() {
  return {
    name: "Fuerza 5×5", goal: "Fuerza", frequency: 3,
    notes: "Calienta con 2 series ligeras antes de la primera serie de trabajo.",
    days: [
      { id: "d-m-a", name: "Día A", exercises: [ex(2, 5, "5", 180), ex(1, 5, "5", 180), ex(9, 5, "5", 120)] },
      { id: "d-m-b", name: "Día B", exercises: [ex(2, 5, "5", 180), ex(4, 5, "5", 150), ex(7, 1, "5", 240, "Una sola serie pesada")] },
    ],
  };
}
function routineFull(name = "Full body") {
  return {
    name, goal: "Recomposición", frequency: 3, notes: "",
    days: [{ id: id("d-"), name: "Full body", exercises: [ex(22, 3, "12", 90), ex(11, 3, "10", 90), ex(12, 3, "12", 90), ex(16, 3, "10", 90), ex(6, 3, "15", 60)] }],
  };
}

/* ---- generador de sesiones con progresión de cargas ---- */
function buildSessions({ clientId, routine, weekdays, weeks, load, skipLastDays = 0, comments = {} }) {
  const out = [];
  const today = startOfDay(new Date());
  const monday = weekStart(today);
  const seen = {};
  let k = 0;
  for (let w = weeks; w >= 0; w--) {
    for (const wd of weekdays) {
      const day = addDays(monday, -w * 7 + wd);
      if (day >= today) continue;
      if (skipLastDays && (today - day) / DAY < skipLastDays) continue;
      const d = routine.days[k % routine.days.length];
      const start = new Date(day); start.setHours(18, 10 + ((k * 7) % 30), 0, 0);
      const dur = (48 + ((k * 7) % 19)) * 60;
      const extra = comments[k] || {};
      out.push({
        id: `w-${clientId}-${k}`, clientId, dayId: d.id, dayName: d.name, routineName: routine.name,
        startedAt: start.toISOString(), finishedAt: new Date(start.getTime() + dur * 1000).toISOString(),
        durationSec: dur, difficulty: extra.difficulty ?? 3, comment: extra.comment ?? "", prs: [],
        exercises: d.exercises.map((e) => {
          const L = load[e.exId] || { base: 10, step: 0, every: 99 };
          seen[e.exId] = (seen[e.exId] || 0) + 1;
          const weight = L.base + L.step * Math.floor((seen[e.exId] - 1) / L.every);
          const low = parseInt(e.reps, 10) || 8;
          return {
            exId: e.exId,
            target: { sets: e.sets, reps: e.reps, rest: e.rest },
            sets: Array.from({ length: e.sets }, (_, i) => ({
              weight, reps: Math.max(1, low + (i < 2 ? 1 : 0) - (i === e.sets - 1 && k % 3 === 0 ? 1 : 0)), done: true,
            })),
          };
        }),
      });
      k++;
    }
  }
  // Récords: marca los que superaron el mejor peso previo
  const best = {};
  out.forEach((s) => {
    s.exercises.forEach((e) => {
      const top = Math.max(...e.sets.map((x) => x.weight));
      if (best[e.exId] != null && top > best[e.exId]) s.prs.push({ exId: e.exId, weight: top, prev: best[e.exId] });
      best[e.exId] = Math.max(best[e.exId] ?? 0, top);
    });
  });
  return out;
}

export function buildSeed() {
  n = 0;
  const now = new Date();
  const today = startOfDay(now);
  const iso = (d) => new Date(d).toISOString();
  const daysAgo = (d, h = 10, m = 0) => { const x = addDays(today, -d); x.setHours(h, m, 0, 0); return iso(x); };

  /* ---------- usuarios ---------- */
  const users = [
    { id: 1,  role: "admin",  name: "Andrea Vélez",     email: "admin@fitcoach.com",  password: "admin123", createdAt: daysAgo(400) },
    { id: 2,  role: "coach",  name: "Carlos Méndez",    email: "carlos@fitcoach.com", password: "coach123", createdAt: daysAgo(160), phone: "098 765 4321", city: "Quito" },
    { id: 3,  role: "coach",  name: "Ana Torres",       email: "ana@fitcoach.com",    password: "coach123", createdAt: daysAgo(62),  phone: "099 112 2334", city: "Guayaquil" },
    { id: 4,  role: "coach",  name: "Diego Ruiz",       email: "diego@fitcoach.com",  password: "coach123", createdAt: daysAgo(115), phone: "097 554 1290", city: "Cuenca" },
    { id: 10, role: "client", name: "Sofía López",      email: "sofia@fitcoach.com",  password: "user123",  createdAt: daysAgo(48) },
    { id: 11, role: "client", name: "Mario García",     email: "mario@fitcoach.com",  password: "user123",  createdAt: daysAgo(40) },
    { id: 12, role: "client", name: "Valeria Cruz",     email: "valeria@fitcoach.com",password: "user123",  createdAt: daysAgo(3) },
    { id: 13, role: "client", name: "Daniel Paredes",   email: "daniel@fitcoach.com", password: "user123",  createdAt: daysAgo(70) },
    { id: 20, role: "client", name: "Lucía Benítez",    email: "lucia@fitcoach.com",  password: "user123",  createdAt: daysAgo(50) },
    { id: 21, role: "client", name: "Jorge Salas",      email: "jorge@fitcoach.com",  password: "user123",  createdAt: daysAgo(41) },
    { id: 22, role: "client", name: "Paula Ortiz",      email: "paula@fitcoach.com",  password: "user123",  createdAt: daysAgo(100) },
  ];

  /* ---------- licencias ---------- */
  const lic = (code, months, coachId, createdDaysAgo, activatedDaysAgo, extra = {}) => {
    const createdAt = daysAgo(createdDaysAgo, 9);
    const activatedAt = activatedDaysAgo != null ? daysAgo(activatedDaysAgo, 11) : null;
    return {
      id: id("lic-"), code, months, coachId, createdAt, activatedAt,
      expiresAt: activatedAt ? iso(addMonths(activatedAt, months)) : null,
      revoked: false, note: "",
      charges: [{ at: createdAt, amount: planPrice(months), months, kind: "venta" }],
      ...extra,
    };
  };
  const licenses = [
    lic("FIT-7K2M-Q4XA", 6, 2, 160, 158),
    lic("FIT-9PA4-HT3N", 12, 3, 62, 60),
    lic("FIT-Z3Q8-LM2D", 3, 4, 115, 112),
    lic("FIT-R8WD-6C2K", 3, null, 5, null, { note: "Para gimnasio Músculo Norte" }),
    lic("FIT-M5TE-J7YB", 1, null, 2, null),
  ];

  /* ---------- clientes ---------- */
  const clients = [
    { userId: 10, coachId: 2, goal: "Hipertrofia",   phone: "099 555 0101", heightCm: 162, fee: 60, billingDay: 15, active: true, routine: routineSofia(),
      weights: [61.8, 61.6, 61.5, 61.1, 61.0, 60.8, 60.4].map((v, i) => ({ date: daysAgo(43 - i * 7, 7), kg: v })) },
    { userId: 11, coachId: 2, goal: "Fuerza",        phone: "098 555 0202", heightCm: 178, fee: 55, billingDay: 5,  active: true, routine: routineMario(),
      weights: [84.0, 84.3, 84.4, 84.8, 85.2].map((v, i) => ({ date: daysAgo(36 - i * 7, 7), kg: v })) },
    { userId: 12, coachId: 2, goal: "Tonificación",  phone: "097 555 0303", heightCm: 165, fee: 50, billingDay: 1,  active: true, routine: null,
      weights: [{ date: daysAgo(3, 7), kg: 57.2 }] },
    { userId: 13, coachId: 2, goal: "Pérdida de grasa", phone: "096 555 0404", heightCm: 181, fee: 60, billingDay: 5, active: true, routine: routineFull("Recomposición full body"),
      weights: [92.0, 91.2, 90.6, 90.1, 89.5].map((v, i) => ({ date: daysAgo(63 - i * 10, 7), kg: v })) },
    { userId: 20, coachId: 3, goal: "Salud general", phone: "099 222 0505", heightCm: 158, fee: 45, billingDay: 10, active: true, routine: routineFull(), weights: [] },
    { userId: 21, coachId: 3, goal: "Hipertrofia",   phone: "098 222 0606", heightCm: 174, fee: 45, billingDay: 10, active: true, routine: routineFull(), weights: [] },
    { userId: 22, coachId: 4, goal: "Fuerza",        phone: "097 222 0707", heightCm: 170, fee: 50, billingDay: 1,  active: true, routine: null, weights: [] },
  ];
  clients.forEach((c) => { c.joinedAt = users.find((u) => u.id === c.userId).createdAt; });

  /* ---------- entrenamientos ---------- */
  const workouts = [
    ...buildSessions({
      clientId: 10, routine: clients[0].routine, weekdays: [0, 1, 3, 4], weeks: 5,
      load: { 1: { base: 30, step: 2.5, every: 3 }, 9: { base: 30, step: 2.5, every: 4 }, 4: { base: 20, step: 2.5, every: 4 },
              13: { base: 5, step: 1, every: 5 }, 5: { base: 8, step: 1, every: 5 }, 2: { base: 45, step: 2.5, every: 3 },
              14: { base: 35, step: 2.5, every: 4 }, 8: { base: 50, step: 5, every: 3 }, 18: { base: 40, step: 5, every: 5 } },
      comments: { 7: { difficulty: 4, comment: "La sentadilla se sintió pesada, dormí poco." },
                  12: { difficulty: 2, comment: "¡Subí peso en press banca!" },
                  19: { difficulty: 5, comment: "La última serie de sentadilla fue al límite. ¿Bajamos un poco?" } },
    }),
    ...buildSessions({
      clientId: 11, routine: clients[1].routine, weekdays: [0, 2, 4], weeks: 4,
      load: { 2: { base: 100, step: 2.5, every: 1 }, 1: { base: 70, step: 2.5, every: 2 }, 9: { base: 60, step: 2.5, every: 2 },
              4: { base: 45, step: 1.25, every: 2 }, 7: { base: 130, step: 5, every: 1 } },
      comments: { 9: { difficulty: 4, comment: "Primera vez con 120 kg en sentadilla." } },
    }),
    ...buildSessions({
      clientId: 13, routine: clients[3].routine, weekdays: [1, 3], weeks: 5, skipLastDays: 9,
      load: { 22: { base: 16, step: 2, every: 3 }, 11: { base: 14, step: 2, every: 3 }, 12: { base: 40, step: 5, every: 3 },
              16: { base: 10, step: 2, every: 3 }, 6: { base: 20, step: 2.5, every: 3 } },
    }),
    ...buildSessions({
      clientId: 20, routine: clients[4].routine, weekdays: [0, 3], weeks: 3,
      load: { 22: { base: 10, step: 2, every: 3 }, 11: { base: 8, step: 1, every: 3 }, 12: { base: 30, step: 5, every: 3 }, 16: { base: 6, step: 2, every: 3 }, 6: { base: 15, step: 2.5, every: 3 } },
    }),
    ...buildSessions({
      clientId: 21, routine: clients[5].routine, weekdays: [1, 4], weeks: 3,
      load: { 22: { base: 20, step: 2, every: 3 }, 11: { base: 18, step: 2, every: 3 }, 12: { base: 50, step: 5, every: 3 }, 16: { base: 14, step: 2, every: 3 }, 6: { base: 25, step: 2.5, every: 3 } },
    }),
  ];

  /* ---------- pagos ---------- */
  const payments = [];
  const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  clients.forEach((c) => {
    for (let back = 2; back >= 0; back--) {
      const due = new Date(today.getFullYear(), today.getMonth() - back, c.billingDay, 9);
      if (due < startOfDay(c.joinedAt) && back > 0) continue;
      const late = c.userId === 13 && back === 1;
      let paidAt = back > 0 ? iso(addDays(due, late ? 9 : -1)) : null;
      if (back === 0 && c.userId === 12) paidAt = daysAgo(3, 12);
      if (back === 0 && c.userId === 20) paidAt = daysAgo(4, 12);
      payments.push({
        id: id("pay-"), coachId: c.coachId, clientId: c.userId,
        concept: `Mensualidad ${MONTHS[due.getMonth()]}`, amount: c.fee, dueDate: iso(due),
        paidAt, method: paidAt ? ["Transferencia", "Efectivo", "Tarjeta"][c.userId % 3] : "",
      });
    }
  });

  /* ---------- mensajes ---------- */
  const msg = (coachId, clientId, from, text, at, read = true) => ({ id: id("m-"), coachId, clientId, from, text, at, read });
  const limitSession = workouts.find((w) => w.id === "w-10-19");
  const messages = [
    msg(2, 10, 2,  "Sofía, esta semana subimos 2.5 kg en press banca si completas las 10 reps.", daysAgo(4, 9, 12)),
    msg(2, 10, 10, "¡Va! El jueves lo intento", daysAgo(4, 9, 40)),
    msg(2, 10, 2,  "Recuerda calentar bien la cadera antes de pierna.", daysAgo(2, 8, 5)),
    msg(2, 10, 10, "Comentario del entrenamiento (Pierna): la última serie de sentadilla fue al límite. ¿Bajamos un poco?", limitSession?.finishedAt || daysAgo(4, 19), false),
    msg(2, 11, 2,  "Mario, tu mensualidad de este mes está pendiente. ¿Me confirmas cuando transfieras?", daysAgo(3, 17, 30)),
    msg(2, 11, 11, "Mañana sin falta, profe.", daysAgo(3, 18, 2)),
    msg(2, 13, 2,  "Daniel, ¿todo bien? Hace días que no registras entrenamientos.", daysAgo(2, 12, 15)),
    msg(2, 12, 2,  "¡Bienvenida, Valeria! Esta semana armo tu rutina según la evaluación.", daysAgo(3, 15, 0)),
    msg(2, 12, 12, "Gracias Carlos, quedo atenta.", daysAgo(3, 15, 20), false),
    msg(3, 20, 3,  "Lucía, excelente semana. Seguimos así.", daysAgo(5, 10)),
  ];

  /* ---------- comunidad ---------- */
  const posts = [
    { id: id("p-"), coachId: 2, authorId: 2, kind: "challenge", at: daysAgo(6, 8),
      text: "Reto de este mes: 14 entrenamientos registrados. Quien lo cumpla gana una sesión de técnica gratis.",
      likes: [10, 11, 13], comments: [
        { id: id("c-"), authorId: 10, text: "¡Dentro!", at: daysAgo(6, 9) },
        { id: id("c-"), authorId: 11, text: "Voy por ello.", at: daysAgo(6, 12) },
      ] },
    { id: id("p-"), coachId: 2, authorId: 11, kind: "post", at: daysAgo(5, 20),
      text: "Primera vez con 120 kg en sentadilla. Gracias por la paciencia con la técnica.",
      likes: [2, 10], comments: [{ id: id("c-"), authorId: 2, text: "Cada semana se ve mejor esa profundidad.", at: daysAgo(5, 21) }] },
    { id: id("p-"), coachId: 2, authorId: 2, kind: "post", at: daysAgo(2, 7),
      text: "Tip de la semana: duerme 7–8 horas. La fuerza que ganas en el gimnasio se construye descansando.",
      likes: [10], comments: [] },
    { id: id("p-"), coachId: 3, authorId: 3, kind: "post", at: daysAgo(3, 9), text: "Bienvenidos al grupo. Aquí compartimos logros y dudas.", likes: [20], comments: [] },
  ];

  /* ---------- plantillas ---------- */
  const templates = [
    { id: id("t-"), coachId: 2, createdAt: daysAgo(90), ...routineSofia(), name: "Torso / Pierna 4 días" },
    { id: id("t-"), coachId: 2, createdAt: daysAgo(80), ...routineFull("Full body principiante"), frequency: 3 },
    { id: id("t-"), coachId: 2, createdAt: daysAgo(70), ...routineMario(), name: "Fuerza 5×5 clásico" },
  ];

  /* ---------- actividad para el administrador ---------- */
  const activity = [
    { id: id("a-"), at: daysAgo(2, 9), kind: "license", text: "Se generó la licencia FIT-M5TE-J7YB (1 mes)" },
    { id: id("a-"), at: daysAgo(3, 15), kind: "client", text: "Carlos Méndez agregó a Valeria Cruz" },
    { id: id("a-"), at: daysAgo(5, 9), kind: "license", text: "Se generó la licencia FIT-R8WD-6C2K (3 meses)" },
    { id: id("a-"), at: daysAgo(20, 0), kind: "expired", text: "Venció la licencia de Diego Ruiz" },
    { id: id("a-"), at: daysAgo(60, 11), kind: "coach", text: "Ana Torres activó su licencia de 12 meses" },
  ];

  return {
    version: 2,
    users, licenses, clients, exercises: EXERCISES.map((e) => ({ ...e })),
    templates, payments, workouts, messages, posts, activity,
    active: {},
    sessionUserId: null,
    seededAt: iso(now),
  };
}
