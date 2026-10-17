/* FitCoach Pro — servidor de producción.
   API en /api y la app web compilada (carpeta dist) en el mismo dominio. */
import fs from "node:fs";
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
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
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
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
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
    res.json(s);
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
    console.warn("[FitCoach Pro] No hay administrador. Define ADMIN_EMAIL y ADMIN_PASSWORD en .env y reinicia, o ejecuta: npm run create-admin");
    return;
  }
  const { passwordProblem } = await import("./auth.js");
  const pp = passwordProblem(password, email);
  if (pp) { console.error(`[FitCoach Pro] ADMIN_PASSWORD no es segura: ${pp}`); return; }
  await knex("users").insert({ role: "admin", email: email.toLowerCase(), password_hash: await hashPassword(password), name, profile: "{}", created_at: nowISO() });
  console.log(`[FitCoach Pro] Administrador creado: ${email}. Ya puedes quitar ADMIN_PASSWORD del archivo .env.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  await migrate();
  await ensureAdmin();
  const app = createApp();
  app.listen(config.port, () => console.log(`[FitCoach Pro] listo en el puerto ${config.port} (${config.isProd ? "producción" : "desarrollo"}, base ${config.db.client})`));
}
