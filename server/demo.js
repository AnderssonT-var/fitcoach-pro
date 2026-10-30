/* Datos ficticios para las cuentas de prueba (prueba@gmail.com y cliente@gmail.com).
   Corre UNA sola vez al arrancar el servidor (queda marcado en settings) y solo toca esas cuentas
   y asesorados de ejemplo con correos @example.com. Todo lo que crea es inventado. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { knex, J, S } from "./db.js";
import { config } from "./config.js";
import { hashPassword, coachLicenseRow } from "./auth.js";
import { FOREVER, nowISO } from "./util.js";
import { addToBests } from "./history.js";
import { bump } from "./versions.js";
import { newCode } from "./routes/common.js";
import { dropCache } from "./landing.js";

const KEY = "demo-fill:prueba:v1";
const COACH_EMAIL = "prueba@gmail.com";
const CLIENT_EMAIL = "cliente@gmail.com";
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "demo-assets");

const DAY = 864e5;
const rid = (p) => `${p}${crypto.randomBytes(6).toString("hex")}`;
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysAgo = (d, h = 10, m = 0) => { const x = startOfDay(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0); return x.toISOString(); };
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const dataUrl = (file, mime) => `data:${mime};base64,${fs.readFileSync(path.join(ASSETS, file)).toString("base64")}`;

let n = 0;
const ex = (exId, sets, reps, rest, notes = "") => ({ uid: `re-demo-${++n}`, exId, sets, reps, rest, notes });

const ROUTINES = {
  camila: () => ({
    name: "Torso / Pierna 4 días", goal: "Hipertrofia", frequency: 4,
    notes: "Alterna Torso y Pierna. Si completas todas las reps con buena técnica, sube 2.5 kg la próxima sesión. Descansa lo indicado entre series.",
    days: [
      { id: "d-demo-t1", name: "Torso A", exercises: [ex(1, 4, "8-10", 90, "Escápulas juntas, baja controlado"), ex(9, 4, "10", 90), ex(4, 3, "8-10", 90), ex(13, 3, "12-15", 60), ex(5, 3, "12", 60)] },
      { id: "d-demo-p1", name: "Pierna A", exercises: [ex(2, 4, "6-8", 150, "Muslo paralelo al piso"), ex(14, 3, "10", 120), ex(8, 4, "10-12", 90, "Pausa de 1 s arriba"), ex(18, 3, "15", 60)] },
      { id: "d-demo-t2", name: "Torso B", exercises: [ex(11, 4, "10", 90), ex(12, 4, "10-12", 90), ex(20, 3, "15", 60), ex(6, 3, "12", 60)] },
      { id: "d-demo-p2", name: "Pierna B", exercises: [ex(15, 4, "12", 120), ex(16, 3, "10", 90), ex(17, 3, "12", 60), ex(19, 3, "40 s", 45)] },
    ],
  }),
  full: (name = "Full body 3 días") => ({
    name, goal: "Recomposición", frequency: 3, notes: "Calienta 5 minutos en bicicleta antes de empezar.",
    days: [{ id: `d-demo-f${++n}`, name: "Full body", exercises: [ex(22, 3, "12", 90), ex(11, 3, "10", 90), ex(12, 3, "12", 90), ex(16, 3, "10", 90), ex(6, 3, "15", 60)] }],
  }),
  strength: () => ({
    name: "Fuerza 5×5", goal: "Fuerza", frequency: 3, notes: "Dos series de calentamiento antes de la primera serie de trabajo.",
    days: [
      { id: "d-demo-sa", name: "Día A", exercises: [ex(2, 5, "5", 180), ex(1, 5, "5", 180), ex(9, 5, "5", 120)] },
      { id: "d-demo-sb", name: "Día B", exercises: [ex(2, 5, "5", 180), ex(4, 5, "5", 150), ex(7, 1, "5", 240, "Una sola serie pesada")] },
    ],
  }),
};

function sessions({ clientId, routine, weekdays, weeks, load, comments = {}, skipLastDays = 0 }) {
  const out = [];
  const today = startOfDay();
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const seen = {};
  let k = 0;
  for (let w = weeks; w >= 0; w--) {
    for (const wd of weekdays) {
      const day = new Date(monday); day.setDate(monday.getDate() - w * 7 + wd);
      if (day >= today || (skipLastDays && (today - day) / DAY < skipLastDays)) continue;
      const d = routine.days[k % routine.days.length];
      const start = new Date(day); start.setHours(18, 5 + ((k * 7) % 40), 0, 0);
      const dur = (46 + ((k * 7) % 21)) * 60;
      const extra = comments[k] || {};
      out.push({
        id: `w-demo-${clientId}-${k}`, finishedAt: new Date(start.getTime() + dur * 1000).toISOString(),
        data: {
          dayId: d.id, dayName: d.name, routineName: routine.name, startedAt: start.toISOString(), durationSec: dur,
          difficulty: extra.difficulty ?? 3, comment: extra.comment ?? "", prs: [],
          exercises: d.exercises.map((e) => {
            const L = load[e.exId] || { base: 10, step: 0, every: 99 };
            seen[e.exId] = (seen[e.exId] || 0) + 1;
            const weight = L.base + L.step * Math.floor((seen[e.exId] - 1) / L.every);
            const low = parseInt(e.reps, 10) || 8;
            return { exId: e.exId, target: { sets: e.sets, reps: e.reps, rest: e.rest },
              sets: Array.from({ length: e.sets }, (_, i) => ({ weight, reps: Math.max(1, low + (i < 2 ? 1 : 0) - (i === e.sets - 1 && k % 3 === 0 ? 1 : 0)), done: true })) };
          }),
        },
      });
      k++;
    }
  }
  const best = {};
  for (const s of out) for (const e of s.data.exercises) {
    const top = Math.max(...e.sets.map((x) => x.weight));
    if (best[e.exId] != null && top > best[e.exId]) s.data.prs.push({ exId: e.exId, weight: top, prev: best[e.exId] });
    best[e.exId] = Math.max(best[e.exId] ?? 0, top);
  }
  return out;
}

async function savePageImage(coachId, file) {
  const id = `f-demo-${coachId}-${path.basename(file, path.extname(file))}`;
  if (await knex("files").where({ id }).first()) return id;
  const rel = path.join("page", `${id}${path.extname(file)}`);
  fs.mkdirSync(path.join(config.uploadDir, "page"), { recursive: true });
  const buf = fs.readFileSync(path.join(ASSETS, file));
  fs.writeFileSync(path.join(config.uploadDir, rel), buf, { mode: 0o600 });
  await knex("files").insert({ id, kind: "page", owner_id: coachId, path: rel, mime: file.endsWith(".png") ? "image/png" : "image/jpeg", size: buf.length, created_at: nowISO() });
  return id;
}

export async function fillDemo() {
  // Si un proceso quedó a medias (el hosting lo reinició), se retoma después de 3 minutos; todo lo que crea tiene id fijo
  const prev = await knex("settings").where({ key: KEY }).first();
  const st = J(prev?.value, null);
  if (prev && !(st?.state === "running" && Date.now() - Date.parse(st.at) > 180e3)) return;
  const claim = S({ at: nowISO(), state: "running" });
  if (prev) { if (!(await knex("settings").where({ key: KEY, value: prev.value }).update({ value: claim }))) return; }
  else { try { await knex("settings").insert({ key: KEY, value: claim }); } catch { return; } } // otro proceso ya lo hace
  const done = (state) => knex("settings").where({ key: KEY }).update({ value: S({ at: nowISO(), state }) });
  const coach = await knex("users").where({ email: COACH_EMAIL }).first();
  const client = await knex("users").where({ email: CLIENT_EMAIL }).first();
  if (!coach || coach.role !== "coach") { console.warn("[demo] No existe el entrenador de prueba"); return done("sin entrenador"); }
  const C = coach.id;
  const scopes = new Set(["g", `c:${C}`, `u:${C}`, `w:${C}`]);

  /* ---------- entrenador: perfil, marca, licencia ---------- */
  const profile = { ...J(coach.profile, {}), photo: dataUrl("avatar.jpg", "image/jpeg"), phone: "099 123 4567", city: "Quito", headline: "Fuerza, hipertrofia y recomposición", years: 7,
    instagram: "@pulso.training", body: "m",
    bio: "Soy Martín y llevo 7 años ayudando a personas ocupadas a entrenar con un plan claro. Trabajo con rutinas por días, progresión medida en cada sesión y revisión semanal de cada asesorado.",
    specialties: ["Fuerza", "Hipertrofia", "Pérdida de grasa", "Técnica"], certifications: ["NSCA-CPT", "Nutrición deportiva nivel 1"],
    services: ["Rutina personalizada", "Revisión semanal de progreso", "Chat directo conmigo", "Ajustes según tus resultados"] };
  const slugFree = !(await knex("users").where({ brand_slug: "pulso-training" }).whereNot({ id: C }).first());
  const brand = { ...J(coach.brand, {}), businessName: "Pulso Training", tagline: "Entrena con un plan. Mide tu progreso.", color: "#5856D6", logo: dataUrl("logo.png", "image/png"),
    signup: J(coach.brand, {}).signup || { open: true, fee: 45, trialDays: 7, trialFee: 0, templateId: null } };
  await knex("users").where({ id: C }).update({ name: "Martín Vega", profile: S(profile), brand: S(brand), ...(slugFree ? { brand_slug: "pulso-training" } : {}),
    consent_version: coach.consent_version || config.legalVersion, consent_at: coach.consent_at || nowISO() });
  const slug = slugFree ? "pulso-training" : coach.brand_slug;
  if (!(await coachLicenseRow(C))) {
    await knex("licenses").insert({ id: rid("lic-"), code: newCode(), months: 0, coach_id: C, created_at: nowISO(), activated_at: nowISO(), expires_at: FOREVER, revoked: false, note: "Cuenta de prueba (datos ficticios)", charges: S([]) });
  }

  /* ---------- asesorados ---------- */
  const people = [];
  if (client && client.role === "client") people.push({ user: client, pending: true, name: "Camila Ríos", body: "f", goal: "Hipertrofia", heightCm: 164, fee: 45, billingDay: 5, joined: 70,
    routine: ROUTINES.camila(), weekdays: [0, 1, 3, 4], weeks: 8,
    load: { 1: { base: 27.5, step: 2.5, every: 3 }, 9: { base: 30, step: 2.5, every: 3 }, 4: { base: 20, step: 2.5, every: 4 }, 13: { base: 4, step: 1, every: 5 }, 5: { base: 7, step: 1, every: 5 },
      2: { base: 45, step: 2.5, every: 2 }, 14: { base: 35, step: 2.5, every: 3 }, 8: { base: 50, step: 5, every: 3 }, 18: { base: 40, step: 5, every: 4 },
      11: { base: 10, step: 2, every: 4 }, 12: { base: 32, step: 2.5, every: 3 }, 20: { base: 12, step: 2.5, every: 5 }, 6: { base: 15, step: 2.5, every: 4 },
      15: { base: 80, step: 10, every: 3 }, 16: { base: 8, step: 2, every: 4 }, 17: { base: 20, step: 2.5, every: 4 }, 19: { base: 0, step: 0, every: 99 } },
    comments: { 6: { difficulty: 4, comment: "La sentadilla se sintió pesada, dormí poco." }, 14: { difficulty: 2, comment: "¡Subí peso en press banca! Me sentí muy bien." },
      23: { difficulty: 5, comment: "La última serie de sentadilla fue al límite. ¿Bajamos un poco?" }, 29: { difficulty: 3, comment: "Hip thrust con 70 kg, nuevo récord 💪" } },
    weights: [63.4, 63.1, 62.9, 62.6, 62.4, 62.0, 61.9, 61.5, 61.2, 61.0],
    meas: [[68, 63.4, 28.0, 74, 99, 88, 27.5, 56, "Medición inicial"], [47, 62.6, 27.1, 72.5, 98, 88.5, 28, 56.5], [26, 62.0, 26.2, 71, 97.5, 89, 28.4, 57], [3, 61.0, 25.0, 69, 97, 89.5, 29, 57.5, "Muy buena evolución de cintura"]],
    notes: [[60, "General", "Prefiere entrenar en la tarde. Responde bien a volumen alto.", false], [30, "Lesión", "Molestia leve en la rodilla derecha en sentadilla profunda. Mantener profundidad al paralelo.", true], [8, "Técnica", "Mejoró la retracción escapular en press banca. Lista para subir a 40 kg.", false]],
    profile: { bio: "Me gusta entrenar en la tarde. Quiero ganar fuerza en las piernas y mejorar mi postura.", injuries: "Molestia leve en la rodilla derecha en sentadilla profunda.", birthYear: 1996, phone: "098 765 1234" } });
  const extras = [
    { email: "lucas.demo@example.com", name: "Lucas Andrade", body: "m", goal: "Fuerza", heightCm: 179, fee: 50, billingDay: 10, joined: 45, routine: ROUTINES.strength(), weekdays: [0, 2, 4], weeks: 6,
      load: { 2: { base: 90, step: 2.5, every: 1 }, 1: { base: 65, step: 2.5, every: 2 }, 9: { base: 55, step: 2.5, every: 2 }, 4: { base: 40, step: 1.25, every: 2 }, 7: { base: 120, step: 5, every: 1 } },
      comments: { 10: { difficulty: 4, comment: "Primera vez con 110 kg en sentadilla." } }, weights: [82.0, 82.4, 82.9, 83.1, 83.6, 84.0] },
    { email: "sofia.demo@example.com", name: "Sofía Herrera", body: "f", goal: "Pérdida de grasa", heightCm: 160, fee: 45, billingDay: 1, joined: 38, routine: ROUTINES.full(), weekdays: [0, 2, 4], weeks: 5,
      load: { 22: { base: 12, step: 2, every: 3 }, 11: { base: 8, step: 1, every: 3 }, 12: { base: 27.5, step: 2.5, every: 3 }, 16: { base: 6, step: 2, every: 3 }, 6: { base: 12.5, step: 2.5, every: 3 } },
      weights: [70.2, 69.6, 69.1, 68.4, 68.0] },
    { email: "diego.demo@example.com", pending: true, name: "Diego Paredes", body: "m", goal: "Recomposición", heightCm: 183, fee: 50, billingDay: 15, joined: 60, routine: ROUTINES.full("Recomposición full body"), weekdays: [1, 3], weeks: 7, skipLastDays: 9,
      load: { 22: { base: 18, step: 2, every: 3 }, 11: { base: 14, step: 2, every: 3 }, 12: { base: 45, step: 5, every: 3 }, 16: { base: 12, step: 2, every: 3 }, 6: { base: 22.5, step: 2.5, every: 3 } },
      weights: [91.5, 91.0, 90.2, 89.8, 89.1] },
    { email: "valentina.demo@example.com", name: "Valentina Mora", body: "f", goal: "Tonificación", heightCm: 167, fee: 45, billingDay: 20, joined: 4, routine: null, weekdays: [], weeks: 0, load: {}, weights: [58.3] },
  ];
  const randomPw = await hashPassword(crypto.randomBytes(24).toString("base64url"));
  for (const e of extras) {
    let u = await knex("users").where({ email: e.email }).first();
    if (!u) {
      const [id] = await knex("users").insert({ role: "client", email: e.email, password_hash: randomPw, name: e.name, profile: S({ body: e.body }), created_at: daysAgo(e.joined, 9),
        consent_version: config.legalVersion, consent_at: daysAgo(e.joined, 9) });
      u = await knex("users").where({ email: e.email }).first() || { id };
    }
    people.push({ ...e, user: u });
  }

  const allBuddies = [];
  for (const p of people) {
    const U = p.user.id;
    allBuddies.push(U);
    scopes.add(`u:${U}`);
    const prevRow = await knex("clients").where({ user_id: U }).first();
    if (prevRow && prevRow.coach_id !== C) scopes.add(`c:${prevRow.coach_id}`).add(`u:${prevRow.coach_id}`);
    const w = sessions({ clientId: U, routine: p.routine || { days: [] }, weekdays: p.routine ? p.weekdays : [], weeks: p.weeks, load: p.load, comments: p.comments, skipLastDays: p.skipLastDays });
    for (const s of w) {
      if (await knex("workouts").where({ id: s.id }).first()) continue;
      await knex("workouts").insert({ id: s.id, client_id: U, coach_id: C, finished_at: s.finishedAt, data: S(s.data) });
    }
    const bests = {};
    for (const row of await knex("workouts").where({ client_id: U }).orderBy("finished_at", "asc")) addToBests(bests, { ...J(row.data, {}), finishedAt: row.finished_at });
    const step = p.weights.length > 1 ? Math.floor((p.joined - 2) / (p.weights.length - 1)) : 0;
    const data = {
      ...J(prevRow?.data, {}), goal: p.goal, phone: p.profile?.phone || "099 000 0000", heightCm: p.heightCm, fee: p.fee, billingDay: p.billingDay, joinedAt: daysAgo(p.joined, 9),
      routine: p.routine, trial: null, bests,
      weights: p.weights.map((kg, i) => ({ date: daysAgo(p.joined - 2 - i * step, 7), kg })),
      measurements: (p.meas || []).map((r, i) => ({ id: `ms-demo-${U}-${i}`, date: daysAgo(r[0], 8), weight: r[1], fat: r[2], waist: r[3], hip: r[4], chest: r[5], arm: r[6], thigh: r[7], note: r[8] || "" })),
      notes: (p.notes || []).map(([d, category, text, pinned], i) => ({ id: `nt-demo-${U}-${i}`, at: daysAgo(d, 11), category, text, pinned })),
    };
    if (prevRow) await knex("clients").where({ user_id: U }).update({ coach_id: C, active: true, data: S(data) });
    else await knex("clients").insert({ user_id: U, coach_id: C, active: true, data: S(data) });
    if (p.profile || p === people[0]) {
      await knex("users").where({ id: U }).update({ name: p.name, profile: S({ ...J(p.user.profile, {}), body: p.body, ...(p.profile || {}) }) });
    }
    // Mensualidades: las anteriores pagadas, la de este mes pendiente (salvo una)
    const today = startOfDay();
    for (let back = 2; back >= 0; back--) {
      const due = new Date(today.getFullYear(), today.getMonth() - back, p.billingDay, 9);
      if (due < new Date(Date.now() - p.joined * DAY) && back > 0) continue;
      const from = new Date(due.getFullYear(), due.getMonth(), 1).toISOString(), to = new Date(due.getFullYear(), due.getMonth() + 1, 1).toISOString();
      if (await knex("payments").where({ client_id: U }).where("concept", "like", "Mensualidad%").where("due_date", ">=", from).where("due_date", "<", to).first()) continue;
      const paid = back > 0 || !p.pending;
      await knex("payments").insert({ id: rid("pay-"), coach_id: C, client_id: U, concept: `Mensualidad ${MONTHS[due.getMonth()]}`, amount: p.fee, due_date: due.toISOString(),
        paid_at: paid ? new Date(due.getTime() - DAY).toISOString() : null, method: paid ? ["Transferencia", "Efectivo", "Tarjeta"][U % 3] : "" });
    }
  }

  /* ---------- mensajes, comunidad y plantillas ---------- */
  const cam = people[0]?.email ? null : people[0]?.user.id;
  const lucas = people.find((p) => p.email === "lucas.demo@example.com")?.user.id;
  const sofia = people.find((p) => p.email === "sofia.demo@example.com")?.user.id;
  const diego = people.find((p) => p.email === "diego.demo@example.com")?.user.id;
  const vale = people.find((p) => p.email === "valentina.demo@example.com")?.user.id;
  let seq = 0;
  const once = async (table, id, row) => { if (!(await knex(table).where({ id }).first())) await knex(table).insert({ id, ...row }); };
  const msg = (clientId, from, text, at, read = true) => { const id = `m-demo-${C}-${++seq}`; return clientId && once("messages", id, { coach_id: C, client_id: clientId, from_id: from, text, at, read }); };
  await msg(cam, C, "¡Hola Camila! Bienvenida a Pulso Training. Ya tienes tu rutina de 4 días en la app.", daysAgo(68, 9, 10));
  await msg(cam, cam, "¡Gracias Martín! Mañana empiezo con Torso A.", daysAgo(68, 9, 32));
  await msg(cam, C, "Esta semana subimos 2.5 kg en press banca si completas las 10 reps.", daysAgo(6, 9, 12));
  await msg(cam, cam, "¡Va! El jueves lo intento.", daysAgo(6, 9, 40));
  await msg(cam, C, "Vi tu comentario de la sentadilla. Esta semana bajamos 5 kg y cuidamos la profundidad.", daysAgo(3, 8, 5));
  await msg(cam, cam, "Perfecto, así me siento más segura con la rodilla.", daysAgo(3, 8, 20));
  await msg(cam, C, "Recuerda que la mensualidad vence el día 5. ¡Gran mes, sigue así! 💪", daysAgo(1, 17, 30));
  await msg(cam, cam, "Listo, transfiero mañana. ¡Gracias!", daysAgo(1, 18, 2), false);
  await msg(lucas, C, "Lucas, excelente semana. Ya rozas los 120 kg en sentadilla.", daysAgo(2, 12, 15));
  await msg(lucas, lucas, "¡Gracias profe! El viernes voy por ellos.", daysAgo(2, 13, 0), false);
  await msg(diego, C, "Diego, ¿todo bien? Hace unos días que no registras entrenamientos.", daysAgo(1, 10, 0));
  await msg(vale, C, "¡Bienvenida, Valentina! Esta semana armo tu rutina según tu evaluación.", daysAgo(3, 15, 0));
  await msg(vale, vale, "Gracias, quedo atenta.", daysAgo(3, 15, 20), false);

  const post = (author, kind, text, at, likes = [], comments = []) => once("posts", `p-demo-${C}-${++seq}`, { coach_id: C, author_id: author, kind, text, at, likes: S(likes.filter(Boolean)), comments: S(comments.filter((c) => c.authorId)) });
  await post(C, "challenge", "Reto de este mes: 14 entrenamientos registrados. Quien lo cumpla gana una sesión de técnica gratis. 🏆", daysAgo(9, 8), allBuddies,
    [{ id: `c-demo-${++seq}`, authorId: cam, text: "¡Dentro!", at: daysAgo(9, 9) }, { id: `c-demo-${++seq}`, authorId: lucas, text: "Voy por ello.", at: daysAgo(9, 12) }]);
  await post(lucas, "post", "Primera vez con 110 kg en sentadilla. Gracias por la paciencia con la técnica.", daysAgo(5, 20), [C, cam, sofia],
    [{ id: `c-demo-${++seq}`, authorId: C, text: "Cada semana se ve mejor esa profundidad.", at: daysAgo(5, 21) }]);
  await post(cam, "post", "Hip thrust con 70 kg 🔥 hace dos meses no llegaba a 50.", daysAgo(3, 19, 40), [C, lucas, sofia, diego],
    [{ id: `c-demo-${++seq}`, authorId: sofia, text: "¡Qué crack!", at: daysAgo(3, 20) }, { id: `c-demo-${++seq}`, authorId: C, text: "Constancia pura. Orgulloso de ese progreso.", at: daysAgo(3, 20, 30) }]);
  await post(C, "post", "Tip de la semana: duerme 7–8 horas. La fuerza que ganas en el gimnasio se construye descansando. 😴", daysAgo(1, 7), [cam, sofia]);

  const tpl = (name, r) => once("templates", `t-demo-${C}-${++seq}`, { coach_id: C, created_at: daysAgo(90), data: S({ ...r, name }) });
  await tpl("Torso / Pierna 4 días", ROUTINES.camila());
  await tpl("Full body principiante", ROUTINES.full());
  await tpl("Fuerza 5×5 clásico", ROUTINES.strength());

  /* ---------- página de presentación ---------- */
  const img = {};
  for (const k of ["hero", "about", "card1", "card2", "card3", "g1", "g2", "g3", "g4", "g5", "g6"]) img[k] = await savePageImage(C, `${k}.jpg`);
  const id = () => crypto.randomBytes(5).toString("hex");
  const page = {
    theme: { mode: "dark", color: "", font: "modern", radius: "round" },
    hero: { showLogo: true, kicker: "Entrenamiento personal · Quito y online", title: "Entrena con un plan. Mide tu progreso.",
      subtitle: "Rutinas hechas para ti, seguimiento semanal real y una app donde ves cada kilo que subes. Sin adivinar, sin perder el tiempo.", image: img.hero, overlay: 35, align: "center" },
    contact: { whatsapp: "593991234567", whatsappText: "Hola Martín, vi tu página y quiero empezar a entrenar contigo.", ctaLabel: "Trabajemos juntos", floating: true, showLogin: true, loginLabel: "Iniciar sesión" },
    social: { instagram: "@pulso.training", tiktok: "@pulso.training", facebook: "", youtube: "@pulsotraining", email: "hola@example.com", website: "" },
    seo: { description: "Martín Vega, entrenador personal en Quito y online. Rutinas personalizadas, seguimiento semanal y resultados medibles.", footer: "Quito, Ecuador · Entrenamiento presencial y online" },
    sections: [
      { id: id(), type: "stats", visible: true, title: "", bg: "default", items: [
        { id: id(), value: "7+", title: "Años de experiencia" }, { id: id(), value: "+180", title: "Alumnos entrenados" },
        { id: id(), value: "-1.200 kg", title: "Perdidos entre todos" }, { id: id(), value: "4.9★", title: "Valoración promedio" }] },
      { id: id(), type: "about", visible: true, title: "Hola, soy Martín", imageSide: "left", bg: "alt", image: img.about,
        body: "Empecé a entrenar a los 17 y desde hace **7 años** ayudo a personas ocupadas a ponerse en forma sin vivir en el gimnasio.\n\nMi método es simple: un **plan por días**, cargas que suben cuando estás listo y una **revisión semanal** de tu progreso. Tú entrenas; yo me encargo de que cada sesión cuente.\n\nTrabajo presencial en Quito y online con alumnos de todo el país." },
      { id: id(), type: "cards", visible: true, title: "Cómo trabajamos", subtitle: "Todo lo que necesitas para avanzar, en un solo lugar.", columns: "3", bg: "default", items: [
        { id: id(), image: img.card1, icon: "", title: "Plan a tu medida", text: "Una rutina diseñada para tu objetivo, tu nivel y el tiempo que tienes. La ves en la app con videos y descansos." },
        { id: id(), image: img.card2, icon: "", title: "Progreso medido", text: "Cada serie queda registrada. Ves tus récords, tus medidas y cómo cambia tu cuerpo semana a semana." },
        { id: id(), image: img.card3, icon: "", title: "Chat directo", text: "Me escribes cuando lo necesites. Reviso tus entrenamientos y ajusto el plan según tus resultados." }] },
      { id: id(), type: "plans", visible: true, title: "Planes", subtitle: "Sin permanencia. Cambias o pausas cuando quieras.", bg: "alt", items: [
        { id: id(), title: "Online", price: "$35", period: "/mes", text: "Rutina personalizada en la app\nRevisión semanal\nChat directo", button: "Empezar online", highlight: false },
        { id: id(), title: "Online Pro", price: "$45", period: "/mes", text: "Todo lo del plan Online\nGuía de alimentación\nVideollamada mensual\nAjustes cada semana", button: "Quiero este", highlight: true },
        { id: id(), title: "Presencial", price: "$90", period: "/mes", text: "8 sesiones al mes conmigo\nCorrección de técnica en vivo\nTodo lo del plan Online Pro", button: "Reservar", highlight: false }] },
      { id: id(), type: "reviews", visible: true, title: "Lo que dicen mis asesorados", subtitle: "", bg: "default", items: [
        { id: id(), image: "", title: "Camila R.", detail: "-2.4 kg y -5 cm de cintura", rating: 5, text: "En dos meses subí 20 kg en hip thrust y bajé 5 cm de cintura. Me encanta ver mi progreso en la app." },
        { id: id(), image: "", title: "Lucas A.", detail: "Sentadilla de 90 a 115 kg", rating: 5, text: "La técnica cambió por completo. Cada semana sé exactamente qué peso usar." },
        { id: id(), image: "", title: "Sofía H.", detail: "-2.2 kg en 5 semanas", rating: 5, text: "Rutinas cortas que sí puedo cumplir con mi trabajo. Martín siempre responde rápido." },
        { id: id(), image: "", title: "Diego P.", detail: "Recomposición", rating: 4, text: "Me ayudó a volver a entrenar después de años. Muy buena organización y seguimiento." }] },
      { id: id(), type: "gallery", visible: true, title: "El día a día", subtitle: "", bg: "alt", items: [
        { id: id(), image: img.g1, title: "" }, { id: id(), image: img.g2, title: "" }, { id: id(), image: img.g3, title: "" },
        { id: id(), image: img.g4, title: "" }, { id: id(), image: img.g5, title: "" }, { id: id(), image: img.g6, title: "" }] },
      { id: id(), type: "faq", visible: true, title: "Preguntas frecuentes", bg: "default", items: [
        { id: id(), title: "¿Necesito ir a un gimnasio?", text: "Lo ideal es tener acceso a pesas, pero también armo planes para casa con lo que tengas." },
        { id: id(), title: "¿Cómo veo mi rutina?", text: "En la app VYTRAFIT: ahí tienes tu rutina, registras cada serie y me escribes por el chat." },
        { id: id(), title: "¿Puedo pausar mi plan?", text: "Sí. No hay permanencia: pausas o cambias de plan cuando quieras." },
        { id: id(), title: "¿Cada cuánto se ajusta la rutina?", text: "Reviso tu progreso cada semana y ajusto cargas o ejercicios según tus resultados." }] },
      { id: id(), type: "cta", visible: true, title: "¿Empezamos esta semana?", body: "Escríbeme y en menos de 24 horas tienes tu plan listo en la app.", button: "Trabajemos juntos", action: "whatsapp", link: "", bg: "brand" },
    ],
  };
  const row = { data: S(page), published: true, updated_at: nowISO() };
  if (await knex("coach_pages").where({ coach_id: C }).first()) await knex("coach_pages").where({ coach_id: C }).update(row);
  else await knex("coach_pages").insert({ coach_id: C, ...row });
  dropCache();

  await bump(...scopes);
  await done(`listo · ${people.length} asesorados · enlace ${slug}`);
  console.log(`[demo] Cuentas de prueba llenas: ${people.length} asesorados, página /${slug}`);
}
