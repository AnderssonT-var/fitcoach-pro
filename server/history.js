/* Historial de entrenamientos: los entrenamientos terminados no cambian,
   así que se resumen una vez y se guardan en memoria. Los récords de todos
   los tiempos se guardan en el asesorado para no recorrer todo el historial. */
import { knex, J, S } from "./db.js";

export const FULL_DAYS = 120;   // detalle completo (series) de los últimos 4 meses
export const SUMMARY_DAYS = 430; // resumen (fecha, volumen, series) para rachas y listados

const cache = new Map();
const MAX_CACHE = 50000;
const remember = (id, v) => { if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value); cache.set(id, v); return v; };

const setVol = (x) => (x.done ? (+x.weight || 0) * (+x.reps || 0) : 0) + (x.drops || []).reduce((t, d) => t + (+d.weight || 0) * (+d.reps || 0), 0);
export function summarize(row) {
  const hit = cache.get(row.id);
  if (hit) return hit;
  const d = J(row.data, {});
  const ex = d.exercises || [];
  return remember(row.id, {
    id: row.id, clientId: row.client_id, finishedAt: row.finished_at, summary: true, exercises: [],
    dayName: d.dayName, routineName: d.routineName, durationSec: d.durationSec || 0, difficulty: d.difficulty, comment: d.comment || "", prs: d.prs || [],
    vol: ex.reduce((t, e) => t + (e.sets || []).reduce((a, x) => a + setVol(x), 0), 0),
    setCount: ex.reduce((t, e) => t + (e.sets || []).filter((x) => x.done).length, 0),
  });
}

/** Entrenamientos de uno o varios asesorados: completos los recientes, resumidos los anteriores. */
export async function historyFor(where) {
  const now = Date.now();
  const fullFrom = new Date(now - FULL_DAYS * 864e5).toISOString();
  const sumFrom = new Date(now - SUMMARY_DAYS * 864e5).toISOString();
  const recent = await where(knex("workouts")).where("finished_at", ">=", fullFrom);
  const older = await where(knex("workouts")).where("finished_at", ">=", sumFrom).where("finished_at", "<", fullFrom).select("id", "client_id", "finished_at");
  const missing = older.filter((r) => !cache.has(r.id)).map((r) => r.id);
  for (let i = 0; i < missing.length; i += 500) {
    for (const r of await knex("workouts").whereIn("id", missing.slice(i, i + 500))) summarize(r);
  }
  return [
    ...recent.map((w) => ({ ...J(w.data, {}), id: w.id, clientId: w.client_id, finishedAt: w.finished_at })),
    ...older.map((r) => cache.get(r.id)).filter(Boolean),
  ];
}

/* ---------- récords de todos los tiempos ---------- */
/** Actualiza récords con un entrenamiento: { [exId]: { w, r, at, first } } */
export function addToBests(bests, w) {
  for (const e of w.exercises || []) {
    const done = (e.sets || []).filter((x) => x.done && +x.reps > 0);
    if (!done.length) continue;
    const top = done.reduce((b, x) => (+x.weight > b.w || (+x.weight === b.w && +x.reps > b.r) ? { w: +x.weight, r: +x.reps } : b), { w: -1, r: 0 });
    const cur = bests[e.exId];
    if (!cur) bests[e.exId] = { ...top, at: w.finishedAt, first: top.w };
    else if (top.w > cur.w || (top.w === cur.w && top.r > cur.r)) bests[e.exId] = { ...cur, ...top, at: w.finishedAt };
  }
  return bests;
}

/** Calcula los récords de asesorados que aún no los tienen (una sola vez por asesorado). */
export async function backfillBests(rows) {
  let changed = false;
  for (const c of rows) {
    const d = J(c.data, {});
    if (d.bests) continue;
    const ws = await knex("workouts").where({ client_id: c.user_id }).orderBy("finished_at", "asc");
    const bests = {};
    for (const w of ws) addToBests(bests, { ...J(w.data, {}), finishedAt: w.finished_at });
    const fresh = J((await knex("clients").where({ user_id: c.user_id }).first())?.data, {});
    if (fresh.bests) continue;
    await knex("clients").where({ user_id: c.user_id }).update({ data: S({ ...fresh, bests }) });
    changed = true;
  }
  return changed;
}

/** ¿Ya tiene una mensualidad con vencimiento en ese mes? (evita cobros duplicados) */
export async function hasMonthly(trx, clientId, date = new Date()) {
  const from = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString();
  return !!(await trx("payments").where({ client_id: clientId }).where("concept", "like", "Mensualidad%")
    .where("due_date", ">=", from).where("due_date", "<", to).first());
}
