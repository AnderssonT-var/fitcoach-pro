/* Notificaciones (suscribirse, probar), tareas programadas y registro de errores. */
import crypto from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { knex } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { h, notFound, nowISO, parse } from "../util.js";
import { fcmEnabled, getVapid, notify, removeSubscription, saveSubscription } from "../notify.js";
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
  res.json({ ok: true, ...(await runJobs()) });
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
const started = Date.now();
export const systemRouter = Router();
systemRouter.use(authenticate, requireRole("admin"));
systemRouter.get("/", h(async (_req, res) => {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const rows = await knex("error_log").where("at", ">=", since).orderBy("at", "desc").limit(1000);
  const groups = new Map();
  for (const r of rows) {
    const g = groups.get(r.fingerprint) || { fingerprint: r.fingerprint, source: r.source, message: r.message, count: 0, last: r.at, first: r.at, path: r.path, detail: r.detail, ua: r.ua };
    g.count++; g.first = r.at; groups.set(r.fingerprint, g);
  }
  const day = new Date(Date.now() - 864e5).toISOString();
  let dbOk = true; try { await knex.raw("select 1"); } catch { dbOk = false; }
  res.json({
    uptimeSec: Math.round((Date.now() - started) / 1000), node: process.version, db: dbOk, dbClient: knex.client.config.client,
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
    errors24h: rows.filter((r) => r.at >= day).length, errors7d: rows.length,
    pushSubs: +(await knex("push_subs").count({ n: "*" }).first()).n, fcm: fcmEnabled(), cron: !!process.env.CRON_KEY,
    groups: [...groups.values()].slice(0, 50),
  });
}));
systemRouter.delete("/errors", h(async (_req, res) => { await knex("error_log").delete(); res.json({ ok: true }); }));
systemRouter.post("/jobs", h(async (_req, res) => res.json(await runJobs())));
