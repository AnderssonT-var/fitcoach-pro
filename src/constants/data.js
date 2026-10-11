export const EXERCISES_DB = [
  { id: 1,  name: "Press Banca",       muscle: "Pecho",           equipment: "Barra" },
  { id: 2,  name: "Sentadilla",        muscle: "Piernas",         equipment: "Barra" },
  { id: 3,  name: "Dominadas",         muscle: "Espalda",         equipment: "Barra fija" },
  { id: 4,  name: "Press Militar",     muscle: "Hombros",         equipment: "Barra" },
  { id: 5,  name: "Curl Bíceps",       muscle: "Bíceps",          equipment: "Mancuernas" },
  { id: 6,  name: "Triceps Polea",     muscle: "Tríceps",         equipment: "Polea" },
  { id: 7,  name: "Peso Muerto",       muscle: "Espalda/Piernas", equipment: "Barra" },
  { id: 8,  name: "Hip Thrust",        muscle: "Glúteos",         equipment: "Barra" },
  { id: 9,  name: "Remo con Barra",    muscle: "Espalda",         equipment: "Barra" },
  { id: 10, name: "Fondos Paralelas",  muscle: "Pecho/Tríceps",   equipment: "Paralelas" },
];

export const TEMPLATE_ROUTINES = [
  {
    id: 1, name: "Hipertrofia 5 días", days: 5, category: "Hipertrofia",
    exercises: [
      { exId: 1, sets: 4, reps: "8-10", rest: "90s",  notes: "" },
      { exId: 2, sets: 4, reps: "6-8",  rest: "120s", notes: "Bajar hasta paralelo" },
      { exId: 9, sets: 3, reps: "10-12",rest: "90s",  notes: "" },
    ],
  },
  {
    id: 2, name: "Fuerza Base 3 días", days: 3, category: "Powerlifting",
    exercises: [
      { exId: 7, sets: 5, reps: "5",  rest: "180s", notes: "Espalda recta" },
      { exId: 4, sets: 4, reps: "6",  rest: "120s", notes: "" },
    ],
  },
  {
    id: 3, name: "Cardio & Tono", days: 4, category: "Funcional",
    exercises: [
      { exId: 5, sets: 3, reps: "15", rest: "60s",  notes: "" },
      { exId: 8, sets: 4, reps: "12", rest: "90s",  notes: "" },
    ],
  },
];

export const initClients = [
  {
    id: 1, name: "Sofía López",  email: "sofia@mail.com", goal: "Hipertrofia",
    streak: 14, progress: 78, weight: 60, height: 162, active: true,
    routine: {
      name: "Push/Pull/Legs — Sofía", days: 5, category: "Hipertrofia",
      exercises: [
        { exId: 1, sets: 4, reps: "8-10", rest: "90s",  notes: "Arqueo controlado" },
        { exId: 2, sets: 4, reps: "6-8",  rest: "120s", notes: "" },
        { exId: 9, sets: 3, reps: "10-12",rest: "90s",  notes: "" },
      ],
    },
    payments: [
      { id: 1, concept: "Mensualidad Abril", amount: 800, date: "2026-04-01", status: "paid",    method: "Transferencia" },
      { id: 2, concept: "Mensualidad Mayo",  amount: 800, date: "2026-05-01", status: "pending", method: "" },
    ],
  },
  {
    id: 2, name: "Mario García", email: "mario@mail.com", goal: "Fuerza",
    streak: 7, progress: 45, weight: 85, height: 178, active: true,
    routine: {
      name: "Fuerza Base — Mario", days: 3, category: "Powerlifting",
      exercises: [
        { exId: 7, sets: 5, reps: "5", rest: "180s", notes: "PR objetivo: 140kg" },
        { exId: 4, sets: 4, reps: "6", rest: "120s", notes: "" },
      ],
    },
    payments: [
      { id: 1, concept: "Mensualidad Abril", amount: 700, date: "2026-04-01", status: "paid",    method: "Efectivo" },
      { id: 2, concept: "Mensualidad Mayo",  amount: 700, date: "2026-05-01", status: "overdue", method: "" },
    ],
  },
  {
    id: 3, name: "Valeria Cruz", email: "val@mail.com", goal: "Tonificación",
    streak: 21, progress: 92, weight: 55, height: 165, active: true,
    routine: null,
    payments: [
      { id: 1, concept: "Mensualidad Abril", amount: 650, date: "2026-04-01", status: "paid", method: "Tarjeta" },
    ],
  },
];

export const LICENSES = [
  { id: "LIC-001", coach: "Carlos Méndez", code: "FIT-X7K2-2026", issued: "2026-02-01", expires: "2026-08-01", status: "active"  },
  { id: "LIC-002", coach: "Ana Torres",    code: "FIT-M9P4-2026", issued: "2026-04-01", expires: "2026-05-01", status: "active"  },
  { id: "LIC-003", coach: "Diego Ruiz",    code: "FIT-Z3Q8-2026", issued: "2026-03-20", expires: "2026-04-20", status: "expired" },
];

export const NAV = {
  admin: [
    { id: "dashboard",   icon: "⚡",  label: "Dashboard" },
    { id: "licencias",   icon: "🔑",  label: "Licencias" },
    { id: "entrenadores",icon: "🏋️", label: "Entrenadores" },
  ],
  coach: [
    { id: "dashboard",  icon: "⚡",  label: "Dashboard" },
    { id: "clientes",   icon: "👥",  label: "Mis Clientes" },
    { id: "pagos",      icon: "💰",  label: "Control de Pagos" },
    { id: "ejercicios", icon: "💪",  label: "Ejercicios" },
    { id: "comunidad",  icon: "🌐",  label: "Comunidad" },
    { id: "chat",       icon: "💬",  label: "Mensajes" },
  ],
  user: [
    { id: "dashboard", icon: "⚡",  label: "Inicio" },
    { id: "rutina",    icon: "🏋️", label: "Mi Rutina" },
    { id: "progreso",  icon: "📈",  label: "Progreso" },
    { id: "comunidad", icon: "🌐",  label: "Comunidad" },
    { id: "chat",      icon: "💬",  label: "Mi Entrenador" },
  ],
};
