/* Rutas del seguimiento entre sesiones (asesorado y entrenador). */
import { z } from "zod";
import { knex, bool, J, S } from "../db.js";
import { bad, h, notFound, parse, stamp, uid } from "../util.js";
import { deleteFile, saveFile } from "../files.js";
import { notifyLater } from "../notify.js";
import { routineSchema } from "./schemas.js";
import { ownClient } from "./common.js";
import { DEFAULT_RULES, assertDay, editClientData, phaseIndexAt, pruneDays } from "../coaching.js";

const str = (max) => z.string().trim().max(max);
const first = (n) => String(n || "").split(" ")[0];
const score = z.number().int().min(1).max(10);

/* ---------- esquemas ---------- */
const onboardingSchema = z.object({
  goal: str(40), experience: z.enum(["nuevo", "intermedio", "avanzado"]), days: z.array(z.number().int().min(0).max(6)).max(7),
  place: z.enum(["gimnasio", "casa", "peso-corporal"]), injuries: str(600).default(""), notes: str(600).default(""),
  weight: z.number().min(20).max(400).nullable().optional(), heightCm: z.number().min(100).max(250).nullable().optional(),
});
const habitSchema = z.object({ id: str(40).min(1), name: str(40).min(1), target: z.number().min(0).max(100000), unit: str(16).default(""), kind: z.enum(["check", "count"]) });
const checkinSchema = z.object({
  weight: z.number().min(20).max(400).nullable().optional(), waist: z.number().min(30).max(250).nullable().optional(),
  energy: score, sleep: score, stress: score, hunger: score,
  answers: z.array(z.object({ q: str(200), a: str(1000) })).max(8).default([]),
  photos: z.array(z.object({ src: z.string().max(6_000_000), pose: z.enum(["Frente", "Perfil", "Espalda", "Otra"]) })).max(3).default([]),
});
const mealSchema = z.object({ id: str(40).min(1), name: str(40).min(1), desc: str(300).default(""), kcal: z.number().min(0).max(5000).default(0) });
const nutritionSchema = z.object({
  kcal: z.number().min(0).max(10000), protein: z.number().min(0).max(1000), carbs: z.number().min(0).max(2000), fat: z.number().min(0).max(1000),
  water: z.number().int().min(0).max(30).default(8), meals: z.array(mealSchema).max(10).default([]), notes: str(1000).default(""),
});
const phaseSchema = z.object({ id: str(40).min(1), name: str(60).min(1), weeks: z.number().int().min(1).max(26), routine: routineSchema });
const ruleSchema = z.object({
  kind: z.enum(DEFAULT_RULES.map((r) => r.kind)), on: z.boolean(), text: str(400).optional(),
  day: z.number().int().min(0).max(6).optional(), hour: z.number().int().min(5).max(22).optional(), days: z.number().int().min(2).max(30).optional(),
});
const planSchema = z.object({ id: str(40).min(1), name: str(60).min(1), price: z.number().min(0).max(100000), period: z.enum(["mes", "trimestre", "semestre", "año", "única"]) });

/* ============================================================
   Asesorado
   ============================================================ */
export function clientCoaching(r) {
  /** Cuestionario de inicio: lo llena al entrar por primera vez. */
  r.put("/onboarding", h(async (req, res) => {
    const o = parse(onboardingSchema, req.body);
    const c = await editClientData(req.user.id, (d) => {
      d.onboarding = { ...o, at: stamp() };
      if (o.goal && !d.goal) d.goal = o.goal;
      if (o.heightCm) d.heightCm = o.heightCm;
      if (o.weight) (d.weights ||= []).push({ date: stamp(), kg: o.weight });
    }).then(() => knex("clients").where({ user_id: req.user.id }).first());
    notifyLater(c.coach_id, { title: `${first(req.user.name)} completó su cuestionario`, body: "Ya puedes armarle el programa con sus respuestas.", page: "clientes", params: { id: req.user.id }, kind: "onboarding" });
    res.json({ ok: true });
  }));

  /** Hábitos del día: valor de un hábito en una fecha. */
  r.put("/habits/log", h(async (req, res) => {
    const { date, habitId, value } = parse(z.object({ date: z.string().max(10), habitId: str(40).min(1), value: z.number().min(0).max(100000) }), req.body);
    assertDay(date);
    await editClientData(req.user.id, (d) => {
      const log = (d.habitLog ||= {});
      (log[date] ||= {})[habitId] = value;
      pruneDays(log);
    });
    res.json({ ok: true });
  }));

  /** Check-in semanal (con fotos opcionales si dio permiso). */
  r.post("/checkins", h(async (req, res) => {
    const b = parse(checkinSchema, req.body);
    if (b.photos.length && !bool(req.user.photo_consent)) throw bad("Activa el permiso de fotos en «Mi perfil» para subirlas.");
    const photoIds = [];
    for (const p of b.photos) {
      const fileId = await saveFile("photos", req.user.id, p.src, 4 * 1024 * 1024);
      const id = uid("ph-");
      await knex("photos").insert({ id, client_id: req.user.id, file_id: fileId, pose: p.pose, note: "Check-in", date: stamp(), by_id: req.user.id, at: stamp() });
      photoIds.push(id);
    }
    const id = uid("ci-");
    let coachId;
    await editClientData(req.user.id, (d, c) => {
      coachId = c.coach_id;
      const row = { id, date: stamp(), weight: b.weight ?? null, waist: b.waist ?? null, energy: b.energy, sleep: b.sleep, stress: b.stress, hunger: b.hunger, answers: b.answers, photos: photoIds, reviewedAt: null, reply: "" };
      (d.checkins ||= []).push(row);
      if (d.checkins.length > 104) d.checkins = d.checkins.slice(-104);
      if (b.weight) (d.weights ||= []).push({ date: row.date, kg: b.weight });
    });
    notifyLater(coachId, { title: `Check-in de ${first(req.user.name)}`, body: "Tiene uno nuevo para revisar.", page: "clientes", params: { id: req.user.id, tab: "checkins" }, tag: `ci-${req.user.id}`, kind: "checkin" });
    res.status(201).json({ id });
  }));

  /** Nutrición: marcar una comida del plan, el agua y los registros con foto. */
  r.put("/food/meal", h(async (req, res) => {
    const { date, mealId, done } = parse(z.object({ date: z.string().max(10), mealId: str(40).min(1), done: z.boolean() }), req.body);
    assertDay(date);
    await editClientData(req.user.id, (d) => {
      const day = ((d.foodLog ||= {})[date] ||= {});
      (day.meals ||= {})[mealId] = done;
      pruneDays(d.foodLog, 60);
    });
    res.json({ ok: true });
  }));
  r.put("/food/water", h(async (req, res) => {
    const { date, glasses } = parse(z.object({ date: z.string().max(10), glasses: z.number().int().min(0).max(30) }), req.body);
    assertDay(date);
    await editClientData(req.user.id, (d) => { ((d.foodLog ||= {})[date] ||= {}).water = glasses; pruneDays(d.foodLog, 60); });
    res.json({ ok: true });
  }));
  r.post("/food/entry", h(async (req, res) => {
    const b = parse(z.object({ date: z.string().max(10), name: str(80).min(1, "Escribe qué comiste."), kcal: z.number().min(0).max(5000).nullable().optional(),
      protein: z.number().min(0).max(500).nullable().optional(), photo: z.string().max(6_000_000).nullable().optional() }), req.body);
    assertDay(b.date);
    const fileId = b.photo ? await saveFile("food", req.user.id, b.photo, 4 * 1024 * 1024) : null;
    const id = uid("fe-");
    await editClientData(req.user.id, (d) => {
      const day = ((d.foodLog ||= {})[b.date] ||= {});
      (day.entries ||= []).push({ id, name: b.name, kcal: b.kcal ?? null, protein: b.protein ?? null, photo: fileId, at: stamp() });
      if (day.entries.length > 20) throw bad("Ya registraste muchas comidas este día.");
      pruneDays(d.foodLog, 60);
    });
    res.status(201).json({ id });
  }));
  r.delete("/food/entry/:id", h(async (req, res) => {
    let fileId = null;
    await editClientData(req.user.id, (d) => {
      for (const day of Object.values(d.foodLog || {})) {
        const e = (day.entries || []).find((x) => x.id === req.params.id);
        if (e) { fileId = e.photo; day.entries = day.entries.filter((x) => x.id !== e.id); }
      }
    });
    await deleteFile(fileId);
    res.json({ ok: true });
  }));

  /** «Ya pagué»: comprobante del asesorado; el entrenador lo confirma. */
  r.post("/payments/:id/receipt", h(async (req, res) => {
    const { src, method } = parse(z.object({ src: z.string().max(6_000_000).nullable().optional(), method: str(40).default("") }), req.body);
    const p = await knex("payments").where({ id: req.params.id, client_id: req.user.id }).first();
    if (!p) throw notFound("No encontramos ese pago.");
    if (p.paid_at) throw bad("Ese pago ya está registrado.");
    const fileId = src ? await saveFile("receipts", req.user.id, src, 4 * 1024 * 1024) : null;
    if (p.receipt_file && fileId) await deleteFile(p.receipt_file);
    await knex("payments").where({ id: p.id }).update({ receipt_file: fileId || p.receipt_file || null, client_paid_at: stamp(), method: method || p.method || "" });
    notifyLater(p.coach_id, { title: `${first(req.user.name)} avisó que pagó`, body: `${p.concept}: $${(+p.amount).toFixed(2).replace(/\.00$/, "")}. Revisa el comprobante y confírmalo.`, page: "pagos", tag: `rc-${p.id}`, kind: "payment" });
    res.json({ ok: true });
  }));
}

/* ============================================================
   Entrenador
   ============================================================ */
export function coachCoaching(r) {
  const edit = async (req, fn) => {
    const c = await ownClient(req.user.id, req.params.id);
    return editClientData(c.user_id, fn);
  };

  r.put("/clients/:id/habits", h(async (req, res) => {
    const { habits } = parse(z.object({ habits: z.array(habitSchema).max(8) }), req.body);
    await edit(req, (d) => { d.habits = habits; });
    res.json({ ok: true });
  }));

  r.put("/clients/:id/checkin-config", h(async (req, res) => {
    const cfg = parse(z.object({ day: z.number().int().min(0).max(6), questions: z.array(str(200).min(1)).max(6) }), req.body);
    await edit(req, (d) => { d.checkinCfg = cfg; });
    res.json({ ok: true });
  }));

  r.post("/clients/:id/checkins/:cid/review", h(async (req, res) => {
    const { reply } = parse(z.object({ reply: str(2000).default("") }), req.body);
    const c = await ownClient(req.user.id, req.params.id);
    await editClientData(c.user_id, (d) => {
      const ci = (d.checkins || []).find((x) => x.id === req.params.cid);
      if (!ci) throw notFound("Ese check-in ya no existe.");
      ci.reviewedAt = stamp();
      if (reply) ci.reply = reply;
    });
    if (reply) {
      await knex("messages").insert({ id: uid("m-"), coach_id: req.user.id, client_id: c.user_id, from_id: req.user.id, read: false, at: stamp(), text: `Sobre tu check-in: ${reply}` });
      notifyLater(c.user_id, { title: `${first(req.user.name)} revisó tu check-in`, body: reply.slice(0, 140), page: "mensajes", kind: "message" });
    }
    res.json({ ok: true });
  }));

  r.put("/clients/:id/nutrition", h(async (req, res) => {
    const { nutrition } = parse(z.object({ nutrition: nutritionSchema.nullable() }), req.body);
    await edit(req, (d) => { d.nutrition = nutrition; });
    if (nutrition) notifyLater(+req.params.id, { title: "Tu plan de nutrición se actualizó", body: `${nutrition.kcal} kcal · ${nutrition.protein} g de proteína al día.`, page: "nutricion", kind: "routine" });
    res.json({ ok: true });
  }));

  /** Programa por fases: la fase en curso se vuelve la rutina actual. */
  r.put("/clients/:id/program", h(async (req, res) => {
    const { program } = parse(z.object({ program: z.object({ phases: z.array(phaseSchema).min(1).max(8), startedAt: z.string().max(30).optional() }).nullable() }), req.body);
    await edit(req, (d) => {
      if (!program) { d.program = null; return; }
      const p = { phases: program.phases, startedAt: program.startedAt || d.program?.startedAt || stamp() };
      const i = phaseIndexAt(p) ?? 0;
      d.program = { ...p, current: i };
      d.routine = { ...p.phases[i].routine, phase: { index: i, name: p.phases[i].name, total: p.phases.length } };
    });
    res.json({ ok: true });
  }));

  r.put("/clients/:id/tags", h(async (req, res) => {
    const { tags } = parse(z.object({ tags: z.array(str(24).min(1)).max(8) }), req.body);
    await edit(req, (d) => { d.tags = [...new Set(tags)]; });
    res.json({ ok: true });
  }));

  /** Automatizaciones y cobro en línea: en el perfil del entrenador. */
  r.put("/automations", h(async (req, res) => {
    const { rules } = parse(z.object({ rules: z.array(ruleSchema).max(DEFAULT_RULES.length) }), req.body);
    const u = await knex("users").where({ id: req.user.id }).first();
    await knex("users").where({ id: req.user.id }).update({ profile: S({ ...J(u.profile, {}), automations: rules }) });
    res.json({ ok: true });
  }));
  r.put("/billing", h(async (req, res) => {
    const b = parse(z.object({
      payLink: z.string().trim().max(300).refine((v) => !v || /^https:\/\/[^\s]+$/.test(v), "El enlace de pago debe empezar con https://").default(""),
      payLabel: str(40).default(""), instructions: str(600).default(""), plans: z.array(planSchema).max(8).default([]),
    }), req.body);
    const u = await knex("users").where({ id: req.user.id }).first();
    await knex("users").where({ id: req.user.id }).update({ profile: S({ ...J(u.profile, {}), billing: b }) });
    res.json({ ok: true });
  }));
}
