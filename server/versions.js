/* Versiones de los datos: cada cambio marca qué parte del sistema cambió.
   Así /api/state responde «sin cambios» (304) sin volver a armar todo el estado,
   que es lo más caro del servidor. Las versiones viven en la base de datos para que
   funcione igual con varios procesos.

   Alcances:
     g          → general (precios, textos legales, licencias): lo cambia el administrador
     c:<coach>  → lo que comparten el entrenador y todos sus asesorados (comunidad, ejercicios, marca, compañeros)
     u:<user>   → lo de una sola persona (su rutina, pagos, mensajes, peso…). El entrenador
                  ve todo lo de sus asesorados, así que un cambio de un asesorado también marca u:<entrenador>
     w:<coach>  → historial de entrenamientos del grupo (lo más pesado del estado) */
import crypto from "node:crypto";
import { knex } from "./db.js";

const token = () => `${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`;

/* Caché corta en memoria de las versiones leídas (se renueva sola cada 2 s y al cambiar algo aquí) */
const memo = new Map(); // scope -> { v, at }
const MEMO_MS = 2000;

export async function bump(...scopes) {
  const list = [...new Set(scopes.filter(Boolean))];
  if (!list.length) return;
  const rows = list.map((scope) => ({ scope, v: token() }));
  try {
    await knex("state_versions").insert(rows).onConflict("scope").merge(["v"]);
    for (const r of rows) memo.set(r.scope, { v: r.v, at: Date.now() });
  } catch (e) {
    for (const s of list) memo.delete(s);
    console.warn("[versiones]", e.message);
  }
}

export async function versions(scopes) {
  const now = Date.now();
  const out = {};
  const need = [];
  for (const s of scopes) {
    const m = memo.get(s);
    if (m && now - m.at < MEMO_MS) out[s] = m.v; else need.push(s);
  }
  if (need.length) {
    const rows = await knex("state_versions").whereIn("scope", need).select("scope", "v");
    for (const s of need) {
      const v = rows.find((r) => r.scope === s)?.v || "0";
      out[s] = v;
      memo.set(s, { v, at: now });
    }
  }
  if (memo.size > 50000) memo.clear();
  return out;
}

/* Grupo (entrenador) de cada asesorado, en memoria: casi nunca cambia */
const coachOf = new Map();
export async function coachIdOf(user) {
  if (user.role === "coach") return user.id;
  if (user.role !== "client") return null;
  const hit = coachOf.get(user.id);
  if (hit && Date.now() - hit.at < 10 * 60e3) return hit.id;
  const c = await knex("clients").where({ user_id: user.id }).select("coach_id").first();
  coachOf.set(user.id, { id: c?.coach_id ?? null, at: Date.now() });
  return c?.coach_id ?? null;
}
export const forgetCoachOf = (userId) => coachOf.delete(userId);

/** Qué alcances toca una acción (según quién la hace y a qué ruta). */
export async function scopesFor(req) {
  const u = req.user;
  if (!u) return [];
  const p = (req.baseUrl + req.path).replace(/\/+$/, "");
  if (u.role === "admin") return ["g"];
  if (u.role === "coach") {
    const me = u.id;
    const m = p.match(/^\/api\/coach\/clients\/(\d+)(\/.*)?$/);
    if (m) {
      forgetCoachOf(+m[1]);
      // Cambiar datos de un asesorado solo afecta a él y al entrenador; pausarlo o borrarlo cambia el grupo
      if (!m[2]) return [`u:${me}`, `u:${m[1]}`, `c:${me}`, `w:${me}`];
      return [`u:${me}`, `u:${m[1]}`];
    }
    if (p === "/api/coach/clients") return [`u:${me}`, `c:${me}`];
    if (p.startsWith("/api/coach/templates")) return [`u:${me}`];
    if (p === "/api/messages" || p === "/api/messages/read") {
      const cid = +req.body?.clientId;
      return cid ? [`u:${me}`, `u:${cid}`] : [`u:${me}`, `c:${me}`];
    }
    if (p.startsWith("/api/coach/payments/") || p === "/api/coach/payments") {
      const cid = +req.body?.clientId;
      return cid ? [`u:${me}`, `u:${cid}`] : [`u:${me}`, `c:${me}`];
    }
    return [`u:${me}`, `c:${me}`];
  }
  // asesorado
  const coach = await coachIdOf(u);
  const me = u.id;
  const base = [`u:${me}`, coach && `u:${coach}`];
  if (p === "/api/client/workout/finish") return [...base, coach && `c:${coach}`, coach && `w:${coach}`];
  // La sesión en curso la arma el propio celular: solo el entrenador necesita verla cambiar
  if (p === "/api/client/workout/active" && req.method === "PUT") return [coach && `u:${coach}`];
  if (p === "/api/client/workout/active" || p === "/api/client/weight" || p.startsWith("/api/client/photos") || p.startsWith("/api/messages")) return base;
  if (p === "/api/client/rest-alarm") return [];
  if (p === "/api/account") return [...base, coach && `c:${coach}`, coach && `w:${coach}`];
  // perfil (nombre y foto se ven en la comunidad), publicaciones, consentimientos…
  return [...base, coach && `c:${coach}`];
}

/** Middleware: después de cada cambio exitoso marca las versiones que corresponden. */
export function bumpAfterChange(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  // Se marca ANTES de responder: si la app pide el estado justo después, ya ve el cambio
  const json = res.json.bind(res);
  let bumped = false;
  res.json = (body) => {
    if (bumped || res.statusCode >= 400 || !req.user) return json(body);
    bumped = true;
    scopesFor(req).then((s) => bump(...s)).catch(() => {}).finally(() => json(body));
    return res;
  };
  res.on("finish", () => {
    if (bumped || res.statusCode >= 400 || !req.user) return;
    bumped = true;
    scopesFor(req).then((s) => bump(...s)).catch(() => {});
  });
  next();
}
