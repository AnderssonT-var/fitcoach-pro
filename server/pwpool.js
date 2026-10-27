/* Contraseñas en hilos aparte.
   bcrypt es lento a propósito (≈0,25 s por contraseña). Si se calcula en el hilo principal,
   100 inicios de sesión a la vez congelan el servidor para todos. Aquí se hace en
   hilos de trabajo y el servidor sigue atendiendo mientras tanto. */
import os from "node:os";
import { Worker } from "node:worker_threads";
import bcrypt from "bcryptjs";
import { HttpError } from "./util.js";
import { addTime, count } from "./metrics.js";

const SIZE = Math.max(1, Math.min(+process.env.PW_THREADS || 2, (os.availableParallelism?.() || os.cpus().length)));
const MAX_QUEUE = 400;



let workers = [];
let disabled = false;
const queue = [];
const jobs = new Map();
let seq = 0;

function spawn() {
  const w = new Worker(new URL("./pwworker.cjs", import.meta.url));
  w.busy = null;
  w.on("message", ({ id, r, e }) => {
    const j = jobs.get(id);
    jobs.delete(id);
    w.busy = null;
    w.unref(); // sin trabajo no impide que el proceso termine (scripts)
    if (j) {
      addTime("pw", Date.now() - j.t0);
      e ? j.reject(new Error(e)) : j.resolve(r);
    }
    pump();
  });
  w.on("error", (err) => {
    console.error("[contraseñas] hilo con error:", err.message);
    if (w.busy) { const j = jobs.get(w.busy); jobs.delete(w.busy); j?.reject(err); }
    workers = workers.filter((x) => x !== w);
    if (!workers.length && !spawnSafe()) disabled = true;
    pump();
  });
  w.unref(); // después de los listeners (agregarlos lo vuelve a «ref»)
  return w;
}
function spawnSafe() {
  try { workers.push(spawn()); return true; } catch (e) { console.warn("[contraseñas] sin hilos, se usa el hilo principal:", e.message); return false; }
}

function pump() {
  for (const w of workers) {
    if (w.busy || !queue.length) continue;
    const j = queue.shift();
    w.busy = j.id;
    w.ref(); // mientras trabaja, el proceso espera su respuesta
    jobs.set(j.id, j);
    w.postMessage(j.msg);
  }
}

function run(op, a, b, cost) {
  if (!workers.length && !disabled) { for (let i = 0; i < SIZE; i++) if (!spawnSafe()) { disabled = !workers.length; break; } }
  if (disabled) return op === "hash" ? bcrypt.hash(a, cost) : bcrypt.compare(a, b);
  if (queue.length >= MAX_QUEUE) {
    return Promise.reject(new HttpError(503, "Hay muchas personas entrando a la vez. Intenta de nuevo en unos segundos.", { code: "busy", retryAfter: 5 }));
  }
  return new Promise((resolve, reject) => {
    const id = ++seq;
    queue.push({ id, msg: { id, op, a, b, cost }, resolve, reject, t0: Date.now() });
    if (queue.length > 1) count("pw.queued");
    pump();
  });
}

export const hashInPool = (pw, cost) => run("hash", pw, null, cost);
export const compareInPool = (pw, hash) => run("compare", pw, hash);
export const poolInfo = () => ({ threads: workers.length, queue: queue.length, busy: workers.filter((w) => w.busy).length, disabled });
