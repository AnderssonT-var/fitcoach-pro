import crypto from "node:crypto";

export const uid = (p = "") => `${p}${crypto.randomBytes(9).toString("base64url")}`;
export const nowISO = () => new Date().toISOString();

/** Error con código HTTP y mensaje para el usuario. */
export class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
export const bad = (msg) => new HttpError(400, msg);
export const forbidden = (msg = "No tienes permiso para hacer esto.") => new HttpError(403, msg);
export const notFound = (msg = "No se encontró.") => new HttpError(404, msg);

/** Envuelve un handler async para que los errores lleguen al middleware de errores. */
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Valida el body con un esquema zod y devuelve los datos limpios. */
export function parse(schema, data) {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    const first = r.error.issues[0];
    throw bad(first?.message && !/^(Expected|Required|Invalid|String must|Number must|Array must)/.test(first.message)
      ? first.message : `Revisa el campo «${first?.path?.join(".") || "datos"}».`);
  }
  return r.data;
}

export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const monthName = (d = new Date()) => MONTHS[d.getMonth()];
/** «Mensualidad octubre 2026» */
export const monthlyConcept = (d = new Date()) => `Mensualidad ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export const round2 = (n) => Math.round(n * 100) / 100;
