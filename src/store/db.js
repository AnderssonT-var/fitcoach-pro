/* ============================================================
   Store de la app conectado al servidor.
   Los datos vienen de /api/state (solo lo que el usuario puede ver)
   y cada acción llama a la API; el servidor valida permisos.
   Las funciones de lectura (selectores) no cambian.
   ============================================================ */
import { useSyncExternalStore } from "react";
import { EXERCISE_LIBRARY } from "./exercises";
import { abs, api, hasSession, onLost, setTokens } from "./api";
import { addDays, repsLow, startOfDay, weekStart } from "../lib/format";

const LIBRARY = EXERCISE_LIBRARY.map((e) => ({ ...e, coachId: null }));
const blank = (status) => ({
  status, version: 1, users: [], clients: [], licenses: [], payments: [], workouts: [], messages: [], posts: [], templates: [],
  exercises: LIBRARY, activity: [], active: {}, subscriptions: [], settings: { pricing: null }, ranking: null, access: null, sessionUserId: null,
});

let state = blank(hasSession() ? "boot" : "guest");
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
function setState(next) { state = next; emit(); }
let localDirty = false; // hubo cambios optimistas desde la última carga
let lastRaw = null;     // última respuesta completa del servidor
function patch(fn) { const d = structuredClone(state); fn(d); localDirty = true; setState(d); }

export function useDB() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
export const getDB = () => state;

const uid = (p = "") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nowISO = () => new Date().toISOString();

/* ============================================================
   Carga del estado desde el servidor
   ============================================================ */
let pendingActive = null; // cambios del entrenamiento en curso aún no guardados
let loading = null;

function normalize(s) {
  s.status = "ready";
  s.exercises = [...LIBRARY, ...(s.exercises || []).map((e) => ({ ...e, photo: abs(e.photo) }))];
  s.clients = (s.clients || []).map((c) => ({ ...c, photos: (c.photos || []).map((p) => ({ ...p, src: abs(p.src) })) }));
  s.subscriptions = (s.subscriptions || []).map((x) => ({ ...x, receipt: abs(x.receipt) }));
  if (pendingActive) s.active = { ...s.active, [pendingActive.clientId]: pendingActive };
  return s;
}

/** Vuelve a pedir los datos al servidor. */
export async function reload() {
  if (!hasSession()) { setState(blank("guest")); return; }
  loading ||= (async () => {
    const ready = state.status === "ready" && lastRaw;
    const s = await api("GET", "/api/state", undefined, { conditional: !!ready });
    if (s.notModified) {
      // Sin cambios en el servidor; si hubo cambios optimistas que no se confirmaron, se vuelve a lo del servidor
      if (localDirty) { localDirty = false; setState(normalize(structuredClone(lastRaw))); }
      return;
    }
    if (s.error) {
      if (s.offline && state.status === "ready") return; // sin conexión: se mantiene lo que había
      if (s.offline) { setState({ ...blank("offline"), error: s.error }); return; }
      if (!hasSession()) setState(blank("guest"));
      return;
    }
    lastRaw = s; localDirty = false;
    setState(normalize(structuredClone(s)));
  })().finally(() => { loading = null; });
  return loading;
}

onLost(() => { pendingActive = null; lastRaw = null; setTokens(null); setState(blank("guest")); });

/* Sincroniza cada 20 s mientras la app está visible (mensajes, cambios del entrenador, etc.) */
if (typeof window !== "undefined") {
  setInterval(() => { if (state.status === "ready" && document.visibilityState === "visible") reload(); }, 20000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && state.status === "ready") reload(); });
  if (state.status === "boot") reload();
}

/** Llama a la API y, si sale bien, recarga los datos. Devuelve la respuesta. */
async function act(method, path, body) {
  const r = await api(method, path, body);
  if (!r.error) await reload();
  else if (r.status === 402 || r.code === "consent_required" || r.code === "password_change" || r.code === "client_inactive" || r.code === "coach_license") await reload();
  return r;
}

/* ============================================================
   Selectores (iguales a los de antes)
   ============================================================ */
export const userById = (s, id) => s.users.find((u) => u.id === id);
export const clientById = (s, id) => s.clients.find((c) => c.userId === id);
export const coachBySlug = () => null; // el acceso con marca se consulta al servidor (fetchBrand)

export function brandOf(s, user) {
  if (!user || user.role === "admin") return null;
  const coach = user.role === "coach" ? user : userById(s, clientById(s, user.id)?.coachId);
  if (!coach) return null;
  const b = coach.brand || {};
  return { coach, name: b.businessName || "", logo: b.logo || null, color: b.color || "", tagline: b.tagline || "", slug: b.slug || "" };
}

export const exerciseById = (s, id) => s.exercises.find((e) => e.id === id) || { id, name: "Ejercicio", muscle: "", equipment: "", primary: [], secondary: [] };

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

export function coachLicense(s, coachId) {
  const mine = s.licenses.filter((l) => l.coachId === coachId);
  const valid = mine.filter((l) => ["active", "expiring"].includes(licenseStatus(l)));
  const pool = valid.length ? valid : mine;
  return [...pool].sort((a, b) => new Date(b.expiresAt || 0) - new Date(a.expiresAt || 0))[0] || null;
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
  s.clients.filter((c) => c.coachId === coachId).map((c) => ({ ...c, user: userById(s, c.userId) })).filter((c) => c.user);

export const workoutsOf = (s, clientId) =>
  s.workouts.filter((w) => clientId == null || w.clientId === clientId).sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));

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
  for (let w = 1; w < 60; w++) { if (weekCount(s, clientId, w) >= goal) streak++; else break; }
  return streak;
}
export function sessionVolume(w) {
  if (w.summary) return w.vol || 0; // entrenamiento antiguo: el servidor envía solo el resumen
  return w.exercises.reduce((t, e) => t + e.sets.filter((x) => x.done).reduce((a, x) => a + (+x.weight || 0) * (+x.reps || 0)
    + (x.drops || []).reduce((v, d) => v + (+d.weight || 0) * (+d.reps || 0), 0), 0), 0);
}
export function doneSetCount(w) { if (w.summary) return w.setCount || 0; return w.exercises.reduce((t, e) => t + e.sets.filter((x) => x.done).length, 0); }

export function lastPerformance(s, clientId, exId) {
  for (const w of workoutsOf(s, clientId)) {
    const e = w.exercises.find((x) => x.exId === exId);
    if (e && e.sets.some((x) => x.done)) return { at: w.finishedAt, sets: e.sets.filter((x) => x.done) };
  }
  return null;
}
export function bestSet(s, clientId, exId) {
  // Récord de todos los tiempos guardado en el servidor + lo registrado recién
  const b = s.clients.find((c) => c.userId === clientId)?.bests?.[exId];
  let best = b && b.w >= 0 ? { weight: b.w, reps: b.r, at: b.at, first: b.first } : null;
  for (const w of s.workouts) {
    if (w.clientId !== clientId) continue;
    const e = w.exercises.find((x) => x.exId === exId);
    if (!e) continue;
    for (const x of e.sets) {
      if (!x.done || !(+x.reps > 0)) continue;
      if (!best || +x.weight > best.weight || (+x.weight === best.weight && +x.reps > best.reps)) best = { ...best, weight: +x.weight, reps: +x.reps, at: w.finishedAt };
    }
  }
  return best;
}
export function nextDay(s, clientId) {
  const c = clientById(s, clientId);
  if (!c?.routine?.days?.length) return null;
  const last = workoutsOf(s, clientId).find((w) => c.routine.days.some((d) => d.id === w.dayId));
  if (!last) return c.routine.days[0];
  const i = c.routine.days.findIndex((d) => d.id === last.dayId);
  return c.routine.days[(i + 1) % c.routine.days.length];
}
export function thread(s, coachId, clientId) {
  return s.messages.filter((m) => m.coachId === coachId && m.clientId === clientId).sort((a, b) => new Date(a.at) - new Date(b.at));
}
/** Último mensaje del entrenador que etiqueta este ejercicio (para verlo al entrenar). */
export function lastExerciseNote(s, coachId, clientId, exId) {
  return thread(s, coachId, clientId).filter((m) => m.exId === exId && m.from === coachId).at(-1) || null;
}
export function unreadFor(s, userId) {
  return s.messages.filter((m) => !m.read && m.from !== userId && (m.coachId === userId || m.clientId === userId)).length;
}
export function exerciseInUse(s, id) {
  return s.clients.some((c) => c.routine?.days.some((day) => day.exercises.some((e) => e.exId === id)));
}

/** Precios de los planes según lo que definió el administrador. */
export const PLAN_MONTHS = [1, 3, 6, 12];
export function plansOf(s) {
  const p = s.settings?.pricing;
  if (!p) return [];
  return PLAN_MONTHS.map((m) => {
    const d = p.discounts?.[m] || 0;
    const v = p.monthly * m * (1 - d / 100);
    return { months: m, label: `${m} ${m === 1 ? "mes" : "meses"}`, discount: d, price: d > 0 ? Math.round(v) : Math.round(v * 100) / 100 };
  });
}

/* ============================================================
   Sesión
   ============================================================ */
export async function login(email, password, brandSlug = null) {
  const r = await api("POST", "/api/auth/login", { email: email.trim(), password, ...(brandSlug ? { brandSlug } : {}) });
  if (r.error) return r;
  setTokens(r);
  await reload();
  return { ok: true };
}
export async function logout() {
  const rt = (() => { try { return localStorage.getItem("fcp.rt"); } catch { return null; } })();
  pendingActive = null;
  api("POST", "/api/auth/logout", { refreshToken: rt });
  setTokens(null);
  setState(blank("guest"));
}
export async function logoutAll() {
  await api("POST", "/api/auth/logout-all", {});
  setTokens(null);
  setState(blank("guest"));
}
export async function changePassword(current, next) {
  const r = await api("POST", "/api/auth/password", { current, next });
  if (r.error) return r;
  setTokens(r);
  await reload();
  return { ok: true };
}
export const acceptConsent = (photos) => act("POST", "/api/auth/consent", { accept: true, ...(photos !== undefined ? { photos } : {}) });
export const setPhotoConsent = (value) => act("POST", "/api/auth/photo-consent", { value });
export async function fetchBrand(slug) {
  if (!slug) return null;
  const r = await api("GET", `/api/public/brand/${encodeURIComponent(slug)}`);
  return r.error ? null : r;
}
export const fetchPricing = () => api("GET", "/api/public/pricing");

export function normalizeCode(code) {
  const raw = code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^FIT/, "").slice(0, 12);
  return raw ? `FIT-${raw.match(/.{1,4}/g).join("-")}` : "";
}

/** Registro de un entrenador con su código de licencia. */
export async function activateLicense({ code, name, email, password, acceptTerms }) {
  const r = await api("POST", "/api/auth/activate", { code, name, email, password, acceptTerms });
  if (r.error) return r;
  setTokens(r);
  await reload();
  return { ok: true };
}
export const redeemCode = (_coachId, code) => act("POST", "/api/coach/redeem", { code });
export const requestSubscription = (data) => act("POST", "/api/coach/subscriptions", data);

/* ============================================================
   Administrador
   ============================================================ */
export async function generateLicenses(months, qty, note = "") {
  const r = await act("POST", "/api/admin/licenses", { months, qty, note });
  return r.error ? r : r.licenses;
}
export const renewLicense = (id, months) => act("POST", `/api/admin/licenses/${id}/renew`, { months });
export const revokeLicense = (id) => act("POST", `/api/admin/licenses/${id}/revoke`, {});
export const restoreLicense = (id) => act("POST", `/api/admin/licenses/${id}/restore`, {});
export const deleteLicense = (id) => act("DELETE", `/api/admin/licenses/${id}`);
export const savePricing = (p) => act("PUT", "/api/admin/pricing", p);
export const saveLegal = (p) => act("PUT", "/api/admin/legal", p);
export const fetchInfo = () => api("GET", "/api/public/info");
export const approveSubscription = (id, note) => act("POST", `/api/admin/subscriptions/${id}/approve`, { note });
export const rejectSubscription = (id, note) => act("POST", `/api/admin/subscriptions/${id}/reject`, { note });
export const adminResetPassword = (userId) => act("POST", `/api/admin/users/${userId}/reset-password`, {});

/* ============================================================
   Entrenador
   ============================================================ */
export async function addClient(_coachId, data) {
  const r = await act("POST", "/api/coach/clients", {
    name: data.name, email: data.email, goal: data.goal || "", phone: data.phone || "",
    height: data.height ? +data.height : null, weight: data.weight ? +data.weight : null, fee: +data.fee || 0,
    ...(data.trial ? { trial: { days: +data.trial.days, fee: +data.trial.fee || 0 } } : {}),
  });
  return r;
}
export const updateClient = (clientId, p) => act("PATCH", `/api/coach/clients/${clientId}`, p);
export async function resetClientPassword(clientId) {
  const r = await act("POST", `/api/coach/clients/${clientId}/reset-password`, {});
  return r.error ? r : r.password;
}
export const deleteClient = (clientId) => act("DELETE", `/api/coach/clients/${clientId}`);
export function addBodyWeight(clientId, kgValue) {
  const me = userById(state, state.sessionUserId);
  return me?.role === "client"
    ? act("POST", "/api/client/weight", { kg: +kgValue })
    : act("POST", `/api/coach/clients/${clientId}/weight`, { kg: +kgValue });
}
const cleanRoutine = (r) => r && ({
  name: r.name || "", goal: r.goal || "", frequency: +r.frequency || 3, notes: r.notes || "",
  days: r.days.map((d) => ({ id: d.id, name: d.name, exercises: d.exercises.map((e) => ({ uid: e.uid, exId: e.exId, sets: +e.sets || 1, reps: String(e.reps ?? ""), rest: +e.rest || 0, notes: e.notes || "",
    technique: e.technique === "dropset" ? "dropset" : "normal", ...(e.technique === "dropset" && e.drops ? { drops: { count: +e.drops.count, pct: +e.drops.pct, on: e.drops.on === "all" ? "all" : "last" } } : {}) })) })),
});
export const saveRoutine = (clientId, routine, slot = "current") => act("PUT", `/api/coach/clients/${clientId}/routine`, { routine: routine ? cleanRoutine(routine) : null, slot });
/* Plan de prueba */
export const startTrial = (clientId, days, fee) => act("POST", `/api/coach/clients/${clientId}/trial`, { days: +days, fee: +fee || 0 });
export const extendTrial = (clientId, days) => act("POST", `/api/coach/clients/${clientId}/trial/extend`, { days: +days });
export const convertTrial = (clientId) => act("POST", `/api/coach/clients/${clientId}/trial/convert`, {});
export const cancelTrial = (clientId, pause = true) => act("POST", `/api/coach/clients/${clientId}/trial/cancel`, { pause });
export const saveTemplate = (_coachId, routine, name) => act("POST", "/api/coach/templates", { routine: cleanRoutine(routine), name });
export const deleteTemplate = (id) => act("DELETE", `/api/coach/templates/${id}`);
export const newUid = () => uid("re-");

export function upsertExercise(_coachId, data) {
  const { id, coachId, images, source, ...body } = data;
  const payload = { ...body, sets: +body.sets || 3, rest: +body.rest || 60, photo: body.photo?.startsWith?.("data:") ? body.photo : body.photo ? undefined : null };
  return id ? act("PUT", `/api/coach/exercises/${id}`, payload) : act("POST", "/api/coach/exercises", payload);
}
export const deleteExercise = (id) => act("DELETE", `/api/coach/exercises/${id}`);

export const addPayment = (_coachId, p) => act("POST", "/api/coach/payments", { clientId: +p.clientId, concept: p.concept, amount: +p.amount, dueDate: p.dueDate, paid: !!p.paid, method: p.method || "" });
export const markPaid = (id, method) => act("POST", `/api/coach/payments/${id}/paid`, { method });
export const markUnpaid = (id) => act("POST", `/api/coach/payments/${id}/unpaid`, {});
export const deletePayment = (id) => act("DELETE", `/api/coach/payments/${id}`);
export async function generateMonthly() {
  const r = await act("POST", "/api/coach/payments/generate-monthly", {});
  return r.error ? 0 : r.created;
}
export async function updateBrand(_coachId, p) {
  const r = await act("PUT", "/api/coach/brand", p);
  return r.error ? r : { ok: true };
}

/* Seguimiento del asesorado */
export const addMeasurement = (clientId, m) => act("POST", `/api/coach/clients/${clientId}/measurements`, m);
export const deleteMeasurement = (clientId, id) => act("DELETE", `/api/coach/clients/${clientId}/measurements/${id}`);
export function addPhotos(clientId, photos) {
  const me = userById(state, state.sessionUserId);
  const body = { photos: photos.map((p) => ({ src: p.src, pose: p.pose, note: p.note || "", date: p.date || null })) };
  return me?.role === "client" ? act("POST", "/api/client/photos", body) : act("POST", `/api/coach/clients/${clientId}/photos`, body);
}
export function deletePhoto(clientId, id) {
  const me = userById(state, state.sessionUserId);
  return me?.role === "client" ? act("DELETE", `/api/client/photos/${id}`) : act("DELETE", `/api/coach/clients/${clientId}/photos/${id}`);
}
export const addNote = (clientId, n) => act("POST", `/api/coach/clients/${clientId}/notes`, n);
export const updateNote = (clientId, id, p) => act("PATCH", `/api/coach/clients/${clientId}/notes/${id}`, p);
export const deleteNote = (clientId, id) => act("DELETE", `/api/coach/clients/${clientId}/notes/${id}`);

/* ============================================================
   Compartido: perfil, mensajes, comunidad
   ============================================================ */
const PROFILE_KEYS = ["name", "body", "photo", "phone", "city", "headline", "years", "instagram", "bio", "specialties", "certifications", "services", "injuries", "birthYear"];
export function updateProfile(_userId, p) {
  const body = Object.fromEntries(PROFILE_KEYS.filter((k) => p[k] !== undefined).map((k) => [k, k === "years" || k === "birthYear" ? (p[k] === "" || p[k] == null ? null : +p[k]) : p[k]]));
  return act("PUT", "/api/profile", body);
}

export async function sendMessage(coachId, clientId, from, text, ref = null) {
  // Se muestra al instante y luego se confirma con el servidor
  const tagged = ref?.exId ? { exId: ref.exId, tag: ref.tag || "comentario" } : {};
  patch((d) => { d.messages.push({ id: uid("tmp-"), coachId, clientId, from, text: text.trim(), at: nowISO(), read: false, pending: true, exId: null, tag: null, ...tagged }); });
  const me = userById(state, state.sessionUserId);
  return act("POST", "/api/messages", { text, ...tagged, ...(me?.role === "coach" ? { clientId } : {}) });
}
export function markThreadRead(coachId, clientId, readerId) {
  if (!state.messages.some((m) => m.coachId === coachId && m.clientId === clientId && m.from !== readerId && !m.read)) return;
  patch((d) => { d.messages.forEach((m) => { if (m.coachId === coachId && m.clientId === clientId && m.from !== readerId) m.read = true; }); });
  const me = userById(state, state.sessionUserId);
  api("POST", "/api/messages/read", me?.role === "coach" ? { clientId } : {});
}
export const addPost = (_coachId, _authorId, text, kind = "post") => act("POST", "/api/posts", { text, kind });
export function toggleLike(postId, userId) {
  patch((d) => { const p = d.posts.find((x) => x.id === postId); if (p) p.likes = p.likes.includes(userId) ? p.likes.filter((x) => x !== userId) : [...p.likes, userId]; });
  return act("POST", `/api/posts/${postId}/like`, {});
}
export const addComment = (postId, _authorId, text) => act("POST", `/api/posts/${postId}/comments`, { text });
export const deletePost = (postId) => act("DELETE", `/api/posts/${postId}`);

/* Datos personales del asesorado */
export async function exportMyData() {
  const r = await api("GET", "/api/account/export");
  if (r.error) return r;
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "mis-datos-vytrafit.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return { ok: true };
}
export async function deleteMyAccount(password) {
  const r = await api("DELETE", "/api/account", { password });
  if (r.error) return r;
  setTokens(null);
  setState(blank("guest"));
  return { ok: true };
}

/* ============================================================
   Entrenamiento en vivo: se edita al instante y se guarda en el
   servidor cada pocos segundos (si se cierra la app, se retoma).
   ============================================================ */
let saveTimer = null;
function queueActiveSave(a) {
  pendingActive = a;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushActive, 1200);
}
async function flushActive() {
  const a = pendingActive;
  if (!a) return;
  const r = await api("PUT", "/api/client/workout/active", a);
  if (!r.error && pendingActive === a) pendingActive = null;
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { if (pendingActive) flushActive(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && pendingActive) flushActive(); });
}

export function startWorkout(clientId, dayId) {
  if (state.active[clientId]) return;
  const c = clientById(state, clientId);
  if (!c?.routine) return;
  const day = c.routine.days.find((x) => x.id === dayId) || c.routine.days[0];
  const a = {
    id: uid("w-"), clientId, dayId: day.id, dayName: day.name, routineName: c.routine.name || "",
    startedAt: nowISO(), restEndsAt: null, restTotal: 0,
    exercises: day.exercises.map((e) => {
      const last = lastPerformance(state, clientId, e.exId);
      const nSets = Math.max(1, +e.sets || 1);
      const drop = e.technique === "dropset" && e.drops?.count > 0 ? { count: +e.drops.count, pct: +e.drops.pct || 20, on: e.drops.on === "all" ? "all" : "last" } : null;
      return {
        exId: e.exId, notes: e.notes || "",
        target: { sets: nSets, reps: String(e.reps), rest: +e.rest || 0, ...(drop ? { drop } : {}) },
        sets: Array.from({ length: nSets }, (_, i) => {
          const prev = last?.sets[i] || last?.sets.at(-1);
          const st = { weight: "", reps: "", prevWeight: prev?.weight ?? null, prevReps: prev?.reps ?? null, done: false };
          if (drop && (drop.on === "all" || i === nSets - 1)) st.drops = Array.from({ length: drop.count }, (_, k) => ({ weight: "", reps: "", prevReps: prev?.drops?.[k]?.reps ?? null, done: false }));
          return st;
        }),
      };
    }),
  };
  patch((d) => { d.active[clientId] = a; });
  pendingActive = a;
  flushActive();
}
export function updateWorkout(clientId, fn) {
  if (!state.active[clientId]) return;
  patch((d) => { fn(d.active[clientId]); });
  queueActiveSave(state.active[clientId]);
}
export async function discardWorkout(clientId) {
  clearTimeout(saveTimer); pendingActive = null;
  patch((d) => { delete d.active[clientId]; });
  await act("DELETE", "/api/client/workout/active");
}
export async function finishWorkout(clientId, { difficulty, comment, share }) {
  const a = state.active[clientId];
  if (!a) return null;
  clearTimeout(saveTimer);
  const prName = (() => {
    // Nombre del ejercicio con récord, para el mensaje de la comunidad
    for (const e of a.exercises) {
      const top = Math.max(0, ...e.sets.filter((x) => x.done && +x.reps > 0).map((x) => +x.weight || 0));
      const prev = bestSet(state, clientId, e.exId);
      if (prev && top > prev.weight) return exerciseById(state, e.exId).name;
    }
    return undefined;
  })();
  const r = await api("POST", "/api/client/workout/finish", { session: a, difficulty, comment, share, prName });
  if (r.error) return r;
  pendingActive = null;
  patch((d) => { delete d.active[clientId]; });
  await reload();
  return r;
}

export { repsLow };
