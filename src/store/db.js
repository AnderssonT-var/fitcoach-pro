/* ============================================================
   Store de la app conectado al servidor, pensado para trabajar SIN CONEXIÓN.
   - Los datos vienen de /api/state (solo lo que el usuario puede ver) y se guardan
     en el equipo: la app abre y funciona aunque no haya internet.
   - Cada cambio se guarda primero en el equipo (cola de acciones) y se ve al instante;
     se sube al servidor apenas hay señal, en orden y sin duplicarse (Idempotency-Key).
   - Si el servidor rechaza una acción (por ejemplo, datos no válidos) se avisa.
   Las funciones de lectura (selectores) no cambian.
   ============================================================ */
import { useSyncExternalStore } from "react";
import { EXERCISE_LIBRARY } from "./exercises";
import { abs, api, getStateTag, hasSession, onLost, pollSeconds, resetStateTag, setStateTag, setSyncInfo, setTokens } from "./api";
import { askPersist, kvGet, kvSet } from "./idb";
import { addDays, repsLow, startOfDay, weekStart } from "../lib/format";

const LIBRARY = EXERCISE_LIBRARY.map((e) => ({ ...e, coachId: null }));
const blank = (status) => ({
  status, version: 1, users: [], clients: [], licenses: [], payments: [], workouts: [], messages: [], posts: [], templates: [],
  exercises: LIBRARY, activity: [], active: {}, subscriptions: [], settings: { pricing: null }, ranking: null, access: null, sessionUserId: null,
  pendingOps: [], pendingUploads: 0, syncErrors: [],
});

let state = blank(hasSession() ? "boot" : "guest");
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
function setState(next) { state = next; emit(); }
/** Cambio local que no pasa por el servidor (por ejemplo, la sesión en curso). */
function patch(fn) { const d = { ...state, active: { ...state.active } }; fn(d); setState(d); }

export function useDB() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
export const getDB = () => state;

const uid = (p = "") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nowISO = () => new Date().toISOString();
const newOpId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.replace(/[^a-z0-9]/g, "x");

/* ============================================================
   Datos guardados en el equipo
   ============================================================ */
const LS = { state: "fcp.state", active: "fcp.active", outbox: "fcp.outbox" };
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio o sin almacenamiento */ } };
const saveLocalActive = (a) => lsSet(LS.active, a ? { a, at: Date.now() } : null);

let lastRaw = null;      // última respuesta completa del servidor
let ops = [];            // acciones hechas en este equipo que faltan subir (en orden)
let confirmed = [];      // acciones ya subidas que se siguen mostrando hasta que llegue el estado nuevo
let syncErrors = [];     // acciones que el servidor no aceptó
let pendingActive = null; // cambios del entrenamiento en curso aún no guardados en el servidor
let loading = null;

const me = () => lastRaw?.sessionUserId ?? state.sessionUserId ?? null;
const myOps = () => ops.filter((o) => o.userId === me());
const persistOps = () => kvSet("ops", ops);
setSyncInfo(() => ({ pending: myOps().length, failed: syncErrors.filter((e) => e.userId === me()).length }));
export const pendingCount = () => myOps().length;
/** Compatibilidad: entrenamientos terminados sin conexión que faltan subir. */
export const outbox = () => myOps().filter((o) => o.kind === "finish").map((o) => ({ userId: o.userId, ...o.body }));

function mkOp(userId, kind, method, path, body, { args, label, at } = {}) {
  return { id: newOpId(), userId, kind, method, path, body, args: args ?? null, label: label || "Cambio", at: at || nowISO(), tries: 0 };
}

let snapTimer = null;
function saveSnapshot() {
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => { if (lastRaw && hasSession()) kvSet("state", { ...lastRaw, __etag: getStateTag() }); }, 1200);
}

/* Al abrir: se cargan la cola y lo último que llegó del servidor (la app abre al instante, con o sin señal) */
const storeReady = (async () => {
  const [o, e, cached] = await Promise.all([kvGet("ops"), kvGet("syncErrors"), hasSession() ? kvGet("state") : null]);
  ops = Array.isArray(o) ? o : [];
  syncErrors = Array.isArray(e) ? e : [];
  // Cola antigua (solo entrenamientos terminados sin conexión) → cola nueva
  const old = lsGet(LS.outbox);
  if (Array.isArray(old) && old.length) {
    for (const it of old) {
      const { userId, ...body } = it;
      if (!ops.some((x) => x.kind === "finish" && x.body?.session?.id === body.session?.id)) {
        ops.push(mkOp(userId, "finish", "POST", "/api/client/workout/finish", body, { label: `Entrenamiento ${body.session?.dayName || ""}`.trim(), at: body.finishedAt }));
      }
    }
    persistOps();
  }
  lsSet(LS.outbox, null);
  const legacy = lsGet(LS.state);
  lsSet(LS.state, null);
  const snap = cached || legacy;
  if (snap && hasSession() && state.status === "boot") {
    lastRaw = snap;
    if (snap.__etag) setStateTag(snap.__etag);
    render({ offline: false, stale: true });
  }
  askPersist();
})();

/* ============================================================
   Cómo se ve el estado: lo del servidor + las acciones aún sin subir
   ============================================================ */
function normalize(s) {
  s.status = "ready";
  s.exercises = [...LIBRARY, ...(s.exercises || []).map((e) => ({ ...e, photo: abs(e.photo) }))];
  s.clients = (s.clients || []).map((c) => ({ ...c, photos: (c.photos || []).map((p) => ({ ...p, src: abs(p.src) })) }));
  s.subscriptions = (s.subscriptions || []).map((x) => ({ ...x, receipt: abs(x.receipt) }));
  s.workouts ||= [];
  s.reviews ||= [];
  s.active ||= {};
  if (pendingActive) s.active = { ...s.active, [pendingActive.clientId]: pendingActive };
  // Sesión guardada en este equipo (por ejemplo, se cerró la app sin señal)
  const local = lsGet(LS.active)?.a;
  if (local && local.clientId === s.sessionUserId) {
    const finished = s.workouts.some((w) => w.ref === local.id) || ops.some((o) => o.kind === "finish" && o.body?.session?.id === local.id);
    const discarded = ops.some((o) => o.kind === "discard" && o.args?.id === local.id);
    const server = s.active?.[local.clientId];
    if (finished || discarded) saveLocalActive(null);
    else if (!server || server.id === local.id) {
      s.active = { ...s.active, [local.clientId]: local };
      if (!server || JSON.stringify(server) !== JSON.stringify(local)) setTimeout(() => queueActiveSave(local), 0);
    }
  }
  return s;
}

function view() {
  // El historial puede ser grande: se copia la lista, no cada entrenamiento (las acciones solo agregan)
  const { workouts, ...rest } = lastRaw;
  const d = normalize({ ...structuredClone(rest), workouts: [...(workouts || [])] });
  const uidNow = d.sessionUserId;
  for (const op of [...confirmed, ...ops]) {
    if (op.userId !== uidNow) continue;
    const fn = REDUCERS[op.kind];
    if (fn) { try { fn(d, op.args || {}, op); } catch (e) { console.warn("[sin conexión]", op.kind, e); } }
  }
  d.pendingOps = ops.filter((o) => o.userId === uidNow).map((o) => ({ id: o.id, kind: o.kind, label: o.label, at: o.at, tries: o.tries || 0, error: o.lastError || null }));
  d.pendingUploads = d.pendingOps.length;
  d.syncErrors = syncErrors.filter((e) => e.userId === uidNow);
  return d;
}
function render(extra = {}) {
  if (!lastRaw) return;
  setState({ ...view(), offline: state.offline || false, stale: state.stale || false, busy: state.busy || false, ...extra });
}

/* ============================================================
   Carga del estado desde el servidor
   ============================================================ */
/** Vuelve a pedir los datos al servidor. */
export async function reload() {
  await storeReady;
  if (!hasSession()) { setState(blank("guest")); return; }
  loading ||= (async () => {
    const started = Date.now();
    const haveHistory = lastRaw?.workouts && lastRaw.historyKey ? lastRaw.historyKey : null;
    const s = await api("GET", "/api/state", undefined, { conditional: !!lastRaw, haveHistory });
    if (s.notModified) {
      confirmed = confirmed.filter((c) => c.confirmedAt > started);
      render({ offline: false, stale: false, busy: false });
      backoff = 0;
      return;
    }
    if (s.error) {
      const transient = s.offline || s.status >= 500 || s.status === 429;
      if (transient) {
        backoff = Math.min(60e3, Math.max(5e3, backoff * 2));
        if (lastRaw) render({ offline: !!s.offline, busy: !s.offline });
        else setState({ ...blank("offline"), error: s.error });
        return;
      }
      if (!hasSession()) setState(blank("guest"));
      return;
    }
    backoff = 0;
    if (s.historyKept && lastRaw?.workouts) s.workouts = lastRaw.workouts;
    if (!Array.isArray(s.workouts)) { s.workouts = []; resetStateTag(); s.historyKey = null; } // no debería pasar: la próxima vez llega completo
    delete s.historyKept;
    lastRaw = s;
    confirmed = confirmed.filter((c) => c.confirmedAt > started);
    saveSnapshot();
    render({ offline: false, stale: false, busy: false });
    if (myOps().length) kick(0);
    if (pendingActive) flushActive();
    warmImages();
  })().finally(() => { loading = null; });
  return loading;
}

onLost(() => {
  pendingActive = null; lastRaw = null; confirmed = [];
  kvSet("state", null); setTokens(null); resetStateTag();
  setState(blank("guest")); // la cola se conserva: se sube cuando esa persona vuelva a entrar
});

/* Actualización periódica: cada 20 s (o lo que pida el servidor si hay mucha gente),
   con una pequeña variación para que no consulten todos al mismo tiempo; sin señal se espera más */
let backoff = 0;
let pollTimer = null;
function schedulePoll() {
  clearTimeout(pollTimer);
  const base = (state.offline || state.busy) && backoff ? backoff : pollSeconds() * 1000;
  pollTimer = setTimeout(async () => {
    if (state.status === "ready" && document.visibilityState === "visible") await reload().catch(() => {});
    schedulePoll();
  }, base * (0.85 + Math.random() * 0.3));
}
if (typeof window !== "undefined") {
  schedulePoll();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && state.status === "ready") { reload(); kick(0); } });
  window.addEventListener("online", () => { backoff = 0; if (state.status === "ready") { reload(); kick(0); } });
  window.addEventListener("focus", () => { if (state.status === "ready" && state.offline) reload(); });
  if (state.status === "boot") reload();
}

/* ============================================================
   Cola de acciones
   ============================================================ */
const waiters = new Map();
const settle = (id, r) => { const w = waiters.get(id); if (w) { waiters.delete(id); w(r); } };
let kickTimer = null, flushing = null;
function kick(delay = 0) { clearTimeout(kickTimer); kickTimer = setTimeout(() => { flush(); }, delay); }
const BLOCKED = ["consent_required", "password_change", "client_inactive", "coach_license", "license_required"];
const retryable = (r) => r.offline || r.status === 0 || r.status >= 500 || r.status === 429 || r.status === 408 || r.status === 409 || r.status === 401;

/** Sube las acciones pendientes, una por una y en orden. */
export async function flushOutbox() { return flush(); }
async function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    await storeReady;
    if (!hasSession() || !me()) return;
    const done = [];
    for (;;) {
      const op = ops.find((o) => o.userId === me());
      if (!op) break;
      const r = await api(op.method, op.path, op.body, { opId: op.id, opAt: Date.parse(op.at) || undefined });
      if (r.error && (retryable(r) || r.status === 402 || BLOCKED.includes(r.code))) {
        op.tries = (op.tries || 0) + 1; op.lastError = r.error; op.lastTry = nowISO();
        persistOps();
        for (const o of ops) settle(o.id, { ok: true, queued: true });
        const wait = r.retryAfter ? r.retryAfter * 1000 : Math.min(60e3, 2000 * 2 ** Math.min(op.tries, 5));
        kick(wait);
        render(r.offline ? { offline: true } : {});
        if (!r.offline && !retryable(r)) reload(); // falta aceptar algo (privacidad, licencia…): se muestra la pantalla
        break;
      }
      ops = ops.filter((o) => o.id !== op.id);
      persistOps();
      if (r.error) {
        syncErrors = [...syncErrors, { id: op.id, userId: op.userId, label: op.label, error: r.error, at: nowISO() }].slice(-20);
        kvSet("syncErrors", syncErrors);
        reportFailed(op, r.error);
      } else confirmed.push({ ...op, confirmedAt: Date.now() });
      done.push([op.id, r]);
    }
    if (done.length) {
      await reload();
      for (const [id, r] of done) settle(id, r);
    }
  })().finally(() => { flushing = null; });
  return flushing;
}
function reportFailed(op, error) {
  api("POST", "/api/sync/report", { failed: [{ label: op.label, path: op.path, error }] }).catch(() => {});
}
/** Descarta el aviso de una acción que el servidor no aceptó. */
export function dismissSyncError(id) {
  syncErrors = id ? syncErrors.filter((e) => e.id !== id) : syncErrors.filter((e) => e.userId !== me());
  kvSet("syncErrors", syncErrors);
  render();
}

/**
 * Hace una acción.
 * - Con `kind` se guarda en la cola: se ve al instante (REDUCERS[kind]) y se sube cuando hay señal.
 *   Devuelve la respuesta del servidor o { ok: true, queued: true } si quedó guardada para después.
 * - Sin `kind` necesita conexión (por ejemplo, crear cuentas o generar licencias).
 */
async function act(method, path, body, opt = {}) {
  await storeReady;
  if (!opt.kind) {
    const r = await api(method, path, body);
    if (!r.error) await reload();
    else if (r.status === 402 || BLOCKED.includes(r.code)) await reload();
    if (r.offline) return { ...r, error: "Necesitas conexión a internet para hacer esto." };
    return r;
  }
  const op = mkOp(me(), opt.kind, method, path, body, opt);
  ops.push(op);
  persistOps();
  render();
  const result = new Promise((res) => waiters.set(op.id, res));
  kick(0);
  // La pantalla no espera a una red lenta: si tarda, la acción sigue guardada y se sube sola
  const wait = opt.wait ?? 4000;
  return Promise.race([result, new Promise((res) => setTimeout(() => res({ ok: true, queued: true, slow: true }), wait))]);
}

/* Imágenes de los ejercicios de la rutina: se guardan para verlas sin conexión */
let warmed = "";
function warmImages() {
  try {
    const sw = typeof navigator !== "undefined" && navigator.serviceWorker?.controller;
    if (!sw || !lastRaw) return;
    const c = (lastRaw.clients || []).find((x) => x.userId === lastRaw.sessionUserId);
    const ids = new Set((c?.routine?.days || []).flatMap((d) => d.exercises.map((e) => e.exId)));
    const urls = [];
    for (const id of ids) {
      const ex = LIBRARY.find((e) => e.id === id);
      for (let f = 0; f < (ex?.images || 0); f++) urls.push(exerciseImage(ex, f));
    }
    const key = urls.join("|");
    if (!urls.length || key === warmed) return;
    warmed = key;
    sw.postMessage({ type: "warm", urls });
  } catch { /* nada */ }
}

/* ============================================================
   Cómo se ve cada acción mientras no se sube (idempotentes: si el
   servidor ya la tiene, no se duplica)
   ============================================================ */
const findClient = (d, id) => d.clients.find((c) => c.userId === id);
const has = (arr, id) => (arr || []).some((x) => x.id === id);
const REDUCERS = {
  msg(d, a, op) {
    const id = `m-${op.id}`;
    if (!has(d.messages, id)) d.messages.push({ id, coachId: a.coachId, clientId: a.clientId, from: a.from, text: a.text, at: op.at, read: false, pending: true, exId: a.exId || null, tag: a.tag || null });
  },
  read(d, a) { d.messages.forEach((m) => { if (m.coachId === a.coachId && m.clientId === a.clientId && m.from !== a.reader) m.read = true; }); },
  like(d, a) {
    const p = d.posts.find((x) => x.id === a.postId);
    if (!p) return;
    const on = p.likes.includes(a.userId);
    if (a.value && !on) p.likes = [...p.likes, a.userId];
    if (!a.value && on) p.likes = p.likes.filter((x) => x !== a.userId);
  },
  post(d, a, op) {
    const id = `p-${op.id}`;
    if (!has(d.posts, id)) d.posts.unshift({ id, coachId: a.coachId, authorId: a.authorId, kind: a.kind, text: a.text, at: op.at, likes: [], comments: [], workoutId: null, pending: true });
  },
  comment(d, a, op) {
    const p = d.posts.find((x) => x.id === a.postId);
    const id = `c-${op.id}`;
    if (p && !has(p.comments, id)) p.comments = [...p.comments, { id, authorId: a.authorId, text: a.text, at: op.at, pending: true }];
  },
  delPost(d, a) { d.posts = d.posts.filter((p) => p.id !== a.postId); },
  weight(d, a, op) {
    const c = findClient(d, a.clientId);
    if (c && !(c.weights || []).some((w) => w.date === op.at && w.kg === a.kg)) c.weights = [...(c.weights || []), { date: op.at, kg: a.kg, pending: true }];
  },
  measure(d, a, op) {
    const c = findClient(d, a.clientId);
    const id = `ms-${op.id}`;
    if (!c || has(c.measurements, id)) return;
    const date = a.date ? new Date(`${a.date}T08:00:00`).toISOString() : op.at;
    const row = { id, date, note: a.note || "", pending: true };
    for (const k of ["weight", "fat", "waist", "hip", "chest", "arm", "thigh"]) if (a[k] != null && a[k] !== "") row[k] = +a[k];
    c.measurements = [...(c.measurements || []), row].sort((x, y) => new Date(x.date) - new Date(y.date));
    if (row.weight) c.weights = [...(c.weights || []), { date, kg: row.weight }].sort((x, y) => new Date(x.date) - new Date(y.date));
  },
  delMeasure(d, a) { const c = findClient(d, a.clientId); if (c) c.measurements = (c.measurements || []).filter((m) => m.id !== a.id); },
  note(d, a, op) {
    const c = findClient(d, a.clientId);
    const id = `nt-${op.id}`;
    if (c && !has(c.notes, id)) c.notes = [...(c.notes || []), { id, at: op.at, category: a.category, text: a.text, pinned: false, pending: true }];
  },
  noteUpd(d, a) { const n = findClient(d, a.clientId)?.notes?.find((x) => x.id === a.id); if (n) Object.assign(n, a.patch); },
  noteDel(d, a) { const c = findClient(d, a.clientId); if (c) c.notes = (c.notes || []).filter((n) => n.id !== a.id); },
  routine(d, a) {
    const c = findClient(d, a.clientId);
    if (!c) return;
    if (a.slot === "plan") c.planRoutine = a.routine; else c.routine = a.routine;
  },
  clientUpd(d, a) {
    const c = findClient(d, a.clientId);
    const u = d.users.find((x) => x.id === a.clientId);
    if (u && a.patch.name) u.name = a.patch.name;
    if (u && a.patch.email) u.email = a.patch.email;
    if (c) for (const k of ["goal", "phone", "heightCm", "fee", "billingDay", "active"]) if (a.patch[k] !== undefined) c[k] = a.patch[k];
  },
  profile(d, a) {
    const u = d.users.find((x) => x.id === a.userId);
    if (!u) return;
    for (const [k, v] of Object.entries(a.patch)) if (k !== "notif") u[k] = v;
    if (a.patch.notif) u.notif = { ...(u.notif || {}), ...a.patch.notif };
    if (a.patch.phone !== undefined) { const c = findClient(d, a.userId); if (c) c.phone = a.patch.phone; }
  },
  brand(d, a) {
    const u = d.users.find((x) => x.id === a.userId);
    if (u) u.brand = { ...(u.brand || {}), ...a.patch, ...(a.patch.slug !== undefined ? { slug: a.patch.slug } : {}) };
  },
  pay(d, a, op) {
    const id = `pay-${op.id}`;
    if (has(d.payments, id)) return;
    d.payments.push({ id, coachId: a.coachId, clientId: a.clientId, concept: a.concept, amount: +a.amount, dueDate: new Date(`${a.dueDate}T09:00:00`).toISOString(),
      paidAt: a.paid ? op.at : null, method: a.paid ? a.method || "" : "", pending: true });
  },
  paid(d, a, op) { const p = d.payments.find((x) => x.id === a.id); if (p && !p.paidAt) { p.paidAt = op.at; p.method = a.method || ""; } },
  unpaid(d, a) { const p = d.payments.find((x) => x.id === a.id); if (p) { p.paidAt = null; p.method = ""; } },
  payDel(d, a) { d.payments = d.payments.filter((p) => p.id !== a.id); },
  tpl(d, a, op) {
    const id = `t-${op.id}`;
    if (!has(d.templates, id)) d.templates.unshift({ ...a.routine, name: a.name, id, coachId: a.coachId, createdAt: op.at, pending: true });
  },
  tplDel(d, a) { d.templates = d.templates.filter((t) => t.id !== a.id); },
  exUpd(d, a) {
    const e = d.exercises.find((x) => x.id === a.id);
    if (!e) return;
    const { photo, ...rest } = a.patch;
    Object.assign(e, rest);
    if (photo === null) e.photo = null; else if (typeof photo === "string") e.photo = photo;
  },
  exDel(d, a) { d.exercises = d.exercises.filter((e) => e.id !== a.id); },
  photos(d, a, op) {
    const c = findClient(d, a.clientId);
    if (!c) return;
    a.photos.forEach((p, i) => {
      const id = i ? `ph-${op.id}-${i}` : `ph-${op.id}`;
      if (has(c.photos, id)) return;
      c.photos = [{ id, src: p.src, pose: p.pose, note: p.note || "", date: p.date ? new Date(`${p.date}T08:00:00`).toISOString() : op.at, by: a.by, at: op.at, pending: true }, ...(c.photos || [])];
    });
  },
  photoDel(d, a) { const c = findClient(d, a.clientId); if (c) c.photos = (c.photos || []).filter((p) => p.id !== a.id); },
  finish(d, _a, op) {
    const b = op.body;
    const a = b.session;
    delete d.active[a.clientId];
    if (d.workouts.some((w) => w.ref === a.id)) return;
    const exercises = a.exercises.map((e) => ({ exId: e.exId, target: e.target, sets: e.sets.map((x) => ({ weight: +x.weight || 0, reps: Math.round(+x.reps || 0), done: !!x.done,
      ...(x.drops?.some((dd) => dd.done) ? { drops: x.drops.filter((dd) => dd.done).map((dd) => ({ weight: +dd.weight || 0, reps: +dd.reps || 0, done: true })) } : {}) })) }));
    const durationSec = Math.max(0, Math.round((Date.parse(b.finishedAt || op.at) - Date.parse(a.startedAt)) / 1000)) || 0;
    d.workouts.push({ id: `w-${op.id}`, ref: a.id, clientId: a.clientId, finishedAt: b.finishedAt || op.at, dayId: a.dayId, dayName: a.dayName, routineName: a.routineName,
      startedAt: a.startedAt, durationSec, difficulty: b.difficulty, comment: b.comment || "", prs: [], exercises, pending: true });
  },
  discard(d, a) { if (d.active[a.clientId]?.id === a.id) delete d.active[a.clientId]; },
  consent() { /* se ve al recargar */ },
};
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
function freshSession() { lastRaw = null; confirmed = []; resetStateTag(); kvSet("state", null); }
export async function login(email, password, brandSlug = null) {
  const r = await api("POST", "/api/auth/login", { email: email.trim(), password, ...(brandSlug ? { brandSlug } : {}) });
  if (r.error) return r.offline ? { ...r, error: "Para entrar necesitas conexión a internet. Después puedes usar la app sin señal." } : r;
  freshSession();
  setTokens(r);
  await reload();
  return { ok: true };
}
export async function logout() {
  const rt = (() => { try { return localStorage.getItem("fcp.rt"); } catch { return null; } })();
  const uidNow = me();
  pendingActive = null;
  // Al salir a propósito se borra lo guardado en el equipo (datos y cambios sin subir de esta cuenta)
  ops = ops.filter((o) => o.userId !== uidNow); persistOps();
  syncErrors = syncErrors.filter((e) => e.userId !== uidNow); kvSet("syncErrors", syncErrors);
  saveLocalActive(null);
  freshSession();
  api("POST", "/api/auth/logout", { refreshToken: rt });
  setTokens(null);
  setState(blank("guest"));
}
export async function logoutAll() {
  const r = await api("POST", "/api/auth/logout-all", {});
  if (r.error) return r;
  freshSession();
  setTokens(null);
  setState(blank("guest"));
  return { ok: true };
}
export async function changePassword(current, next) {
  const r = await api("POST", "/api/auth/password", { current, next });
  if (r.error) return r.offline ? { ...r, error: "Necesitas conexión a internet para cambiar la contraseña." } : r;
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
  freshSession();
  setTokens(r);
  await reload();
  return { ok: true };
}
export const redeemCode = (_coachId, code) => act("POST", "/api/coach/redeem", { code });
export const requestSubscription = (data) => act("POST", "/api/coach/subscriptions", data);

/* ============================================================
   Administrador (necesita conexión)
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
const nameOf = (id) => (state.users.find((u) => u.id === id)?.name || "").split(" ")[0];
export async function addClient(_coachId, data) {
  // Necesita conexión: el servidor crea la cuenta y la contraseña temporal
  return act("POST", "/api/coach/clients", {
    name: data.name, email: data.email, goal: data.goal || "", phone: data.phone || "",
    height: data.height ? +data.height : null, weight: data.weight ? +data.weight : null, fee: +data.fee || 0,
    ...(data.trial ? { trial: { days: +data.trial.days, fee: +data.trial.fee || 0 } } : {}),
  });
}
export const updateClient = (clientId, p) => act("PATCH", `/api/coach/clients/${clientId}`, p, { kind: "clientUpd", args: { clientId, patch: p }, label: `Datos de ${nameOf(clientId)}` });
export async function resetClientPassword(clientId) {
  const r = await act("POST", `/api/coach/clients/${clientId}/reset-password`, {});
  return r.error ? r : r.password;
}
export const deleteClient = (clientId) => act("DELETE", `/api/coach/clients/${clientId}`);
export function addBodyWeight(clientId, kgValue) {
  const mine = userById(state, state.sessionUserId);
  const kg = +kgValue;
  const opt = { kind: "weight", args: { clientId, kg }, label: `Peso ${kg} kg` };
  return mine?.role === "client"
    ? act("POST", "/api/client/weight", { kg }, opt)
    : act("POST", `/api/coach/clients/${clientId}/weight`, { kg }, opt);
}
const cleanRoutine = (r) => r && ({
  name: r.name || "", goal: r.goal || "", frequency: +r.frequency || 3, notes: r.notes || "",
  days: r.days.map((d) => ({ id: d.id, name: d.name, exercises: d.exercises.map((e) => ({ uid: e.uid, exId: e.exId, sets: +e.sets || 1, reps: String(e.reps ?? ""), rest: +e.rest || 0, notes: e.notes || "",
    technique: e.technique === "dropset" ? "dropset" : "normal", ...(e.technique === "dropset" && e.drops ? { drops: { count: +e.drops.count, pct: +e.drops.pct, on: e.drops.on === "all" ? "all" : "last" } } : {}),
    ...(e.linkNext ? { linkNext: true } : {}), ...(e.effort?.type ? { effort: { type: e.effort.type, value: +e.effort.value } } : {}),
    ...(e.tempo && /^[0-9X]{1,2}(-[0-9X]{1,2}){2,3}$/i.test(e.tempo) ? { tempo: e.tempo.toUpperCase() } : {}) })) })),
});
export function saveRoutine(clientId, routine, slot = "current") {
  const clean = routine ? cleanRoutine(routine) : null;
  return act("PUT", `/api/coach/clients/${clientId}/routine`, { routine: clean, slot },
    { kind: "routine", args: { clientId, routine: clean, slot }, label: `Rutina de ${nameOf(clientId)}` });
}
/* Plan de prueba: se guardan sin conexión y se aplican al volver la señal (el servidor arma pagos y mensajes) */
export const startTrial = (clientId, days, fee) => act("POST", `/api/coach/clients/${clientId}/trial`, { days: +days, fee: +fee || 0 }, { kind: "trial", label: `Prueba de ${nameOf(clientId)}` });
export const extendTrial = (clientId, days) => act("POST", `/api/coach/clients/${clientId}/trial/extend`, { days: +days }, { kind: "trial", label: `Extender prueba de ${nameOf(clientId)}` });
export const convertTrial = (clientId) => act("POST", `/api/coach/clients/${clientId}/trial/convert`, {}, { kind: "trial", label: `Plan completo de ${nameOf(clientId)}` });
export const cancelTrial = (clientId, pause = true) => act("POST", `/api/coach/clients/${clientId}/trial/cancel`, { pause }, { kind: "trial", label: `Cancelar prueba de ${nameOf(clientId)}` });
export function saveTemplate(coachId, routine, name) {
  const clean = cleanRoutine(routine);
  return act("POST", "/api/coach/templates", { routine: clean, name }, { kind: "tpl", args: { routine: clean, name, coachId: coachId ?? me() }, label: `Plantilla «${name}»` });
}
export const deleteTemplate = (id) => act("DELETE", `/api/coach/templates/${id}`, undefined, { kind: "tplDel", args: { id }, label: "Borrar plantilla" });
export const newUid = () => uid("re-");

export function upsertExercise(_coachId, data) {
  const { id, coachId, images, source, ...body } = data;
  const payload = { ...body, sets: +body.sets || 3, rest: +body.rest || 60, photo: body.photo?.startsWith?.("data:") ? body.photo : body.photo ? undefined : null };
  // Crear un ejercicio nuevo necesita conexión (el servidor le da su número); editarlo, no
  return id
    ? act("PUT", `/api/coach/exercises/${id}`, payload, { kind: "exUpd", args: { id, patch: payload }, label: `Ejercicio «${body.name || ""}»` })
    : act("POST", "/api/coach/exercises", payload);
}
export const deleteExercise = (id) => act("DELETE", `/api/coach/exercises/${id}`, undefined, { kind: "exDel", args: { id }, label: "Borrar ejercicio" });

export function addPayment(coachId, p) {
  const body = { clientId: +p.clientId, concept: p.concept, amount: +p.amount, dueDate: p.dueDate, paid: !!p.paid, method: p.method || "" };
  return act("POST", "/api/coach/payments", body, { kind: "pay", args: { ...body, coachId: coachId ?? me() }, label: `Pago «${p.concept}»` });
}
export const markPaid = (id, method) => act("POST", `/api/coach/payments/${id}/paid`, { method }, { kind: "paid", args: { id, method }, label: "Marcar pagado" });
export const markUnpaid = (id) => act("POST", `/api/coach/payments/${id}/unpaid`, {}, { kind: "unpaid", args: { id }, label: "Marcar pendiente" });
export const deletePayment = (id) => act("DELETE", `/api/coach/payments/${id}`, undefined, { kind: "payDel", args: { id }, label: "Borrar pago" });
export async function generateMonthly() {
  const r = await act("POST", "/api/coach/payments/generate-monthly", {});
  return r.error ? 0 : r.created;
}
export async function updateBrand(coachId, p) {
  const r = await act("PUT", "/api/coach/brand", p, { kind: "brand", args: { userId: coachId ?? me(), patch: p }, label: "Marca" });
  return r.error ? r : { ok: true };
}

/* Reseñas: el asesorado escribe la suya; el entrenador la aprueba (sale en su página) o la rechaza (se borra) */
export const saveMyReview = (r) => act("PUT", "/api/client/review", r);
export const deleteMyReview = () => act("DELETE", "/api/client/review");
export const approveReview = (id) => act("POST", `/api/coach/reviews/${id}/approve`, {});
export const rejectReview = (id) => act("DELETE", `/api/coach/reviews/${id}`);

/* Seguimiento del asesorado */
export const addMeasurement = (clientId, m) => act("POST", `/api/coach/clients/${clientId}/measurements`, m, { kind: "measure", args: { clientId, ...m }, label: `Medidas de ${nameOf(clientId)}` });
export const deleteMeasurement = (clientId, id) => act("DELETE", `/api/coach/clients/${clientId}/measurements/${id}`, undefined, { kind: "delMeasure", args: { clientId, id }, label: "Borrar medidas" });
export function addPhotos(clientId, photos) {
  const mine = userById(state, state.sessionUserId);
  const body = { photos: photos.map((p) => ({ src: p.src, pose: p.pose, note: p.note || "", date: p.date || null })) };
  const opt = { kind: "photos", args: { clientId, photos: body.photos, by: me() }, label: photos.length === 1 ? "Foto de progreso" : `${photos.length} fotos de progreso` };
  return mine?.role === "client" ? act("POST", "/api/client/photos", body, opt) : act("POST", `/api/coach/clients/${clientId}/photos`, body, opt);
}
export function deletePhoto(clientId, id) {
  const mine = userById(state, state.sessionUserId);
  const opt = { kind: "photoDel", args: { clientId, id }, label: "Borrar foto" };
  return mine?.role === "client" ? act("DELETE", `/api/client/photos/${id}`, undefined, opt) : act("DELETE", `/api/coach/clients/${clientId}/photos/${id}`, undefined, opt);
}
export const addNote = (clientId, n) => act("POST", `/api/coach/clients/${clientId}/notes`, n, { kind: "note", args: { clientId, ...n }, label: `Nota de ${nameOf(clientId)}` });
export const updateNote = (clientId, id, p) => act("PATCH", `/api/coach/clients/${clientId}/notes/${id}`, p, { kind: "noteUpd", args: { clientId, id, patch: p }, label: "Editar nota" });
export const deleteNote = (clientId, id) => act("DELETE", `/api/coach/clients/${clientId}/notes/${id}`, undefined, { kind: "noteDel", args: { clientId, id }, label: "Borrar nota" });

/* ============================================================
   Compartido: perfil, mensajes, comunidad
   ============================================================ */
const PROFILE_KEYS = ["name", "body", "photo", "phone", "city", "headline", "years", "instagram", "bio", "specialties", "certifications", "services", "injuries", "birthYear"];
export function updateProfile(userId, p) {
  const body = Object.fromEntries(PROFILE_KEYS.filter((k) => p[k] !== undefined).map((k) => [k, k === "years" || k === "birthYear" ? (p[k] === "" || p[k] == null ? null : +p[k]) : p[k]]));
  return act("PUT", "/api/profile", body, { kind: "profile", args: { userId: userId ?? me(), patch: body }, label: "Perfil" });
}

/** Recordatorio de entrenamiento del asesorado: { on, days: [0..6], time: "18:00" } */
export const saveReminder = (reminder) => act("PUT", "/api/profile", { notif: { reminder } }, { kind: "profile", args: { userId: me(), patch: { notif: { reminder } } }, label: "Recordatorio" });

/** Inscripción desde el enlace del entrenador: crea la cuenta y entra. */
export async function signupWithCoach(data) {
  const r = await api("POST", "/api/public/signup", data);
  if (r.error) return r;
  freshSession();
  setTokens(r);
  await reload();
  return { ok: true };
}

/* Administrador: estado del sistema y errores */
export const fetchSystem = (range = "1h") => api("GET", `/api/admin/system?range=${range}`);
export const clearErrors = (fingerprint) => api("DELETE", `/api/admin/system/errors${fingerprint ? `?fingerprint=${fingerprint}` : ""}`);
export const runJobsNow = () => api("POST", "/api/admin/system/jobs", {});
export const runChecksNow = () => api("POST", "/api/admin/system/check", {});

export function sendMessage(coachId, clientId, from, text, ref = null) {
  // Se muestra al instante y se sube apenas hay señal
  const tagged = ref?.exId ? { exId: ref.exId, tag: ref.tag || "comentario" } : {};
  const mine = userById(state, state.sessionUserId);
  const clean = text.trim();
  return act("POST", "/api/messages", { text: clean, ...tagged, ...(mine?.role === "coach" ? { clientId } : {}) },
    { kind: "msg", args: { coachId, clientId, from, text: clean, ...tagged }, label: `Mensaje: «${clean.slice(0, 40)}»` });
}
export function markThreadRead(coachId, clientId, readerId) {
  if (!state.messages.some((m) => m.coachId === coachId && m.clientId === clientId && m.from !== readerId && !m.read)) return;
  if (myOps().some((o) => o.kind === "read" && o.args.coachId === coachId && o.args.clientId === clientId)) return;
  const mine = userById(state, state.sessionUserId);
  act("POST", "/api/messages/read", mine?.role === "coach" ? { clientId } : {}, { kind: "read", args: { coachId, clientId, reader: readerId }, label: "Mensajes leídos" });
}
export function addPost(coachId, authorId, text, kind = "post") {
  return act("POST", "/api/posts", { text, kind }, { kind: "post", args: { coachId, authorId: authorId ?? me(), text: text.trim(), kind }, label: kind === "challenge" ? "Reto" : "Publicación" });
}
export function toggleLike(postId, userId) {
  const p = state.posts.find((x) => x.id === postId);
  const value = !(p?.likes || []).includes(userId);
  return act("POST", `/api/posts/${postId}/like`, {}, { kind: "like", args: { postId, userId, value }, label: value ? "Me gusta" : "Quitar me gusta" });
}
export const addComment = (postId, authorId, text) => act("POST", `/api/posts/${postId}/comments`, { text }, { kind: "comment", args: { postId, authorId: authorId ?? me(), text: text.trim() }, label: "Comentario" });
export const deletePost = (postId) => act("DELETE", `/api/posts/${postId}`, undefined, { kind: "delPost", args: { postId }, label: "Borrar publicación" });

/* Datos personales del asesorado (necesitan conexión) */
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
  ops = ops.filter((o) => o.userId !== me()); persistOps();
  freshSession();
  setTokens(null);
  setState(blank("guest"));
  return { ok: true };
}
/* ============================================================
   Entrenamiento en vivo: se edita al instante, queda guardado en el equipo
   y se copia al servidor cada pocos segundos (si se cierra la app, se retoma;
   sin señal se sigue entrenando y se sube después).
   ============================================================ */
let saveTimer = null;
function queueActiveSave(a) {
  pendingActive = a;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushActive, 1200);
}
let activeRetry = null;
async function flushActive() {
  const a = pendingActive;
  if (!a) return;
  clearTimeout(activeRetry);
  const r = await api("PUT", "/api/client/workout/active", a, { timeout: 15e3 });
  if (!r.error) { if (pendingActive === a) pendingActive = null; return; }
  if (r.offline || r.status >= 500 || r.status === 429) activeRetry = setTimeout(() => { if (pendingActive) flushActive(); }, 30e3); // se reintenta solo
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
        target: { sets: nSets, reps: String(e.reps), rest: +e.rest || 0, ...(drop ? { drop } : {}),
          ...(e.linkNext ? { linkNext: true } : {}), ...(e.effort?.type ? { effort: e.effort } : {}), ...(e.tempo ? { tempo: e.tempo } : {}) },
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
  saveLocalActive(a);
  pendingActive = a;
  flushActive();
}
export function updateWorkout(clientId, fn) {
  if (!state.active[clientId]) return;
  const next = structuredClone(state.active[clientId]);
  fn(next);
  patch((d) => { d.active[clientId] = next; });
  saveLocalActive(next);
  queueActiveSave(next);
}
export async function discardWorkout(clientId) {
  const a = state.active[clientId];
  clearTimeout(saveTimer); pendingActive = null; saveLocalActive(null);
  patch((d) => { delete d.active[clientId]; });
  await act("DELETE", "/api/client/workout/active", undefined, { kind: "discard", args: { clientId, id: a?.id }, label: "Descartar entrenamiento" });
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
  const finishedAt = nowISO();
  const body = { session: a, difficulty, comment, share, prName, finishedAt };
  pendingActive = null; saveLocalActive(null);
  const r = await act("POST", "/api/client/workout/finish", body, { kind: "finish", label: `Entrenamiento ${a.dayName || ""}`.trim(), at: finishedAt, wait: 9000 });
  if (r.queued) {
    // Sin señal: queda en el equipo (ya aparece en el historial) y se sube solo cuando vuelva la conexión
    const done = a.exercises.reduce((t, e) => t + e.sets.filter((x) => x.done).length, 0);
    return { queued: true, durationSec: Math.round((Date.now() - Date.parse(a.startedAt)) / 1000), done, volume: sessionVolume(a), prs: [], comment };
  }
  return r;
}

export { repsLow };
