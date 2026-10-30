/* Notificaciones (suscribirse, probar), tareas programadas y registro de errores. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { knex, J } from "../db.js";
import { config } from "../config.js";
import { PROC, mergeMinutes, pct, processInfo, recent, recentSlowQueries, trackJob } from "../metrics.js";
import { activeAlerts, evaluate } from "../alerts.js";
import { loadLevel, pollSeconds, stateGate } from "../load.js";
import { poolInfo } from "../pwpool.js";
import { authenticate, requireRole } from "../auth.js";
import { bad, h, notFound, nowISO, parse } from "../util.js";
import { fcmEnabled, fcmInfo, getVapid, loadFcm, notify, parseFcmAccount, removeSubscription, saveSubscription, testFcmAccount } from "../notify.js";
import { runJobs } from "../jobs.js";

/* ---------- notificaciones push ---------- */
export const pushRouter = Router();
pushRouter.use(authenticate);
pushRouter.get("/config", h(async (_req, res) => {
  res.json({ vapidPublicKey: (await getVapid()).publicKey, fcm: fcmEnabled() });
}));
const subSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("web"), endpoint: z.string().url().max(800).refine((u) => u.startsWith("https://"), "Suscripción no válida."),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  z.object({ kind: z.literal("fcm"), token: z.string().min(20).max(400) }),
]);
pushRouter.post("/subscribe", h(async (req, res) => {
  const sub = parse(subSchema, req.body);
  await saveSubscription(req.user.id, sub, req.headers["user-agent"]);
  res.status(201).json({ ok: true });
}));
pushRouter.post("/unsubscribe", h(async (req, res) => {
  const { key } = parse(z.object({ key: z.string().max(800) }), req.body);
  await removeSubscription(req.user.id, key);
  res.json({ ok: true });
}));
pushRouter.post("/test", rateLimit({ windowMs: 60e3, limit: 5, standardHeaders: "draft-7", legacyHeaders: false }), h(async (req, res) => {
  const sent = await notify(req.user.id, { title: "¡Notificaciones activadas!", body: "Así te avisaremos de mensajes, pagos y entrenamientos.", tag: "test", kind: "test" });
  res.json({ sent });
}));

/* ---------- tareas programadas desde afuera (cron de Hostinger o GitHub Actions) ---------- */
export const cronRouter = Router();
cronRouter.all("/", h(async (req, res) => {
  const key = process.env.CRON_KEY || "";
  const given = String(req.query.key || req.headers["x-cron-key"] || "");
  if (!key || given.length !== key.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key))) throw notFound("No existe esa ruta.");
  res.json({ ok: true, ...(await trackJob("avisos", runJobs)) });
}));

/* ---------- registro de errores ---------- */
const fp = (source, message) => crypto.createHash("sha1").update(`${source}|${String(message).slice(0, 200)}`).digest("hex");
let lastAlert = 0;
export async function logError({ source, message, detail = "", path = "", userId = null, ua = "" }) {
  try {
    await knex("error_log").insert({ at: nowISO(), source, fingerprint: fp(source, message), message: String(message).slice(0, 500),
      detail: String(detail).slice(0, 8000), path: String(path).slice(0, 200), user_id: userId, ua: String(ua).slice(0, 200) });
    // Aviso al administrador (como mucho uno cada 30 minutos)
    if (source === "server" && Date.now() - lastAlert > 30 * 60e3) {
      lastAlert = Date.now();
      const admins = await knex("users").where({ role: "admin" }).select("id");
      for (const a of admins) notify(a.id, { title: "Error en el servidor", body: String(message).slice(0, 140), page: "sistema", tag: "server-error", kind: "error" }).catch(() => {});
    }
  } catch (e) { console.error("[error_log]", e.message); }
}

/** Errores de la app (pantallas): se aceptan sin sesión, con límite por IP. */
export const reportRouter = Router();
reportRouter.post("/", rateLimit({ windowMs: 10 * 60e3, limit: 20, standardHeaders: "draft-7", legacyHeaders: false }), h(async (req, res) => {
  const b = parse(z.object({ message: z.string().max(500), stack: z.string().max(6000).optional().default(""), path: z.string().max(200).optional().default(""), version: z.string().max(40).optional() }), req.body);
  await logError({ source: "app", message: b.message, detail: b.stack, path: b.path, ua: req.headers["user-agent"] });
  res.status(202).json({ ok: true });
}));

/* ---------- panel «Sistema» del administrador ---------- */
export const systemRouter = Router();
systemRouter.use(authenticate, requireRole("admin"));

const cached = new Map();
async function memo(key, ms, fn) {
  const hit = cached.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.v;
  const v = await fn();
  cached.set(key, { v, at: Date.now() });
  return v;
}
const safe = async (fn, fallback = null) => { try { return await fn(); } catch { return fallback; } };
const n = (row) => +(row?.n || 0);

/** Serie por minuto de todos los procesos (los minutos ya cerrados vienen de la base). */
async function minuteRows(fromMs) {
  const rows = await knex("metrics_log").where({ kind: "min" }).where("at", ">=", new Date(fromMs).toISOString()).orderBy("at").select("at", "proc", "data");
  return rows.map((r) => ({ at: r.at, proc: r.proc, d: J(r.data, {}) }));
}
function seriesFrom(rows, stepMs, fromMs, toMs) {
  const slots = new Map();
  for (const r of rows) {
    const t = Math.floor(Date.parse(r.at) / stepMs) * stepMs;
    (slots.get(t) || slots.set(t, []).get(t)).push(r.d);
  }
  const out = [];
  for (let t = Math.floor(fromMs / stepMs) * stepMs; t <= toMs; t += stepMs) {
    const list = slots.get(t) || [];
    const m = mergeMinutes(list);
    const mins = Math.max(1, stepMs / 60e3);
    out.push({ t, req: m.req, rpm: Math.round(m.req / mins), s4: m.s4, s5: m.s5, r429: m.r429, r503: m.r503 + m.state.shed,
      p50: pct(m.lat, 0.5), p95: pct(m.lat, 0.95), p99: pct(m.lat, 0.99), avg: m.req ? Math.round(m.latSum / m.req) : 0,
      cpu: m.cpu, rss: m.mem.rss, heap: m.mem.heap, lag: m.lag.p99, lagMax: m.lag.max, users: m.users.coach + m.users.client + m.users.admin,
      db: m.db.n, dbAvg: m.db.n ? Math.round(m.db.ms / m.db.n) : 0, slow: m.db.slow, has: list.length > 0 });
  }
  return out;
}
function dirSize(dir) {
  let bytes = 0, files = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { files++; try { bytes += fs.statSync(p).size; } catch { /* nada */ } } } };
  try { walk(dir); } catch { /* sin carpeta */ }
  return { bytes, files };
}

systemRouter.get("/", h(async (req, res) => {
  const now = Date.now();
  const range = ["1h", "24h", "7d"].includes(req.query.range) ? req.query.range : "1h";
  const alerts = activeAlerts();

  // Ahora mismo: últimos 5 minutos de todos los procesos (+ el minuto en curso de este)
  const last5 = await safe(() => minuteRows(now - 5 * 60e3), []);
  const others = last5.filter((r) => r.proc !== PROC).map((r) => r.d);
  const mine = recent(5);
  const nowAgg = mergeMinutes([mine, ...others]);
  const dbPing = await safe(async () => { const t = Date.now(); await knex.raw("select 1"); return Date.now() - t; }, null);

  // Historia
  const series = await memo(`series:${range}`, range === "1h" ? 10e3 : 60e3, async () => {
    if (range === "7d") {
      const rows = await knex("metrics_log").where({ kind: "hour" }).where("at", ">=", new Date(now - 7 * 864e5).toISOString()).orderBy("at").select("at", "proc", "data");
      return seriesFrom(rows.map((r) => ({ at: r.at, proc: r.proc, d: J(r.data, {}) })), 3600e3, now - 7 * 864e5, now);
    }
    const from = now - (range === "24h" ? 24 * 3600e3 : 60 * 60e3);
    return seriesFrom(await minuteRows(from), range === "24h" ? 15 * 60e3 : 60e3, from, now - 60e3);
  }).catch(() => []);

  // Rutas de la última hora
  const routes = await memo("routes", 30e3, async () => {
    const rows = await minuteRows(now - 60 * 60e3);
    return mergeMinutes([...rows.map((r) => r.d), recent(1)]).routes.map(([k, cnt, ms, max, err, slow]) => ({ route: k, n: cnt, avg: Math.round(ms / Math.max(1, cnt)), max: Math.round(max), err, slow }));
  }).catch(() => []);
  const hour = await memo("hourAgg", 30e3, async () => mergeMinutes((await minuteRows(now - 60 * 60e3)).map((r) => r.d))).catch(() => mergeMinutes([]));
  const day = await memo("dayAgg", 120e3, async () => mergeMinutes((await minuteRows(now - 24 * 3600e3)).map((r) => r.d))).catch(() => mergeMinutes([]));

  // Procesos vivos (cada uno escribe su minuto)
  const procs = await memo("procs", 15e3, async () => {
    const rows = await knex("metrics_log").where({ kind: "min" }).where("at", ">=", new Date(now - 4 * 60e3).toISOString()).orderBy("at", "desc").select("at", "proc", "data");
    const seen = new Map();
    for (const r of rows) if (!seen.has(r.proc)) { const d = J(r.data, {}); seen.set(r.proc, { proc: r.proc, at: r.at, cpu: d.cpu, rss: d.mem?.rss, heap: d.mem?.heap, lag: d.lag?.p99, req: d.req }); }
    return [...seen.values()];
  }).catch(() => []);
  const boots = await safe(async () => (await knex("metrics_log").where({ kind: "boot" }).orderBy("at", "desc").limit(15).select("at", "proc", "data")).map((r) => ({ at: r.at, proc: r.proc, ...J(r.data, {}) })), []);
  const alertLog = await safe(async () => (await knex("metrics_log").where({ kind: "alert" }).orderBy("at", "desc").limit(40).select("at", "data")).map((r) => ({ at: r.at, ...J(r.data, {}) })), []);

  // Usuarios y equipos
  const people = await memo("people", 30e3, async () => {
    const ago = (ms) => new Date(now - ms).toISOString();
    const activeBy = async (ms) => {
      const rows = await knex("devices").join("users", "users.id", "devices.user_id").where("devices.seen_at", ">=", ago(ms))
        .select("users.role").countDistinct({ n: "devices.user_id" }).groupBy("users.role");
      return Object.fromEntries(rows.map((r) => [r.role, +r.n]));
    };
    const [m5, h1, d1, d7] = [await activeBy(5 * 60e3), await activeBy(3600e3), await activeBy(864e5), await activeBy(7 * 864e5)];
    const platforms = await knex("devices").where("seen_at", ">=", ago(7 * 864e5)).select("platform", "app_version").count({ n: "*" }).groupBy("platform", "app_version");
    const totals = await knex("users").select("role").count({ n: "*" }).groupBy("role");
    const activeClients = n(await knex("clients").where({ active: true }).count({ n: "*" }).first());
    const pendingDevices = await knex("devices").join("users", "users.id", "devices.user_id")
      .where((q) => q.where("devices.pending", ">", 0).orWhereNotNull("devices.last_error"))
      .where("devices.seen_at", ">=", ago(14 * 864e5))
      .orderBy("devices.seen_at", "desc").limit(30)
      .select("users.name", "users.role", "devices.platform", "devices.app_version", "devices.pending", "devices.failed", "devices.seen_at", "devices.last_sync_at", "devices.last_error");
    const locked = n(await knex("users").where("locked_until", ">", Date.now()).count({ n: "*" }).first());
    const sessions = n(await knex("refresh_tokens").where({ revoked: false }).where("expires_at", ">", new Date().toISOString()).count({ n: "*" }).first());
    return { active: { m5, h1, d1, d7 }, platforms: platforms.map((p) => ({ platform: p.platform, version: p.app_version || "", n: +p.n })),
      totals: Object.fromEntries(totals.map((t) => [t.role, +t.n])), activeClients, pendingDevices, locked, sessions };
  }).catch(() => null);

  // Base de datos: tablas y tamaño
  const dbInfo = await memo("dbinfo", 5 * 60e3, async () => {
    const tables = ["users", "clients", "workouts", "active_workouts", "messages", "posts", "payments", "photos", "files", "exercises", "templates", "licenses", "subscriptions", "refresh_tokens", "push_subs", "error_log", "idem_keys", "devices", "metrics_log"];
    const rows = {};
    for (const t of tables) rows[t] = await safe(async () => n(await knex(t).count({ n: "*" }).first()), null);
    let sizeMb = null;
    if (knex.client.config.client === "mysql2") {
      sizeMb = await safe(async () => {
        const [r] = await knex.raw("SELECT ROUND(SUM(data_length + index_length) / 1048576, 1) AS mb FROM information_schema.tables WHERE table_schema = DATABASE()");
        return +r[0].mb;
      });
    } else sizeMb = await safe(async () => Math.round(fs.statSync(knex.client.config.connection.filename).size / 104857.6) / 10);
    const files = await safe(async () => {
      const r = await knex("files").select("kind").count({ n: "*" }).sum({ b: "size" }).groupBy("kind");
      return r.map((x) => ({ kind: x.kind, n: +x.n, mb: Math.round((+x.b || 0) / 104857.6) / 10 }));
    }, []);
    const disk = dirSize(config.uploadDir);
    let free = null;
    try { if (fs.statfsSync) { const st = fs.statfsSync(config.uploadDir); free = { mb: Math.round((st.bavail * st.bsize) / 1048576), pct: Math.round((st.bavail / st.blocks) * 100) }; } } catch { /* nada */ }
    return { rows, sizeMb, files, uploadsMb: Math.round(disk.bytes / 104857.6) / 10, uploadFiles: disk.files, free };
  }).catch(() => null);

  // Tareas programadas
  const jobs = await safe(async () => (await knex("settings").where("key", "like", "job:%")).map((r) => J(r.value, {})), []);

  // Errores agrupados (7 días)
  const since = new Date(now - 7 * 864e5).toISOString();
  const errRows = await safe(() => knex("error_log").where("at", ">=", since).orderBy("at", "desc").limit(2000), []);
  const groups = new Map();
  for (const r of errRows) {
    const g = groups.get(r.fingerprint) || { fingerprint: r.fingerprint, source: r.source, message: r.message, count: 0, last: r.at, first: r.at, path: r.path, detail: r.detail, ua: r.ua, users: new Set() };
    g.count++; g.first = r.at; if (r.user_id) g.users.add(r.user_id); groups.set(r.fingerprint, g);
  }
  const dayAgo = new Date(now - 864e5).toISOString();

  const p = processInfo();
  const worst = alerts.reduce((w, a) => Math.max(w, { critical: 3, warning: 2, info: 1 }[a.level] || 0), 0);
  res.json({
    now: new Date(now).toISOString(), status: worst >= 3 ? "critical" : worst === 2 ? "warning" : "ok",
    alerts, alertLog, range, series, routes,
    live: {
      rpm: Math.round(nowAgg.req / 5), req5: nowAgg.req, s4: nowAgg.s4, s5: nowAgg.s5, r429: nowAgg.r429, r503: nowAgg.r503 + nowAgg.state.shed,
      p50: pct(nowAgg.lat, 0.5), p95: pct(nowAgg.lat, 0.95), p99: pct(nowAgg.lat, 0.99), max: Math.round(nowAgg.latMax),
      errorRate: nowAgg.req ? Math.round((nowAgg.s5 / nowAgg.req) * 1000) / 10 : 0, users: nowAgg.users, inflightMax: nowAgg.inflightMax,
      dbPing, db: { ...nowAgg.db, avg: nowAgg.db.n ? Math.round(nowAgg.db.ms / nowAgg.db.n) : 0 }, state: nowAgg.state, auth: nowAgg.auth, sync: nowAgg.sync, push: nowAgg.push, pw: nowAgg.pw,
      load: { level: loadLevel(), pollSec: pollSeconds(), gate: stateGate.info(), passwords: poolInfo() },
    },
    hour: { auth: hour.auth, sync: hour.sync, push: hour.push, state: hour.state, db: hour.db, req: hour.req, s4: hour.s4, s5: hour.s5, r429: hour.r429 },
    day: { auth: day.auth, sync: day.sync, push: day.push, state: day.state, req: day.req, s5: day.s5, r429: day.r429, p95: pct(day.lat, 0.95) },
    process: p, procs, boots, slowQueries: recentSlowQueries(), people, dbInfo, jobs,
    // compatibilidad con la versión anterior del panel
    uptimeSec: p.uptimeSec, node: p.node, db: dbPing != null, dbClient: knex.client.config.client, memoryMb: p.mem.rss,
    errors24h: errRows.filter((r) => r.at >= dayAgo).length, errors7d: errRows.length,
    pushSubs: await safe(async () => n(await knex("push_subs").count({ n: "*" }).first()), 0), fcm: fcmEnabled(), cron: !!process.env.CRON_KEY,
    groups: [...groups.values()].slice(0, 60).map((g) => ({ ...g, users: g.users.size })),
  });
}));
systemRouter.delete("/errors", h(async (req, res) => {
  if (req.query.fingerprint) await knex("error_log").where({ fingerprint: String(req.query.fingerprint).slice(0, 64) }).delete();
  else await knex("error_log").delete();
  res.json({ ok: true });
}));
/* Notificaciones Android: el administrador sube el archivo de la cuenta de servicio de Firebase */
systemRouter.get("/fcm", h(async (_req, res) => { await loadFcm(); res.json({ fcm: fcmInfo() }); }));
systemRouter.put("/fcm", h(async (req, res) => {
  const { json } = parse(z.object({ json: z.string().max(20000) }), req.body);
  const a = parseFcmAccount(json);
  if (!a) throw bad("Ese archivo no es una cuenta de servicio de Firebase. Descárgalo en Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.");
  try { await testFcmAccount(a); } catch (e) { throw bad(`Google no aceptó la clave: ${e.message}`); }
  const value = JSON.stringify({ type: a.type, project_id: a.project_id, private_key_id: a.private_key_id, private_key: a.private_key, client_email: a.client_email, client_id: a.client_id });
  await knex("settings").insert({ key: "fcm:account", value }).onConflict("key").merge(["value"]);
  await loadFcm();
  res.json({ ok: true, fcm: fcmInfo() });
}));
systemRouter.delete("/fcm", h(async (_req, res) => {
  await knex("settings").where({ key: "fcm:account" }).delete();
  await loadFcm();
  res.json({ ok: true, fcm: fcmInfo() });
}));
systemRouter.post("/jobs", h(async (_req, res) => res.json(await trackJob("avisos", runJobs))));
systemRouter.post("/check", h(async (_req, res) => res.json({ alerts: await evaluate() })));
