/* Sincronización con las apps que trabajan sin conexión.
   - Cada acción guardada en el celular trae un identificador (Idempotency-Key). Si llega dos
     veces (se cortó la señal a mitad de camino), la segunda vez se responde lo mismo sin repetirla.
   - X-Op-At trae la hora real en que se hizo la acción.
   - Cada equipo informa su versión y cuántas acciones tiene pendientes: el administrador lo ve. */
import { knex, S } from "./db.js";
import { reqCtx } from "./util.js";
import { count } from "./metrics.js";

const KEY = /^[A-Za-z0-9_-]{8,28}$/;
const MAX_BODY = 64 * 1024;

function opTime(v) {
  if (!v) return null;
  const t = /^\d+$/.test(String(v)) ? +v : Date.parse(String(v));
  if (!Number.isFinite(t)) return null;
  const now = Date.now();
  if (t > now + 5 * 60e3 || t < now - 14 * 864e5) return null; // reloj del equipo muy desfasado: se usa la hora del servidor
  return new Date(Math.min(t, now)).toISOString();
}

export function idempotency(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS" || !req.user) return next();
  const key = String(req.headers["idempotency-key"] || "");
  if (!KEY.test(key)) return next();
  const userId = req.user.id;
  const at = opTime(req.headers["x-op-at"]);
  (async () => {
    const row = await knex("idem_keys").where({ user_id: userId, key }).first();
    if (row) {
      if (+row.status === 0 && Date.now() - Date.parse(row.at) < 120e3) {
        count("sync.conflict");
        return res.status(409).json({ error: "Esta acción se está guardando. Intenta de nuevo en un momento.", code: "in_progress" });
      }
      if (+row.status > 0) {
        count("sync.replay");
        res.setHeader("Idempotent-Replay", "true");
        return res.status(+row.status).type("json").send(row.body || "{\"ok\":true}");
      }
      await knex("idem_keys").where({ user_id: userId, key }).delete(); // quedó a medias (proceso reiniciado)
    }
    try {
      await knex("idem_keys").insert({ user_id: userId, key, status: 0, body: null, at: new Date().toISOString() });
    } catch {
      count("sync.conflict");
      return res.status(409).json({ error: "Esta acción se está guardando. Intenta de nuevo en un momento.", code: "in_progress" });
    }
    count("sync.ops");
    let stored = false;
    const save = (status, body) => {
      if (stored) return;
      stored = true;
      // Errores del servidor (5xx): se borra para que el reintento sí se procese
      const q = status >= 500
        ? knex("idem_keys").where({ user_id: userId, key }).delete()
        : knex("idem_keys").where({ user_id: userId, key }).update({ status, body: body && body.length <= MAX_BODY ? body : null });
      q.catch(() => {});
    };
    const json = res.json.bind(res);
    res.json = (body) => { save(res.statusCode, S(body)); return json(body); };
    res.on("finish", () => save(res.statusCode, null));
    res.on("close", () => { if (!res.writableEnded) save(500, null); });
    reqCtx.run({ op: key, at, ids: new Map() }, next);
  })().catch(next);
}

/* ---------- equipos conectados ---------- */
const seen = new Map(); // `${user}|${device}` -> { at, pending, failed }
const PLATFORM = /^(web|pwa|ios-pwa|android|ios|apk|flutter-web)$/;

export function trackDevice(req, _res, next) {
  const u = req.user;
  if (!u) return next();
  const device = String(req.headers["x-device"] || "").slice(0, 40) || `ua-${hash(req.headers["user-agent"] || "")}`;
  const [plat, ver] = String(req.headers["x-app"] || "").split("/");
  const pending = Math.max(0, Math.min(99999, +req.headers["x-pending"] || 0));
  const failed = Math.max(0, Math.min(99999, +req.headers["x-sync-failed"] || 0));
  const k = `${u.id}|${device}`;
  const prev = seen.get(k);
  const now = Date.now();
  if (!prev || now - prev.at > 120e3 || prev.pending !== pending || prev.failed !== failed) {
    seen.set(k, { at: now, pending, failed });
    if (seen.size > 100000) seen.clear();
    const row = { user_id: u.id, device, platform: PLATFORM.test(plat) ? plat : "web", app_version: String(ver || "").slice(0, 30) || null,
      seen_at: new Date(now).toISOString(), pending, failed, ...(pending === 0 && prev?.pending > 0 ? { last_sync_at: new Date(now).toISOString() } : {}) };
    knex("devices").insert(row).onConflict(["user_id", "device"]).merge().catch(() => {});
  }
  next();
}
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

/** Informe de la app: acciones que el servidor rechazó al sincronizar (para el administrador). */
export async function syncReport(req, res) {
  const items = Array.isArray(req.body?.failed) ? req.body.failed.slice(0, 20) : [];
  const device = String(req.headers["x-device"] || "").slice(0, 40) || "?";
  if (items.length) {
    count("sync.failed", items.length);
    const last = items[items.length - 1];
    const text = `${String(last.label || last.path || "acción").slice(0, 80)}: ${String(last.error || "").slice(0, 200)}`;
    await knex("devices").where({ user_id: req.user.id, device }).update({ last_error: text.slice(0, 300) }).catch(() => {});
  }
  count("sync.reported");
  res.json({ ok: true });
}
