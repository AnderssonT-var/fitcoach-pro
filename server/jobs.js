/* Tareas programadas: corren cada 5 minutos dentro del servidor y también cuando se llama a
   /api/cron (por ejemplo desde un cron de Hostinger o GitHub Actions). Varios procesos pueden
   correrlas a la vez: `once()` asegura que cada aviso salga una sola vez. */
import { knex, J } from "./db.js";
import { notify, once } from "./notify.js";
import { settleTrials } from "./trial.js";

const DAY = 864e5;
const first = (n) => String(n || "").split(" ")[0];
const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const money = (v) => `$${(+v).toFixed(2).replace(/\.00$/, "")}`;
const quiet = (d = new Date()) => d.getHours() < 8 || d.getHours() >= 21; // sin avisos de noche

let running = false;
export async function runJobs() {
  if (running) return { skipped: true };
  running = true;
  const out = { reminders: 0, payments: 0, trials: 0, licenses: 0 };
  try {
    const clients = await knex("clients").where({ active: true });
    await settleTrials(clients); // pruebas vencidas pasan al plan completo aunque nadie abra la app
    if (!quiet()) {
      out.reminders = await reminders(clients);
      out.payments = await payments();
      out.trials = await trials();
      out.licenses = await licenses();
    }
  } catch (e) { console.error("[jobs]", e.message); out.error = e.message; }
  finally { running = false; }
  return out;
}

/* «Hoy te toca entrenar» a la hora que eligió el asesorado, si aún no entrenó hoy */
async function reminders(clients) {
  const now = new Date(), today = ymd(now), dow = now.getDay();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const ids = clients.map((c) => c.user_id);
  if (!ids.length) return 0;
  const users = await knex("users").whereIn("id", ids).select("id", "name", "profile");
  let n = 0;
  for (const u of users) {
    const r = J(u.profile, {}).notif?.reminder;
    if (!r?.on || !Array.isArray(r.days) || !r.days.includes(dow) || !r.time || hhmm < r.time) continue;
    const c = clients.find((x) => x.user_id === u.id);
    const routine = J(c.data, {}).routine;
    if (!routine) continue;
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    if (await knex("workouts").where({ client_id: u.id }).where("finished_at", ">=", startToday).first()) continue;
    if (!(await once(`remind:${u.id}:${today}`))) continue;
    await notify(u.id, { title: `${first(u.name)}, hoy toca entrenar 💪`, body: `Tu rutina «${routine.name || "de hoy"}» te espera. ¡Vamos!`, page: "inicio", tag: "remind", kind: "remind" });
    n++;
  }
  return n;
}

/* Pagos: aviso al asesorado un día antes y al vencer; al entrenador, un resumen de lo que venció */
async function payments() {
  const now = Date.now();
  const soon = await knex("payments").whereNull("paid_at")
    .where("due_date", ">", new Date(now).toISOString()).where("due_date", "<=", new Date(now + DAY).toISOString());
  let n = 0;
  for (const p of soon) {
    if (!(await once(`pay-due:${p.id}`))) continue;
    await notify(p.client_id, { title: "Tu pago vence mañana", body: `${p.concept}: ${money(p.amount)}. Coordina el pago con tu entrenador.`, page: "pagos", tag: `pay-${p.id}`, kind: "payment" });
    n++;
  }
  const over = await knex("payments").whereNull("paid_at")
    .where("due_date", "<=", new Date(now).toISOString()).where("due_date", ">", new Date(now - 3 * DAY).toISOString());
  const byCoach = new Map();
  for (const p of over) {
    if (await once(`pay-over:${p.id}`)) {
      await notify(p.client_id, { title: "Tienes un pago vencido", body: `${p.concept}: ${money(p.amount)}. Escríbele a tu entrenador para ponerte al día.`, page: "pagos", tag: `pay-${p.id}`, kind: "payment" });
      n++;
    }
    if (await once(`coach-over:${p.id}`)) (byCoach.get(p.coach_id) || byCoach.set(p.coach_id, []).get(p.coach_id)).push(p);
  }
  for (const [coachId, list] of byCoach) {
    const names = await knex("users").whereIn("id", list.map((p) => p.client_id)).select("id", "name");
    const who = list.map((p) => `${first(names.find((u) => u.id === p.client_id)?.name)} (${money(p.amount)})`).join(", ");
    await notify(coachId, { title: list.length === 1 ? "Venció un pago" : `Vencieron ${list.length} pagos`, body: who, page: "pagos", tag: "coach-over", kind: "payment" });
  }
  return n;
}

/* Plan de prueba: aviso 3 días antes (a los dos) y al entrenador si terminó sin plan completo */
async function trials() {
  const rows = await knex("clients").where({ active: true });
  let n = 0;
  for (const c of rows) {
    const d = J(c.data, {}), t = d.trial;
    if (!t || !["active", "ended"].includes(t.status)) continue;
    const left = Math.ceil((Date.parse(t.end) - Date.now()) / DAY);
    const u = await knex("users").where({ id: c.user_id }).select("name").first();
    if (t.status === "active" && left > 0 && left <= 3 && (await once(`trial3:${c.user_id}:${t.end}`))) {
      await notify(c.user_id, { title: `Te quedan ${left} ${left === 1 ? "día" : "días"} de prueba`, body: "Al terminar pasas a tu plan completo, armado para tus objetivos.", page: "inicio", kind: "trial" });
      await notify(c.coach_id, { title: `La prueba de ${first(u?.name)} termina en ${left} ${left === 1 ? "día" : "días"}`,
        body: d.planRoutine ? "Su plan completo ya está listo: se activará solo." : "Prepara su plan completo para que se active solo.", page: "clientes", params: { id: c.user_id }, kind: "trial" });
      n++;
    }
    if (t.status === "ended" && (await once(`trial-ended:${c.user_id}:${t.end}`))) {
      await notify(c.coach_id, { title: `Terminó la prueba de ${first(u?.name)}`, body: "Decide si pasa al plan completo, extiendes la prueba o no continúa.", page: "clientes", params: { id: c.user_id }, kind: "trial" });
      n++;
    }
  }
  return n;
}

/* Licencia del entrenador: aviso 7 días antes de vencer */
async function licenses() {
  const now = Date.now();
  const rows = await knex("licenses").whereNotNull("coach_id").where({ revoked: false })
    .where("expires_at", ">", new Date(now).toISOString()).where("expires_at", "<=", new Date(now + 7 * DAY).toISOString());
  let n = 0;
  for (const l of rows) {
    // solo si es su licencia más lejana (no la avisa si ya renovó)
    const later = await knex("licenses").where({ coach_id: l.coach_id, revoked: false }).where("expires_at", ">", l.expires_at).first();
    if (later || !(await once(`lic7:${l.id}:${l.expires_at}`))) continue;
    const days = Math.ceil((Date.parse(l.expires_at) - now) / DAY);
    await notify(l.coach_id, { title: `Tu licencia vence en ${days} ${days === 1 ? "día" : "días"}`, body: "Renuévala en Suscripción para que tus asesorados no pierdan el acceso.", page: "suscripcion", kind: "license" });
    n++;
  }
  return n;
}
