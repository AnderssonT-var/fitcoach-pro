/* VYTRAFIT — servidor de producción.
   API en /api y la app web compilada (carpeta dist) en el mismo dominio. */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import { mountLanding } from "./landing.js";
import compression from "compression";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { knex, migrate, bool } from "./db.js";
import { authenticate, coachLicenseRow, hashPassword, requireRole } from "./auth.js";
import { HttpError, h, nowISO, reqCtx } from "./util.js";
import { serveFile } from "./files.js";
import { buildState } from "./state.js";
import { router as authRouter, publicRouter } from "./routes/auth.js";
import { router as adminRouter } from "./routes/admin.js";
import { router as coachRouter } from "./routes/coach.js";
import { accountRouter, clientRouter, sharedRouter } from "./routes/client.js";
import { cronRouter, logError, pushRouter, reportRouter, systemRouter } from "./routes/system.js";
import { runJobs } from "./jobs.js";
import { APP_VERSION, count, addTime, httpMetrics, recordBoot, recordStop, trackJob } from "./metrics.js";
import { startAlerts } from "./alerts.js";
import { bumpAfterChange, coachIdOf, versions } from "./versions.js";
import { idempotency, syncReport, trackDevice } from "./sync.js";
import { loadLevel, pollSeconds, stateGate } from "./load.js";
import { FULL_DAYS } from "./history.js";
import { signupRouter } from "./routes/signup.js";

const VERSION = APP_VERSION;
const DB_CONN_ERR = /ECONNRESET|EPIPE|PROTOCOL_CONNECTION_LOST|ETIMEDOUT|Connection lost|Can't add new command when connection is in closed state/;
/* Cambia cuando cambia la forma del estado: así las apps no reciben un 304 de un formato viejo */
const STATE_FORMAT = "s3";

/* Respuestas de /api/state recién armadas (si otro equipo del mismo usuario las pide, no se rearman) */
const bodies = new Map();
let bodiesBytes = 0;
const BODIES_MAX = 48 * 1024 * 1024;
function remember(key, body) {
  if (body.length > 8 * 1024 * 1024) return;
  if (bodies.has(key)) return;
  bodies.set(key, { body, at: Date.now() });
  bodiesBytes += body.length;
  while (bodiesBytes > BODIES_MAX || bodies.size > 400) {
    const [k, v] = bodies.entries().next().value;
    bodies.delete(k); bodiesBytes -= v.body.length;
  }
}
function recall(key) {
  const hit = bodies.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > 10 * 60e3) { bodies.delete(key); bodiesBytes -= hit.body.length; return null; }
  return hit.body;
}
const building = new Map(); // armado en curso por clave (dos pedidos iguales esperan el mismo)
const shaTag = (s) => crypto.createHash("sha1").update(s).digest("base64url").slice(0, 27);

/* Usuario del token (sin consultar la base) para limitar por persona y no por IP:
   en un gimnasio muchas personas comparten la misma conexión */
function tokenUser(req) {
  if (req._tokenUser !== undefined) return req._tokenUser;
  const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
  let sub = null;
  if (m) { try { sub = jwt.verify(m[1], config.jwtSecret, { issuer: "fitcoachpro", algorithms: ["HS256"] }).sub; } catch { sub = null; } }
  req._tokenUser = sub;
  return sub;
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", /^\d+$/.test(config.trustProxy) ? +config.trustProxy : config.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'", "data:"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "upgrade-insecure-requests": config.isProd ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }, // la app Android carga fotos firmadas
    strictTransportSecurity: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));
  app.use(compression());

  /* CORS solo para orígenes conocidos (la app Android y los configurados) */
  app.use("/api", (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, If-None-Match, Idempotency-Key, X-Op-At, X-App, X-Device, X-Pending, X-Sync-Failed, X-Have-History");
      res.setHeader("Access-Control-Expose-Headers", "ETag, X-Poll-Interval, Retry-After, Idempotent-Replay");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });
  app.use("/api", httpMetrics);
  app.use("/api", express.json({ limit: "8mb" }));
  const limited = { error: "Demasiadas solicitudes. Espera un momento.", code: "rate_limited" };
  // Por persona (con sesión): 600 por minuto alcanzan para subir una cola grande de cambios hechos sin conexión
  app.use("/api", rateLimit({ windowMs: 60e3, limit: 600, standardHeaders: "draft-7", legacyHeaders: false, message: limited,
    skip: (req) => !tokenUser(req), keyGenerator: (req) => `u:${tokenUser(req)}` }));
  // Por conexión: alto, porque un gimnasio entero puede salir por la misma IP
  app.use("/api", rateLimit({ windowMs: 60e3, limit: (req) => (tokenUser(req) ? 6000 : 900), standardHeaders: false, legacyHeaders: false, message: limited,
    keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip)}` }));
  app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Poll-Interval", String(pollSeconds())); next(); });
  // Si el servidor está saturado, las consultas de «¿hay algo nuevo?» esperan; los cambios siempre se atienden
  app.use("/api/state", (req, res, next) => {
    if (loadLevel() === 2 && req.headers["if-none-match"]) {
      count("state.shed");
      res.setHeader("Retry-After", "30");
      return res.status(503).json({ error: "Mucha gente conectada. Tus datos están a salvo; se actualizan en unos segundos.", code: "busy" });
    }
    next();
  });

  app.get("/api/health", h(async (_req, res) => { await knex.raw("select 1"); res.json({ ok: true, version: VERSION, time: nowISO() }); }));
  app.use("/api/public/signup", signupRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/cron", cronRouter);
  app.use("/api/report-error", reportRouter);
  app.use("/api/push", pushRouter);
  app.use("/api/admin/system", systemRouter);
  app.use("/api/auth", bumpAfterChange, authRouter);
  app.post("/api/sync/report", authenticate, trackDevice, h(syncReport));
  app.get("/api/files/:id", h(serveFile));

  /* Estado del usuario (todo lo que puede ver según su rol).
     Para no rearmarlo en cada consulta, la etiqueta (ETag) se calcula con las versiones de
     los datos: si nada cambió se responde 304 sin tocar el resto de la base. El historial de
     entrenamientos (lo más pesado) solo se envía si la app no tiene ya el mismo. */
  app.get("/api/state", authenticate, trackDevice, h(async (req, res) => {
    const u = req.user;
    const t0 = Date.now();
    if (u.role === "admin") {
      const s = await stateGate.run(() => buildState(u));
      const body = JSON.stringify(s);
      const etag = `"${shaTag(body)}"`;
      res.setHeader("ETag", etag);
      addTime("state", Date.now() - t0);
      if (req.headers["if-none-match"] === etag) { count("state.notModified"); return res.status(304).end(); }
      count("state.full"); count("state.bytes", body.length);
      return res.type("json").send(body);
    }
    const coach = await coachIdOf(u);
    let access = null;
    if (u.role === "client") {
      const c = await knex("clients").where({ user_id: u.id }).select("active", "coach_id").first();
      if (!c || !bool(c.active)) access = { ok: false, code: "client_inactive", message: "Tu entrenador pausó esta cuenta. Escríbele para reactivarla." };
      else if (!(await coachLicenseRow(c.coach_id))) access = { ok: false, code: "coach_license", message: "El acceso de tu entrenador está pausado por ahora. Vuelve a intentar más tarde." };
      else access = { ok: true };
    }
    const scopes = ["g", coach && `c:${coach}`, `u:${u.id}`, coach && `w:${coach}`].filter(Boolean);
    const v = await versions(scopes);
    const bucket = Math.floor(Date.now() / 600e3); // cada 10 min se rearma igual (pruebas que vencen, fotos firmadas)
    const etag = `"${shaTag([STATE_FORMAT, u.id, u.token_version, u.consent_version, u.must_change_password, u.photo_consent, bucket, access?.code || "", ...scopes.map((x) => v[x])].join("|"))}"`;
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) { count("state.notModified"); return res.status(304).end(); }
    // Historial: cambia solo cuando alguien del grupo termina un entrenamiento (y una vez al día por la ventana de fechas)
    const historyKey = shaTag(`${STATE_FORMAT}|${u.id}|${v[`w:${coach}`] || "0"}|${Math.floor(Date.now() / 864e5)}|${FULL_DAYS}`).slice(0, 16);
    const keep = req.headers["x-have-history"] === historyKey;
    const key = `${etag}|${keep ? "k" : "f"}`;
    let body = recall(key);
    if (body) count("state.memo");
    else {
      let p = building.get(key);
      if (!p) {
        p = stateGate.run(async () => {
          const s = await buildState(u, { history: !keep });
          if (access) s.access = access;
          s.historyKey = historyKey;
          if (keep) s.historyKept = true;
          return JSON.stringify(s);
        }).finally(() => building.delete(key));
        building.set(key, p);
      }
      body = await p;
      remember(key, body);
      addTime("state", Date.now() - t0);
    }
    count("state.full"); count("state.bytes", body.length);
    if (keep) count("state.keptHistory");
    res.type("json").send(body);
  }));

  // Cambios: se registra el equipo, se evita repetir acciones reintentadas y se marca qué datos cambiaron
  const changes = [trackDevice, idempotency, bumpAfterChange];
  app.use("/api/admin", authenticate, requireRole("admin"), ...changes, adminRouter);
  app.use("/api/coach", authenticate, requireRole("coach"), ...changes, coachRouter);
  app.use("/api/client", authenticate, requireRole("client"), ...changes, clientRouter);
  app.use("/api/account", authenticate, ...changes, accountRouter);
  app.use("/api", authenticate, ...changes, sharedRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: "No existe esa ruta." }));

  /* Página de presentación de cada entrenador: /<enlace> */
  mountLanding(app);

  /* App web */
  if (fs.existsSync(path.join(config.webDir, "index.html"))) {
    app.use(express.static(config.webDir, { index: false, maxAge: "7d", setHeaders: (res, p) => { if (p.endsWith(".html") || p.endsWith("sw.js") || p.endsWith(".webmanifest")) res.setHeader("Cache-Control", "no-cache"); } }));
    app.get("*", (_req, res) => { res.setHeader("Cache-Control", "no-cache"); res.sendFile(path.join(config.webDir, "index.html")); });
  }

  /* Errores: mensaje claro para el usuario, sin detalles internos */
  app.use((err, req, res, _next) => {
    if (err instanceof HttpError) {
      if (err.status === 503) res.setHeader("Retry-After", String(err.extra?.retryAfter || 10));
      return res.status(err.status).json({ error: err.message, ...err.extra });
    }
    // Conexión a la base cortada por el hosting (ECONNRESET): una consulta de lectura se repite una vez
    // con otra conexión, así la persona no ve el error
    if (DB_CONN_ERR.test(String(err?.code || err?.message)) && req.method === "GET" && !res.headersSent && !req._dbRetry) {
      req._dbRetry = true;
      count("db.err");
      return app.handle(req, res, () => {});
    }
    // Reintento de una acción hecha sin conexión que ya se había guardado (mismo id): no es un error
    if (reqCtx.getStore()?.op && /duplicate|unique|UNIQUE constraint/i.test(String(err?.message || err?.code))) {
      count("sync.replay");
      return res.status(200).json({ ok: true, duplicate: true });
    }
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "El archivo es demasiado grande." });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Solicitud no válida." });
    console.error("[error]", err);
    logError({ source: "server", message: err?.message || String(err), detail: err?.stack || "", path: `${req.method} ${req.path}`, userId: req.user?.id ?? null, ua: req.headers["user-agent"] });
    res.status(500).json({ error: "Algo salió mal en el servidor. Intenta de nuevo." });
  });
  return app;
}

/** Crea la cuenta de administrador la primera vez (desde ADMIN_EMAIL y ADMIN_PASSWORD). */
export async function ensureAdmin() {
  const any = await knex("users").where({ role: "admin" }).first();
  if (any) return;
  const { email, password, name } = config.admin;
  if (!email || !password) {
    console.warn("[VYTRAFIT] No hay administrador. Define ADMIN_EMAIL y ADMIN_PASSWORD en .env y reinicia, o ejecuta: npm run create-admin");
    return;
  }
  const { passwordProblem } = await import("./auth.js");
  const pp = passwordProblem(password, email);
  if (pp) { console.error(`[VYTRAFIT] ADMIN_PASSWORD no es segura: ${pp}`); return; }
  try {
    await knex("users").insert({ role: "admin", email: email.toLowerCase(), password_hash: await hashPassword(password), name, profile: "{}", created_at: nowISO() });
  } catch (e) {
    if (/duplicate|unique/i.test(String(e?.message))) return; // otro proceso lo creó al mismo tiempo
    throw e;
  }
  console.log(`[VYTRAFIT] Administrador creado: ${email}. Ya puedes quitar ADMIN_PASSWORD del archivo .env.`);
}

/** Limpieza periódica: sesiones vencidas, entrenamientos abandonados y actividad antigua. */
export async function housekeeping() {
  const now = Date.now();
  try {
    await knex("refresh_tokens").where("expires_at", "<", new Date(now).toISOString()).delete();
    await knex("active_workouts").where("updated_at", "<", new Date(now - 14 * 864e5).toISOString()).delete();
    await knex("activity").where("at", "<", new Date(now - 400 * 864e5).toISOString()).delete();
    await knex("notif_log").where("at", "<", new Date(now - 60 * 864e5).toISOString()).delete();
    await knex("error_log").where("at", "<", new Date(now - 30 * 864e5).toISOString()).delete();
    await knex("idem_keys").where("at", "<", new Date(now - 21 * 864e5).toISOString()).delete();
    await knex("devices").where("seen_at", "<", new Date(now - 180 * 864e5).toISOString()).delete();
  } catch (e) { console.error("[limpieza]", e.message); throw e; }
}

/** Arranca el servidor (lo llama server.js en la raíz, o este archivo si se ejecuta directo). */
let started = false;
export async function start() {
  if (started) return;
  started = true;
  process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
  if (config.isProd && config.db.client !== "mysql2") console.warn("[VYTRAFIT] Producción con SQLite: se recomienda MySQL (define DB_HOST, DB_NAME, DB_USER y DB_PASSWORD).");
  if (!fs.existsSync(path.join(config.webDir, "index.html"))) console.warn("[VYTRAFIT] No se encontró la app compilada (dist). Ejecuta: npm run build");
  await migrate();
  await ensureAdmin();
  recordBoot();
  startAlerts();
  // Datos ficticios para las cuentas de prueba (una sola vez)
  import("./demo.js").then((m) => m.fillDemo()).catch((e) => console.warn("[demo]", e.message));
  await trackJob("limpieza", housekeeping).catch(() => {});
  const timer = setInterval(() => trackJob("limpieza", housekeeping).catch(() => {}), 6 * 3600e3);
  timer.unref();
  // Recordatorios, avisos de pagos y de pruebas (cada 5 minutos)
  const jobs = setInterval(() => trackJob("avisos", runJobs).catch(() => {}), 5 * 60e3);
  jobs.unref();
  setTimeout(() => trackJob("avisos", runJobs).catch(() => {}), 20e3).unref();
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`[VYTRAFIT] listo en el puerto ${config.port} (${config.isProd ? "producción" : "desarrollo"}, base ${config.db.client})`));
  server.keepAliveTimeout = 65e3; // mayor que el del proxy para evitar cortes 502
  server.headersTimeout = 66e3;
  server.requestTimeout = 120e3; // nadie queda esperando para siempre
  server.maxConnections = +process.env.MAX_CONNECTIONS || 4000;
  // Apagado ordenado: termina las solicitudes en curso y cierra la base de datos
  const stop = (sig) => {
    console.log(`[VYTRAFIT] ${sig}: cerrando…`);
    const done = () => knex.destroy().finally(() => process.exit(0));
    server.close(() => { recordStop(sig).finally(done); });
    server.closeIdleConnections?.(); // conexiones keep-alive sin uso no deben retrasar el apagado
    setTimeout(() => process.exit(1), 10e3).unref();
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) start().catch((e) => { console.error("[VYTRAFIT] no pudo arrancar:", e); process.exit(1); });
