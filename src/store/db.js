/* ============================================================
   Store central del demo.
   Persiste en localStorage (si está disponible) y notifica a la
   interfaz. Cada función exportada equivale a un endpoint del
   backend futuro (ver database/fitcoachpro.sql).
   ============================================================ */
import { useSyncExternalStore } from "react";
import { buildSeed } from "./seed";
import { addDays, addMonths, monthName, planPrice, repsLow, startOfDay, weekStart } from "../lib/format";
import { slugify } from "../lib/brand";

const KEY = "fcp5.db";

/* ---------- persistencia segura ---------- */
function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s?.version === 5 ? s : null;
  } catch { return null; }
}
let warnedFull = false;
function save(s) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); warnedFull = false; }
  catch (e) {
    // Sin espacio (fotos pesadas) o sin almacenamiento: el demo sigue en memoria
    if (!warnedFull && /quota/i.test(String(e?.name || e))) {
      warnedFull = true;
      window.dispatchEvent(new CustomEvent("fcp:storage-full"));
    }
  }
}

let state = load() || buildSeed();
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function commit(fn) {
  const draft = structuredClone(state);
  const out = fn(draft);
  state = draft;
  save(state);
  emit();
  return out;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) { state = load() || state; emit(); }
  });
}

export function useDB() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state, () => state,
  );
}
export const getDB = () => state;

const uid = (p = "") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nowISO = () => new Date().toISOString();
const log = (d, kind, text) => d.activity.unshift({ id: uid("a-"), at: nowISO(), kind, text });

/* ============================================================
   Selectores
   ============================================================ */
export const userById = (s, id) => s.users.find((u) => u.id === id);
export const clientById = (s, id) => s.clients.find((c) => c.userId === id);
/** Entrenador dueño de un enlace de acceso (#slug). */
export const coachBySlug = (s, slug) => slug ? s.users.find((u) => u.role === "coach" && u.brand?.slug === slug) : null;

/** Marca que ve un usuario: la de su entrenador (o la suya si es entrenador). */
export function brandOf(s, user) {
  if (!user || user.role === "admin") return null;
  const coach = user.role === "coach" ? user : userById(s, clientById(s, user.id)?.coachId);
  if (!coach) return null;
  const b = coach.brand || {};
  return { coach, name: b.businessName || "", logo: b.logo || null, color: b.color || "", tagline: b.tagline || "", slug: b.slug || "" };
}

export const exerciseById = (s, id) => s.exercises.find((e) => e.id === id) || { id, name: "Ejercicio", muscle: "", equipment: "", primary: [], secondary: [] };

/** Imagen del ejercicio: foto propia del entrenador o las de la biblioteca (0 = inicio, 1 = final). */
export function exerciseImage(ex, frame = 0) {
  if (ex?.photo) return ex.photo;
  if (!ex?.images) return null;
  return `${import.meta.env.BASE_URL}ejercicios/${ex.id}-${Math.min(frame, ex.images - 1)}.webp`;
}

export function licenseStatus(l) {
  if (l.revoked) return "revoked";
  if (!l.coachId) return "available";
  const left = (new Date(l.expiresAt) - Date.now()) / 86400000;
  if (left < 0) return "expired";
  if (left <= 30) return "expiring";
  return "active";
}
export const LICENSE_LABEL = { active: "Activa", expiring: "Por vencer", expired: "Vencida", revoked: "Revocada", available: "Sin usar" };
export const LICENSE_TONE  = { active: "ok", expiring: "warn", expired: "bad", revoked: "muted", available: "info" };

/** Licencia vigente (o la más reciente) de un entrenador. */
export function coachLicense(s, coachId) {
  const mine = s.licenses.filter((l) => l.coachId === coachId);
  const valid = mine.filter((l) => ["active", "expiring"].includes(licenseStatus(l)));
  const pool = valid.length ? valid : mine;
  return pool.sort((a, b) => new Date(b.expiresAt || 0) - new Date(a.expiresAt || 0))[0] || null;
}
export function coachCanWork(s, coachId) {
  const l = coachLicense(s, coachId);
  return !!l && ["active", "expiring"].includes(licenseStatus(l));
}

export function paymentStatus(p) {
  if (p.paidAt) return "paid";
  return new Date(p.dueDate) < startOfDay(new Date()) ? "overdue" : "pending";
}
export const PAY_LABEL = { paid: "Pagado", pending: "Pendiente", overdue: "Vencido" };
export const PAY_TONE  = { paid: "ok", pending: "warn", overdue: "bad" };

export const clientsOf = (s, coachId) =>
  s.clients.filter((c) => c.coachId === coachId).map((c) => ({ ...c, user: userById(s, c.userId) }));

export const workoutsOf = (s, clientId) =>
  s.workouts.filter((w) => clientId == null || w.clientId === clientId)
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));

export const workoutsForCoach = (s, coachId) => {
  const ids = new Set(s.clients.filter((c) => c.coachId === coachId).map((c) => c.userId));
  return s.workouts.filter((w) => ids.has(w.clientId)).sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
};

export function weekCount(s, clientId, offsetWeeks = 0) {
  const from = addDays(weekStart(new Date()), -7 * offsetWeeks);
  const to = addDays(from, 7);
  return s.workouts.filter((w) => w.clientId === clientId && new Date(w.finishedAt) >= from && new Date(w.finishedAt) < to).length;
}

export function weekStreak(s, clientId, goal) {
  if (!goal) return 0;
  let streak = weekCount(s, clientId, 0) >= goal ? 1 : 0;
  for (let w = 1; w < 60; w++) {
    if (weekCount(s, clientId, w) >= goal) streak++;
    else break;
  }
  return streak;
}

export function sessionVolume(w) {
  return w.exercises.reduce((t, e) => t + e.sets.filter((x) => x.done).reduce((a, x) => a + (+x.weight || 0) * (+x.reps || 0), 0), 0);
}
export function doneSetCount(w) {
  return w.exercises.reduce((t, e) => t + e.sets.filter((x) => x.done).length, 0);
}

export function lastPerformance(s, clientId, exId) {
  for (const w of workoutsOf(s, clientId)) {
    const e = w.exercises.find((x) => x.exId === exId);
    if (e && e.sets.some((x) => x.done)) return { at: w.finishedAt, sets: e.sets.filter((x) => x.done) };
  }
  return null;
}
export function bestSet(s, clientId, exId) {
  let best = null;
  for (const w of s.workouts) {
    if (w.clientId !== clientId) continue;
    const e = w.exercises.find((x) => x.exId === exId);
    if (!e) continue;
    for (const x of e.sets) {
      if (!x.done || !(+x.reps > 0)) continue;
      if (!best || +x.weight > best.weight || (+x.weight === best.weight && +x.reps > best.reps)) {
        best = { weight: +x.weight, reps: +x.reps, at: w.finishedAt };
      }
    }
  }
  return best;
}

/** Día sugerido: el siguiente en la rotación después del último entrenado. */
export function nextDay(s, clientId) {
  const c = clientById(s, clientId);
  if (!c?.routine?.days?.length) return null;
  const last = workoutsOf(s, clientId).find((w) => c.routine.days.some((d) => d.id === w.dayId));
  if (!last) return c.routine.days[0];
  const i = c.routine.days.findIndex((d) => d.id === last.dayId);
  return c.routine.days[(i + 1) % c.routine.days.length];
}

export function thread(s, coachId, clientId) {
  return s.messages.filter((m) => m.coachId === coachId && m.clientId === clientId)
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}
export function unreadFor(s, userId) {
  return s.messages.filter((m) => !m.read && m.from !== userId && (m.coachId === userId || m.clientId === userId)).length;
}

/* ============================================================
   Sesión de usuario
   ============================================================ */
export function login(email, password, brandCoachId = null) {
  const u = state.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u) return { error: "No hay ninguna cuenta con ese correo." };
  if (u.password !== password) return { error: "La contraseña no coincide. Revísala e intenta otra vez." };
  if (brandCoachId) {
    // Acceso con la marca de un entrenador: solo entra él y sus asesorados
    const owner = u.role === "coach" ? u.id : u.role === "client" ? clientById(state, u.id)?.coachId : null;
    if (owner !== brandCoachId) {
      const b = userById(state, brandCoachId)?.brand;
      return { error: `Esta cuenta no pertenece a ${b?.businessName || userById(state, brandCoachId)?.name}. Entra desde el acceso de tu entrenador.` };
    }
  }
  if (u.role === "client" && !clientById(state, u.id)?.active) return { error: "Tu entrenador pausó esta cuenta. Escríbele para reactivarla." };
  commit((d) => { d.sessionUserId = u.id; });
  return { user: u };
}
export function loginAs(userId) { commit((d) => { d.sessionUserId = userId; }); }
export function logout() { commit((d) => { d.sessionUserId = null; }); }

export function normalizeCode(code) {
  const raw = code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^FIT/, "").slice(0, 8);
  return raw ? `FIT-${raw.slice(0, 4)}${raw.length > 4 ? "-" + raw.slice(4) : ""}` : "";
}

function checkCode(d, code) {
  const l = d.licenses.find((x) => x.code === normalizeCode(code));
  if (!l) return { error: "Ese código no existe. Revisa que esté completo (FIT-XXXX-XXXX)." };
  if (l.revoked) return { error: "Esta licencia fue revocada. Pide un código nuevo al administrador." };
  if (l.coachId) return { error: "Este código ya fue usado por otro entrenador." };
  return { l };
}

/** Registro de un entrenador nuevo con su código de licencia. */
export function activateLicense({ code, name, email, password }) {
  if (state.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    return { error: "Ya existe una cuenta con ese correo. Inicia sesión y canjea el código desde tu panel." };
  }
  return commit((d) => {
    const { l, error } = checkCode(d, code);
    if (error) return { error };
    let slug = slugify(name) || "entrenador", n = 2;
    while (d.users.some((u) => u.brand?.slug === slug)) slug = `${slugify(name)}-${n++}`;
    const user = { id: Math.max(...d.users.map((u) => u.id)) + 1, role: "coach", name: name.trim(), email: email.trim().toLowerCase(), password, createdAt: nowISO(), phone: "", city: "",
      photo: null, headline: "", years: null, instagram: "", bio: "", specialties: [], certifications: [], services: [],
      brand: { businessName: "", slug, color: "", logo: null, tagline: "" } };
    d.users.push(user);
    l.coachId = user.id; l.activatedAt = nowISO(); l.expiresAt = addMonths(new Date(), l.months).toISOString();
    d.sessionUserId = user.id;
    log(d, "coach", `${user.name} activó su licencia de ${l.months} ${l.months === 1 ? "mes" : "meses"}`);
    return { user };
  });
}

/** Un entrenador existente canjea un código para renovar o reactivar su acceso. */
export function redeemCode(coachId, code) {
  return commit((d) => {
    const { l, error } = checkCode(d, code);
    if (error) return { error };
    const current = d.licenses
      .filter((x) => x.coachId === coachId && !x.revoked && new Date(x.expiresAt) > new Date())
      .sort((a, b) => new Date(b.expiresAt) - new Date(a.expiresAt))[0];
    const from = current ? new Date(current.expiresAt) : new Date();
    l.coachId = coachId; l.activatedAt = nowISO(); l.expiresAt = addMonths(from, l.months).toISOString();
    const coach = d.users.find((u) => u.id === coachId);
    log(d, "license", `${coach.name} canjeó ${l.code} (+${l.months} ${l.months === 1 ? "mes" : "meses"})`);
    return { license: l };
  });
}

/* ============================================================
   Administrador
   ============================================================ */
function randomCode(d) {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    const part = () => Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join("");
    code = `FIT-${part()}-${part()}`;
  } while (d.licenses.some((l) => l.code === code));
  return code;
}
export function generateLicenses(months, qty, note = "") {
  return commit((d) => {
    const out = [];
    for (let i = 0; i < qty; i++) {
      const l = { id: uid("lic-"), code: randomCode(d), months, coachId: null, createdAt: nowISO(), activatedAt: null, expiresAt: null, revoked: false, note,
        charges: [{ at: nowISO(), amount: planPrice(months), months, kind: "venta" }] };
      d.licenses.unshift(l);
      out.push(l);
    }
    log(d, "license", qty === 1 ? `Se generó la licencia ${out[0].code} (${months} ${months === 1 ? "mes" : "meses"})` : `Se generaron ${qty} licencias de ${months} ${months === 1 ? "mes" : "meses"}`);
    return out;
  });
}
export function renewLicense(id, months) {
  commit((d) => {
    const l = d.licenses.find((x) => x.id === id);
    const base = l.expiresAt && new Date(l.expiresAt) > new Date() ? new Date(l.expiresAt) : new Date();
    l.expiresAt = addMonths(base, months).toISOString();
    l.revoked = false;
    l.charges.push({ at: nowISO(), amount: planPrice(months), months, kind: "renovación" });
    const coach = d.users.find((u) => u.id === l.coachId);
    log(d, "license", `Renovaste la licencia de ${coach?.name ?? l.code} por ${months} ${months === 1 ? "mes" : "meses"}`);
  });
}
export function revokeLicense(id) {
  commit((d) => {
    const l = d.licenses.find((x) => x.id === id);
    l.revoked = true;
    const coach = d.users.find((u) => u.id === l.coachId);
    log(d, "expired", `Revocaste la licencia ${l.code}${coach ? ` de ${coach.name}` : ""}`);
  });
}
export function restoreLicense(id) {
  commit((d) => {
    const l = d.licenses.find((x) => x.id === id);
    l.revoked = false;
    log(d, "license", `Reactivaste la licencia ${l.code}`);
  });
}
export function deleteLicense(id) {
  commit((d) => { d.licenses = d.licenses.filter((l) => l.id !== id); });
}

/* ============================================================
   Entrenador: clientes
   ============================================================ */
export function addClient(coachId, data) {
  if (state.users.some((u) => u.email.toLowerCase() === data.email.trim().toLowerCase())) {
    return { error: "Ya existe una cuenta con ese correo." };
  }
  return commit((d) => {
    const password = `fit${Math.floor(1000 + Math.random() * 9000)}`;
    const user = { id: Math.max(...d.users.map((u) => u.id)) + 1, role: "client", name: data.name.trim(), email: data.email.trim().toLowerCase(), password, createdAt: nowISO(),
      photo: null, bio: "", injuries: "", birthYear: null };
    d.users.push(user);
    const today = new Date();
    d.clients.push({
      userId: user.id, coachId, goal: data.goal, phone: data.phone || "", heightCm: +data.height || null,
      fee: +data.fee || 0, billingDay: today.getDate(), active: true, routine: null, joinedAt: nowISO(),
      weights: data.weight ? [{ date: nowISO(), kg: +data.weight }] : [],
      measurements: data.weight ? [{ id: uid("ms-"), date: nowISO(), weight: +data.weight, note: "Medición inicial" }] : [],
      photos: [], notes: [],
    });
    if (+data.fee) {
      d.payments.push({ id: uid("pay-"), coachId, clientId: user.id, concept: `Mensualidad ${monthName()}`, amount: +data.fee, dueDate: nowISO(), paidAt: null, method: "" });
    }
    d.messages.push({ id: uid("m-"), coachId, clientId: user.id, from: coachId, read: false, at: nowISO(),
      text: `¡Hola ${user.name.split(" ")[0]}! Bienvenido/a. Aquí verás tu rutina y podrás registrar cada entrenamiento.` });
    const coach = d.users.find((u) => u.id === coachId);
    log(d, "client", `${coach.name} agregó a ${user.name}`);
    return { user, password };
  });
}
export function updateClient(clientId, patch) {
  commit((d) => {
    const c = d.clients.find((x) => x.userId === clientId);
    const u = d.users.find((x) => x.id === clientId);
    if (patch.name != null) u.name = patch.name;
    if (patch.email != null) u.email = patch.email;
    ["goal", "phone", "heightCm", "fee", "billingDay", "active"].forEach((k) => { if (patch[k] !== undefined) c[k] = patch[k]; });
  });
}
export function resetClientPassword(clientId) {
  return commit((d) => {
    const u = d.users.find((x) => x.id === clientId);
    u.password = `fit${Math.floor(1000 + Math.random() * 9000)}`;
    return u.password;
  });
}
export function addBodyWeight(clientId, kgValue) {
  commit((d) => {
    const c = d.clients.find((x) => x.userId === clientId);
    c.weights.push({ date: nowISO(), kg: +kgValue });
  });
}

/* ---------- rutinas y plantillas ---------- */
export function saveRoutine(clientId, routine) {
  commit((d) => { d.clients.find((x) => x.userId === clientId).routine = routine; });
}
export function saveTemplate(coachId, routine, name) {
  commit((d) => { d.templates.unshift({ ...structuredClone(routine), id: uid("t-"), coachId, name, createdAt: nowISO() }); });
}
export function deleteTemplate(id) { commit((d) => { d.templates = d.templates.filter((t) => t.id !== id); }); }
export const newUid = () => uid("re-");

/* ---------- biblioteca ---------- */
export function upsertExercise(coachId, data) {
  commit((d) => {
    if (data.id) Object.assign(d.exercises.find((e) => e.id === data.id), data);
    else d.exercises.push({ ...data, id: Math.max(...d.exercises.map((e) => e.id)) + 1, coachId });
  });
}
export function deleteExercise(id) { commit((d) => { d.exercises = d.exercises.filter((e) => e.id !== id); }); }
export function exerciseInUse(s, id) {
  return s.clients.some((c) => c.routine?.days.some((day) => day.exercises.some((e) => e.exId === id)));
}

/* ---------- pagos ---------- */
export function addPayment(coachId, p) {
  commit((d) => {
    d.payments.push({ id: uid("pay-"), coachId, clientId: +p.clientId, concept: p.concept, amount: +p.amount,
      dueDate: new Date(`${p.dueDate}T09:00:00`).toISOString(), paidAt: p.paid ? nowISO() : null, method: p.paid ? p.method : "" });
  });
}
export function markPaid(id, method) {
  commit((d) => { const p = d.payments.find((x) => x.id === id); p.paidAt = nowISO(); p.method = method; });
}
export function markUnpaid(id) {
  commit((d) => { const p = d.payments.find((x) => x.id === id); p.paidAt = null; p.method = ""; });
}
export function deletePayment(id) { commit((d) => { d.payments = d.payments.filter((p) => p.id !== id); }); }

/** Crea la mensualidad del mes en curso para cada cliente activo que aún no la tenga. */
export function generateMonthly(coachId) {
  return commit((d) => {
    const now = new Date();
    const concept = `Mensualidad ${monthName(now)}`;
    let created = 0;
    d.clients.filter((c) => c.coachId === coachId && c.active && c.fee > 0).forEach((c) => {
      const has = d.payments.some((p) => p.clientId === c.userId && p.concept === concept);
      if (has) return;
      const due = new Date(now.getFullYear(), now.getMonth(), Math.min(c.billingDay || 1, 28), 9);
      d.payments.push({ id: uid("pay-"), coachId, clientId: c.userId, concept, amount: c.fee, dueDate: due.toISOString(), paidAt: null, method: "" });
      created++;
    });
    return created;
  });
}

/* ---------- mensajes ---------- */
export function sendMessage(coachId, clientId, from, text) {
  commit((d) => { d.messages.push({ id: uid("m-"), coachId, clientId, from, text: text.trim(), at: nowISO(), read: false }); });
}
export function markThreadRead(coachId, clientId, readerId) {
  if (!state.messages.some((m) => m.coachId === coachId && m.clientId === clientId && m.from !== readerId && !m.read)) return;
  commit((d) => {
    d.messages.forEach((m) => { if (m.coachId === coachId && m.clientId === clientId && m.from !== readerId) m.read = true; });
  });
}

/* ---------- comunidad ---------- */
export function addPost(coachId, authorId, text, kind = "post") {
  commit((d) => { d.posts.unshift({ id: uid("p-"), coachId, authorId, kind, text: text.trim(), at: nowISO(), likes: [], comments: [] }); });
}
export function toggleLike(postId, userId) {
  commit((d) => {
    const p = d.posts.find((x) => x.id === postId);
    p.likes = p.likes.includes(userId) ? p.likes.filter((x) => x !== userId) : [...p.likes, userId];
  });
}
export function addComment(postId, authorId, text) {
  commit((d) => { d.posts.find((x) => x.id === postId).comments.push({ id: uid("c-"), authorId, text: text.trim(), at: nowISO() }); });
}
export function deletePost(postId) { commit((d) => { d.posts = d.posts.filter((p) => p.id !== postId); }); }

/* ============================================================
   Perfiles y marca
   ============================================================ */
const PROFILE_KEYS = ["name", "body", "photo", "phone", "city", "headline", "years", "instagram", "bio", "specialties", "certifications", "services", "injuries", "birthYear"];
export function updateProfile(userId, patch) {
  commit((d) => {
    const u = d.users.find((x) => x.id === userId);
    PROFILE_KEYS.forEach((k) => { if (patch[k] !== undefined) u[k] = patch[k]; });
    if (patch.phone !== undefined && u.role === "client") d.clients.find((c) => c.userId === userId).phone = patch.phone;
  });
}
export function updateBrand(coachId, patch) {
  const slug = patch.slug !== undefined ? slugify(patch.slug) : undefined;
  if (slug !== undefined) {
    if (slug.length < 3) return { error: "El enlace necesita al menos 3 letras o números." };
    if (state.users.some((u) => u.id !== coachId && u.brand?.slug === slug)) return { error: "Ese enlace ya lo usa otro entrenador. Prueba con otro." };
  }
  commit((d) => {
    const u = d.users.find((x) => x.id === coachId);
    u.brand = { ...(u.brand || {}), ...patch, ...(slug !== undefined ? { slug } : {}) };
  });
  return { ok: true };
}

/* ============================================================
   Seguimiento del asesorado: medidas, fotos y notas
   (solo el entrenador del cliente puede escribirlas)
   ============================================================ */
const MEAS_KEYS = ["weight", "fat", "waist", "hip", "chest", "arm", "thigh"];
export function addMeasurement(clientId, m) {
  commit((d) => {
    const c = d.clients.find((x) => x.userId === clientId);
    const row = { id: uid("ms-"), date: m.date ? new Date(`${m.date}T08:00:00`).toISOString() : nowISO(), note: (m.note || "").trim() };
    MEAS_KEYS.forEach((k) => { if (m[k] !== "" && m[k] != null && !Number.isNaN(+m[k])) row[k] = +m[k]; });
    c.measurements.push(row);
    c.measurements.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (row.weight) { c.weights.push({ date: row.date, kg: row.weight }); c.weights.sort((a, b) => new Date(a.date) - new Date(b.date)); }
  });
}
export function deleteMeasurement(clientId, id) {
  commit((d) => { const c = d.clients.find((x) => x.userId === clientId); c.measurements = c.measurements.filter((m) => m.id !== id); });
}
export function addPhotos(clientId, photos, byUserId) {
  commit((d) => {
    const c = d.clients.find((x) => x.userId === clientId);
    photos.forEach((p) => c.photos.push({ id: uid("ph-"), src: p.src, pose: p.pose, note: (p.note || "").trim(),
      date: p.date ? new Date(`${p.date}T08:00:00`).toISOString() : nowISO(), by: byUserId, at: nowISO() }));
    c.photos.sort((a, b) => new Date(b.date) - new Date(a.date));
  });
}
export function deletePhoto(clientId, id) {
  commit((d) => { const c = d.clients.find((x) => x.userId === clientId); c.photos = c.photos.filter((p) => p.id !== id); });
}
export function addNote(clientId, { text, category }) {
  commit((d) => { d.clients.find((x) => x.userId === clientId).notes.push({ id: uid("nt-"), at: nowISO(), category, text: text.trim(), pinned: false }); });
}
export function updateNote(clientId, id, patch) {
  commit((d) => { Object.assign(d.clients.find((x) => x.userId === clientId).notes.find((n) => n.id === id), patch); });
}
export function deleteNote(clientId, id) {
  commit((d) => { const c = d.clients.find((x) => x.userId === clientId); c.notes = c.notes.filter((n) => n.id !== id); });
}

/* ============================================================
   Entrenamiento en vivo
   ============================================================ */
export function startWorkout(clientId, dayId) {
  commit((d) => {
    if (d.active[clientId]) return;
    const c = d.clients.find((x) => x.userId === clientId);
    const day = c.routine.days.find((x) => x.id === dayId) || c.routine.days[0];
    d.active[clientId] = {
      id: uid("w-"), clientId, dayId: day.id, dayName: day.name, routineName: c.routine.name,
      startedAt: nowISO(), restEndsAt: null, restTotal: 0,
      exercises: day.exercises.map((e) => {
        const last = lastPerformance(d, clientId, e.exId);
        const nSets = Math.max(1, +e.sets || 1);
        return {
          exId: e.exId, notes: e.notes || "", target: { sets: nSets, reps: String(e.reps), rest: e.rest },
          sets: Array.from({ length: nSets }, (_, i) => {
            const prev = last?.sets[i] || last?.sets.at(-1);
            return { weight: "", reps: "", prevWeight: prev?.weight ?? null, prevReps: prev?.reps ?? null, done: false };
          }),
        };
      }),
    };
  });
}
export function updateWorkout(clientId, fn) {
  commit((d) => { if (d.active[clientId]) fn(d.active[clientId]); });
}
export function discardWorkout(clientId) { commit((d) => { delete d.active[clientId]; }); }

export function finishWorkout(clientId, { difficulty, comment, share }) {
  return commit((d) => {
    const a = d.active[clientId];
    if (!a) return null;
    const finishedAt = nowISO();
    const prs = [];
    const exercises = a.exercises.map((e) => {
      const sets = e.sets.map((x) => ({ weight: +x.weight || 0, reps: +x.reps || 0, done: !!x.done }));
      const top = Math.max(0, ...sets.filter((x) => x.done && x.reps > 0).map((x) => x.weight));
      const prev = bestSet(d, clientId, e.exId);
      if (prev && top > prev.weight) prs.push({ exId: e.exId, weight: top, prev: prev.weight });
      return { exId: e.exId, target: e.target, sets };
    });
    const w = {
      id: a.id, clientId, dayId: a.dayId, dayName: a.dayName, routineName: a.routineName,
      startedAt: a.startedAt, finishedAt, durationSec: Math.round((Date.parse(finishedAt) - Date.parse(a.startedAt)) / 1000),
      difficulty, comment: comment.trim(), prs, exercises,
    };
    d.workouts.push(w);
    delete d.active[clientId];
    const c = d.clients.find((x) => x.userId === clientId);
    if (w.comment) {
      d.messages.push({ id: uid("m-"), coachId: c.coachId, clientId, from: clientId, read: false, at: finishedAt,
        text: `Comentario del entrenamiento (${a.dayName}): ${w.comment}` });
    }
    if (share) {
      const u = d.users.find((x) => x.id === clientId);
      const pr = prs[0] ? ` Nuevo récord en ${exerciseById(d, prs[0].exId).name}: ${prs[0].weight} kg.` : "";
      d.posts.unshift({ id: uid("p-"), coachId: c.coachId, authorId: clientId, kind: "workout", at: finishedAt, likes: [], comments: [],
        text: `${u.name.split(" ")[0]} completó ${a.dayName} en ${Math.round(w.durationSec / 60)} min.${pr}`, workoutId: w.id });
    }
    return { ...w, volume: sessionVolume(w), done: doneSetCount(w) };
  });
}

/* ---------- utilidades del demo ---------- */
export function resetDemo() {
  const keepSession = state.sessionUserId;
  state = buildSeed();
  state.sessionUserId = state.users.some((u) => u.id === keepSession) ? keepSession : null;
  save(state);
  emit();
}

export { repsLow };
