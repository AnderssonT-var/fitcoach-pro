/* Asesorado (entrenamientos, peso, fotos propias, sus datos) y funciones compartidas
   (perfil, mensajes y comunidad). */
import { Router } from "express";
import { z } from "zod";
import { knex, bool, J, S } from "../db.js";
import { checkPassword, requireClientAccess, requireConsent, requireLicense } from "../auth.js";
import { bad, forbidden, h, notFound, nowISO, parse, uid } from "../util.js";
import { checkInlineImage, deleteFile, saveFile } from "../files.js";
import { buildState, userOut } from "../state.js";
import { groupOf } from "./common.js";
import { addToBests } from "../history.js";
import { deleteClientData, MESSAGE_TAGS, photosSchema, profileSchema, sessionSchema } from "./schemas.js";

/* ============================================================
   Cuenta del asesorado: exportar y eliminar (siempre disponibles)
   ============================================================ */
export const accountRouter = Router();
accountRouter.get("/export", h(async (req, res) => {
  const state = await buildState(req.user);
  const me = state.users.find((u) => u.id === req.user.id);
  const data = {
    exportadoEl: nowISO(), cuenta: { nombre: me.name, correo: me.email, creada: me.createdAt, perfil: me },
    asesoria: state.clients[0] || null, pagos: state.payments,
    // Exportación completa: todo el historial, no solo lo que la app muestra
    entrenamientos: (await knex("workouts").where(req.user.role === "coach" ? { coach_id: req.user.id } : { client_id: req.user.id }).orderBy("finished_at"))
      .map((w) => ({ ...J(w.data, {}), id: w.id, clientId: w.client_id, finishedAt: w.finished_at })),
    mensajes: (await knex("messages").where(req.user.role === "coach" ? { coach_id: req.user.id } : { client_id: req.user.id }).orderBy("at"))
      .map((m) => ({ de: m.from_id, texto: m.text, fecha: m.at })),
  };
  res.setHeader("Content-Disposition", `attachment; filename="mis-datos-vytrafit.json"`);
  res.json(data);
}));
accountRouter.delete("/", h(async (req, res) => {
  if (req.user.role !== "client") throw bad("Para cerrar una cuenta de entrenador escribe al administrador.");
  const { password } = parse(z.object({ password: z.string().max(200) }), req.body);
  if (!(await checkPassword(password, req.user.password_hash))) throw bad("La contraseña no coincide.");
  await deleteClientData(req.user.id);
  res.json({ ok: true });
}));

/* ============================================================
   Asesorado
   ============================================================ */
export const clientRouter = Router();
clientRouter.use(requireClientAccess, requireConsent);

async function editMine(userId, fn) {
  return knex.transaction(async (trx) => {
    const c = await trx("clients").where({ user_id: userId }).first();
    const data = J(c.data, {});
    const out = await fn(data, c, trx);
    await trx("clients").where({ user_id: userId }).update({ data: S(data) });
    return out;
  });
}

clientRouter.post("/weight", h(async (req, res) => {
  const { kg } = parse(z.object({ kg: z.number().min(20).max(400) }), req.body);
  await editMine(req.user.id, (d) => { (d.weights ||= []).push({ date: nowISO(), kg }); });
  res.json({ ok: true });
}));

clientRouter.post("/photos", h(async (req, res) => {
  const { photos } = parse(photosSchema, req.body);
  if (!bool(req.user.photo_consent)) throw bad("Activa el permiso de fotos en «Mi perfil» para subirlas.");
  for (const p of photos) {
    const fileId = await saveFile("photos", req.user.id, p.src, 4 * 1024 * 1024);
    await knex("photos").insert({ id: uid("ph-"), client_id: req.user.id, file_id: fileId, pose: p.pose, note: p.note || "",
      date: p.date ? new Date(`${p.date}T08:00:00`).toISOString() : nowISO(), by_id: req.user.id, at: nowISO() });
  }
  res.status(201).json({ ok: true });
}));
clientRouter.delete("/photos/:pid", h(async (req, res) => {
  const p = await knex("photos").where({ id: req.params.pid, client_id: req.user.id }).first();
  if (!p) throw notFound();
  await knex("photos").where({ id: p.id }).delete();
  await deleteFile(p.file_id);
  res.json({ ok: true });
}));

/* ---------- entrenamiento en vivo ---------- */
clientRouter.put("/workout/active", h(async (req, res) => {
  const session = parse(sessionSchema, req.body);
  if (session.clientId !== req.user.id) throw forbidden();
  const row = { data: S(session), updated_at: nowISO() };
  const n = await knex("active_workouts").where({ client_id: req.user.id }).update(row);
  if (!n) await knex("active_workouts").insert({ client_id: req.user.id, ...row });
  res.json({ ok: true });
}));
clientRouter.delete("/workout/active", h(async (req, res) => {
  await knex("active_workouts").where({ client_id: req.user.id }).delete();
  res.json({ ok: true });
}));

clientRouter.post("/workout/finish", h(async (req, res) => {
  const body = parse(z.object({
    session: sessionSchema, difficulty: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional().default(""),
    share: z.boolean().optional().default(false), prName: z.string().trim().max(80).optional(),
  }), req.body);
  const a = body.session;
  if (a.clientId !== req.user.id) throw forbidden();
  const coachId = req.client.coach_id;
  const finishedAt = nowISO();

  // Récords contra el historial guardado en el servidor
  const history = (await knex("workouts").where({ client_id: req.user.id }).select("data")).map((w) => J(w.data, {}));
  const best = (exId) => Math.max(0, ...history.flatMap((w) => (w.exercises || []).filter((e) => e.exId === exId)
    .flatMap((e) => e.sets.filter((x) => x.done && x.reps > 0).map((x) => +x.weight || 0))));
  const prs = [];
  const exercises = a.exercises.map((e) => {
    const clean = (x) => ({ weight: Math.max(0, Math.min(1000, +x.weight || 0)), reps: Math.max(0, Math.min(500, Math.round(+x.reps || 0))), done: !!x.done });
    const sets = e.sets.map((x) => {
      const out = clean(x);
      const drops = (x.drops || []).map(clean).filter((d) => d.done && d.reps > 0);
      return drops.length ? { ...out, drops } : out;
    });
    const top = Math.max(0, ...sets.filter((x) => x.done && x.reps > 0).map((x) => x.weight));
    const prev = best(e.exId);
    if (prev > 0 && top > prev) prs.push({ exId: e.exId, weight: top, prev });
    return { exId: e.exId, target: e.target, sets };
  });
  const started = Date.parse(a.startedAt);
  const durationSec = Number.isFinite(started) ? Math.max(0, Math.min(6 * 3600, Math.round((Date.now() - started) / 1000))) : 0;
  const w = { dayId: a.dayId, dayName: a.dayName, routineName: a.routineName, startedAt: a.startedAt, durationSec, difficulty: body.difficulty, comment: body.comment, prs, exercises };
  const id = uid("w-");
  await knex.transaction(async (trx) => {
    await trx("workouts").insert({ id, client_id: req.user.id, coach_id: coachId, finished_at: finishedAt, data: S(w) });
    // Récords de todos los tiempos del asesorado
    const cRow = await trx("clients").where({ user_id: req.user.id }).first();
    const cd = J(cRow.data, {});
    if (cd.bests) await trx("clients").where({ user_id: req.user.id }).update({ data: S({ ...cd, bests: addToBests(cd.bests, { ...w, finishedAt }) }) });
    await trx("active_workouts").where({ client_id: req.user.id }).delete();
    if (body.comment) {
      await trx("messages").insert({ id: uid("m-"), coach_id: coachId, client_id: req.user.id, from_id: req.user.id, read: false, at: finishedAt,
        text: `Comentario del entrenamiento (${a.dayName}): ${body.comment}` });
    }
    if (body.share) {
      const pr = prs[0] && body.prName ? ` Nuevo récord en ${body.prName}: ${prs[0].weight} kg.` : "";
      await trx("posts").insert({ id: uid("p-"), coach_id: coachId, author_id: req.user.id, kind: "workout", at: finishedAt, likes: S([]), comments: S([]),
        text: `${req.user.name.split(" ")[0]} completó ${a.dayName} en ${Math.round(durationSec / 60)} min.${pr}`, workout_id: id });
    }
  });
  const volume = exercises.reduce((t, e) => t + e.sets.filter((x) => x.done).reduce((s, x) => s + x.weight * x.reps + (x.drops || []).reduce((v, d) => v + d.weight * d.reps, 0), 0), 0);
  const done = exercises.reduce((t, e) => t + e.sets.filter((x) => x.done).length, 0);
  res.status(201).json({ ...w, id, clientId: req.user.id, finishedAt, volume, done });
}));

/* ============================================================
   Compartido: perfil, mensajes y comunidad
   ============================================================ */
export const sharedRouter = Router();
sharedRouter.use(requireLicense, requireClientAccess, requireConsent);

sharedRouter.put("/profile", h(async (req, res) => {
  const body = parse(profileSchema, req.body);
  if (body.photo) checkInlineImage(body.photo, 300 * 1024);
  const { name, ...rest } = body;
  // Campos que aplican a cada rol
  const allowed = req.user.role === "coach"
    ? ["photo", "phone", "city", "headline", "years", "instagram", "bio", "specialties", "certifications", "services", "body"]
    : ["photo", "phone", "bio", "injuries", "birthYear", "body"];
  const profile = J(req.user.profile, {});
  for (const k of allowed) if (rest[k] !== undefined) profile[k] = rest[k];
  await knex.transaction(async (trx) => {
    await trx("users").where({ id: req.user.id }).update({ profile: S(profile), ...(name ? { name } : {}) });
    if (req.user.role === "client" && rest.phone !== undefined) {
      const c = await trx("clients").where({ user_id: req.user.id }).first();
      await trx("clients").where({ user_id: req.user.id }).update({ data: S({ ...J(c.data, {}), phone: rest.phone }) });
    }
  });
  res.json({ ok: true });
}));

/** Conversación: el entrenador elige con qué asesorado; el asesorado siempre con su entrenador. */
async function pair(req, clientId) {
  if (req.user.role === "coach") {
    const c = await knex("clients").where({ user_id: +clientId, coach_id: req.user.id }).first();
    if (!c) throw notFound("No encontramos esa conversación.");
    return { coachId: req.user.id, clientId: c.user_id };
  }
  if (req.user.role === "client") return { coachId: req.client.coach_id, clientId: req.user.id };
  throw forbidden();
}

sharedRouter.post("/messages", h(async (req, res) => {
  const body = parse(z.object({
    clientId: z.number().int().optional(), text: z.string().trim().min(1, "Escribe un mensaje.").max(2000),
    exId: z.number().int().positive().optional(), tag: z.enum(MESSAGE_TAGS).optional(),
  }), req.body);
  const p = await pair(req, body.clientId);
  // Solo se puede etiquetar un ejercicio de la biblioteca general o de este entrenador
  if (body.exId && body.exId >= 100000 && !(await knex("exercises").where({ id: body.exId, coach_id: p.coachId }).first())) throw notFound("No encontramos ese ejercicio.");
  const m = { id: uid("m-"), coach_id: p.coachId, client_id: p.clientId, from_id: req.user.id, text: body.text, at: nowISO(), read: false,
    ...(body.exId ? { ex_id: body.exId, tag: body.tag || "comentario" } : {}) };
  await knex("messages").insert(m);
  res.status(201).json({ id: m.id });
}));
sharedRouter.post("/messages/read", h(async (req, res) => {
  const body = parse(z.object({ clientId: z.number().int().optional() }), req.body);
  const p = await pair(req, body.clientId);
  await knex("messages").where({ coach_id: p.coachId, client_id: p.clientId }).whereNot({ from_id: req.user.id }).update({ read: true });
  res.json({ ok: true });
}));

async function visiblePost(req, id) {
  const group = await groupOf(req.user);
  const p = await knex("posts").where({ id, coach_id: group }).first();
  if (!p) throw notFound("Esa publicación ya no existe.");
  return p;
}
sharedRouter.post("/posts", h(async (req, res) => {
  const body = parse(z.object({ text: z.string().trim().min(1, "Escribe algo para publicar.").max(1000), kind: z.enum(["post", "challenge"]).default("post") }), req.body);
  if (body.kind === "challenge" && req.user.role !== "coach") throw forbidden("Solo el entrenador puede publicar retos.");
  const group = await groupOf(req.user);
  await knex("posts").insert({ id: uid("p-"), coach_id: group, author_id: req.user.id, kind: body.kind, text: body.text, at: nowISO(), likes: S([]), comments: S([]) });
  res.status(201).json({ ok: true });
}));
sharedRouter.post("/posts/:id/like", h(async (req, res) => {
  const p = await visiblePost(req, req.params.id);
  const likes = J(p.likes, []);
  const next = likes.includes(req.user.id) ? likes.filter((x) => x !== req.user.id) : [...likes, req.user.id];
  await knex("posts").where({ id: p.id }).update({ likes: S(next) });
  res.json({ ok: true });
}));
sharedRouter.post("/posts/:id/comments", h(async (req, res) => {
  const { text } = parse(z.object({ text: z.string().trim().min(1).max(500) }), req.body);
  const p = await visiblePost(req, req.params.id);
  const comments = [...J(p.comments, []), { id: uid("c-"), authorId: req.user.id, text, at: nowISO() }];
  await knex("posts").where({ id: p.id }).update({ comments: S(comments) });
  res.status(201).json({ ok: true });
}));
sharedRouter.delete("/posts/:id", h(async (req, res) => {
  const p = await visiblePost(req, req.params.id);
  if (p.author_id !== req.user.id && req.user.role !== "coach") throw forbidden("Solo puedes borrar tus publicaciones.");
  await knex("posts").where({ id: p.id }).delete();
  res.json({ ok: true });
}));

export { userOut };
