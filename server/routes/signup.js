/* Inscripción de un asesorado desde el enlace de su entrenador (si el entrenador la abrió). */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { knex, J } from "../db.js";
import { coachLicenseRow, hashPassword, issueTokens, passwordProblem } from "../auth.js";
import { HttpError, bad, h, parse } from "../util.js";
import { cloneRoutine, insertClient } from "../clients.js";
import { notifyLater } from "../notify.js";
import { log } from "./common.js";

export const signupRouter = Router();

/** Ajustes de inscripción del entrenador (guardados en su marca). */
export function signupSettings(coach) {
  const s = J(coach.brand, {}).signup || {};
  return { open: !!s.open, fee: +s.fee || 0, trialDays: +s.trialDays || 0, trialFee: +s.trialFee || 0, templateId: s.templateId || null };
}

const limiter = rateLimit({ windowMs: 60 * 60e3, limit: 8, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Demasiadas inscripciones desde esta conexión. Intenta más tarde." } });

signupRouter.post("/", limiter, h(async (req, res) => {
  const b = parse(z.object({
    slug: z.string().max(80), name: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
    email: z.string().trim().toLowerCase().email("Escribe un correo válido.").max(190), phone: z.string().trim().max(30).optional().default(""),
    goal: z.string().trim().max(60).optional().default(""), password: z.string().max(200),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "Acepta el aviso de privacidad para inscribirte." }) }),
    photos: z.boolean().optional().default(false), website: z.string().max(200).optional().default(""), // campo trampa para bots
  }), req.body);
  if (b.website) throw bad("No pudimos completar la inscripción.");
  const coach = await knex("users").where({ brand_slug: String(b.slug).toLowerCase(), role: "coach" }).first();
  const s = coach ? signupSettings(coach) : null;
  if (!coach || !s.open) throw new HttpError(404, "Este entrenador no tiene la inscripción abierta. Pídele tus datos de acceso.");
  if (!(await coachLicenseRow(coach.id))) throw new HttpError(403, "Este entrenador no está recibiendo asesorados por ahora.");
  const pp = passwordProblem(b.password, b.email);
  if (pp) throw bad(pp);
  if (await knex("users").where({ email: b.email }).first()) throw bad("Ya existe una cuenta con ese correo. Inicia sesión.");
  const hash = await hashPassword(b.password);
  // Rutina inicial: la plantilla que eligió el entrenador (si existe)
  let routine = null;
  if (s.templateId) {
    const t = await knex("templates").where({ id: s.templateId, coach_id: coach.id }).first();
    if (t) { const d = J(t.data, {}); routine = cloneRoutine(d, s.trialDays ? `Prueba de ${b.name.split(" ")[0]}` : d.name); }
  }
  const userId = await knex.transaction(async (trx) => {
    const id = await insertClient(trx, { coach, name: b.name, email: b.email, passwordHash: hash, mustChange: false, consent: true, photoConsent: b.photos,
      phone: b.phone, goal: b.goal, fee: s.fee, trial: s.trialDays ? { days: s.trialDays, fee: s.trialFee } : null, routine,
      welcome: `¡Hola ${b.name.split(" ")[0]}! Gracias por inscribirte. ${routine ? "Ya tienes tu rutina para empezar." : "En breve preparo tu rutina."} Cualquier duda, escríbeme por aquí.` });
    await log(trx, "client", `Un asesorado se inscribió con ${coach.name}`);
    return id;
  });
  notifyLater(coach.id, { title: "Nuevo asesorado inscrito", body: `${b.name}${s.trialDays ? ` empezó su prueba de ${s.trialDays} días` : " se inscribió"}.${routine ? "" : " Crea su rutina."}`,
    page: "clientes", params: { id: userId }, kind: "signup" });
  const user = await knex("users").where({ id: userId }).first();
  res.status(201).json({ ...(await issueTokens(user, req)), userId });
}));
