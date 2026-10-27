/* Autenticación: contraseñas con bcrypt, token de acceso JWT (15 min)
   y token de renovación aleatorio, guardado como hash y rotado en cada uso. */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { knex, bool } from "./db.js";
import { config } from "./config.js";
import { HttpError, forbidden, nowISO, uid } from "./util.js";
import { compareInPool, hashInPool } from "./pwpool.js";
import { count } from "./metrics.js";

const COST = 12;
const ACCESS_TTL = "15m";
const REFRESH_DAYS = 30;
export const MAX_FAILS = 5;
export const LOCK_MINUTES = 15;

// Se calculan en hilos aparte para no congelar el servidor (ver pwpool.js)
export const hashPassword = (pw) => hashInPool(pw, COST);
export const checkPassword = (pw, hash) => compareInPool(pw, hash);
/* Hash de relleno para que el tiempo de respuesta no revele si el correo existe */
const DUMMY = bcrypt.hashSync("dummy-password-for-timing", COST);
export const dummyCheck = (pw) => compareInPool(pw || "x", DUMMY);

/** Reglas de contraseña. Devuelve un mensaje de error o null. */
export function passwordProblem(pw, email = "") {
  if (typeof pw !== "string" || pw.length < 8) return "La contraseña necesita al menos 8 caracteres.";
  if (pw.length > 128) return "La contraseña es demasiado larga.";
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(pw) || !/\d/.test(pw)) return "Usa letras y números en la contraseña.";
  const local = String(email).split("@")[0].toLowerCase();
  if (local.length >= 4 && pw.toLowerCase().includes(local)) return "La contraseña no puede contener tu correo.";
  if (/^(12345678|password|contraseña|qwerty)/i.test(pw)) return "Esa contraseña es muy común. Elige otra.";
  return null;
}

/** Contraseña temporal legible (sin caracteres confusos), con letras y números. */
export function tempPassword() {
  const L = "abcdefghjkmnpqrstuvwxyz", D = "23456789";
  const pick = (s) => s[crypto.randomInt(s.length)];
  const chars = [pick(L).toUpperCase(), pick(D), pick(D), ...Array.from({ length: 7 }, () => pick(L + D))];
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

export function signAccess(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, tv: user.token_version }, config.jwtSecret,
    { expiresIn: ACCESS_TTL, issuer: "fitcoachpro", algorithm: "HS256" });
}

export async function issueTokens(user, req, trx = knex) {
  const token = crypto.randomBytes(48).toString("base64url");
  await trx("refresh_tokens").insert({
    id: uid("rt-"), user_id: user.id, token_hash: sha(token), revoked: false, created_at: nowISO(),
    expires_at: new Date(Date.now() + REFRESH_DAYS * 864e5).toISOString(),
    user_agent: String(req?.headers?.["user-agent"] || "").slice(0, 200),
  });
  return { accessToken: signAccess(user), refreshToken: token };
}

/** Rota el token de renovación. Si se reusa uno ya rotado, se cierran todas las sesiones. */
export async function rotateRefresh(token, req) {
  if (typeof token !== "string" || token.length < 20) throw new HttpError(401, "Tu sesión terminó. Vuelve a iniciar sesión.");
  // Reuso de un token ya rotado: posible robo. Se cierran todas las sesiones (fuera de la transacción para que persista).
  const prior = await knex("refresh_tokens").where({ token_hash: sha(token) }).first();
  if (prior && bool(prior.revoked)) {
    count("auth.reuse");
    await revokeAll(prior.user_id);
    throw new HttpError(401, "Por seguridad cerramos tu sesión en todos los dispositivos. Vuelve a entrar.");
  }
  return knex.transaction(async (trx) => {
    const row = await trx("refresh_tokens").where({ token_hash: sha(token) }).first();
    if (!row) throw new HttpError(401, "Tu sesión terminó. Vuelve a iniciar sesión.");
    // Se marca usado solo si nadie lo usó en paralelo
    const used = await trx("refresh_tokens").where({ id: row.id, revoked: false }).update({ revoked: true });
    if (used !== 1) throw new HttpError(401, "Tu sesión terminó. Vuelve a iniciar sesión.");
    if (new Date(row.expires_at) < new Date()) throw new HttpError(401, "Tu sesión venció. Vuelve a iniciar sesión.");
    const user = await trx("users").where({ id: row.user_id }).first();
    if (!user) throw new HttpError(401, "Tu sesión terminó. Vuelve a iniciar sesión.");
    const pair = await issueTokens(user, req, trx);
    const next = await trx("refresh_tokens").where({ token_hash: sha(pair.refreshToken) }).first();
    await trx("refresh_tokens").where({ id: row.id }).update({ replaced_by: next.id });
    return { user, ...pair };
  });
}

export async function revokeRefresh(token) {
  if (typeof token === "string") await knex("refresh_tokens").where({ token_hash: sha(token) }).update({ revoked: true });
}

/** Cierra todas las sesiones: invalida tokens de acceso (versión) y de renovación. */
export async function revokeAll(userId, trx = knex) {
  await trx("refresh_tokens").where({ user_id: userId }).update({ revoked: true });
  await trx("users").where({ id: userId }).increment("token_version", 1);
}

/* ---------- middleware ---------- */
export async function authenticate(req, _res, next) {
  try {
    const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
    if (!m) throw new HttpError(401, "Inicia sesión para continuar.");
    let payload;
    try { payload = jwt.verify(m[1], config.jwtSecret, { issuer: "fitcoachpro", algorithms: ["HS256"] }); }
    catch { throw new HttpError(401, "Tu sesión venció.", { code: "token_expired" }); }
    const user = await knex("users").where({ id: +payload.sub }).first();
    if (!user || user.token_version !== payload.tv) throw new HttpError(401, "Tu sesión terminó. Vuelve a iniciar sesión.");
    req.user = user;
    next();
  } catch (e) { next(e); }
}

export const requireRole = (...roles) => (req, _res, next) =>
  next(roles.includes(req.user?.role) ? undefined : forbidden());

/** Licencia vigente de un entrenador (consultada siempre en el servidor). */
export async function coachLicenseRow(coachId, trx = knex) {
  return trx("licenses").where({ coach_id: coachId, revoked: false }).where("expires_at", ">", nowISO())
    .orderBy("expires_at", "desc").first();
}

/** El entrenador necesita licencia vigente para trabajar. */
export async function requireLicense(req, _res, next) {
  try {
    if (req.user.role === "coach" && !(await coachLicenseRow(req.user.id))) {
      throw new HttpError(402, "Tu licencia no está vigente. Renuévala para seguir trabajando.", { code: "license_required" });
    }
    next();
  } catch (e) { next(e); }
}

/** El asesorado necesita: cuenta activa, entrenador con licencia y consentimiento aceptado. */
export async function requireClientAccess(req, _res, next) {
  try {
    if (req.user.role !== "client") return next();
    const c = await knex("clients").where({ user_id: req.user.id }).first();
    if (!c || !bool(c.active)) throw new HttpError(403, "Tu entrenador pausó esta cuenta. Escríbele para reactivarla.", { code: "client_inactive" });
    if (!(await coachLicenseRow(c.coach_id))) throw new HttpError(403, "El acceso de tu entrenador está pausado por ahora.", { code: "coach_license" });
    req.client = c;
    next();
  } catch (e) { next(e); }
}

/** Acciones que exigen haber aceptado el aviso de privacidad. */
export function requireConsent(req, _res, next) {
  if (req.user.role !== "admin" && req.user.consent_version !== config.legalVersion) {
    return next(new HttpError(403, "Acepta el aviso de privacidad para continuar.", { code: "consent_required" }));
  }
  if (bool(req.user.must_change_password)) {
    return next(new HttpError(403, "Cambia tu contraseña temporal para continuar.", { code: "password_change" }));
  }
  next();
}
