/* SOLO DESARROLLO: llena una base local con datos de ejemplo para probar.
   Se niega a correr en producción. Contraseñas: Admin2026 / Coach2026 / Cliente2026 */
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { build } from "esbuild";
import { config, ROOT } from "../config.js";
import { knex, migrate, S } from "../db.js";
import { hashPassword } from "../auth.js";
import { uid } from "../util.js";

if (config.isProd) { console.error("dev-seed no se puede usar en producción."); process.exit(1); }
const out = path.join(os.tmpdir(), `fcp-seed-${Date.now()}.mjs`);
await build({ entryPoints: [path.join(ROOT, "src/store/seed.js")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error", define: { "import.meta.env.BASE_URL": '"/"' } });
const { buildSeed } = await import(out);
fs.unlinkSync(out);
const s = buildSeed();

await migrate();
for (const t of ["refresh_tokens", "photos", "files", "activity", "exercises", "templates", "posts", "messages", "active_workouts", "workouts", "payments", "subscriptions", "settings", "licenses", "clients", "users"]) await knex(t).delete();

const pw = { admin: await hashPassword("Admin2026"), coach: await hashPassword("Coach2026"), client: await hashPassword("Cliente2026") };
const PROFILE = ["photo", "phone", "city", "headline", "years", "instagram", "bio", "specialties", "certifications", "services", "injuries", "birthYear", "body"];
for (const u of s.users) {
  const profile = Object.fromEntries(PROFILE.filter((k) => u[k] !== undefined).map((k) => [k, u[k]]));
  await knex("users").insert({ id: u.id, role: u.role, email: u.email, password_hash: pw[u.role], name: u.name, profile: S(profile),
    brand: u.brand ? S({ businessName: u.brand.businessName, color: u.brand.color, logo: u.brand.logo, tagline: u.brand.tagline }) : null,
    brand_slug: u.brand?.slug || null, created_at: u.createdAt,
    consent_version: u.id === 12 ? null : config.legalVersion, consent_at: u.id === 12 ? null : u.createdAt, photo_consent: u.id === 10 });
}
for (const c of s.clients) {
  const { userId, coachId, active, photos, ...data } = c;
  await knex("clients").insert({ user_id: userId, coach_id: coachId, active, data: S(data) });
}
for (const l of s.licenses) await knex("licenses").insert({ id: l.id, code: l.code.length === 13 ? `${l.code}-${l.code.slice(4, 8)}` : l.code, months: l.months, coach_id: l.coachId, created_at: l.createdAt, activated_at: l.activatedAt, expires_at: l.expiresAt, revoked: l.revoked, note: l.note, charges: S(l.charges) });
for (const p of s.payments) await knex("payments").insert({ id: p.id, coach_id: p.coachId, client_id: p.clientId, concept: p.concept, amount: p.amount, due_date: p.dueDate, paid_at: p.paidAt, method: p.method });
for (const w of s.workouts) {
  const { id, clientId, finishedAt, ...data } = w;
  await knex("workouts").insert({ id, client_id: clientId, coach_id: s.clients.find((c) => c.userId === clientId).coachId, finished_at: finishedAt, data: S(data) });
}
for (const m of s.messages) await knex("messages").insert({ id: m.id, coach_id: m.coachId, client_id: m.clientId, from_id: m.from, text: m.text, at: m.at, read: m.read });
for (const p of s.posts) await knex("posts").insert({ id: p.id, coach_id: p.coachId, author_id: p.authorId, kind: p.kind, text: p.text, at: p.at, likes: S(p.likes), comments: S(p.comments), workout_id: p.workoutId || null });
for (const t of s.templates) { const { id, coachId, createdAt, ...data } = t; await knex("templates").insert({ id, coach_id: coachId, created_at: createdAt, data: S(data) }); }
for (const a of s.activity) await knex("activity").insert(a);
// Para probar el aviso: Diego (id 4) con licencia vencida
await knex("licenses").where({ coach_id: 4 }).update({ expires_at: new Date(Date.now() - 5 * 864e5).toISOString() });
console.log(`Datos de prueba cargados: ${s.users.length} usuarios, ${s.workouts.length} entrenamientos.`);
await knex.destroy();
