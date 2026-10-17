/* Crea o actualiza una cuenta de administrador.
   Uso: npm run create-admin -- correo@dominio.com "Contraseña-segura-1" "Nombre" */
import { knex, migrate } from "../db.js";
import { hashPassword, passwordProblem, revokeAll } from "../auth.js";
import { nowISO } from "../util.js";

const [email, password, name = "Administrador"] = process.argv.slice(2);
if (!email || !password) { console.error('Uso: npm run create-admin -- correo@dominio.com "Contraseña-segura-1" "Nombre"'); process.exit(1); }
const pp = passwordProblem(password, email);
if (pp) { console.error(pp); process.exit(1); }
await migrate();
const hash = await hashPassword(password);
const u = await knex("users").where({ email: email.toLowerCase() }).first();
if (u && u.role !== "admin") { console.error("Ese correo ya pertenece a otra cuenta."); process.exit(1); }
if (u) { await knex("users").where({ id: u.id }).update({ password_hash: hash, name, failed_logins: 0, locked_until: null }); await revokeAll(u.id); console.log("Administrador actualizado."); }
else { await knex("users").insert({ role: "admin", email: email.toLowerCase(), password_hash: hash, name, profile: "{}", created_at: nowISO() }); console.log("Administrador creado."); }
await knex.destroy();
