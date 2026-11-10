/* Progreso por grupo muscular → cuánto "crece" el personaje.
   Se usa en la web y en la página que muestra la app Android (mismo cálculo en ambos).
   - Fuerza: cuánto subió el peso máximo de cada ejercicio desde la primera vez (récords).
   - Constancia: cuántos entrenamientos trabajaron ese músculo.
   Cada músculo va de 0 (recién empieza) a 1 (desarrollo máximo del personaje). */

export const GROUPS = [
  ["chest", "Pecho"], ["back", "Espalda"], ["shoulders", "Hombros"], ["biceps", "Bíceps"], ["triceps", "Tríceps"],
  ["forearms", "Antebrazos"], ["abs", "Abdomen"], ["quads", "Cuádriceps"], ["hams", "Femorales"], ["glutes", "Glúteos"], ["calves", "Pantorrillas"],
];

const BY_MUSCLE = {
  Pecho: ["chest"], Espalda: ["back"], Hombros: ["shoulders"], "Bíceps": ["biceps"], "Tríceps": ["triceps"], Antebrazos: ["forearms"],
  Abdomen: ["abs"], "Cuádriceps": ["quads"], Isquiotibiales: ["hams"], "Glúteos": ["glutes"], Pantorrillas: ["calves"],
  "Cuerpo completo": ["quads", "glutes", "back", "shoulders", "abs"],
};
export const groupsOf = (muscle) => BY_MUSCLE[muscle] || [];

const clamp = (v) => Math.max(0, Math.min(1, v));

/**
 * @param bests     { [exId]: { w, first } }  récords del asesorado
 * @param workouts  lista de entrenamientos (cada uno con exercises[].exId)
 * @param muscleOf  (exId) => nombre del músculo ("Pecho", "Espalda", …)
 */
export function computeProgress({ bests = {}, workouts = [], muscleOf }) {
  const gains = {}, sessions = {};
  for (const [g] of GROUPS) { gains[g] = []; sessions[g] = 0; }
  for (const [id, b] of Object.entries(bests || {})) {
    const gs = groupsOf(muscleOf(+id));
    if (!gs.length || !(b?.w > 0)) continue;
    const first = Math.max(+b.first || 0, 0);
    const gain = first > 0 ? Math.max(0, (b.w - first) / first) : 0;
    for (const g of gs) gains[g].push(Math.min(gain, 1.5));
  }
  for (const w of workouts) {
    const seen = new Set();
    for (const e of w.exercises || []) for (const g of groupsOf(muscleOf(+e.exId))) seen.add(g);
    for (const g of seen) sessions[g]++;
  }
  const groups = {};
  let sum = 0;
  for (const [g, label] of GROUPS) {
    const arr = gains[g].sort((a, b) => b - a).slice(0, 4);
    const gain = arr.length ? arr.reduce((t, v) => t + v, 0) / arr.length : 0;
    // 75 % de mejora de fuerza o 30 sesiones de constancia llenan cada parte
    const level = clamp(0.65 * clamp(gain / 0.75) + 0.35 * clamp(sessions[g] / 30));
    groups[g] = { label, level, gain, sessions: sessions[g] };
    sum += level;
  }
  const avg = sum / GROUPS.length;
  const total = workouts.length;
  // Nivel 1–50: mezcla del desarrollo promedio y la constancia general
  const raw = 1 + 49 * clamp(0.75 * avg + 0.25 * clamp(total / 120));
  const level = Math.floor(raw);
  return { groups, avg, level, next: raw - level, total, title: titleFor(level) };
}

export function titleFor(level) {
  if (level >= 40) return "Leyenda";
  if (level >= 30) return "Élite";
  if (level >= 20) return "Avanzado";
  if (level >= 10) return "Intermedio";
  return "Principiante";
}

export const SKINS = ["#f6d7c3", "#eac0a0", "#d8a27c", "#b97f57", "#8d5a3b", "#5e3b26"];
export const HAIR_COLORS = ["#1b1410", "#3b2516", "#6b4425", "#a8743f", "#d9b56d", "#b3332e", "#9aa0a6", "#f2f2f2"];
export const CLOTH_COLORS = ["#5856d6", "#007aff", "#34c759", "#ff3b30", "#ff9500", "#1c1c1e", "#f2f2f7", "#af52de", "#ff2d55", "#30b0c7"];
export const HAIR_STYLES = { m: [["corto", "Corto"], ["rapado", "Rapado"], ["rizado", "Rizado"], ["calvo", "Calvo"], ["largo", "Largo"]], f: [["coleta", "Coleta"], ["largo", "Largo"], ["mono", "Moño"], ["corto", "Corto"], ["rizado", "Rizado"]] };
export const OUTFITS = { m: [["tank", "Esqueleto"], ["tee", "Camiseta"], ["none", "Sin camiseta"]], f: [["top", "Top deportivo"], ["tank", "Esqueleto"], ["tee", "Camiseta"]] };

export function defaultStyle(body = "m") {
  const f = body === "f";
  return { body: f ? "f" : "m", skin: SKINS[2], hair: f ? "coleta" : "corto", hairColor: HAIR_COLORS[1], outfit: f ? "top" : "tank",
    top: f ? "#ff2d55" : "#5856d6", bottom: "#1c1c1e", shoes: "#f2f2f7", name: "" };
}

/** Completa un estilo guardado con los valores por defecto (y corrige combinaciones inválidas). */
export function normalizeStyle(s, body) {
  const base = defaultStyle(s?.body || body);
  const out = { ...base, ...(s || {}) };
  if (!HAIR_STYLES[out.body].some(([k]) => k === out.hair)) out.hair = base.hair;
  if (!OUTFITS[out.body].some(([k]) => k === out.outfit)) out.outfit = base.outfit;
  return out;
}
