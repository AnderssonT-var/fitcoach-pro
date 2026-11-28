/* Lógica del seguimiento: cumplimiento, rango con XP, hábitos, check-in, nutrición,
   fases y la lista «Necesitan atención» del entrenador. Sin React: se usa en toda la app. */
import { DAY, addDays, startOfDay } from "./format";

export const todayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const daysAgoKey = (n) => todayKey(addDays(new Date(), -n));

export const DEFAULT_HABITS = [
  { id: "h-sueno", name: "Sueño", target: 7, unit: "h", kind: "count" },
  { id: "h-agua", name: "Agua", target: 8, unit: "vasos", kind: "count" },
  { id: "h-pasos", name: "Pasos", target: 8000, unit: "pasos", kind: "count" },
  { id: "h-proteina", name: "Proteína", target: 1, unit: "", kind: "check" },
];
export const DEFAULT_CHECKIN = { day: 0, questions: ["¿Qué fue lo mejor de tu semana?", "¿Algo te molestó o te costó?"] };
export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const habitsOf = (c) => (Array.isArray(c?.habits) && c.habits.length ? c.habits : DEFAULT_HABITS);
export const checkinCfgOf = (c) => ({ ...DEFAULT_CHECKIN, ...(c?.checkinCfg || {}) });

/* ---------- cumplimiento ---------- */
/** % de entrenamientos hechos frente a los planificados (frecuencia semanal de la rutina) en los últimos `days` días. */
export function compliance(c, workouts, days) {
  const freq = +c?.routine?.frequency || 0;
  if (!freq) return null;
  const joined = c.joinedAt ? new Date(c.joinedAt) : null;
  const from = new Date(Date.now() - days * DAY);
  const start = joined && joined > from ? joined : from;
  const span = Math.max(1, (Date.now() - start) / DAY);
  const planned = Math.max(1, Math.round((freq * span) / 7));
  const done = workouts.filter((w) => w.clientId === c.userId && new Date(w.finishedAt) >= start).length;
  return Math.min(100, Math.round((done / planned) * 100));
}
export const complianceTone = (p) => (p == null ? "" : p >= 80 ? "ok" : p >= 50 ? "warn" : "bad");
export function complianceSet(c, workouts) {
  return { d7: compliance(c, workouts, 7), d30: compliance(c, workouts, 30), d90: compliance(c, workouts, 90) };
}

/* ---------- hábitos ---------- */
export function habitDone(h, v) { return h.kind === "check" ? +v >= 1 : +v >= +h.target; }
export function habitsToday(c, date = todayKey()) {
  const log = c?.habitLog?.[date] || {};
  const list = habitsOf(c).map((h) => ({ ...h, value: +log[h.id] || 0, done: habitDone(h, log[h.id]) }));
  return { list, done: list.filter((h) => h.done).length, total: list.length };
}
/** % de hábitos cumplidos en los últimos `days` días (solo días con algo registrado o desde que empezó). */
export function habitCompliance(c, days = 7) {
  const hs = habitsOf(c);
  if (!hs.length) return null;
  let ok = 0, total = 0;
  for (let i = 0; i < days; i++) {
    const log = c?.habitLog?.[daysAgoKey(i)] || {};
    for (const h of hs) { total++; if (habitDone(h, log[h.id])) ok++; }
  }
  return total ? Math.round((ok / total) * 100) : null;
}
/** Días seguidos con todos los hábitos cumplidos (hoy cuenta si ya los completó). */
export function habitStreak(c) {
  const hs = habitsOf(c);
  let n = 0;
  for (let i = 0; i < 365; i++) {
    const log = c?.habitLog?.[daysAgoKey(i)] || {};
    const all = hs.every((h) => habitDone(h, log[h.id]));
    if (all) n++; else if (i > 0) break;
  }
  return n;
}

/* ---------- check-in ---------- */
export const lastCheckin = (c) => (c?.checkins || []).at(-1) || null;
/** ¿Le toca enviar el check-in? (el día elegido o después, si no envió uno en los últimos 5 días) */
export function checkinDue(c) {
  if (!c?.routine) return false;
  const last = lastCheckin(c);
  if (last && Date.now() - new Date(last.date) < 5 * DAY) return false;
  const day = checkinCfgOf(c).day;
  const dow = new Date().getDay();
  const since = (dow - day + 7) % 7; // días desde el día del check-in
  return since <= 2; // el día y los dos siguientes
}
export const pendingReviews = (c) => (c?.checkins || []).filter((x) => !x.reviewedAt);

/* ---------- nutrición ---------- */
export function foodToday(c, date = todayKey()) {
  const n = c?.nutrition;
  const day = c?.foodLog?.[date] || {};
  const meals = (n?.meals || []).map((m) => ({ ...m, done: !!day.meals?.[m.id] }));
  const entries = day.entries || [];
  const kcal = meals.filter((m) => m.done).reduce((t, m) => t + (+m.kcal || 0), 0) + entries.reduce((t, e) => t + (+e.kcal || 0), 0);
  const protein = entries.reduce((t, e) => t + (+e.protein || 0), 0);
  return { plan: n, meals, entries, kcal, protein, water: +day.water || 0 };
}

/* ---------- rango y XP ---------- */
export const RANKS = [
  { name: "Bronce I", xp: 0 }, { name: "Bronce II", xp: 300 }, { name: "Bronce III", xp: 700 },
  { name: "Plata I", xp: 1200 }, { name: "Plata II", xp: 1900 }, { name: "Plata III", xp: 2800 },
  { name: "Oro I", xp: 4000 }, { name: "Oro II", xp: 5500 }, { name: "Oro III", xp: 7500 },
  { name: "Platino", xp: 10000 }, { name: "Diamante", xp: 14000 }, { name: "Élite", xp: 20000 },
];
/** XP: 100 por entrenamiento, 50 por récord, 50 por check-in y 10 por hábito cumplido. */
export function xpOf(c, workouts) {
  const mine = workouts.filter((w) => w.clientId === c?.userId);
  const prs = mine.reduce((t, w) => t + (w.prs?.length || 0), 0);
  let habits = 0;
  const hs = habitsOf(c);
  for (const log of Object.values(c?.habitLog || {})) for (const h of hs) if (habitDone(h, log[h.id])) habits++;
  return mine.length * 100 + prs * 50 + (c?.checkins?.length || 0) * 50 + habits * 10;
}
export function rankOf(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i], next = RANKS[i + 1] || null;
  return { name: cur.name, index: i, xp, from: cur.xp, to: next?.xp ?? cur.xp, next: next?.name || null,
    pct: next ? Math.min(1, (xp - cur.xp) / (next.xp - cur.xp)) : 1, tier: cur.name.split(" ")[0].toLowerCase() };
}
/** Días seguidos entrenando o cumpliendo hábitos (la racha que se ve en el inicio). */
export function dayStreak(c, workouts) {
  const days = new Set(workouts.filter((w) => w.clientId === c?.userId).map((w) => todayKey(w.finishedAt)));
  const hs = habitsOf(c);
  for (const [k, log] of Object.entries(c?.habitLog || {})) if (hs.some((h) => habitDone(h, log[h.id]))) days.add(k);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    if (days.has(daysAgoKey(i))) n++;
    else if (i > 0) break;
  }
  return n;
}

/* ---------- programa por fases ---------- */
export function phaseInfo(c) {
  const p = c?.program;
  if (!p?.phases?.length) return null;
  const i = Math.min(p.current ?? 0, p.phases.length - 1);
  let start = new Date(p.startedAt);
  for (let k = 0; k < i; k++) start = addDays(start, 7 * p.phases[k].weeks);
  const week = Math.max(1, Math.floor((Date.now() - start) / (7 * DAY)) + 1);
  const end = addDays(start, 7 * p.phases[i].weeks);
  return { index: i, total: p.phases.length, phase: p.phases[i], week: Math.min(week, p.phases[i].weeks), weeks: p.phases[i].weeks, endsIn: Math.ceil((end - startOfDay(new Date())) / DAY) };
}

/* ---------- necesitan atención ---------- */
/**
 * Asesorados a los que el entrenador debería atender hoy, con el motivo y su urgencia.
 * level: 3 rojo (urgente), 2 ámbar, 1 gris (aviso).
 */
export function needsAttention({ clients, workouts, payments, messages, coachId }) {
  const out = [];
  for (const c of clients) {
    if (!c.active) continue;
    const name = c.user?.name || "";
    const push = (level, kind, text, action) => out.push({ clientId: c.userId, name, level, kind, text, action });
    const p7 = compliance(c, workouts, 7), p30 = compliance(c, workouts, 30);
    if (p7 != null && p30 != null && p30 - p7 >= 20) push(3, "drop", `Cumplimiento bajó de ${p30}% a ${p7}%`, "Escribir");
    const last = workouts.filter((w) => w.clientId === c.userId).sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))[0];
    const since = last ? Math.floor((Date.now() - new Date(last.finishedAt)) / DAY) : (c.joinedAt ? Math.floor((Date.now() - new Date(c.joinedAt)) / DAY) : 0);
    if (c.routine && since >= 4 && !(p7 != null && p30 != null && p30 - p7 >= 20)) push(since >= 7 ? 3 : 2, "inactive", `Lleva ${since} días sin entrenar`, "Escribir");
    const rev = pendingReviews(c);
    if (rev.length) {
      const h = Math.floor((Date.now() - new Date(rev[0].date)) / 36e5);
      push(h >= 48 ? 3 : 2, "checkin", `Check-in sin revisar · hace ${h < 24 ? `${h} h` : `${Math.floor(h / 24)} d`}`, "Revisar");
    }
    if (!c.routine) push(2, "routine", "No tiene rutina asignada", "Crear rutina");
    else if (c.onboarding && !c.routine.days?.length) push(2, "routine", "Completó el cuestionario: arma su programa", "Crear rutina");
    const ph = phaseInfo(c);
    if (ph && ph.index === ph.total - 1 && ph.endsIn <= 7 && ph.endsIn >= 0) push(1, "phase", `Su programa termina en ${ph.endsIn} ${ph.endsIn === 1 ? "día" : "días"}`, "Renovar");
    const over = payments.filter((p) => p.clientId === c.userId && !p.paidAt && new Date(p.dueDate) < startOfDay(new Date()));
    const sent = payments.filter((p) => p.clientId === c.userId && !p.paidAt && p.clientPaidAt);
    if (sent.length) push(2, "receipt", `Avisó que pagó ${sent[0].concept.toLowerCase()}`, "Confirmar");
    else if (over.length) push(2, "payment", `Pago vencido: ${over[0].concept}`, "Cobrar");
    const unread = messages.filter((m) => m.clientId === c.userId && m.coachId === coachId && m.from === c.userId && !m.read);
    if (unread.length) push(1, "message", `${unread.length} ${unread.length === 1 ? "mensaje nuevo" : "mensajes nuevos"}`, "Responder");
  }
  return out.sort((a, b) => b.level - a.level);
}
