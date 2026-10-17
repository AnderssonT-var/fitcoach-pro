/* Archivos privados (fotos de progreso y comprobantes de pago).
   Nunca son públicos: se sirven con una URL firmada que vence. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { knex } from "./db.js";
import { config } from "./config.js";
import { bad, nowISO, uid } from "./util.js";

const TYPES = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WEBP" },
];

/** Decodifica una imagen data URL y comprueba su tipo real por los bytes, no por el texto. */
export function decodeImage(dataUrl, maxBytes) {
  const m = typeof dataUrl === "string" && dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw bad("La imagen no es válida. Usa JPG, PNG o WebP.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > maxBytes) throw bad(`La imagen pesa demasiado (máximo ${Math.round(maxBytes / 1024 / 1024 * 10) / 10} MB).`);
  const type = TYPES.find((t) => t.test(buf));
  if (!type) throw bad("La imagen no es válida. Usa JPG, PNG o WebP.");
  return { buf, ...type };
}

/** Valida una imagen pequeña que se guarda dentro del perfil (avatar, logo). */
export function checkInlineImage(dataUrl, maxBytes) {
  if (dataUrl == null) return null;
  if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/svg+xml")) throw bad("Sube el logo en JPG, PNG o WebP.");
  decodeImage(dataUrl, maxBytes);
  return dataUrl;
}

export async function saveFile(kind, ownerId, dataUrl, maxBytes = 4 * 1024 * 1024, trx = knex) {
  const { buf, mime, ext } = decodeImage(dataUrl, maxBytes);
  const id = uid("f-");
  const rel = path.join(kind, `${id}.${ext}`);
  fs.mkdirSync(path.join(config.uploadDir, kind), { recursive: true });
  fs.writeFileSync(path.join(config.uploadDir, rel), buf, { mode: 0o600 });
  await trx("files").insert({ id, kind, owner_id: ownerId, path: rel, mime, size: buf.length, created_at: nowISO() });
  return id;
}

export async function deleteFile(id, trx = knex) {
  if (!id) return;
  const f = await trx("files").where({ id }).first();
  if (!f) return;
  await trx("files").where({ id }).delete();
  try { fs.unlinkSync(path.join(config.uploadDir, f.path)); } catch { /* ya no existe */ }
}

const sign = (id, exp) => crypto.createHmac("sha256", config.fileSecret).update(`${id}.${exp}`).digest("base64url");

/** URL firmada; vence en 2 a 3 horas (estable dentro de la misma hora para la caché). */
export function signedUrl(id) {
  if (!id) return null;
  const exp = Math.floor(Date.now() / 3600e3) * 3600 + 3 * 3600;
  return `/api/files/${id}?exp=${exp}&sig=${sign(id, exp)}`;
}

export async function serveFile(req, res) {
  const { id } = req.params;
  const exp = +req.query.exp;
  const sig = String(req.query.sig || "");
  const ok = /^f-[\w-]+$/.test(id) && exp > Date.now() / 1000 && sig.length > 20 &&
    crypto.timingSafeEqual(Buffer.from(sign(id, exp)), Buffer.from(sig.padEnd(sign(id, exp).length).slice(0, sign(id, exp).length)));
  if (!ok) return res.status(403).json({ error: "Enlace vencido o no válido." });
  const f = await knex("files").where({ id }).first();
  if (!f) return res.status(404).json({ error: "No se encontró." });
  res.setHeader("Content-Type", f.mime);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  fs.createReadStream(path.join(config.uploadDir, f.path)).on("error", () => res.status(404).end()).pipe(res);
}
