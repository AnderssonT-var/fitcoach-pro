/* Seguimiento entre sesiones: cuestionario de inicio, hábitos, check-in semanal, nutrición,
   programa por fases, automatizaciones y cobro en línea del entrenador.
   Casi todo vive en el JSON de la ficha del asesorado (clients.data) y en el perfil del
   entrenador (users.profile), igual que el resto de su seguimiento. */
import fs from "node:fs";
import path from "node:path";
import { knex, J, S } from "./db.js";
import { config } from "./config.js";
import { bad, nowISO, uid } from "./util.js";

/* ---------- valores por defecto ---------- */
export const DEFAULT_HABITS = [
  { id: "h-sueno", name: "Sueño", target: 7, unit: "h", kind: "count" },
  { id: "h-agua", name: "Agua", target: 8, unit: "vasos", kind: "count" },
  { id: "h-pasos", name: "Pasos", target: 8000, unit: "pasos", kind: "count" },
  { id: "h-proteina", name: "Proteína", target: 1, unit: "", kind: "check" },
];
export const DEFAULT_CHECKIN = { day: 0, questions: ["¿Qué fue lo mejor de tu semana?", "¿Algo te molestó o te costó?"] };

/** Reglas automáticas del entrenador (se guardan en su perfil; estas son las de fábrica). */
export const DEFAULT_RULES = [
  { kind: "welcome", on: true, text: "¡Bienvenido/a! Ya tienes acceso. Completa tu cuestionario de inicio para armar tu programa." },
  { kind: "checkin", on: true, day: 0, hour: 18 },
  { kind: "inactive", on: true, days: 4 },
  { kind: "pr", on: true, text: "¡Nuevo récord! Así se progresa, sigue así." },
  { kind: "phase", on: true },
];
export function rulesOf(coachProfile) {
  const saved = Array.isArray(coachProfile?.automations) ? coachProfile.automations : [];
  return DEFAULT_RULES.map((r) => ({ ...r, ...(saved.find((s) => s.kind === r.kind) || {}) }));
}
export const ruleOf = (coachProfile, kind) => rulesOf(coachProfile).find((r) => r.kind === kind);
export async function coachRules(coachId, trx = knex) {
  const u = await trx("users").where({ id: coachId }).select("profile").first();
  return rulesOf(J(u?.profile, {}));
}

/* ---------- fechas ---------- */
export const dayKey = (d = new Date()) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TZ || "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p; // AAAA-MM-DD en la hora local del negocio
};
const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function assertDay(s) {
  if (!isDay(s)) throw bad("Fecha no válida.");
  const t = Date.parse(`${s}T12:00:00Z`);
  if (!Number.isFinite(t) || t > Date.now() + 2 * 864e5 || t < Date.now() - 120 * 864e5) throw bad("Esa fecha está fuera de rango.");
  return s;
}
/** Deja solo los últimos `days` días de un registro por fecha. */
export function pruneDays(obj, days = 120) {
  const min = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  for (const k of Object.keys(obj || {})) if (k < min) delete obj[k];
  return obj;
}

/* ---------- notas de voz ---------- */
const AUDIO = [
  { mime: "audio/webm", ext: "webm", test: (b) => b.readUInt32BE(0) === 0x1a45dfa3 },
  { mime: "audio/ogg", ext: "ogg", test: (b) => b.slice(0, 4).toString("ascii") === "OggS" },
  { mime: "audio/mp4", ext: "m4a", test: (b) => b.slice(4, 8).toString("ascii") === "ftyp" },
  { mime: "audio/mpeg", ext: "mp3", test: (b) => b.slice(0, 3).toString("ascii") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) },
  { mime: "audio/aac", ext: "aac", test: (b) => b[0] === 0xff && (b[1] & 0xf6) === 0xf0 },
  { mime: "audio/wav", ext: "wav", test: (b) => b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WAVE" },
];
/** Guarda una nota de voz (data URL de audio); el tipo se comprueba por los bytes. */
export async function saveAudio(ownerId, dataUrl, trx = knex) {
  const m = typeof dataUrl === "string" && dataUrl.match(/^data:audio\/[\w.+-]+(?:;[\w=.-]+)*;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw bad("La nota de voz no es válida.");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length < 200) throw bad("La nota de voz está vacía.");
  if (buf.length > 4 * 1024 * 1024) throw bad("La nota de voz es muy larga (máximo unos 3 minutos).");
  const type = AUDIO.find((t) => t.test(buf));
  if (!type) throw bad("Ese formato de audio no se puede guardar.");
  const id = uid("f-");
  const rel = path.join("audio", `${id}.${type.ext}`);
  fs.mkdirSync(path.join(config.uploadDir, "audio"), { recursive: true });
  fs.writeFileSync(path.join(config.uploadDir, rel), buf, { mode: 0o600 });
  await trx("files").insert({ id, kind: "audio", owner_id: ownerId, path: rel, mime: type.mime, size: buf.length, created_at: nowISO() });
  return id;
}

/* ---------- programa por fases ---------- */
/** Fase actual según la fecha de inicio y las semanas de cada fase (o null si no hay fases). */
export function phaseIndexAt(program, now = Date.now()) {
  const phases = program?.phases || [];
  if (!phases.length || !program.startedAt) return null;
  let t = Date.parse(program.startedAt);
  for (let i = 0; i < phases.length; i++) {
    t += Math.max(1, +phases[i].weeks || 1) * 7 * 864e5;
    if (now < t) return i;
  }
  return phases.length - 1;
}

/** Datos que guarda el asesorado o su entrenador; el resto del JSON queda igual. */
export async function editClientData(userId, fn, trx = knex) {
  const c = await trx("clients").where({ user_id: userId }).first();
  if (!c) throw bad("No se encontró la ficha.");
  const data = J(c.data, {});
  const out = await fn(data, c);
  await trx("clients").where({ user_id: userId }).update({ data: S(data) });
  return out;
}
