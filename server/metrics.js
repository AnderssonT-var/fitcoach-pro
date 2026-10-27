/* Monitor del sistema: mide todo lo que pasa en el servidor para el panel «Sistema».
   - Cada solicitud: ruta, código, tiempo y bytes.
   - Base de datos: consultas, tiempo, consultas lentas, errores y conexiones del pool.
   - Proceso: CPU, memoria, retraso del bucle de eventos, solicitudes en curso.
   - Seguridad, sincronización, notificaciones y tareas programadas.
   Cada minuto se guarda un resumen en la base (metrics_log) para ver la historia
   aunque el servidor se reinicie o haya varios procesos. */
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { knex, J, S } from "./db.js";
import { config } from "./config.js";

export const BOOT_ID = crypto.randomBytes(3).toString("hex");
export const PROC = `${os.hostname().slice(0, 20)}:${process.pid}:${BOOT_ID}`;
export const STARTED = Date.now();
export const APP_VERSION = (() => { try { return JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version; } catch { return "?"; } })();

/* ---------- histograma de tiempos (ms) ---------- */
export const LAT_EDGES = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, Infinity];
const latIndex = (ms) => { let i = 0; while (ms > LAT_EDGES[i]) i++; return i; };
/** Percentil aproximado a partir del histograma (interpolación dentro del tramo). */
export function pct(hist, p) {
  const total = hist.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const goal = total * p;
  let acc = 0;
  for (let i = 0; i < hist.length; i++) {
    if (acc + hist[i] >= goal) {
      const lo = i ? LAT_EDGES[i - 1] : 0, hi = Number.isFinite(LAT_EDGES[i]) ? LAT_EDGES[i] : lo * 2;
      return Math.round(lo + (hi - lo) * ((goal - acc) / hist[i]));
    }
    acc += hist[i];
  }
  return LAT_EDGES[LAT_EDGES.length - 2];
}

const counters = () => ({
  auth: { ok: 0, fail: 0, locked: 0, refresh: 0, refreshFail: 0, reuse: 0, signup: 0 },
  sync: { ops: 0, replay: 0, conflict: 0, reported: 0, failed: 0 },
  push: { ok: 0, fail: 0, gone: 0 },
  state: { full: 0, notModified: 0, memo: 0, keptHistory: 0, buildMs: 0, maxBuildMs: 0, bytes: 0, queued: 0, shed: 0 },
  db: { n: 0, ms: 0, max: 0, slow: 0, err: 0 },
  pw: { n: 0, ms: 0, queued: 0, max: 0 },
});
function newBucket(t) {
  return { t, req: 0, s2: 0, s3: 0, s4: 0, s5: 0, r429: 0, r503: 0, lat: LAT_EDGES.map(() => 0), latSum: 0, latMax: 0, bytes: 0,
    routes: new Map(), users: { coach: new Set(), client: new Set(), admin: new Set() }, inflightMax: 0, ...counters() };
}
const minuteOf = (ms = Date.now()) => Math.floor(ms / 60e3) * 60e3;
let cur = newBucket(minuteOf());
const ring = []; // últimos 60 minutos (resumidos) de este proceso
let inflight = 0;

function bucket() {
  const m = minuteOf();
  if (m !== cur.t) rollover(m);
  return cur;
}

/* ---------- bucle de eventos, CPU ---------- */
const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();
let lagNow = 0; // retraso actual (ms), suavizado: se usa para proteger el servidor
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const drift = Math.max(0, now - lastTick - 250);
  lastTick = now;
  lagNow = lagNow * 0.7 + drift * 0.3;
}, 250).unref();
export const eventLoopLag = () => lagNow;

let cpuPrev = process.cpuUsage(), cpuAt = Date.now(), cpuPct = 0;
setInterval(() => {
  const d = process.cpuUsage(cpuPrev), now = Date.now();
  cpuPct = Math.round(((d.user + d.system) / 1000 / (now - cpuAt)) * 100);
  cpuPrev = process.cpuUsage(); cpuAt = now;
}, 5000).unref();
export const cpuPercent = () => cpuPct;

/* ---------- solicitudes HTTP ---------- */
const ID_SEG = /^(\d+|[a-z]{1,4}-[\w-]{5,}|[A-Za-z0-9_-]{20,})$/;
export const routeKey = (method, url) => {
  const p = String(url).split("?")[0].split("/").map((s) => (ID_SEG.test(s) ? ":id" : s)).join("/");
  return `${method} ${p.slice(0, 80)}`;
};

export function httpMetrics(req, res, next) {
  const t0 = process.hrtime.bigint();
  inflight++;
  const b0 = bucket();
  if (inflight > b0.inflightMax) b0.inflightMax = inflight;
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    inflight--;
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const b = bucket();
    const st = res.statusCode;
    b.req++;
    if (st >= 500) b.s5++; else if (st >= 400) b.s4++; else if (st >= 300) b.s3++; else b.s2++;
    if (st === 429) b.r429++;
    if (st === 503) b.r503++;
    b.lat[latIndex(ms)]++;
    b.latSum += ms;
    if (ms > b.latMax) b.latMax = ms;
    b.bytes += +res.getHeader("content-length") || 0;
    const key = routeKey(req.method, req.originalUrl || req.url);
    const r = b.routes.get(key) || { n: 0, ms: 0, max: 0, err: 0, slow: 0 };
    r.n++; r.ms += ms; if (ms > r.max) r.max = ms; if (st >= 500) r.err++; if (ms > 1000) r.slow++;
    b.routes.set(key, r);
    const u = req.user;
    if (u && b.users[u.role]) b.users[u.role].add(u.id);
  };
  res.on("finish", end);
  res.on("close", end);
  next();
}
export const inFlight = () => inflight;

/** Contadores de eventos: count("auth.fail"), count("sync.replay", 3)… */
export function count(path, n = 1) {
  const [group, key] = path.split(".");
  const b = bucket();
  if (b[group] && key in b[group]) b[group][key] += n;
}
export function addTime(group, ms) {
  const b = bucket();
  const g = b[group];
  if (!g) return;
  if (group === "state") { g.buildMs += ms; if (ms > g.maxBuildMs) g.maxBuildMs = ms; return; }
  g.n++; g.ms += ms; if (ms > g.max) g.max = ms;
}

/* ---------- base de datos ---------- */
const pendingQ = new Map();
const slowQueries = []; // las más recientes
const SLOW_MS = 300;
const cleanSql = (sql) => String(sql || "").replace(/\s+/g, " ").replace(/in \((\?, )+\?\)/gi, "in (…)").slice(0, 240);
knex.on("query", (q) => { if (q.__knexQueryUid) pendingQ.set(q.__knexQueryUid, { t: performance.now(), sql: q.sql }); });
const finishQ = (q, failed) => {
  const p = pendingQ.get(q?.__knexQueryUid);
  if (!p) return;
  pendingQ.delete(q.__knexQueryUid);
  const ms = performance.now() - p.t;
  const db = bucket().db;
  db.n++; db.ms += ms; if (ms > db.max) db.max = ms;
  if (failed) db.err++;
  if (ms > SLOW_MS) {
    db.slow++;
    slowQueries.unshift({ at: new Date().toISOString(), ms: Math.round(ms), sql: cleanSql(p.sql), proc: PROC });
    if (slowQueries.length > 40) slowQueries.length = 40;
  }
};
knex.on("query-response", (_r, q) => finishQ(q, false));
knex.on("query-error", (_e, q) => finishQ(q, true));
setInterval(() => { const old = performance.now() - 120e3; for (const [k, v] of pendingQ) if (v.t < old) pendingQ.delete(k); }, 60e3).unref();

export function poolStats() {
  const p = knex.client?.pool;
  if (!p?.numUsed) return null;
  return { used: p.numUsed(), free: p.numFree(), pending: p.numPendingAcquires(), creating: p.numPendingCreates?.() || 0, max: p.max };
}
export const recentSlowQueries = () => slowQueries;

/* ---------- resumen por minuto ---------- */
function memInfo() {
  const m = process.memoryUsage();
  return { rss: Math.round(m.rss / 1048576), heap: Math.round(m.heapUsed / 1048576), heapTotal: Math.round(m.heapTotal / 1048576), ext: Math.round(m.external / 1048576) };
}
function compact(b) {
  const routes = [...b.routes.entries()].sort((a, c) => c[1].ms - a[1].ms).slice(0, 25)
    .map(([k, r]) => [k, r.n, Math.round(r.ms), Math.round(r.max), r.err, r.slow]);
  const lag = { p50: Math.round(loop.percentile(50) / 1e6), p99: Math.round(loop.percentile(99) / 1e6), max: Math.round(loop.max / 1e6) };
  loop.reset();
  return {
    t: b.t, req: b.req, s2: b.s2, s3: b.s3, s4: b.s4, s5: b.s5, r429: b.r429, r503: b.r503, lat: b.lat, latSum: Math.round(b.latSum), latMax: Math.round(b.latMax),
    bytes: b.bytes, routes, users: { coach: b.users.coach.size, client: b.users.client.size, admin: b.users.admin.size },
    inflightMax: b.inflightMax, auth: b.auth, sync: b.sync, push: b.push, state: { ...b.state, buildMs: Math.round(b.state.buildMs), maxBuildMs: Math.round(b.state.maxBuildMs) },
    db: { ...b.db, ms: Math.round(b.db.ms), max: Math.round(b.db.max) }, pw: { ...b.pw, ms: Math.round(b.pw.ms), max: Math.round(b.pw.max) },
    cpu: cpuPct, mem: memInfo(), lag, pool: poolStats(), load: os.loadavg().map((x) => Math.round(x * 100) / 100),
  };
}
function rollover(m) {
  const done = compact(cur);
  ring.push(done);
  if (ring.length > 60) ring.shift();
  cur = newBucket(m);
  persist("min", done);
}
// Aunque no haya tráfico se cierra el minuto (para tener CPU y memoria en la historia)
setInterval(() => bucket(), 10e3).unref();

let persistOk = true;
async function persist(kind, data) {
  try {
    await knex("metrics_log").insert({ at: new Date(data.t || Date.now()).toISOString(), kind, proc: PROC, data: S(data) });
    persistOk = true;
  } catch { persistOk = false; /* la tabla aún no existe o la base no responde */ }
}

/* Resumen por hora (se conserva 30 días) y limpieza */
let lastHour = Math.floor(Date.now() / 3600e3);
setInterval(async () => {
  const h = Math.floor(Date.now() / 3600e3);
  if (h === lastHour) return;
  const from = new Date(lastHour * 3600e3).toISOString(), to = new Date(h * 3600e3).toISOString();
  lastHour = h;
  try {
    const rows = await knex("metrics_log").where({ kind: "min", proc: PROC }).where("at", ">=", from).where("at", "<", to).select("data");
    if (rows.length) await persist("hour", { ...mergeMinutes(rows.map((r) => J(r.data, {}))), t: Date.parse(from) });
    await knex("metrics_log").where({ kind: "min" }).where("at", "<", new Date(Date.now() - 48 * 3600e3).toISOString()).delete();
    await knex("metrics_log").where("at", "<", new Date(Date.now() - 30 * 864e5).toISOString()).delete();
  } catch { /* se reintenta la próxima hora */ }
}, 60e3).unref();

/** Une varios resúmenes (de minutos o de procesos) en uno solo. */
export function mergeMinutes(list) {
  const out = { req: 0, s2: 0, s3: 0, s4: 0, s5: 0, r429: 0, r503: 0, lat: LAT_EDGES.map(() => 0), latSum: 0, latMax: 0, bytes: 0, inflightMax: 0,
    users: { coach: 0, client: 0, admin: 0 }, ...counters(), cpu: 0, mem: { rss: 0, heap: 0 }, lag: { p50: 0, p99: 0, max: 0 }, n: 0, routes: [] };
  const routes = new Map();
  for (const m of list) {
    if (!m) continue;
    out.n++;
    for (const k of ["req", "s2", "s3", "s4", "s5", "r429", "r503", "latSum", "bytes"]) out[k] += m[k] || 0;
    out.latMax = Math.max(out.latMax, m.latMax || 0);
    out.inflightMax = Math.max(out.inflightMax, m.inflightMax || 0);
    (m.lat || []).forEach((v, i) => { out.lat[i] += v; });
    for (const g of ["auth", "sync", "push", "state", "db", "pw"]) for (const k of Object.keys(out[g])) {
      if (k === "max" || k === "maxBuildMs") out[g][k] = Math.max(out[g][k], m[g]?.[k] || 0); else out[g][k] += m[g]?.[k] || 0;
    }
    for (const r of ["coach", "client", "admin"]) out.users[r] = Math.max(out.users[r], m.users?.[r] || 0);
    out.cpu = Math.max(out.cpu, m.cpu || 0);
    out.mem.rss = Math.max(out.mem.rss, m.mem?.rss || 0);
    out.mem.heap = Math.max(out.mem.heap, m.mem?.heap || 0);
    for (const k of ["p50", "p99", "max"]) out.lag[k] = Math.max(out.lag[k], m.lag?.[k] || 0);
    for (const [k, n, ms, max, err, slow] of m.routes || []) {
      const r = routes.get(k) || [k, 0, 0, 0, 0, 0];
      r[1] += n; r[2] += ms; r[3] = Math.max(r[3], max); r[4] += err; r[5] += slow || 0;
      routes.set(k, r);
    }
  }
  out.routes = [...routes.values()].sort((a, b) => b[2] - a[2]).slice(0, 40);
  return out;
}

/** Lo que pasó en este proceso en los últimos `min` minutos (incluye el minuto en curso). */
export function recent(min = 5) {
  const live = { ...compactPeek(cur) };
  return mergeMinutes([...ring.slice(-min + 1), live]);
}
function compactPeek(b) {
  return { req: b.req, s2: b.s2, s3: b.s3, s4: b.s4, s5: b.s5, r429: b.r429, r503: b.r503, lat: b.lat, latSum: b.latSum, latMax: b.latMax, bytes: b.bytes,
    inflightMax: b.inflightMax, users: { coach: b.users.coach.size, client: b.users.client.size, admin: b.users.admin.size },
    auth: b.auth, sync: b.sync, push: b.push, state: b.state, db: b.db, pw: b.pw, cpu: cpuPct, mem: memInfo(), lag: { p50: 0, p99: Math.round(lagNow), max: Math.round(lagNow) },
    routes: [...b.routes.entries()].map(([k, r]) => [k, r.n, r.ms, r.max, r.err, r.slow]) };
}

export function processInfo() {
  const heapLimit = Math.round((process.constrainedMemory?.() || os.totalmem()) / 1048576);
  return {
    proc: PROC, pid: process.pid, version: APP_VERSION, node: process.version, startedAt: new Date(STARTED).toISOString(), uptimeSec: Math.round((Date.now() - STARTED) / 1000),
    cpu: cpuPct, cores: os.availableParallelism?.() || os.cpus().length, load: os.loadavg().map((x) => Math.round(x * 100) / 100),
    mem: memInfo(), memLimitMb: +process.env.MEMORY_LIMIT_MB || heapLimit, sysFreeMb: Math.round(os.freemem() / 1048576), sysTotalMb: Math.round(os.totalmem() / 1048576),
    lagMs: Math.round(lagNow), inflight, pool: poolStats(), persistOk, db: config.db.client,
  };
}

/* ---------- arranque: queda registrado (para detectar reinicios y caídas) ---------- */
export function recordBoot() {
  persist("boot", { t: Date.now(), version: APP_VERSION, node: process.version, pid: process.pid });
}
/** Apagado ordenado (publicación nueva o reinicio del hosting): no cuenta como caída. */
export const recordStop = (sig) => persist("stop", { t: Date.now(), sig, pid: process.pid });

/* ---------- estado de las tareas programadas (visible desde cualquier proceso) ---------- */
export async function trackJob(name, fn) {
  const t0 = Date.now();
  let result, error = null;
  try { result = await fn(); } catch (e) { error = e?.message || String(e); }
  const info = { name, at: new Date().toISOString(), ms: Date.now() - t0, ok: !error && !result?.error, error: error || result?.error || null, result: result ?? null, proc: PROC };
  try {
    const key = `job:${name}`;
    const prev = J((await knex("settings").where({ key }).first())?.value, {});
    const next = { ...info, lastOk: info.ok ? info.at : prev.lastOk || null, fails: info.ok ? 0 : (prev.fails || 0) + 1, runs: (prev.runs || 0) + 1 };
    const n = await knex("settings").where({ key }).update({ value: S(next) });
    if (!n) await knex("settings").insert({ key, value: S(next) }).catch(() => {});
  } catch { /* sin base: se verá como tarea sin correr */ }
  if (error) throw new Error(error);
  return result;
}
