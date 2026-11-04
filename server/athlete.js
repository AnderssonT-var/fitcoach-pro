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

/* ---------------- Rutina personal de Andersson (5 días) ---------------- */
let n = 0;
const ex = (exId, rest = 90, notes = "", sets = 4, reps = "10-15") => ({ uid: `ra-${++n}`, exId, sets, reps, rest, notes });
function andersonRoutine() {
  n = 0;
  const pecho = (tag) => ({ id: `d-at-${tag}`, name: tag === "5" ? "Día 5 · Pecho, bíceps y tríceps" : "Día 2 · Pecho, bíceps y tríceps", exercises: [
    ex(32, 90),                                   // Pec deck
    ex(11, 120),                                  // Press inclinado con mancuernas
    ex(120, 120, "Press plano en Hammer"),        // Press de pecho en Hammer
    ex(30, 90, "Extensión / aperturas en polea"), // Cruce de poleas
    ex(124, 120, "Smith inclinado"),              // Press inclinado en Smith
    ex(56, 60),                                   // Curl de bíceps en polea
    ex(50, 60),                                   // Curl martillo
    ex(49, 60, "Con barra o con mancuernas"),     // Curl con barra
    ex(6, 60),                                    // Extensión de tríceps en polea
    ex(61, 60, "Con barra, sentado"),             // Extensión de tríceps sobre la cabeza
    ex(164, 60, "Máquina universal"),             // Extensión de tríceps en máquina
    ex(169, 60, "Polea cruzada, cada brazo"),     // Extensión de tríceps a una mano
  ] });
  return {
    name: "Mi rutina · 5 días", goal: "Hipertrofia", frequency: 5,
    notes: "4–5 series de 10–15 repeticiones por ejercicio. Sube el peso cuando completes las 15 repeticiones en todas las series con buena técnica.",
    days: [
      { id: "d-at-1", name: "Día 1 · Pierna (cuádriceps)", exercises: [
        ex(81, 60, "Para activar glúteo medio"),   // Abductores en máquina
        ex(194, 120),                              // Sentadilla péndulo
        ex(195, 120),                              // Belt squat
        ex(15, 120),                               // Prensa
        ex(69, 90),                                // Extensión de cuádriceps
        ex(14, 120),                               // Peso muerto rumano
        ex(73, 90),                                // Curl femoral sentado
        ex(8, 120),                                // Hip thrust
        ex(82, 60),                                // Aductores en máquina
        ex(18, 60),                                // Gemelos (de pie)
      ] },
      pecho("2"),
      { id: "d-at-3", name: "Día 3 · Espalda y hombros", exercises: [
        ex(134, 120),                              // Remo en Hammer
        ex(12, 90),                                // Jalón al pecho
        ex(206, 90, "Remo en máquina"),            // Remo con pecho apoyado en máquina
        ex(21, 90, "Unilateral"),                  // Remo con mancuerna a una mano
        ex(212, 60, "Aperturas en máquina de hombros"), // Elevaciones laterales en máquina
        ex(146, 120, "Press militar en Smith"),    // Press de hombros en Smith
        ex(148, 60, "Unilateral, cada brazo"),     // Elevación lateral en polea
        ex(46, 60, "En banco, deltoide posterior"),// Pájaros
        ex(45, 60, "Con mancuerna"),               // Elevaciones frontales
        ex(150, 60, "Pec deck para deltoide posterior"), // Pájaros en máquina
      ] },
      { id: "d-at-4", name: "Día 4 · Pierna (femoral y glúteo)", exercises: [
        ex(81, 60),                                // Abductores en máquina
        ex(14, 120),                               // Peso muerto rumano
        ex(73, 90),                                // Curl femoral sentado
        ex(15, 120),                               // Prensa
        ex(194, 120),                              // Sentadilla péndulo
        ex(17, 90),                                // Curl femoral acostado
        ex(82, 60),                                // Aductores en máquina
        ex(18, 60),                                // Gemelos
      ] },
      pecho("5"),
    ],
  };
}

const KEY = "athlete-routine:andersson:v1";
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
  if (data.routine && data.routine.name !== routine.name) data.prevRoutine = data.routine;
  data.routine = routine;
  data.goal = "Hipertrofia";
  await knex("clients").where({ user_id: athlete.id }).update({ data: S(data) });
  await bump(`u:${athlete.id}`, `u:${admin.id}`, "g");
  await done(`listo · atleta ${athlete.id}`);
  console.log(`[atleta] Rutina de 5 días cargada para ${ADMIN_EMAIL}`);
}
