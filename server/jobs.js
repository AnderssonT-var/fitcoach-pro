/* Tareas programadas: corren cada 5 minutos dentro del servidor y también cuando se llama a
   /api/cron (por ejemplo desde un cron de Hostinger o GitHub Actions). Varios procesos pueden
   correrlas a la vez: `once()` asegura que cada aviso salga una sola vez. */
import { knex, J, S } from "./db.js";
import { notify, once } from "./notify.js";
import { settleTrials } from "./trial.js";
import { phaseIndexAt, rulesOf } from "./coaching.js";

const DAY = 864e5;
const first = (n) => String(n || "").split(" ")[0];
const money = (v) => `$${(+v).toFixed(2).replace(/\.00$/, "")}`;
// Sin avisos de noche (hora de Ecuador o la de APP_TZ); los recordatorios usan la hora de cada asesorado
const quiet = (d = new Date()) => { const h = +new Intl.DateTimeFormat("en-US", { timeZone: process.env.APP_TZ || "America/Guayaquil", hour: "2-digit", hourCycle: "h23" }).format(d); return h < 6 || h >= 22; };

let running = false;
export async function runJobs() {
  if (running) return { skipped: true };
  running = true;
  const out = { reminders: 0, payments: 0, trials: 0, licenses: 0, coaching: 0 };
  try {
    const clients = await knex("clients").where({ active: true });
    await settleTrials(clients); // pruebas vencidas pasan al plan completo aunque nadie abra la app
    if (!quiet()) {
      out.reminders = await reminders(clients);
      out.payments = await payments();
      out.trials = await trials();
      out.licenses = await licenses();
      out.coaching = await coaching(clients);
    }
  } catch (e) { console.error("[jobs]", e.message); out.error = e.message; }
  finally { running = false; }
  return out;
}

/** Fecha y hora locales del asesorado (zona de su equipo; si no hay, Ecuador). */
const DEFAULT_TZ = process.env.APP_TZ || "America/Guayaquil";
function localNow(r, now = new Date()) {
  const fromParts = (tz) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
      .formatToParts(now).map((x) => [x.type, x.value]));
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    return { day: `${p.year}-${p.month}-${p.day}`, dow, hhmm: `${p.hour}:${p.minute}`, hour: +p.hour, offMin: null, tz };
  };
  if (r?.tz) { try { return fromParts(r.tz); } catch { /* zona desconocida */ } }
  if (Number.isFinite(r?.off)) {
    const d = new Date(now.getTime() + r.off * 60e3);
    return { day: d.toISOString().slice(0, 10), dow: d.getUTCDay(), hhmm: d.toISOString().slice(11, 16), hour: d.getUTCHours(), offMin: r.off };
  }
  return fromParts(DEFAULT_TZ);
}
/** Inicio del día local (como instante UTC) para buscar si ya entrenó hoy. */
function localDayStart(l, now = new Date()) {
  const [h, m] = l.hhmm.split(":").map(Number);
  const t = new Date(now); t.setUTCSeconds(0, 0);
  return new Date(t.getTime() - (h * 60 + m) * 60e3).toISOString();
}

/* «Hoy te toca entrenar» a la hora y el día locales que eligió el asesorado, si aún no entrenó hoy */
async function reminders(clients) {
  const now = new Date();
  const ids = clients.map((c) => c.user_id);
  if (!ids.length) return 0;
  const users = await knex("users").whereIn("id", ids).select("id", "name", "profile");
  let n = 0;
  for (const u of users) {
    const r = J(u.profile, {}).notif?.reminder;
    if (!r?.on || !Array.isArray(r.days) || !r.time) continue;
    const l = localNow(r, now);
    if (!r.days.includes(l.dow) || l.hhmm < r.time || l.hour >= 22) continue;
    const today = l.day;
    const c = clients.find((x) => x.user_id === u.id);
    const routine = J(c.data, {}).routine;
    if (!routine) continue;
    const startToday = localDayStart(l, now);
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

/* Automatizaciones del entrenador: check-in semanal, asesorados inactivos y cambio de fase */
async function coaching(clients) {
  if (!clients.length) return 0;
  const coachIds = [...new Set(clients.map((c) => c.coach_id))];
  const coaches = await knex("users").whereIn("id", coachIds).select("id", "name", "profile");
  const users = await knex("users").whereIn("id", clients.map((c) => c.user_id)).select("id", "name", "profile");
  const last = await knex("workouts").whereIn("client_id", clients.map((c) => c.user_id)).select("client_id").max({ at: "finished_at" }).groupBy("client_id");
  const now = new Date();
  let n = 0;
  for (const c of clients) {
    const coach = coaches.find((x) => x.id === c.coach_id);
    const u = users.find((x) => x.id === c.user_id);
    if (!coach || !u) continue;
    const rules = rulesOf(J(coach.profile, {}));
    const on = (k) => rules.find((r) => r.kind === k);
    const d = J(c.data, {});
    const l = localNow(J(u.profile, {}).notif?.reminder, now);

    // 1) Check-in semanal: el día elegido, desde la hora indicada, si no envió uno en los últimos 5 días
    const ci = on("checkin");
    if (ci?.on && d.routine) {
      const day = d.checkinCfg?.day ?? ci.day ?? 0;
      const lastCi = (d.checkins || []).at(-1);
      const recent = lastCi && now - new Date(lastCi.date) < 5 * DAY;
      if (l.dow === day && l.hour >= (ci.hour ?? 18) && l.hour < 22 && !recent && (await once(`ci:${u.id}:${l.day}`))) {
        await notify(u.id, { title: "Tu check-in de la semana", body: "Peso, fotos y cómo te sentiste: te toma 2 minutos.", page: "checkin", tag: "checkin", kind: "checkin" });
        n++;
      }
    }

    // 2) Inactivo: N días sin entrenar teniendo rutina → aviso al entrenador (una vez por semana)
    const ina = on("inactive");
    if (ina?.on && d.routine) {
      const at = last.find((x) => x.client_id === c.user_id)?.at || d.joinedAt;
      const days = at ? Math.floor((now - new Date(at)) / DAY) : 0;
      const week = `${now.getUTCFullYear()}-${Math.floor(now / (7 * DAY))}`;
      if (days >= (ina.days || 4) && (await once(`ina:${u.id}:${week}`))) {
        await notify(c.coach_id, { title: `${first(u.name)} lleva ${days} días sin entrenar`, body: "Escríbele para saber cómo está.", page: "clientes", params: { id: u.id }, kind: "inactive" });
        n++;
      }
    }

    // 3) Programa por fases: al cumplirse las semanas pasa a la fase siguiente
    const ph = on("phase");
    if (ph?.on && d.program?.phases?.length) {
      const i = phaseIndexAt(d.program, now.getTime());
      if (i != null && i !== d.program.current && (await once(`ph:${u.id}:${i}:${d.program.startedAt}`))) {
        const p = d.program.phases[i];
        d.program.current = i;
        d.routine = { ...p.routine, phase: { index: i, name: p.name, total: d.program.phases.length } };
        await knex("clients").where({ user_id: u.id }).update({ data: S(d) });
        await notify(u.id, { title: `Empiezas la fase «${p.name}»`, body: `Tu rutina cambió: ${p.weeks} ${p.weeks === 1 ? "semana" : "semanas"} de ${p.name.toLowerCase()}.`, page: "rutina", kind: "routine" });
        await notify(c.coach_id, { title: `${first(u.name)} pasó a la fase «${p.name}»`, body: "Su rutina se actualizó sola.", page: "clientes", params: { id: u.id }, kind: "routine" });
        n++;
      }
    }
  }
  return n;
}
