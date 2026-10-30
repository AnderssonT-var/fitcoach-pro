/* Entrenador: asesorados, rutinas, seguimiento, biblioteca, pagos, marca y suscripción. */
import { Router } from "express";
import { z } from "zod";
import { knex, bool, J, S } from "../db.js";
import { hashPassword, requireConsent, requireLicense, revokeAll, tempPassword } from "../auth.js";
import { bad, h, notFound, nowISO, parse, stamp, uid, addMonths, monthlyConcept, round2, isForever, licenseEnd } from "../util.js";
import { hasMonthly } from "../history.js";
import { checkInlineImage, deleteFile, saveFile } from "../files.js";
import { coachReviewRoutes, approvedReviews } from "../reviews.js";
import { SCHEMA, cleanPage, loadPage, previewSig, renderPage, savePage, dropCache } from "../landing.js";
import { PLAN_MONTHS, getPricing, planPrice } from "../state.js";
import { codeLimiter } from "./auth.js";
import { convertTrial } from "../trial.js";
import { notifyLater } from "../notify.js";
import { insertClient, newTrial, trialConcept } from "../clients.js";
import { RESERVED_SLUGS, log, normalizeCode, ownClient, slugify } from "./common.js";
import { routineSchema, measurementSchema, photosSchema, exerciseSchema, deleteClientData } from "./schemas.js";

export const router = Router();
const plural = (m) => `${m} ${m === 1 ? "mes" : "meses"}`;

/* ============================================================
   Sin licencia vigente también se puede: canjear código y pagar
   ============================================================ */
router.post("/redeem", codeLimiter, h(async (req, res) => {
  const { code } = parse(z.object({ code: z.string().max(40) }), req.body);
  const norm = normalizeCode(code);
  await knex.transaction(async (trx) => {
    const l = await trx("licenses").where({ code: norm }).first();
    if (!l || bool(l.revoked) || l.coach_id) throw bad("El código no es válido o ya fue usado.");
    const cur = await trx("licenses").where({ coach_id: req.user.id, revoked: false }).where("expires_at", ">", nowISO()).orderBy("expires_at", "desc").first();
    if (cur && isForever(cur.expires_at)) throw bad("Tu licencia es indefinida: no necesitas canjear otro código.");
    const from = cur ? new Date(cur.expires_at) : new Date();
    const n = await trx("licenses").where({ id: l.id, revoked: false }).whereNull("coach_id")
      .update({ coach_id: req.user.id, activated_at: nowISO(), expires_at: licenseEnd(from, l.months) });
    if (n !== 1) throw bad("El código no es válido o ya fue usado.");
    await log(trx, "license", `${req.user.name} canjeó un código (${l.months ? `+${plural(l.months)}` : "licencia indefinida"})`);
  });
  res.json({ ok: true });
}));

router.post("/subscriptions", h(async (req, res) => {
  const body = parse(z.object({
    months: z.number().int().refine((m) => PLAN_MONTHS.includes(m), "Elige un plan."),
    method: z.string().trim().min(2).max(40), reference: z.string().trim().max(120).optional().default(""),
    receipt: z.string().max(6_000_000, "El comprobante pesa demasiado."),
  }), req.body);
  if (await knex("subscriptions").where({ coach_id: req.user.id, status: "pending" }).first()) {
    throw bad("Ya tienes un pago en revisión. Te avisaremos cuando el administrador lo apruebe.");
  }
  const pricing = await getPricing();
  const amount = planPrice(pricing, body.months); // el precio lo pone el servidor, nunca el cliente
  const fileId = await saveFile("receipts", req.user.id, body.receipt, 4 * 1024 * 1024);
  await knex("subscriptions").insert({ id: uid("sub-"), coach_id: req.user.id, months: body.months, amount, status: "pending",
    method: body.method, reference: body.reference, receipt_file: fileId, created_at: nowISO() });
  await log(null, "license", `${req.user.name} envió un pago de $${amount.toFixed(2)} por ${plural(body.months)}`);
  res.status(201).json({ ok: true, amount });
}));

/* ============================================================
   Marca (sin licencia también, para preparar su acceso)
   ============================================================ */
router.put("/brand", h(async (req, res) => {
  const body = parse(z.object({
    businessName: z.string().trim().max(60).optional(), tagline: z.string().trim().max(90).optional(),
    color: z.string().regex(/^(#[0-9a-fA-F]{6})?$/).optional(), logo: z.string().max(500_000).nullable().optional(), slug: z.string().max(60).optional(),
    // Inscripción desde el enlace: abierta o no, mensualidad, prueba y plantilla de rutina inicial
    signup: z.object({ open: z.boolean(), fee: z.number().min(0).max(100000), trialDays: z.union([z.literal(0), z.literal(7), z.literal(14), z.literal(21), z.literal(30)]),
      trialFee: z.number().min(0).max(100000), templateId: z.string().max(40).nullable() }).optional(),
  }), req.body);
  if (body.signup?.templateId && !(await knex("templates").where({ id: body.signup.templateId, coach_id: req.user.id }).first())) throw bad("Esa plantilla ya no existe.");
  const patch = {};
  if (body.slug !== undefined) {
    const slug = slugify(body.slug);
    if (slug.length < 3) throw bad("El enlace necesita al menos 3 letras o números.");
    if (RESERVED_SLUGS.has(slug)) throw bad("Ese enlace está reservado. Prueba con otro.");
    if (await knex("users").where({ brand_slug: slug }).whereNot({ id: req.user.id }).first()) throw bad("Ese enlace ya lo usa otro entrenador. Prueba con otro.");
    patch.brand_slug = slug;
    dropCache();
  }
  if (body.logo !== undefined) checkInlineImage(body.logo, 350 * 1024);
  const { slug: _s, ...rest } = body;
  patch.brand = S({ ...J(req.user.brand, {}), ...rest });
  await knex("users").where({ id: req.user.id }).update(patch);
  res.json({ ok: true });
}));

/* ============================================================
   Página de presentación (se puede preparar sin licencia; se publica con licencia)
   ============================================================ */
router.get("/page", h(async (req, res) => {
  res.json({ page: await loadPage(req.user), schema: SCHEMA, slug: req.user.brand_slug || "", preview: previewSig(req.user.id) });
}));
router.put("/page", h(async (req, res) => {
  if (!req.body || typeof req.body !== "object" || !Array.isArray(req.body.sections)) throw bad("La página no es válida.");
  const page = await savePage(req.user, req.body);
  res.json({ ok: true, page });
}));
router.post("/page/preview", h(async (req, res) => {
  const mine = new Set((await knex("files").where({ owner_id: req.user.id, kind: "page" }).select("id")).map((r) => r.id));
  const page = cleanPage(req.body || {}, mine);
  const origin = `${req.protocol}://${req.get("host")}`;
  res.json({ html: renderPage({ page, coach: req.user, origin, slug: req.user.brand_slug || "", preview: true, clientReviews: await approvedReviews(req.user.id) }) });
}));
coachReviewRoutes(router);
router.post("/page/image", h(async (req, res) => {
  const { data } = parse(z.object({ data: z.string().max(3_000_000) }), req.body);
  const n = +(await knex("files").where({ owner_id: req.user.id, kind: "page" }).count({ n: "*" }).first()).n;
  if (n >= SCHEMA.limits.images) throw bad(`Llegaste al máximo de ${SCHEMA.limits.images} imágenes en tu página. Quita alguna que ya no uses y guarda.`);
  const id = await saveFile("page", req.user.id, data, 1.6 * 1024 * 1024);
  res.status(201).json({ id, url: `/p/img/${id}` });
}));

/* ============================================================
   Desde aquí se exige licencia vigente y términos aceptados
   ============================================================ */
router.use(requireLicense, requireConsent);

/* ---------- asesorados ---------- */
const trialSchema = z.object({ days: z.number().int().min(1).max(60), fee: z.number().min(0).max(100000).optional().default(0) });
const clientFields = {
  goal: z.string().trim().max(60), phone: z.string().trim().max(30), heightCm: z.number().min(50).max(260).nullable(),
  fee: z.number().min(0).max(100000), billingDay: z.number().int().min(1).max(28), active: z.boolean(),
};
router.post("/clients", h(async (req, res) => {
  const body = parse(z.object({
    name: z.string().trim().min(2, "Escribe el nombre.").max(120), email: z.string().trim().toLowerCase().email("Escribe un correo válido.").max(190),
    goal: clientFields.goal, phone: clientFields.phone.optional().default(""), height: z.number().min(0).max(260).optional().nullable(),
    weight: z.number().min(0).max(400).optional().nullable(), fee: z.number().min(0).max(100000).optional().default(0),
    trial: trialSchema.optional().nullable(),
  }), req.body);
  if (await knex("users").where({ email: body.email }).first()) throw bad("Ya existe una cuenta con ese correo.");
  const password = tempPassword();
  const hash = await hashPassword(password);
  const out = await knex.transaction(async (trx) => {
    const userId = await insertClient(trx, { coach: req.user, name: body.name, email: body.email, passwordHash: hash, mustChange: true,
      phone: body.phone, goal: body.goal, fee: body.fee, height: body.height, weight: body.weight, trial: body.trial });
    await log(trx, "client", `${req.user.name} agregó un asesorado`);
    return { userId };
  });
  res.status(201).json({ user: { id: out.userId, name: body.name, email: body.email }, password });
}));

router.patch("/clients/:id", h(async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(190),
    ...Object.fromEntries(Object.entries(clientFields)) }).partial(), req.body);
  const c = await ownClient(req.user.id, req.params.id);
  if (body.email && await knex("users").where({ email: body.email }).whereNot({ id: c.user_id }).first()) throw bad("Ese correo ya lo usa otra cuenta.");
  await knex.transaction(async (trx) => {
    const up = {};
    if (body.name) up.name = body.name;
    if (body.email) up.email = body.email;
    if (Object.keys(up).length) await trx("users").where({ id: c.user_id }).update(up);
    const data = J(c.data, {});
    for (const k of ["goal", "phone", "heightCm", "fee", "billingDay"]) if (body[k] !== undefined) data[k] = body[k];
    await trx("clients").where({ user_id: c.user_id }).update({ data: S(data), ...(body.active !== undefined ? { active: body.active } : {}) });
    if (body.active === false) await revokeAll(c.user_id, trx); // pausar cierra sus sesiones
  });
  res.json({ ok: true });
}));

router.post("/clients/:id/reset-password", h(async (req, res) => {
  const c = await ownClient(req.user.id, req.params.id);
  const password = tempPassword();
  await knex.transaction(async (trx) => {
    await trx("users").where({ id: c.user_id }).update({ password_hash: await hashPassword(password), must_change_password: true, failed_logins: 0, locked_until: null });
    await revokeAll(c.user_id, trx);
  });
  res.json({ password });
}));

router.delete("/clients/:id", h(async (req, res) => {
  const c = await ownClient(req.user.id, req.params.id);
  await deleteClientData(c.user_id);
  await log(null, "client", `${req.user.name} eliminó a un asesorado y sus datos`);
  res.json({ ok: true });
}));

/** Lee, modifica y guarda el JSON de datos de un asesorado. */
async function editClient(coachId, clientId, fn) {
  return knex.transaction(async (trx) => {
    const c = await ownClient(coachId, clientId, trx);
    const data = J(c.data, {});
    const out = await fn(data, c, trx);
    await trx("clients").where({ user_id: c.user_id }).update({ data: S(data) });
    return out;
  });
}

router.post("/clients/:id/weight", h(async (req, res) => {
  const { kg } = parse(z.object({ kg: z.number().min(20).max(400) }), req.body);
  await editClient(req.user.id, req.params.id, (d) => { (d.weights ||= []).push({ date: stamp(), kg }); });
  res.json({ ok: true });
}));

router.put("/clients/:id/routine", h(async (req, res) => {
  const { routine, slot } = parse(z.object({ routine: routineSchema.nullable(), slot: z.enum(["current", "plan"]).optional().default("current") }), req.body);
  await editClient(req.user.id, req.params.id, (d) => {
    if (slot === "plan") {
      if (!d.trial || !["active", "ended"].includes(d.trial.status)) throw bad("Este cliente no está en plan de prueba.");
      d.planRoutine = routine;
    } else d.routine = routine;
  });
  if (slot === "current" && routine) notifyLater(+req.params.id, { title: "Tu rutina se actualizó", body: `${req.user.name.split(" ")[0]} actualizó «${routine.name || "tu rutina"}». Ábrela para ver los cambios.`, page: "rutina", tag: "routine", kind: "routine" });
  res.json({ ok: true });
}));

/* ---------- plan de prueba ---------- */
router.post("/clients/:id/trial", h(async (req, res) => {
  const body = parse(trialSchema, req.body);
  const c = await ownClient(req.user.id, req.params.id);
  const d = J(c.data, {});
  if (d.trial && ["active", "ended"].includes(d.trial.status)) throw bad("Este cliente ya está en plan de prueba.");
  await knex.transaction(async (trx) => {
    d.trial = newTrial(body);
    d.planRoutine = null;
    await trx("clients").where({ user_id: c.user_id }).update({ data: S(d) });
    if (body.fee > 0) await trx("payments").insert({ id: uid("pay-"), coach_id: req.user.id, client_id: c.user_id, concept: trialConcept(body.days), amount: body.fee, due_date: nowISO(), paid_at: null, method: "" });
  });
  res.status(201).json({ ok: true });
}));
router.post("/clients/:id/trial/extend", h(async (req, res) => {
  const { days } = parse(z.object({ days: z.number().int().min(1).max(60) }), req.body);
  await editClient(req.user.id, req.params.id, (d) => {
    if (!d.trial || !["active", "ended"].includes(d.trial.status)) throw bad("Este cliente no está en plan de prueba.");
    const from = Math.max(Date.now(), Date.parse(d.trial.end));
    d.trial = { ...d.trial, status: "active", end: new Date(from + days * 864e5).toISOString(), days: d.trial.days + days };
  });
  res.json({ ok: true });
}));
router.post("/clients/:id/trial/convert", h(async (req, res) => {
  const c = await ownClient(req.user.id, req.params.id);
  const d = J(c.data, {});
  if (!d.trial || !["active", "ended"].includes(d.trial.status)) throw bad("Este cliente no está en plan de prueba.");
  if (!d.planRoutine && !d.routine) throw bad("Prepara primero la rutina del plan completo.");
  await knex.transaction((trx) => convertTrial(trx, c));
  res.json({ ok: true });
}));
router.post("/clients/:id/trial/cancel", h(async (req, res) => {
  const { pause } = parse(z.object({ pause: z.boolean().optional().default(true) }), req.body);
  const c = await ownClient(req.user.id, req.params.id);
  const d = J(c.data, {});
  if (!d.trial || !["active", "ended"].includes(d.trial.status)) throw bad("Este cliente no está en plan de prueba.");
  await knex.transaction(async (trx) => {
    d.trial = { ...d.trial, status: "cancelled", end: Date.parse(d.trial.end) > Date.now() ? nowISO() : d.trial.end };
    d.planRoutine = null;
    await trx("clients").where({ user_id: c.user_id }).update({ data: S(d), ...(pause ? { active: false } : {}) });
    if (pause) await revokeAll(c.user_id, trx);
  });
  res.json({ ok: true });
}));

router.post("/clients/:id/measurements", h(async (req, res) => {
  const m = parse(measurementSchema, req.body);
  await editClient(req.user.id, req.params.id, (d) => {
    const row = { id: uid("ms-"), date: m.date ? new Date(`${m.date}T08:00:00`).toISOString() : stamp(), note: m.note || "" };
    for (const k of ["weight", "fat", "waist", "hip", "chest", "arm", "thigh"]) if (m[k] != null) row[k] = m[k];
    (d.measurements ||= []).push(row);
    d.measurements.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (row.weight) { (d.weights ||= []).push({ date: row.date, kg: row.weight }); d.weights.sort((a, b) => new Date(a.date) - new Date(b.date)); }
  });
  res.status(201).json({ ok: true });
}));
router.delete("/clients/:id/measurements/:mid", h(async (req, res) => {
  await editClient(req.user.id, req.params.id, (d) => { d.measurements = (d.measurements || []).filter((m) => m.id !== req.params.mid); });
  res.json({ ok: true });
}));

/* ---------- fotos de progreso: solo con permiso del asesorado ---------- */
router.post("/clients/:id/photos", h(async (req, res) => {
  const { photos } = parse(photosSchema, req.body);
  const c = await ownClient(req.user.id, req.params.id);
  const u = await knex("users").where({ id: c.user_id }).first();
  if (!bool(u.photo_consent)) throw bad(`${u.name.split(" ")[0]} no ha dado permiso para guardar fotos de su cuerpo. Puede activarlo en «Mi perfil».`);
  for (const p of photos) {
    const fileId = await saveFile("photos", c.user_id, p.src, 4 * 1024 * 1024);
    await knex("photos").insert({ id: uid("ph-"), client_id: c.user_id, file_id: fileId, pose: p.pose, note: p.note || "",
      date: p.date ? new Date(`${p.date}T08:00:00`).toISOString() : stamp(), by_id: req.user.id, at: stamp() });
  }
  res.status(201).json({ ok: true });
}));
router.delete("/clients/:id/photos/:pid", h(async (req, res) => {
  const c = await ownClient(req.user.id, req.params.id);
  const p = await knex("photos").where({ id: req.params.pid, client_id: c.user_id }).first();
  if (!p) throw notFound();
  await knex("photos").where({ id: p.id }).delete();
  await deleteFile(p.file_id);
  res.json({ ok: true });
}));

/* ---------- notas privadas ---------- */
const noteSchema = z.object({ text: z.string().trim().min(1).max(2000), category: z.string().trim().max(30) });
router.post("/clients/:id/notes", h(async (req, res) => {
  const n = parse(noteSchema, req.body);
  await editClient(req.user.id, req.params.id, (d) => { (d.notes ||= []).push({ id: uid("nt-"), at: stamp(), category: n.category, text: n.text, pinned: false }); });
  res.status(201).json({ ok: true });
}));
router.patch("/clients/:id/notes/:nid", h(async (req, res) => {
  const patch = parse(noteSchema.extend({ pinned: z.boolean() }).partial(), req.body);
  await editClient(req.user.id, req.params.id, (d) => {
    const n = (d.notes || []).find((x) => x.id === req.params.nid);
    if (!n) throw notFound();
    Object.assign(n, patch);
  });
  res.json({ ok: true });
}));
router.delete("/clients/:id/notes/:nid", h(async (req, res) => {
  await editClient(req.user.id, req.params.id, (d) => { d.notes = (d.notes || []).filter((n) => n.id !== req.params.nid); });
  res.json({ ok: true });
}));

/* ---------- plantillas ---------- */
router.post("/templates", h(async (req, res) => {
  const { routine, name } = parse(z.object({ routine: routineSchema, name: z.string().trim().min(1).max(80) }), req.body);
  await knex("templates").insert({ id: uid("t-"), coach_id: req.user.id, created_at: nowISO(), data: S({ ...routine, name }) });
  res.status(201).json({ ok: true });
}));
router.delete("/templates/:id", h(async (req, res) => {
  const n = await knex("templates").where({ id: req.params.id, coach_id: req.user.id }).delete();
  if (!n) throw notFound();
  res.json({ ok: true });
}));

/* ---------- ejercicios propios ---------- */
async function exerciseData(body, prev = {}) {
  const { photo, ...rest } = body;
  const data = { ...prev, ...rest };
  if (photo === null) { if (prev.photoFile) await deleteFile(prev.photoFile); delete data.photoFile; }
  else if (typeof photo === "string" && photo.startsWith("data:")) {
    if (prev.photoFile) await deleteFile(prev.photoFile);
    data.photoFile = await saveFile("exercises", 0, photo, 2 * 1024 * 1024);
  }
  delete data.photo;
  return data;
}
router.post("/exercises", h(async (req, res) => {
  const body = parse(exerciseSchema, req.body);
  const data = S(await exerciseData(body));
  // El id es correlativo; si dos entrenadores crean a la vez, se reintenta con el siguiente
  for (let tries = 0; ; tries++) {
    const max = (await knex("exercises").max({ m: "id" }).first())?.m || 0;
    const id = Math.max(100000, +max) + 1;
    try {
      await knex("exercises").insert({ id, coach_id: req.user.id, data });
      return res.status(201).json({ id });
    } catch (e) {
      if (tries >= 4 || !/unique|duplicate|primary/i.test(String(e?.message || e?.code))) throw e;
    }
  }
}));
router.put("/exercises/:id", h(async (req, res) => {
  const body = parse(exerciseSchema, req.body);
  const e = await knex("exercises").where({ id: +req.params.id, coach_id: req.user.id }).first();
  if (!e) throw notFound();
  await knex("exercises").where({ id: e.id }).update({ data: S(await exerciseData(body, J(e.data, {}))) });
  res.json({ ok: true });
}));
router.delete("/exercises/:id", h(async (req, res) => {
  const e = await knex("exercises").where({ id: +req.params.id, coach_id: req.user.id }).first();
  if (!e) throw notFound();
  const clients = await knex("clients").where({ coach_id: req.user.id }).select("data");
  const uses = (r) => r?.days?.some((d) => d.exercises.some((x) => x.exId === e.id));
  if (clients.some((c) => { const d = J(c.data, {}); return uses(d.routine) || uses(d.planRoutine); })) {
    throw bad("Ese ejercicio está en la rutina de un asesorado. Quítalo de esas rutinas primero.");
  }
  await knex("exercises").where({ id: e.id }).delete();
  await deleteFile(J(e.data, {}).photoFile);
  res.json({ ok: true });
}));

/* ---------- pagos de los asesorados ---------- */
router.post("/payments", h(async (req, res) => {
  const p = parse(z.object({ clientId: z.number().int(), concept: z.string().trim().min(1).max(120), amount: z.number().min(0).max(100000),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), paid: z.boolean().optional(), method: z.string().trim().max(40).optional() }), req.body);
  await ownClient(req.user.id, p.clientId);
  await knex("payments").insert({ id: uid("pay-"), coach_id: req.user.id, client_id: p.clientId, concept: p.concept, amount: round2(p.amount),
    due_date: new Date(`${p.dueDate}T09:00:00`).toISOString(), paid_at: p.paid ? stamp() : null, method: p.paid ? p.method || "" : "" });
  res.status(201).json({ ok: true });
}));
router.post("/payments/:id/paid", h(async (req, res) => {
  const { method } = parse(z.object({ method: z.string().trim().max(40) }), req.body);
  const n = await knex("payments").where({ id: req.params.id, coach_id: req.user.id }).update({ paid_at: stamp(), method });
  if (!n) throw notFound();
  res.json({ ok: true });
}));
router.post("/payments/:id/unpaid", h(async (req, res) => {
  const n = await knex("payments").where({ id: req.params.id, coach_id: req.user.id }).update({ paid_at: null, method: "" });
  if (!n) throw notFound();
  res.json({ ok: true });
}));
router.delete("/payments/:id", h(async (req, res) => {
  const n = await knex("payments").where({ id: req.params.id, coach_id: req.user.id }).delete();
  if (!n) throw notFound();
  res.json({ ok: true });
}));
router.post("/payments/generate-monthly", h(async (req, res) => {
  const now = new Date();
  const concept = monthlyConcept(now);
  let created = 0;
  await knex.transaction(async (trx) => {
    const clients = await trx("clients").where({ coach_id: req.user.id, active: true });
    for (const c of clients) {
      const d = J(c.data, {});
      if (!(d.fee > 0)) continue;
      if (d.trial && ["active", "ended"].includes(d.trial.status)) continue; // en prueba aún no paga mensualidad
      if (await hasMonthly(trx, c.user_id, now)) continue;
      const due = new Date(now.getFullYear(), now.getMonth(), Math.min(d.billingDay || 1, 28), 9);
      await trx("payments").insert({ id: uid("pay-"), coach_id: req.user.id, client_id: c.user_id, concept, amount: d.fee, due_date: due.toISOString(), paid_at: null, method: "" });
      created++;
    }
  });
  res.json({ created });
}));
