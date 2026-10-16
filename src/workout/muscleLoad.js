import { exerciseById, workoutsOf } from "../store/db";
import { MUSCLES } from "../ui/MuscleMap";

/* Cuenta series por músculo: 1 por serie si es principal, 0,5 si es secundario. */
function addSets(acc, ex, n) {
  if (!n) return;
  (ex.primary || []).forEach((m) => { acc[m] = (acc[m] || 0) + n; });
  (ex.secondary || []).forEach((m) => { if (!(ex.primary || []).includes(m)) acc[m] = (acc[m] || 0) + n * 0.5; });
}

/** Series hechas por músculo en un entrenamiento. */
export function sessionMuscleSets(db, session) {
  const acc = {};
  (session?.exercises || []).forEach((e) => addSets(acc, exerciseById(db, e.exId), e.sets.filter((s) => s.done).length));
  return acc;
}

/** Series por músculo en los últimos `days` días y promedio semanal. */
export function muscleSets(db, clientId, days = 7) {
  const since = Date.now() - days * 864e5;
  const acc = {};
  let sessions = 0;
  workoutsOf(db, clientId).forEach((w) => {
    if (new Date(w.finishedAt).getTime() < since) return;
    sessions++;
    const s = sessionMuscleSets(db, w);
    Object.entries(s).forEach(([m, n]) => { acc[m] = (acc[m] || 0) + n; });
  });
  const weeks = days / 7;
  const perWeek = Object.fromEntries(Object.entries(acc).map(([m, n]) => [m, n / weeks]));
  return { total: acc, perWeek, sessions };
}

/** Series semanales que plantea una rutina (según su frecuencia). */
export function routineMuscleSets(db, routine) {
  const acc = {};
  if (!routine?.days?.length) return acc;
  const perWeek = (routine.frequency || routine.days.length) / routine.days.length;
  routine.days.forEach((d) => d.exercises.forEach((e) => addSets(acc, exerciseById(db, e.exId), (+e.sets || 0) * perWeek)));
  return acc;
}

/* Rangos de series semanales (guía habitual: 10–20 por músculo para hipertrofia). */
export const WEEK_LEVELS = [
  { lv: 1, label: "1–5", max: 5.5 },
  { lv: 2, label: "6–9", max: 9.5 },
  { lv: 3, label: "10–20", max: 20.5 },
  { lv: 4, label: "Más de 20", max: Infinity },
];
export function weekLevel(n) {
  if (!n || n < 0.5) return 0;
  return WEEK_LEVELS.find((l) => n <= l.max).lv;
}
/* Para un solo entrenamiento */
export const SESSION_LEVELS = [
  { lv: 1, label: "1–2", max: 2.5 }, { lv: 2, label: "3–5", max: 5.5 },
  { lv: 3, label: "6–9", max: 9.5 }, { lv: 4, label: "10+", max: Infinity },
];
export function sessionLevel(n) {
  if (!n || n < 0.5) return 0;
  return SESSION_LEVELS.find((l) => n <= l.max).lv;
}

export const toHeat = (sets, fn) => Object.fromEntries(Object.entries(sets).map(([m, n]) => [m, fn(n)]));
export const fmtSets = (n) => {
  const r = Math.round(n * 2) / 2;
  return `${String(r).replace(".", ",")} ${r === 1 ? "serie" : "series"}`;
};

/** Músculos grandes que conviene no dejar en cero. */
export const KEY_MUSCLES = ["chest", "lats", "shoulders", "quadriceps", "hamstrings", "glutes", "biceps", "triceps", "abdominals", "calves"];
export const orderedMuscles = (sets) => MUSCLES.filter((m) => sets[m] > 0).sort((a, b) => sets[b] - sets[a]);
