/* Administrador: licencias, precios, cobros de suscripción y soporte. */
import { Router } from "express";
import { z } from "zod";
import { knex, J, S } from "../db.js";
import { hashPassword, revokeAll, tempPassword } from "../auth.js";
import { bad, h, notFound, nowISO, parse, uid, licenseEnd } from "../util.js";
import { DEFAULT_PRICING, PLAN_MONTHS, getLegal, getPricing, licenseOut, planPrice } from "../state.js";
import { log, newCode } from "./common.js";

export const router = Router();
// 0 = licencia indefinida (no vence)
const months = z.number().int().refine((m) => m === 0 || PLAN_MONTHS.includes(m), "Elige un plan de 1, 3, 6 o 12 meses, o indefinida.");
const plural = (m) => (m ? `${m} ${m === 1 ? "mes" : "meses"}` : "sin vencimiento");

async function uniqueCode(trx) {
  for (;;) {
    const code = newCode();
    if (!(await trx("licenses").where({ code }).first())) return code;
  }
}

/** Fecha de inicio para extender: el vencimiento vigente del entrenador, o hoy. */
async function extendFrom(trx, coachId) {
  const cur = await trx("licenses").where({ coach_id: coachId, revoked: false }).where("expires_at", ">", nowISO()).orderBy("expires_at", "desc").first();
  return cur ? new Date(cur.expires_at) : new Date();
}

/* ---------- licencias ---------- */
router.post("/licenses", h(async (req, res) => {
  const body = parse(z.object({ months, qty: z.number().int().min(1).max(50), note: z.string().trim().max(200).optional().default("") }), req.body);
  const pricing = await getPricing();
  const out = await knex.transaction(async (trx) => {
    const rows = [];
    for (let i = 0; i < body.qty; i++) {
      const row = { id: uid("lic-"), code: await uniqueCode(trx), months: body.months, coach_id: null, created_at: nowISO(), revoked: false, note: body.note,
        charges: S(body.months ? [{ at: nowISO(), amount: planPrice(pricing, body.months), months: body.months, kind: "venta" }] : []) };
      await trx("licenses").insert(row);
      rows.push(row);
    }
    await log(trx, "license", body.qty === 1 ? `Se generó la licencia ${rows[0].code} (${plural(body.months)})` : `Se generaron ${body.qty} licencias de ${plural(body.months)}`);
    return rows;
  });
  res.status(201).json({ licenses: out.map(licenseOut) });
}));

router.post("/licenses/:id/renew", h(async (req, res) => {
  const { months: m } = parse(z.object({ months }), req.body);
  const pricing = await getPricing();
  await knex.transaction(async (trx) => {
    const l = await trx("licenses").where({ id: req.params.id }).first();
    if (!l) throw notFound();
    if (!l.coach_id) throw bad("Esta licencia aún no tiene entrenador. Entrégale el código para que la active.");
    const base = l.expires_at && new Date(l.expires_at) > new Date() ? new Date(l.expires_at) : new Date();
    const charges = m ? [...J(l.charges, []), { at: nowISO(), amount: planPrice(pricing, m), months: m, kind: "renovación" }] : J(l.charges, []);
    await trx("licenses").where({ id: l.id }).update({ expires_at: licenseEnd(base, m), revoked: false, charges: S(charges), ...(m ? {} : { months: 0 }) });
    const coach = await trx("users").where({ id: l.coach_id }).first();
    await log(trx, "license", m ? `Renovaste la licencia de ${coach?.name ?? l.code} por ${plural(m)}` : `Dejaste indefinida la licencia de ${coach?.name ?? l.code}`);
  });
  res.json({ ok: true });
}));

router.post("/licenses/:id/revoke", h(async (req, res) => {
  const l = await knex("licenses").where({ id: req.params.id }).first();
  if (!l) throw notFound();
  await knex("licenses").where({ id: l.id }).update({ revoked: true });
  const coach = l.coach_id ? await knex("users").where({ id: l.coach_id }).first() : null;
  await log(null, "expired", `Revocaste la licencia ${l.code}${coach ? ` de ${coach.name}` : ""}`);
  res.json({ ok: true });
}));

router.post("/licenses/:id/restore", h(async (req, res) => {
  const n = await knex("licenses").where({ id: req.params.id }).update({ revoked: false });
  if (!n) throw notFound();
  await log(null, "license", "Reactivaste una licencia");
  res.json({ ok: true });
}));

/* Borrar para siempre (también las que ya usa un entrenador: pierde ese tiempo de acceso) */
router.delete("/licenses/:id", h(async (req, res) => {
  const l = await knex("licenses").where({ id: req.params.id }).first();
  if (!l) throw notFound();
  await knex.transaction(async (trx) => {
    await trx("subscriptions").where({ license_id: l.id }).update({ license_id: null });
    await trx("licenses").where({ id: l.id }).delete();
  });
  const coach = l.coach_id ? await knex("users").where({ id: l.coach_id }).first() : null;
  await log(null, "expired", `Eliminaste la licencia ${l.code}${coach ? ` de ${coach.name}` : ""}`);
  res.json({ ok: true });
}));

/* ---------- precios ---------- */
const pct = z.number().min(0).max(90);
router.put("/pricing", h(async (req, res) => {
  const body = parse(z.object({
    monthly: z.number().min(0, "El precio no puede ser negativo.").max(10000),
    currency: z.literal("USD").optional(),
    discounts: z.object({ 1: pct, 3: pct, 6: pct, 12: pct }).partial().optional(),
    instructions: z.string().trim().max(1000).optional(),
    bank: z.object({ name: z.string().trim().max(80), type: z.string().trim().max(40), number: z.string().trim().max(40), holder: z.string().trim().max(120), id: z.string().trim().max(20) }).partial().optional(),
  }), req.body);
  const cur = await getPricing();
  const next = { ...DEFAULT_PRICING, ...cur, ...body, discounts: { ...cur.discounts, ...(body.discounts || {}), 1: 0 }, bank: { ...cur.bank, ...(body.bank || {}) } };
  const exists = await knex("settings").where({ key: "pricing" }).first();
  if (exists) await knex("settings").where({ key: "pricing" }).update({ value: S(next) });
  else await knex("settings").insert({ key: "pricing", value: S(next) });
  await log(null, "license", `Actualizaste el precio mensual a $${next.monthly}`);
  res.json({ pricing: next });
}));

/* ---------- datos legales (aparecen en la política de privacidad) ---------- */
router.put("/legal", h(async (req, res) => {
  const body = parse(z.object({ company: z.string().trim().min(2).max(120), contactEmail: z.string().trim().email("Escribe un correo de contacto válido.").max(190), city: z.string().trim().max(80) }).partial(), req.body);
  const next = { ...(await getLegal()), ...body };
  const exists = await knex("settings").where({ key: "legal" }).first();
  if (exists) await knex("settings").where({ key: "legal" }).update({ value: S(next) });
  else await knex("settings").insert({ key: "legal", value: S(next) });
  res.json({ legal: next });
}));

/* ---------- solicitudes de pago de los entrenadores ---------- */
router.post("/subscriptions/:id/approve", h(async (req, res) => {
  const { note } = parse(z.object({ note: z.string().trim().max(300).optional() }), req.body);
  await knex.transaction(async (trx) => {
    const s = await trx("subscriptions").where({ id: req.params.id }).first();
    if (!s) throw notFound();
    if (s.status !== "pending") throw bad("Esta solicitud ya fue revisada.");
    const from = await extendFrom(trx, s.coach_id);
    const lic = { id: uid("lic-"), code: await uniqueCode(trx), months: s.months, coach_id: s.coach_id, created_at: nowISO(), activated_at: nowISO(),
      expires_at: licenseEnd(from, s.months), revoked: false, note: "Pago aprobado",
      charges: S([{ at: nowISO(), amount: +s.amount, months: s.months, kind: "suscripción" }]) };
    await trx("licenses").insert(lic);
    // Solo se aprueba si sigue pendiente (evita aprobar dos veces)
    const n = await trx("subscriptions").where({ id: s.id, status: "pending" })
      .update({ status: "approved", reviewed_at: nowISO(), reviewed_by: req.user.id, admin_note: note || null, license_id: lic.id });
    if (n !== 1) throw bad("Esta solicitud ya fue revisada.");
    const coach = await trx("users").where({ id: s.coach_id }).first();
    await log(trx, "license", `Aprobaste el pago de ${coach?.name} por ${plural(s.months)} ($${(+s.amount).toFixed(2)})`);
  });
  res.json({ ok: true });
}));

router.post("/subscriptions/:id/reject", h(async (req, res) => {
  const { note } = parse(z.object({ note: z.string().trim().min(3, "Escribe el motivo para que el entrenador lo sepa.").max(300) }), req.body);
  const n = await knex("subscriptions").where({ id: req.params.id, status: "pending" })
    .update({ status: "rejected", reviewed_at: nowISO(), reviewed_by: req.user.id, admin_note: note });
  if (!n) throw bad("Esta solicitud ya fue revisada.");
  res.json({ ok: true });
}));

/* ---------- soporte: contraseña temporal para un entrenador ---------- */
router.post("/users/:id/reset-password", h(async (req, res) => {
  const u = await knex("users").where({ id: +req.params.id }).first();
  if (!u || u.role !== "coach") throw notFound();
  const pw = tempPassword();
  await knex.transaction(async (trx) => {
    await trx("users").where({ id: u.id }).update({ password_hash: await hashPassword(pw), must_change_password: true, failed_logins: 0, locked_until: null });
    await revokeAll(u.id, trx);
  });
  await log(null, "coach", `Generaste una contraseña temporal para ${u.name}`);
  res.json({ password: pw });
}));
