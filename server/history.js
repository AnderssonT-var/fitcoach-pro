/* Historial de entrenamientos: los entrenamientos terminados no cambian,
   así que se resumen una vez y se guardan en memoria. Los récords de todos
   los tiempos se guardan en el asesorado para no recorrer todo el historial. */
import { knex, J, S } from "./db.js";
import { bump } from "./versions.js";

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
    const done = (e.sets || []).filter((x) => x.done && +x.reps > 0 && x.kind !== "w");
    if (!done.length) continue;
    const top = done.reduce((b, x) => (+x.weight > b.w || (+x.weight === b.w && +x.reps > b.r) ? { w: +x.weight, r: +x.reps } : b), { w: -1, r: 0 });
    const cur = bests[e.exId];
    if (!cur) bests[e.exId] = { ...top, at: w.finishedAt, first: top.w };
    else if (top.w > cur.w || (top.w === cur.w && top.r > cur.r)) bests[e.exId] = { ...cur, ...top, at: w.finishedAt };
  }
  return bests;
}

/**
 * Corrige un récord mal escrito (p. ej. 605 kg en vez de 60): cambia las series con ese peso
 * en el historial del ejercicio y vuelve a calcular los récords desde los entrenamientos.
 */
export async function correctBest(clientId, exId, weight, reps) {
  exId = +exId;
  const row = await knex("clients").where({ user_id: clientId }).first();
  if (!row) return null;
  const d = J(row.data, {});
  const cur = d.bests?.[exId];
  const rows = await knex("workouts").where({ client_id: clientId }).orderBy("finished_at", "asc");
  const ws = rows.map((w) => ({ row: w, data: J(w.data, {}) }));
  let fixed = 0;
  if (cur && cur.w > 0) {
    for (const w of ws) {
      let changed = false;
      for (const e of w.data.exercises || []) {
        if (+e.exId !== exId) continue;
        for (const x of e.sets || []) {
          if (+x.weight !== +cur.w) continue;
          x.weight = weight;
          if (reps && +x.reps === +cur.r) x.reps = reps;
          changed = true;
        }
      }
      if (!changed) continue;
      // El aviso de récord de ese entrenamiento también se corrige (o se quita si ya no lo es)
      w.data.prs = (w.data.prs || []).map((p) => (+p.exId === exId && +p.weight === +cur.w ? { ...p, weight } : p)).filter((p) => !(+p.exId === exId && p.weight <= p.prev));
      await knex("workouts").where({ id: w.row.id }).update({ data: S(w.data) });
      cache.delete(w.row.id);
      fixed++;
    }
  }
  const bests = {};
  for (const w of ws) addToBests(bests, { ...w.data, finishedAt: w.row.finished_at });
  // Récords sin entrenamientos detrás (cargados a mano) se conservan
  for (const [k, v] of Object.entries(d.bests || {})) if (!bests[k]) bests[k] = v;
  if (!fixed) {
    const b = bests[exId] || cur || {};
    bests[exId] = { ...b, w: weight, r: reps || b.r || 1, at: b.at || new Date().toISOString(), first: Math.min(b.first ?? weight, weight) };
  }
  const fresh = J((await knex("clients").where({ user_id: clientId }).first()).data, {});
  await knex("clients").where({ user_id: clientId }).update({ data: S({ ...fresh, bests }) });
  await bump(`u:${clientId}`, `u:${row.coach_id}`, `c:${row.coach_id}`, `w:${row.coach_id}`);
  return { fixed, best: bests[exId] || null };
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
    await bump(`u:${c.user_id}`, `u:${c.coach_id}`);
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
