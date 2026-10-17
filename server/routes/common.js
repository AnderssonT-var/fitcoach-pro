import crypto from "node:crypto";
import { knex } from "../db.js";
import { notFound, nowISO, uid } from "../util.js";

export const log = (trx, kind, text) => (trx || knex)("activity").insert({ id: uid("a-"), at: nowISO(), kind, text: String(text).slice(0, 300) });

/* Códigos FIT-XXXX-XXXX-XXXX: 12 caracteres de 32 posibles (60 bits), generados con crypto. */
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newCode() {
  const part = () => Array.from({ length: 4 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join("");
  return `FIT-${part()}-${part()}-${part()}`;
}
export function normalizeCode(code) {
  const raw = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^FIT/, "").slice(0, 12);
  return raw.match(/.{1,4}/g) ? `FIT-${raw.match(/.{1,4}/g).join("-")}` : "";
}

export const RESERVED_SLUGS = new Set(["privacidad", "terminos", "admin", "api", "login", "activar", "fitcoach", "soporte"]);
export const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
export async function slugFrom(name, trx = knex) {
  const base = slugify(name) || "entrenador";
  let slug = RESERVED_SLUGS.has(base) ? `${base}-1` : base, n = 2;
  while (await trx("users").where({ brand_slug: slug }).first()) slug = `${base}-${n++}`;
  return slug;
}

/** Cliente que pertenece al entrenador (si no, 404: no se revela si existe). */
export async function ownClient(coachId, clientId, trx = knex) {
  const c = await trx("clients").where({ user_id: +clientId, coach_id: coachId }).first();
  if (!c) throw notFound("No encontramos a ese asesorado.");
  return c;
}

/** Entrenador del grupo al que pertenece un usuario. */
export async function groupOf(user, trx = knex) {
  if (user.role === "coach") return user.id;
  if (user.role === "client") return (await trx("clients").where({ user_id: user.id }).first())?.coach_id;
  return null;
}
