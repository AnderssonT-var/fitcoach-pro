/* Inicio de sesión, renovación de sesión, activación de licencia,
   cambio de contraseña y consentimiento. */
import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { knex, bool, S } from "../db.js";
import { config } from "../config.js";
import {
  LOCK_MINUTES, MAX_FAILS, authenticate, checkPassword, dummyCheck, hashPassword, issueTokens,
  passwordProblem, revokeAll, revokeRefresh, rotateRefresh,
} from "../auth.js";
import { HttpError, bad, h, nowISO, parse, addMonths, licenseEnd } from "../util.js";
import { getLegal, getPricing, planPrice } from "../state.js";
import { log, normalizeCode, slugFrom } from "./common.js";
import { coachLicenseRow } from "../auth.js";
import { signupSettings } from "./signup.js";
import { count } from "../metrics.js";

export const router = Router();

const msg = { message: "Demasiados intentos. Espera unos minutos y vuelve a intentar." };
const loginLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 10, standardHeaders: "draft-7", legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || "").toLowerCase().slice(0, 190)}`, message: { error: msg.message } });
const ipLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 60, standardHeaders: "draft-7", legacyHeaders: false, message: { error: msg.message } });
export const codeLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 6, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Demasiados intentos con códigos de licencia. Espera 15 minutos." } });

const email = z.string().trim().toLowerCase().email("Escribe un correo válido.").max(190);

async function sessionResponse(user, req) {
  const tokens = await issueTokens(user, req);
  return { ...tokens, userId: user.id };
}

/* ---------- iniciar sesión ---------- */
router.post("/login", ipLimiter, loginLimiter, h(async (req, res) => {
  const body = parse(z.object({ email, password: z.string().min(1).max(200), brandSlug: z.string().max(80).optional().nullable() }), req.body);
  const user = await knex("users").where({ email: body.email }).first();
  const generic = new HttpError(401, "Correo o contraseña incorrectos.");
  if (!user) { count("auth.fail"); await dummyCheck(body.password); throw generic; }
  if (user.locked_until && +user.locked_until > Date.now()) {
    count("auth.locked");
    const min = Math.ceil((+user.locked_until - Date.now()) / 60e3);
    throw new HttpError(429, `Bloqueamos la cuenta por varios intentos fallidos. Intenta en ${min} ${min === 1 ? "minuto" : "minutos"}.`);
  }
  if (!(await checkPassword(body.password, user.password_hash))) {
    count("auth.fail");
    const fails = user.failed_logins + 1;
    await knex("users").where({ id: user.id }).update(fails >= MAX_FAILS
      ? { failed_logins: 0, locked_until: Date.now() + LOCK_MINUTES * 60e3 }
      : { failed_logins: fails });
    if (fails >= MAX_FAILS) throw new HttpError(429, `Bloqueamos la cuenta ${LOCK_MINUTES} minutos por varios intentos fallidos.`);
    throw generic;
  }
  // Acceso con la marca de un entrenador: solo entra él y sus asesorados
  if (body.brandSlug) {
    const owner = await knex("users").where({ brand_slug: body.brandSlug, role: "coach" }).first();
    let ownerId = user.role === "coach" ? user.id : null;
    if (user.role === "client") ownerId = (await knex("clients").where({ user_id: user.id }).first())?.coach_id;
    if (!owner || owner.id !== ownerId) {
      const b = owner ? JSON.parse(owner.brand || "{}").businessName || owner.name : "este entrenador";
      throw new HttpError(403, `Esta cuenta no pertenece a ${b}. Entra desde el acceso de tu entrenador.`);
    }
  }
  await knex("users").where({ id: user.id }).update({ failed_logins: 0, locked_until: null, last_login_at: nowISO() });
  count("auth.ok");
  res.json(await sessionResponse(user, req));
}));

/* ---------- renovar sesión ---------- */
router.post("/refresh", ipLimiter, h(async (req, res) => {
  const { user, accessToken, refreshToken } = await rotateRefresh(req.body?.refreshToken, req).catch((e) => { count("auth.refreshFail"); throw e; });
  count("auth.refresh");
  res.json({ accessToken, refreshToken, userId: user.id });
}));

router.post("/logout", h(async (req, res) => {
  await revokeRefresh(req.body?.refreshToken);
  res.json({ ok: true });
}));

/* ---------- activar licencia y crear cuenta de entrenador ---------- */
router.post("/activate", codeLimiter, h(async (req, res) => {
  const body = parse(z.object({
    code: z.string().max(40), name: z.string().trim().min(3, "Escribe tu nombre completo.").max(120), email,
    password: z.string().max(200), acceptTerms: z.literal(true, { errorMap: () => ({ message: "Acepta los términos y la política de privacidad." }) }),
  }), req.body);
  const pp = passwordProblem(body.password, body.email);
  if (pp) throw bad(pp);
  const code = normalizeCode(body.code);
  if (await knex("users").where({ email: body.email }).first()) throw bad("Ya existe una cuenta con ese correo. Inicia sesión y canjea el código desde tu panel.");
  const hash = await hashPassword(body.password);
  const user = await knex.transaction(async (trx) => {
    const lic = await trx("licenses").where({ code }).first();
    if (!lic || bool(lic.revoked) || lic.coach_id) throw bad("El código no es válido o ya fue usado.");
    const slug = await slugFrom(body.name, trx);
    const [id] = await trx("users").insert({
      role: "coach", email: body.email, password_hash: hash, name: body.name, profile: S({}), brand: S({ businessName: "", color: "", logo: null, tagline: "" }),
      brand_slug: slug, created_at: nowISO(), consent_version: config.legalVersion, consent_at: nowISO(),
    });
    const userId = typeof id === "object" ? id.id : id;
    // Se marca usada solo si sigue libre (evita que dos personas usen el mismo código a la vez)
    const n = await trx("licenses").where({ id: lic.id, revoked: false }).whereNull("coach_id")
      .update({ coach_id: userId, activated_at: nowISO(), expires_at: licenseEnd(new Date(), lic.months) });
    if (n !== 1) throw bad("El código no es válido o ya fue usado.");
    await log(trx, "coach", `${body.name} activó su licencia ${lic.months ? `de ${lic.months} ${lic.months === 1 ? "mes" : "meses"}` : "indefinida"}`);
    return trx("users").where({ id: userId }).first();
  });
  res.status(201).json(await sessionResponse(user, req));
}));

/* ---------- con sesión iniciada ---------- */
router.post("/password", authenticate, h(async (req, res) => {
  const body = parse(z.object({ current: z.string().max(200), next: z.string().max(200) }), req.body);
  if (!(await checkPassword(body.current, req.user.password_hash))) throw bad("La contraseña actual no coincide.");
  const pp = passwordProblem(body.next, req.user.email);
  if (pp) throw bad(pp);
  if (body.current === body.next) throw bad("La nueva contraseña debe ser distinta de la actual.");
  await knex.transaction(async (trx) => {
    await trx("users").where({ id: req.user.id }).update({ password_hash: await hashPassword(body.next), must_change_password: false });
    await revokeAll(req.user.id, trx); // cierra las demás sesiones
  });
  const user = await knex("users").where({ id: req.user.id }).first();
  res.json(await sessionResponse(user, req));
}));

router.post("/logout-all", authenticate, h(async (req, res) => {
  await revokeAll(req.user.id);
  res.json({ ok: true });
}));

/** Aceptación del aviso de privacidad (asesorados) o de los términos (entrenadores). */
router.post("/consent", authenticate, h(async (req, res) => {
  const body = parse(z.object({ accept: z.literal(true), photos: z.boolean().optional() }), req.body);
  const patch = { consent_version: config.legalVersion, consent_at: nowISO() };
  if (req.user.role === "client" && body.photos !== undefined) patch.photo_consent = body.photos;
  await knex("users").where({ id: req.user.id }).update(patch);
  res.json({ ok: true });
}));

/** El asesorado puede dar o retirar en cualquier momento el permiso para fotos. */
router.post("/photo-consent", authenticate, h(async (req, res) => {
  if (req.user.role !== "client") throw bad("Solo aplica a asesorados.");
  const { value } = parse(z.object({ value: z.boolean() }), req.body);
  await knex("users").where({ id: req.user.id }).update({ photo_consent: value });
  res.json({ ok: true });
}));

/* ---------- datos públicos ---------- */
export const publicRouter = Router();
publicRouter.get("/brand/:slug", h(async (req, res) => {
  const slug = String(req.params.slug || "").toLowerCase().slice(0, 80);
  const u = await knex("users").where({ brand_slug: slug, role: "coach" }).first();
  if (!u) return res.status(404).json({ error: "No existe ese acceso." });
  const b = JSON.parse(u.brand || "{}");
  const p = JSON.parse(u.profile || "{}");
  const su = signupSettings(u);
  const signup = su.open && (await coachLicenseRow(u.id)) ? { open: true, trialDays: su.trialDays, trialFee: su.trialFee, fee: su.fee } : { open: false };
  const pg = await knex("coach_pages").where({ coach_id: u.id }).first();
  const page = !!pg && !!pg.published && pg.published !== "0";
  res.json({ coachId: u.id, coachName: u.name, coachPhoto: p.photo || null, businessName: b.businessName || "", logo: b.logo || null, color: b.color || "", tagline: b.tagline || "", slug, signup, page });
}));
publicRouter.get("/pricing", h(async (_req, res) => {
  const p = await getPricing();
  res.json({ currency: p.currency, plans: [1, 3, 6, 12].map((m) => ({ months: m, price: planPrice(p, m) })) });
}));
publicRouter.get("/info", h(async (_req, res) => {
  res.json({ ...(await getLegal()), legalVersion: config.legalVersion });
}));
