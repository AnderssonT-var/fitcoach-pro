/* VYTRAFIT — servidor de producción.
   API en /api y la app web compilada (carpeta dist) en el mismo dominio. */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { knex, migrate, bool } from "./db.js";
import { authenticate, coachLicenseRow, hashPassword, requireRole } from "./auth.js";
import { HttpError, h, nowISO } from "./util.js";
import { serveFile } from "./files.js";
import { buildState } from "./state.js";
import { router as authRouter, publicRouter } from "./routes/auth.js";
import { router as adminRouter } from "./routes/admin.js";
import { router as coachRouter } from "./routes/coach.js";
import { accountRouter, clientRouter, sharedRouter } from "./routes/client.js";

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
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, If-None-Match");
      res.setHeader("Access-Control-Expose-Headers", "ETag");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });
  app.use("/api", express.json({ limit: "8mb" }));
  app.use("/api", rateLimit({ windowMs: 60e3, limit: 400, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Demasiadas solicitudes. Espera un momento." } }));
  app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

  app.get("/api/health", h(async (_req, res) => { await knex.raw("select 1"); res.json({ ok: true, time: nowISO() }); }));
  app.use("/api/public", publicRouter);
  app.use("/api/auth", authRouter);
  app.get("/api/files/:id", h(serveFile));

  /* Estado del usuario (todo lo que puede ver según su rol) */
  app.get("/api/state", authenticate, h(async (req, res) => {
    const s = await buildState(req.user);
    if (req.user.role === "client") {
      const c = await knex("clients").where({ user_id: req.user.id }).first();
      if (!c || !bool(c.active)) s.access = { ok: false, code: "client_inactive", message: "Tu entrenador pausó esta cuenta. Escríbele para reactivarla." };
      else if (!(await coachLicenseRow(c.coach_id))) s.access = { ok: false, code: "coach_license", message: "El acceso de tu entrenador está pausado por ahora. Vuelve a intentar más tarde." };
      else s.access = { ok: true };
    }
    // Si nada cambió desde la última consulta se responde 304 (sin cuerpo): ahorra datos en el celular
    const body = JSON.stringify(s);
    const etag = `"${crypto.createHash("sha1").update(body).digest("base64url")}"`;
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    res.type("json").send(body);
  }));

  app.use("/api/admin", authenticate, requireRole("admin"), adminRouter);
  app.use("/api/coach", authenticate, requireRole("coach"), coachRouter);
  app.use("/api/client", authenticate, requireRole("client"), clientRouter);
  app.use("/api/account", authenticate, accountRouter);
  app.use("/api", authenticate, sharedRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: "No existe esa ruta." }));

  /* App web */
  if (fs.existsSync(path.join(config.webDir, "index.html"))) {
    app.use(express.static(config.webDir, { index: false, maxAge: "7d", setHeaders: (res, p) => { if (p.endsWith(".html")) res.setHeader("Cache-Control", "no-cache"); } }));
    app.get("*", (_req, res) => { res.setHeader("Cache-Control", "no-cache"); res.sendFile(path.join(config.webDir, "index.html")); });
  }

  /* Errores: mensaje claro para el usuario, sin detalles internos */
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "El archivo es demasiado grande." });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Solicitud no válida." });
    console.error("[error]", err);
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
  await knex("users").insert({ role: "admin", email: email.toLowerCase(), password_hash: await hashPassword(password), name, profile: "{}", created_at: nowISO() });
  console.log(`[VYTRAFIT] Administrador creado: ${email}. Ya puedes quitar ADMIN_PASSWORD del archivo .env.`);
}

/** Limpieza periódica: sesiones vencidas, entrenamientos abandonados y actividad antigua. */
export async function housekeeping() {
  const now = Date.now();
  try {
    await knex("refresh_tokens").where("expires_at", "<", new Date(now).toISOString()).delete();
    await knex("active_workouts").where("updated_at", "<", new Date(now - 14 * 864e5).toISOString()).delete();
    await knex("activity").where("at", "<", new Date(now - 400 * 864e5).toISOString()).delete();
  } catch (e) { console.error("[limpieza]", e.message); }
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
  await housekeeping();
  const timer = setInterval(housekeeping, 6 * 3600e3);
  timer.unref();
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`[VYTRAFIT] listo en el puerto ${config.port} (${config.isProd ? "producción" : "desarrollo"}, base ${config.db.client})`));
  server.keepAliveTimeout = 65e3; // mayor que el del proxy para evitar cortes 502
  server.headersTimeout = 66e3;
  // Apagado ordenado: termina las solicitudes en curso y cierra la base de datos
  const stop = (sig) => {
    console.log(`[VYTRAFIT] ${sig}: cerrando…`);
    server.close(() => knex.destroy().finally(() => process.exit(0)));
    server.closeIdleConnections?.(); // conexiones keep-alive sin uso no deben retrasar el apagado
    setTimeout(() => process.exit(1), 10e3).unref();
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) await start();
