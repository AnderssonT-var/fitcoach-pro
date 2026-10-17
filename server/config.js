/* Configuración del servidor a partir de variables de entorno (.env). */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Carga simple de .env (sin dependencias). No sobreescribe variables ya definidas. */
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnv(path.join(ROOT, ".env"));

const env = process.env;
const isProd = env.NODE_ENV === "production";
const DATA = path.resolve(ROOT, env.DATA_DIR || "data");
fs.mkdirSync(DATA, { recursive: true });

/* En desarrollo se genera un secreto local; en producción es obligatorio. */
function secret(name) {
  const v = env[name];
  if (v && v.length >= 32) return v;
  if (isProd) {
    console.error(`\n[FitCoach Pro] Falta ${name} (mínimo 32 caracteres) en el archivo .env. Genera uno con:\n  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"\n`);
    process.exit(1);
  }
  const f = path.join(DATA, `.${name.toLowerCase()}`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(48).toString("base64url"), { mode: 0o600 });
  return fs.readFileSync(f, "utf8").trim();
}

const dbClient = env.DB_CLIENT || (env.DB_HOST ? "mysql2" : "better-sqlite3");

export const config = {
  isProd,
  port: +(env.PORT || 3000),
  dataDir: DATA,
  uploadDir: path.resolve(ROOT, env.UPLOAD_DIR || path.join(DATA, "uploads")),
  webDir: path.resolve(ROOT, env.WEB_DIR || "dist"),
  jwtSecret: secret("JWT_SECRET"),
  fileSecret: secret("FILE_SECRET"),
  trustProxy: env.TRUST_PROXY ?? (isProd ? "1" : "0"),
  /* Orígenes permitidos además del propio dominio (la app Android usa https://localhost) */
  corsOrigins: (env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean)
    .concat(["https://localhost", "capacitor://localhost", "http://localhost"]),
  db: dbClient === "mysql2"
    ? { client: "mysql2", connection: { host: env.DB_HOST || "127.0.0.1", port: +(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, charset: "utf8mb4", timezone: "Z" }, pool: { min: 0, max: 10 } }
    : { client: "better-sqlite3", connection: { filename: path.resolve(ROOT, env.DB_FILE || path.join(DATA, "fitcoach.sqlite")) }, useNullAsDefault: true },
  admin: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD, name: env.ADMIN_NAME || "Administrador" },
  legalVersion: "2026-10",
};
fs.mkdirSync(config.uploadDir, { recursive: true });
