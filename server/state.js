/* Arma los datos que ve cada usuario según su rol.
   Nada fuera de su alcance sale del servidor. */
import { knex, J, bool } from "./db.js";
import { signedUrl } from "./files.js";
import { config } from "./config.js";
import { round2 } from "./util.js";

/* ---------- precios ---------- */
export const PLAN_MONTHS = [1, 3, 6, 12];
export const DEFAULT_PRICING = {
  currency: "USD", monthly: 19, discounts: { 1: 0, 3: 10, 6: 15, 12: 25 },
  instructions: "", bank: { name: "", type: "", number: "", holder: "", id: "" },
};
export async function getPricing(trx = knex) {
  const row = await trx("settings").where({ key: "pricing" }).first();
  const p = J(row?.value, {});
  return { ...DEFAULT_PRICING, ...p, discounts: { ...DEFAULT_PRICING.discounts, ...(p.discounts || {}) }, bank: { ...DEFAULT_PRICING.bank, ...(p.bank || {}) } };
}
export const DEFAULT_LEGAL = { company: "FitCoach Pro", contactEmail: "", city: "Quito, Ecuador" };
export async function getLegal(trx = knex) {
  const row = await trx("settings").where({ key: "legal" }).first();
  return { ...DEFAULT_LEGAL, ...J(row?.value, {}) };
}
/* Con descuento se redondea al dólar para que el precio sea claro */
export const planPrice = (pricing, months) => {
  const d = pricing.discounts[months] || 0;
  const v = pricing.monthly * months * (1 - d / 100);
  return d > 0 ? Math.round(v) : round2(v);
};

/* ---------- conversión de filas ---------- */
const PROFILE_DEFAULTS = { photo: null, phone: "", city: "", headline: "", years: null, instagram: "", bio: "", specialties: [], certifications: [], services: [], injuries: "", birthYear: null, body: "m" };

export function userOut(u, { self = false, publicOnly = false } = {}) {
  const profile = { ...PROFILE_DEFAULTS, ...J(u.profile, {}) };
  const base = { id: u.id, role: u.role, name: u.name, photo: profile.photo, body: profile.body };
  if (publicOnly) return base;
  const out = { ...base, email: u.email, createdAt: u.created_at, ...profile };
  if (u.role === "coach") out.brand = { businessName: "", slug: u.brand_slug || "", color: "", logo: null, tagline: "", ...J(u.brand, {}), slug: u.brand_slug || "" };
  if (self) {
    out.mustChangePassword = bool(u.must_change_password);
    out.consentVersion = u.consent_version;
    out.consentAt = u.consent_at;
    out.consentCurrent = u.consent_version === config.legalVersion;
  }
  out.photoConsent = bool(u.photo_consent);
  return out;
}
const coachPublic = (u) => {
  const o = userOut(u);
  // Lo que el asesorado ve de su entrenador: perfil público, sin datos internos
  return { id: o.id, role: o.role, name: o.name, photo: o.photo, body: o.body, phone: o.phone, city: o.city, headline: o.headline, years: o.years,
    instagram: o.instagram, bio: o.bio, specialties: o.specialties, certifications: o.certifications, services: o.services, brand: o.brand, email: o.email };
};

export const licenseOut = (l) => ({
  id: l.id, code: l.code, months: l.months, coachId: l.coach_id, createdAt: l.created_at, activatedAt: l.activated_at,
  expiresAt: l.expires_at, revoked: bool(l.revoked), note: l.note || "", charges: J(l.charges, []),
});
const paymentOut = (p) => ({ id: p.id, coachId: p.coach_id, clientId: p.client_id, concept: p.concept, amount: +p.amount, dueDate: p.due_date, paidAt: p.paid_at, method: p.method || "" });
const workoutOut = (w) => ({ ...J(w.data, {}), id: w.id, clientId: w.client_id, finishedAt: w.finished_at });
const messageOut = (m) => ({ id: m.id, coachId: m.coach_id, clientId: m.client_id, from: m.from_id, text: m.text, at: m.at, read: bool(m.read), exId: m.ex_id || null, tag: m.tag || null });
const postOut = (p) => ({ id: p.id, coachId: p.coach_id, authorId: p.author_id, kind: p.kind, text: p.text, at: p.at, likes: J(p.likes, []), comments: J(p.comments, []), workoutId: p.workout_id });
const templateOut = (t) => ({ ...J(t.data, {}), id: t.id, coachId: t.coach_id, createdAt: t.created_at });
const exerciseOut = (e) => {
  const { photoFile, ...d } = J(e.data, {});
  return { ...d, id: e.id, coachId: e.coach_id, photo: photoFile ? signedUrl(photoFile) : null };
};
export const subscriptionOut = (s) => ({
  id: s.id, coachId: s.coach_id, months: s.months, amount: +s.amount, status: s.status, method: s.method || "", reference: s.reference || "",
  receipt: signedUrl(s.receipt_file), createdAt: s.created_at, reviewedAt: s.reviewed_at, adminNote: s.admin_note || "", licenseId: s.license_id,
});

const CLIENT_DEFAULTS = { goal: "", phone: "", heightCm: null, fee: 0, billingDay: 1, routine: null, weights: [], measurements: [], notes: [], joinedAt: null };
export function clientOut(c, photos = [], user = null, { withNotes = true } = {}) {
  const data = { ...CLIENT_DEFAULTS, ...J(c.data, {}) };
  if (!withNotes) delete data.notes;
  return {
    ...data, userId: c.user_id, coachId: c.coach_id, active: bool(c.active),
    photoConsent: user ? bool(user.photo_consent) : false,
    photos: photos.filter((p) => p.client_id === c.user_id).map((p) => ({ id: p.id, src: signedUrl(p.file_id), pose: p.pose, note: p.note || "", date: p.date, by: p.by_id, at: p.at })),
  };
}

const empty = () => ({ version: 1, users: [], clients: [], licenses: [], payments: [], workouts: [], messages: [], posts: [], templates: [], exercises: [], activity: [], active: {}, subscriptions: [], ranking: null });

export async function buildState(me) {
  const s = empty();
  s.sessionUserId = me.id;
  const pricing = await getPricing();
  s.settings = { pricing, legal: await getLegal(), legalVersion: config.legalVersion };

  if (me.role === "admin") {
    const users = await knex("users").select();
    s.users = users.map((u) => (u.id === me.id ? userOut(u, { self: true }) : u.role === "client" ? { id: u.id, role: u.role, name: u.name, email: u.email, createdAt: u.created_at, photo: null } : userOut(u)));
    s.clients = (await knex("clients").select("user_id", "coach_id", "active")).map((c) => ({ userId: c.user_id, coachId: c.coach_id, active: bool(c.active) }));
    s.licenses = (await knex("licenses").orderBy("created_at", "desc")).map(licenseOut);
    s.subscriptions = (await knex("subscriptions").orderBy("created_at", "desc")).map(subscriptionOut);
    s.activity = await knex("activity").orderBy("at", "desc").limit(100);
    // Solo fechas de entrenamientos (para saber si un entrenador está activo), sin detalle
    const since = new Date(Date.now() - 60 * 864e5).toISOString();
    s.workouts = (await knex("workouts").where("finished_at", ">", since).select("id", "client_id", "coach_id", "finished_at"))
      .map((w) => ({ id: w.id, clientId: w.client_id, finishedAt: w.finished_at, exercises: [] }));
    return s;
  }

  if (me.role === "coach") {
    const clientRows = await knex("clients").where({ coach_id: me.id });
    const ids = clientRows.map((c) => c.user_id);
    const clientUsers = ids.length ? await knex("users").whereIn("id", ids) : [];
    const photos = ids.length ? await knex("photos").whereIn("client_id", ids).orderBy("date", "desc") : [];
    s.users = [userOut(me, { self: true }), ...clientUsers.map((u) => userOut(u))];
    s.clients = clientRows.map((c) => clientOut(c, photos, clientUsers.find((u) => u.id === c.user_id)));
    s.licenses = (await knex("licenses").where({ coach_id: me.id })).map(licenseOut);
    s.subscriptions = (await knex("subscriptions").where({ coach_id: me.id }).orderBy("created_at", "desc")).map(subscriptionOut);
    s.payments = (await knex("payments").where({ coach_id: me.id })).map(paymentOut);
    s.workouts = (await knex("workouts").where({ coach_id: me.id })).map(workoutOut);
    s.messages = (await knex("messages").where({ coach_id: me.id })).map(messageOut);
    s.posts = (await knex("posts").where({ coach_id: me.id }).orderBy("at", "desc").limit(200)).map(postOut);
    s.templates = (await knex("templates").where({ coach_id: me.id }).orderBy("created_at", "desc")).map(templateOut);
    s.exercises = (await knex("exercises").where({ coach_id: me.id })).map(exerciseOut);
    for (const a of ids.length ? await knex("active_workouts").whereIn("client_id", ids) : []) s.active[a.client_id] = J(a.data);
    return s;
  }

  // Asesorado
  const c = await knex("clients").where({ user_id: me.id }).first();
  if (!c) return s;
  const coach = await knex("users").where({ id: c.coach_id }).first();
  const photos = await knex("photos").where({ client_id: me.id }).orderBy("date", "desc");
  s.clients = [clientOut(c, photos, me, { withNotes: false })]; // las notas del entrenador son privadas
  s.payments = (await knex("payments").where({ client_id: me.id })).map(paymentOut);
  s.workouts = (await knex("workouts").where({ client_id: me.id })).map(workoutOut);
  s.messages = (await knex("messages").where({ client_id: me.id, coach_id: c.coach_id })).map(messageOut);
  s.posts = (await knex("posts").where({ coach_id: c.coach_id }).orderBy("at", "desc").limit(200)).map(postOut);
  s.exercises = (await knex("exercises").where({ coach_id: c.coach_id })).map(exerciseOut);
  const active = await knex("active_workouts").where({ client_id: me.id }).first();
  if (active) s.active[me.id] = J(active.data);

  // Comunidad: compañeros del mismo entrenador (solo nombre y foto) y ranking del mes
  const mates = await knex("clients").where({ coach_id: c.coach_id, active: true }).select("user_id");
  const mateIds = mates.map((m) => m.user_id).filter((id) => id !== me.id);
  const mateUsers = mateIds.length ? await knex("users").whereIn("id", mateIds) : [];
  s.users = [userOut(me, { self: true }), coachPublic(coach), ...mateUsers.map((u) => userOut(u, { publicOnly: true }))];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const counts = await knex("workouts").where({ coach_id: c.coach_id }).where("finished_at", ">=", monthStart)
    .select("client_id").count({ n: "*" }).groupBy("client_id");
  s.ranking = mates.map((m) => ({ userId: m.user_id, n: +(counts.find((x) => x.client_id === m.user_id)?.n || 0) }));
  return s;
}
