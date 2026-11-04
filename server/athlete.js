/* Modo atleta del administrador: su perfil de asesorado enlazado (se entrena a sí mismo).
   Aquí también va la rutina personal que pidió Andersson, que se carga una sola vez al arrancar. */
import crypto from "node:crypto";
import { knex, J, S } from "./db.js";
import { config } from "./config.js";
import { hashPassword } from "./auth.js";
import { nowISO } from "./util.js";
import { routineSchema } from "./routes/schemas.js";
import { bump } from "./versions.js";

/** Devuelve (y crea la primera vez) el perfil de atleta enlazado a un administrador. */
export async function ensureAthlete(admin) {
  if (admin.linked_id) {
    const t = await knex("users").where({ id: admin.linked_id, linked_id: admin.id }).first();
    if (t) return t;
  }
  const [local, domain] = String(admin.email).split("@");
  const email = `${local.split("+")[0]}+atleta@${domain}`.toLowerCase();
  const taken = await knex("users").where({ email }).first();
  if (taken && taken.linked_id !== admin.id) throw Object.assign(new Error("Ya existe una cuenta con el correo de atleta."), { status: 400 });
  const now = nowISO();
  let target = taken;
  await knex.transaction(async (trx) => {
    if (!target) {
      await trx("users").insert({ role: "client", email, password_hash: await hashPassword(crypto.randomBytes(24).toString("base64url")), name: admin.name,
        profile: S({ body: "m" }), created_at: now, consent_version: config.legalVersion, consent_at: now, linked_id: admin.id });
      target = await trx("users").where({ email }).first();
    }
    if (!(await trx("clients").where({ user_id: target.id }).first())) {
      await trx("clients").insert({ user_id: target.id, coach_id: admin.id, active: true,
        data: S({ goal: "Hipertrofia", phone: "", heightCm: null, fee: 0, billingDay: 1, routine: null, planRoutine: null, trial: null, weights: [], measurements: [], notes: [], joinedAt: now }) });
    }
    await trx("users").where({ id: admin.id }).update({ linked_id: target.id });
  });
  return target;
}

/* ---------------- Rutina personal de Andersson (5 días, versión ajustada) ----------------
   Cambios frente a la primera versión: espalda y pecho equilibrados (dos días cada uno),
   tríceps con 3 ejercicios, más deltoide lateral, face pull en vez de elevación frontal
   y sesiones más cortas (8–10 ejercicios). Hombros solo en los días 3 y 5 (nunca seguidos). */
let n = 0;
const ex = (exId, sets, rest, notes = "", reps = "10-15") => ({ uid: `ra-${++n}`, exId, sets, reps, rest, notes });
function andersonRoutine() {
  n = 0;
  return {
    name: "Mi rutina · 5 días", goal: "Hipertrofia", frequency: 5,
    notes: "10–15 repeticiones, terminando cada serie a 1–2 repeticiones del fallo. Cuando completes 15 en todas las series con buena técnica, sube el peso. Anota cada serie: la app te marca los récords.",
    days: [
      { id: "d-at-1", name: "Día 1 · Pierna (cuádriceps)", exercises: [
        ex(81, 3, 60, "Para activar glúteo medio"),  // Abductores en máquina
        ex(194, 4, 120),                             // Sentadilla péndulo
        ex(195, 4, 120),                             // Belt squat
        ex(15, 4, 120),                              // Prensa
        ex(69, 4, 90),                               // Extensión de cuádriceps
        ex(14, 4, 120),                              // Peso muerto rumano
        ex(73, 3, 90),                               // Curl femoral sentado
        ex(8, 4, 120),                               // Hip thrust
        ex(82, 3, 60),                               // Aductores en máquina
        ex(18, 4, 60, "", "12-15"),                  // Gemelos de pie
      ] },
      { id: "d-at-2", name: "Día 2 · Pecho y tríceps", exercises: [
        ex(32, 3, 60, "Para calentar el pecho"),     // Pec deck
        ex(11, 4, 120),                              // Press inclinado con mancuernas
        ex(120, 4, 120, "Press plano en Hammer"),    // Press de pecho en Hammer
        ex(124, 3, 120, "Smith inclinado"),          // Press inclinado en Smith
        ex(6, 4, 60),                                // Extensión de tríceps en polea
        ex(61, 3, 60, "Con barra, sentado"),         // Extensión de tríceps sobre la cabeza
        ex(169, 3, 60, "Polea cruzada, cada brazo"), // Extensión de tríceps a una mano
      ] },
      { id: "d-at-3", name: "Día 3 · Espalda y hombros", exercises: [
        ex(134, 4, 120),                             // Remo en Hammer
        ex(12, 4, 90),                               // Jalón al pecho
        ex(206, 4, 90, "Remo en máquina"),           // Remo con pecho apoyado en máquina
        ex(21, 3, 90, "Unilateral"),                 // Remo con mancuerna a una mano
        ex(146, 3, 120, "Press militar en Smith"),   // Press de hombros en Smith
        ex(212, 4, 60, "Aperturas en máquina de hombros"), // Elevaciones laterales en máquina
        ex(148, 3, 60, "Unilateral, cada brazo"),    // Elevación lateral en polea
        ex(150, 4, 60, "Pec deck para deltoide posterior"), // Pájaros en máquina
        ex(20, 3, 60, "Codos altos, tira hacia la cara"),   // Face pull
      ] },
      { id: "d-at-4", name: "Día 4 · Pierna (femoral y glúteo)", exercises: [
        ex(81, 3, 60),                               // Abductores en máquina
        ex(14, 4, 120),                              // Peso muerto rumano
        ex(73, 4, 90),                               // Curl femoral sentado
        ex(15, 4, 120),                              // Prensa
        ex(194, 3, 120),                             // Sentadilla péndulo
        ex(17, 3, 90),                               // Curl femoral acostado
        ex(82, 3, 60),                               // Aductores en máquina
        ex(83, 4, 60, "", "12-15"),                  // Gemelos sentado
      ] },
      { id: "d-at-5", name: "Día 5 · Espalda, pecho y bíceps", exercises: [
        ex(204, 4, 90),                              // Jalón al pecho en Hammer
        ex(138, 4, 90),                              // Remo en T con pecho apoyado
        ex(36, 3, 90),                               // Remo sentado en polea
        ex(121, 3, 120),                             // Press inclinado en Hammer
        ex(30, 3, 60),                               // Cruce de poleas
        ex(56, 3, 60),                               // Curl de bíceps en polea
        ex(50, 3, 60),                               // Curl martillo
        ex(49, 3, 60, "Con barra o con mancuernas"), // Curl con barra
        ex(13, 4, 60, "Hombro lateral (con mancuernas)"), // Elevaciones laterales
      ] },
    ],
  };
}

const KEY = "athlete-routine:andersson:v3";
const ADMIN_EMAIL = "anderssontoapanta@gmail.com";

/** Carga la rutina una sola vez (si ya tenía otra, se guarda como respaldo). Se puede repetir sin duplicar nada. */
export async function loadAnderssonRoutine() {
  const prev = await knex("settings").where({ key: KEY }).first();
  const st = J(prev?.value, null);
  if (prev && !(st?.state === "running" && Date.now() - Date.parse(st.at) > 180e3)) return;
  const claim = S({ at: nowISO(), state: "running" });
  if (prev) { if (!(await knex("settings").where({ key: KEY, value: prev.value }).update({ value: claim }))) return; }
  else { try { await knex("settings").insert({ key: KEY, value: claim }); } catch { return; } }
  const done = (state) => knex("settings").where({ key: KEY }).update({ value: S({ at: nowISO(), state }) });
  const admin = await knex("users").where({ email: ADMIN_EMAIL, role: "admin" }).first();
  if (!admin) { console.warn("[atleta] No existe el administrador"); return done("sin admin"); }
  const athlete = await ensureAthlete(admin);
  const routine = routineSchema.parse(andersonRoutine());
  const c = await knex("clients").where({ user_id: athlete.id }).first();
  const data = J(c.data, {});
  if (data.routine) data.prevRoutine = data.routine; // la anterior queda de respaldo
  data.routine = routine;
  data.goal = "Hipertrofia";
  await knex("clients").where({ user_id: athlete.id }).update({ data: S(data) });
  await bump(`u:${athlete.id}`, `u:${admin.id}`, "g");
  await done(`listo · atleta ${athlete.id}`);
  console.log(`[atleta] Rutina de 5 días (ajustada) cargada para ${ADMIN_EMAIL}`);
}
