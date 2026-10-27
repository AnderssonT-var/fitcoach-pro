/* Plan de prueba de un asesorado.
   data.trial = { start, end, days, fee, status: "active" | "ended" | "converted" | "cancelled", convertedAt }
   data.routine      → la rutina que el asesorado ve (durante la prueba, la de prueba)
   data.planRoutine  → el plan completo que el entrenador deja listo; se activa al terminar la prueba */
import { knex, J, S } from "./db.js";
import { monthlyConcept, nowISO, uid } from "./util.js";
import { hasMonthly } from "./history.js";
import { notifyLater } from "./notify.js";
import { bump } from "./versions.js";

export const TRIAL_DAYS = [7, 14, 21, 30];

export const trialRunning = (t) => t?.status === "active" && Date.parse(t.end) > Date.now();

/** Pasa al plan completo: activa la rutina preparada, genera la primera mensualidad y avisa al asesorado. */
export async function convertTrial(trx, c, { auto = false } = {}) {
  const d = J(c.data, {});
  if (!d.trial || !["active", "ended"].includes(d.trial.status)) return false;
  const now = nowISO();
  if (d.planRoutine) { d.routine = d.planRoutine; d.planRoutine = null; }
  d.trial = { ...d.trial, status: "converted", convertedAt: now, ...(Date.parse(d.trial.end) > Date.now() ? { end: now } : {}) };
  await trx("clients").where({ user_id: c.user_id }).update({ data: S(d) });
  if (d.fee > 0) {
    if (!(await hasMonthly(trx, c.user_id))) {
      await trx("payments").insert({ id: uid("pay-"), coach_id: c.coach_id, client_id: c.user_id, concept: monthlyConcept(), amount: d.fee, due_date: now, paid_at: null, method: "" });
    }
  }
  const name = d.routine?.name ? `«${d.routine.name}»` : "tu plan completo";
  await trx("messages").insert({ id: uid("m-"), coach_id: c.coach_id, client_id: c.user_id, from_id: c.coach_id, read: false, at: now,
    text: auto
      ? `¡Terminó tu periodo de prueba! Desde hoy entrenas con ${name}. Vamos por tus objetivos 💪`
      : `¡Bienvenido/a al plan completo! Desde hoy entrenas con ${name}.` });
  notifyLater(c.user_id, { title: auto ? "¡Terminó tu prueba!" : "¡Bienvenido/a al plan completo!", body: `Desde hoy entrenas con ${name}.`, page: "rutina", kind: "trial" });
  return true;
}

/** Revisa pruebas vencidas: si el plan completo está listo se activa solo; si no, queda como «terminada» para que el entrenador decida. */
export async function settleTrials(rows) {
  let changed = false;
  for (const c of rows) {
    const d = J(c.data, {});
    if (d.trial?.status !== "active" || Date.parse(d.trial.end) > Date.now()) continue;
    let mine = false;
    await knex.transaction(async (trx) => {
      const fresh = await trx("clients").where({ user_id: c.user_id }).first();
      const fd = J(fresh.data, {});
      if (fd.trial?.status !== "active" || Date.parse(fd.trial.end) > Date.now()) return;
      if (fd.planRoutine) await convertTrial(trx, fresh, { auto: true });
      else {
        fd.trial = { ...fd.trial, status: "ended" };
        await trx("clients").where({ user_id: c.user_id }).update({ data: S(fd) });
      }
      changed = mine = true;
    });
    if (mine) await bump(`u:${c.user_id}`, `u:${c.coach_id}`, `c:${c.coach_id}`);
  }
  return changed;
}
