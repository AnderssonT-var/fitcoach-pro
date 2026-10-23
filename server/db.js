/* Base de datos: Knex sobre MySQL (producción) o SQLite (local). */
import knexFactory from "knex";
import { config } from "./config.js";

export const knex = knexFactory(config.db);

export const J = (v, fallback = null) => {
  if (v == null || v === "") return fallback;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return fallback; }
};
export const S = (v) => JSON.stringify(v ?? null);
export const bool = (v) => v === true || v === 1 || v === "1";

/* Migraciones versionadas: cada una se aplica una sola vez. */
const MIGRATIONS = [
  ["001_inicial", async (k) => {
    const long = (t, name) => (config.db.client === "mysql2" ? t.text(name, "longtext") : t.text(name));
    await k.schema.createTable("users", (t) => {
      t.increments("id").primary();
      t.string("role", 10).notNullable();
      t.string("email", 190).notNullable().unique();
      t.string("password_hash", 100).notNullable();
      t.string("name", 120).notNullable();
      long(t, "profile");
      long(t, "brand");
      t.string("brand_slug", 80).nullable().unique();
      t.boolean("must_change_password").notNullable().defaultTo(false);
      t.integer("failed_logins").notNullable().defaultTo(0);
      t.bigInteger("locked_until").nullable();
      t.integer("token_version").notNullable().defaultTo(0);
      t.string("consent_version", 20).nullable();
      t.string("consent_at", 30).nullable();
      t.boolean("photo_consent").notNullable().defaultTo(false);
      t.string("created_at", 30).notNullable();
      t.string("last_login_at", 30).nullable();
    });
    await k.schema.createTable("clients", (t) => {
      t.integer("user_id").unsigned().primary();
      t.integer("coach_id").unsigned().notNullable().index();
      t.boolean("active").notNullable().defaultTo(true);
      long(t, "data");
    });
    await k.schema.createTable("licenses", (t) => {
      t.string("id", 40).primary();
      t.string("code", 24).notNullable().unique();
      t.integer("months").notNullable();
      t.integer("coach_id").unsigned().nullable().index();
      t.string("created_at", 30).notNullable();
      t.string("activated_at", 30).nullable();
      t.string("expires_at", 30).nullable();
      t.boolean("revoked").notNullable().defaultTo(false);
      t.string("note", 200).nullable();
      long(t, "charges");
    });
    await k.schema.createTable("settings", (t) => { t.string("key", 60).primary(); long(t, "value"); });
    await k.schema.createTable("subscriptions", (t) => {
      t.string("id", 40).primary();
      t.integer("coach_id").unsigned().notNullable().index();
      t.integer("months").notNullable();
      t.decimal("amount", 10, 2).notNullable();
      t.string("status", 12).notNullable();
      t.string("method", 40).nullable();
      t.string("reference", 120).nullable();
      t.string("receipt_file", 40).nullable();
      t.string("created_at", 30).notNullable();
      t.string("reviewed_at", 30).nullable();
      t.integer("reviewed_by").nullable();
      t.string("admin_note", 300).nullable();
      t.string("license_id", 40).nullable();
    });
    await k.schema.createTable("payments", (t) => {
      t.string("id", 40).primary();
      t.integer("coach_id").unsigned().notNullable().index();
      t.integer("client_id").unsigned().notNullable().index();
      t.string("concept", 120).notNullable();
      t.decimal("amount", 10, 2).notNullable();
      t.string("due_date", 30).notNullable();
      t.string("paid_at", 30).nullable();
      t.string("method", 40).nullable();
    });
    await k.schema.createTable("workouts", (t) => {
      t.string("id", 40).primary();
      t.integer("client_id").unsigned().notNullable().index();
      t.integer("coach_id").unsigned().notNullable().index();
      t.string("finished_at", 30).notNullable();
      long(t, "data");
    });
    await k.schema.createTable("active_workouts", (t) => {
      t.integer("client_id").unsigned().primary();
      long(t, "data");
      t.string("updated_at", 30).notNullable();
    });
    await k.schema.createTable("messages", (t) => {
      t.string("id", 40).primary();
      t.integer("coach_id").unsigned().notNullable();
      t.integer("client_id").unsigned().notNullable();
      t.integer("from_id").unsigned().notNullable();
      t.text("text").notNullable();
      t.string("at", 30).notNullable();
      t.boolean("read").notNullable().defaultTo(false);
      t.index(["coach_id", "client_id"]);
    });
    await k.schema.createTable("posts", (t) => {
      t.string("id", 40).primary();
      t.integer("coach_id").unsigned().notNullable().index();
      t.integer("author_id").unsigned().notNullable();
      t.string("kind", 20).notNullable();
      t.text("text").notNullable();
      t.string("at", 30).notNullable();
      long(t, "likes");
      long(t, "comments");
      t.string("workout_id", 40).nullable();
    });
    await k.schema.createTable("templates", (t) => {
      t.string("id", 40).primary();
      t.integer("coach_id").unsigned().notNullable().index();
      t.string("created_at", 30).notNullable();
      long(t, "data");
    });
    await k.schema.createTable("exercises", (t) => {
      t.integer("id").unsigned().primary();
      t.integer("coach_id").unsigned().notNullable().index();
      long(t, "data");
    });
    await k.schema.createTable("photos", (t) => {
      t.string("id", 40).primary();
      t.integer("client_id").unsigned().notNullable().index();
      t.string("file_id", 40).notNullable();
      t.string("pose", 20).nullable();
      t.string("note", 300).nullable();
      t.string("date", 30).notNullable();
      t.integer("by_id").unsigned().notNullable();
      t.string("at", 30).notNullable();
    });
    await k.schema.createTable("files", (t) => {
      t.string("id", 40).primary();
      t.string("kind", 20).notNullable();
      t.integer("owner_id").unsigned().notNullable();
      t.string("path", 200).notNullable();
      t.string("mime", 40).notNullable();
      t.integer("size").notNullable();
      t.string("created_at", 30).notNullable();
    });
    await k.schema.createTable("activity", (t) => {
      t.string("id", 40).primary();
      t.string("at", 30).notNullable().index();
      t.string("kind", 20).notNullable();
      t.string("text", 300).notNullable();
    });
    await k.schema.createTable("refresh_tokens", (t) => {
      t.string("id", 40).primary();
      t.integer("user_id").unsigned().notNullable().index();
      t.string("token_hash", 64).notNullable().unique();
      t.string("expires_at", 30).notNullable();
      t.boolean("revoked").notNullable().defaultTo(false);
      t.string("replaced_by", 40).nullable();
      t.string("created_at", 30).notNullable();
      t.string("user_agent", 200).nullable();
    });
  }],
  // Mensajes que etiquetan un ejercicio (comentario, nota, técnica, molestia)
  ["002_mensajes_ejercicio", async (k) => {
    await k.schema.alterTable("messages", (t) => {
      t.integer("ex_id").unsigned().nullable();
      t.string("tag", 20).nullable();
    });
  }],
  // Entrenamientos terminados sin conexión: el id de la sesión evita guardarlos dos veces
  ["003_ref_entrenamiento", async (k) => {
    await k.schema.alterTable("workouts", (t) => {
      t.string("ref", 40).nullable();
      t.unique(["client_id", "ref"]);
    });
  }],
  // Notificaciones push (navegador y app) y registro para no repetir avisos
  ["004_notificaciones", async (k) => {
    const long = (t, name) => (config.db.client === "mysql2" ? t.text(name, "longtext") : t.text(name));
    await k.schema.createTable("push_subs", (t) => {
      t.string("id", 40).primary();
      t.integer("user_id").unsigned().notNullable().index();
      t.string("kind", 10).notNullable(); // web | fcm
      t.string("endpoint_hash", 64).notNullable().unique();
      long(t, "data"); // endpoint + claves (web) o token (fcm)
      t.string("ua", 200).nullable();
      t.string("created_at", 30).notNullable();
    });
    await k.schema.createTable("notif_log", (t) => {
      t.string("key", 160).primary();
      t.string("at", 30).notNullable().index();
    });
  }],
  // Registro de errores del servidor y de la app (para el administrador)
  ["005_errores", async (k) => {
    await k.schema.createTable("error_log", (t) => {
      t.increments("id").primary();
      t.string("at", 30).notNullable().index();
      t.string("source", 10).notNullable(); // server | app
      t.string("fingerprint", 64).notNullable().index();
      t.string("message", 500).notNullable();
      t.text("detail").nullable();
      t.string("path", 200).nullable();
      t.integer("user_id").unsigned().nullable();
      t.string("ua", 200).nullable();
    });
  }],
];

/* Varios procesos pueden arrancar a la vez (el hosting levanta más de uno): en MySQL se toma un candado */
export async function migrate() {
  if (config.db.client !== "mysql2") return runMigrations();
  const conn = await knex.client.acquireConnection();
  try {
    await knex.raw("SELECT GET_LOCK('vytrafit_migrate', 60)").connection(conn);
    await runMigrations();
  } finally {
    await knex.raw("SELECT RELEASE_LOCK('vytrafit_migrate')").connection(conn).catch(() => {});
    await knex.client.releaseConnection(conn);
  }
}
async function runMigrations() {
  if (!(await knex.schema.hasTable("_migrations"))) {
    await knex.schema.createTable("_migrations", (t) => { t.string("name", 60).primary(); t.string("at", 30); });
  }
  const done = new Set((await knex("_migrations").select("name")).map((r) => r.name));
  for (const [name, fn] of MIGRATIONS) {
    if (done.has(name)) continue;
    await knex.transaction(async (trx) => {
      await fn(trx);
      await trx("_migrations").insert({ name, at: new Date().toISOString() });
    });
    console.log(`[db] migración aplicada: ${name}`);
  }
}
