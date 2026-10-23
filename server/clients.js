/* Alta de un asesorado: la usan el entrenador (Nuevo cliente) y la inscripción desde su enlace. */
import { S } from "./db.js";
import { config } from "./config.js";
import { monthlyConcept, nowISO, uid } from "./util.js";

export const trialConcept = (days) => (days === 30 ? "Mes de prueba" : `Plan de prueba (${days} días)`);
export function newTrial({ days, fee }) {
  const start = new Date();
  return { start: start.toISOString(), end: new Date(start.getTime() + days * 864e5).toISOString(), days, fee: fee || 0, status: "active", convertedAt: null };
}

/** Copia una rutina con ids nuevos (para asignar una plantilla). */
export function cloneRoutine(r, name) {
  const id = () => uid("re-");
  return { ...r, ...(name ? { name } : {}), days: (r.days || []).map((d) => ({ ...d, id: id(), exercises: (d.exercises || []).map((e) => ({ ...e, uid: id() })) })) };
}

/**
 * Crea usuario + ficha + primer cobro + mensaje de bienvenida dentro de una transacción.
 * a: { coach, name, email, passwordHash, mustChange, consent, photoConsent, phone, goal, fee, height, weight, trial, routine, welcome }
 */
export async function insertClient(trx, a) {
  const now = nowISO();
  const [id] = await trx("users").insert({ role: "client", email: a.email, password_hash: a.passwordHash, name: a.name,
    profile: S({ body: "m", ...(a.phone ? { phone: a.phone } : {}) }), must_change_password: !!a.mustChange, created_at: now,
    ...(a.consent ? { consent_version: config.legalVersion, consent_at: now, photo_consent: !!a.photoConsent } : {}) });
  const userId = typeof id === "object" ? id.id : id;
  await trx("clients").insert({ user_id: userId, coach_id: a.coach.id, active: true, data: S({
    goal: a.goal || "", phone: a.phone || "", heightCm: a.height || null, fee: a.fee || 0, billingDay: Math.min(new Date().getDate(), 28),
    routine: a.routine || null, planRoutine: null, joinedAt: now, weights: a.weight ? [{ date: now, kg: a.weight }] : [],
    ...(a.trial ? { trial: newTrial(a.trial) } : {}),
    measurements: a.weight ? [{ id: uid("ms-"), date: now, weight: a.weight, note: "Medición inicial" }] : [], notes: [],
  }) });
  // Con prueba se cobra la prueba; la mensualidad empieza al pasar al plan completo
  if (a.trial) {
    if (a.trial.fee > 0) await trx("payments").insert({ id: uid("pay-"), coach_id: a.coach.id, client_id: userId, concept: trialConcept(a.trial.days), amount: a.trial.fee, due_date: now, paid_at: null, method: "" });
  } else if (a.fee > 0) {
    await trx("payments").insert({ id: uid("pay-"), coach_id: a.coach.id, client_id: userId, concept: monthlyConcept(), amount: a.fee, due_date: now, paid_at: null, method: "" });
  }
  await trx("messages").insert({ id: uid("m-"), coach_id: a.coach.id, client_id: userId, from_id: a.coach.id, read: false, at: now,
    text: a.welcome || `¡Hola ${a.name.split(" ")[0]}! Bienvenido/a. Aquí verás tu rutina y podrás registrar cada entrenamiento.` });
  return userId;
}
