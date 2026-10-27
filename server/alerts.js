/* Alertas automáticas: cada 30 segundos se revisa la salud del sistema.
   Si algo se sale de lo normal se abre una alerta, se avisa al administrador
   (como mucho una vez cada 30 minutos por tipo) y queda en el historial. */
import fs from "node:fs";
import v8 from "node:v8";
import { knex, J, S } from "./db.js";
import { config } from "./config.js";
import { PROC, STARTED, pct, processInfo, recent } from "./metrics.js";
import { loadLevel } from "./load.js";

const active = new Map(); // key -> { key, level, title, detail, since, at }
export const activeAlerts = () => [...active.values()].sort((a, b) => rank(b.level) - rank(a.level));
const rank = (l) => ({ critical: 3, warning: 2, info: 1 }[l] || 0);

let cpuHigh = 0;
let slowChecks = { at: 0, data: {} };

async function slowFacts() {
  // Consultas que no hace falta repetir cada 30 s
  if (Date.now() - slowChecks.at < 120e3) return slowChecks.data;
  const d = {};
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  // Caídas: arranques sin un apagado ordenado antes (publicar una versión nueva no cuenta)
  try {
    const rows = await knex("metrics_log").whereIn("kind", ["boot", "stop"]).where("at", ">=", hourAgo).select("kind");
    const boots = rows.filter((r) => r.kind === "boot").length, stops = rows.filter((r) => r.kind === "stop").length;
    d.boots = Math.max(0, boots - stops - 1);
  } catch { d.boots = 0; }
  try {
    d.subsWaiting = +(await knex("subscriptions").where({ status: "pending" }).where("created_at", "<", new Date(Date.now() - 24 * 3600e3).toISOString()).count({ n: "*" }).first()).n;
  } catch { d.subsWaiting = 0; }
  try {
    // Equipos con cambios guardados que no se vuelven a conectar hace más de un día
    d.stuck = +(await knex("devices").where("pending", ">", 0).where("seen_at", ">=", new Date(Date.now() - 14 * 864e5).toISOString())
      .where("seen_at", "<", new Date(Date.now() - 24 * 3600e3).toISOString()).count({ n: "*" }).first()).n;
  } catch { d.stuck = 0; }
  try {
    const job = J((await knex("settings").where({ key: "job:avisos" }).first())?.value, null);
    d.job = job;
  } catch { d.job = null; }
  try {
    if (fs.statfsSync) {
      const st = fs.statfsSync(config.uploadDir);
      d.diskFreePct = Math.round((st.bavail / st.blocks) * 100);
      d.diskFreeMb = Math.round((st.bavail * st.bsize) / 1048576);
    }
  } catch { /* sin datos del disco */ }
  slowChecks = { at: Date.now(), data: d };
  return d;
}

export async function evaluate() {
  const out = [];
  const add = (key, level, title, detail = "") => out.push({ key, level, title, detail });
  const r = recent(5);
  const p = processInfo();

  // Base de datos
  let dbMs = null;
  try { const t = Date.now(); await knex.raw("select 1"); dbMs = Date.now() - t; }
  catch (e) { add("db_down", "critical", "La base de datos no responde", String(e.message).slice(0, 200)); }
  if (dbMs != null && dbMs > 1000) add("db_slow", "warning", "La base de datos responde lento", `${dbMs} ms en una consulta mínima.`);
  if (p.pool && p.pool.pending > 5) add("db_pool", "warning", "Faltan conexiones a la base de datos", `${p.pool.pending} consultas esperando una conexión (usadas ${p.pool.used}/${p.pool.max}).`);
  if (r.db.slow >= 20) add("slow_queries", "warning", "Muchas consultas lentas", `${r.db.slow} consultas de más de 300 ms en 5 minutos.`);
  if (r.db.err >= 5) add("db_errors", "warning", "Consultas con error", `${r.db.err} consultas fallaron en 5 minutos.`);

  // Respuesta del servidor
  const p95 = pct(r.lat, 0.95);
  if (r.req >= 30 && p95 > 4000) add("latency", "critical", "El servidor responde muy lento", `El 5% más lento tarda más de ${(p95 / 1000).toFixed(1)} s.`);
  else if (r.req >= 30 && p95 > 1500) add("latency", "warning", "El servidor responde lento", `El 5% más lento tarda ${(p95 / 1000).toFixed(1)} s.`);
  if (r.s5 >= 5 && r.s5 / Math.max(1, r.req) > 0.02) add("errors_5xx", "critical", "Errores del servidor", `${r.s5} de ${r.req} solicitudes fallaron (${Math.round((r.s5 / r.req) * 100)}%) en 5 minutos.`);
  if (p.lagMs > 2000) add("event_loop", "critical", "El servidor está trabado", `Retraso de ${p.lagMs} ms para atender (normal: menos de 50 ms).`);
  else if (p.lagMs > 500) add("event_loop", "warning", "El servidor está sobrecargado", `Retraso de ${p.lagMs} ms para atender.`);
  if (loadLevel() === 2 || r.state.shed > 0 || r.r503 > 0) add("shedding", "warning", "Protección por carga activada", `Se pidió a las apps esperar ${r.state.shed + r.r503} veces en 5 minutos. Nadie pierde datos: reintentan solas.`);

  // Recursos
  if (p.cpu > 90) cpuHigh++; else cpuHigh = 0;
  if (cpuHigh >= 6) add("cpu", "warning", "Uso de CPU muy alto", `${p.cpu}% durante más de 3 minutos.`);
  const heap = v8.getHeapStatistics();
  if (heap.used_heap_size / heap.heap_size_limit > 0.9) add("heap", "critical", "La memoria del proceso está por agotarse", `${Math.round(heap.used_heap_size / 1048576)} de ${Math.round(heap.heap_size_limit / 1048576)} MB.`);
  if (p.mem.rss > p.memLimitMb * 0.85) add("memory", "warning", "Memoria alta", `${p.mem.rss} MB de ${p.memLimitMb} MB.`);

  // Seguridad
  if (r.auth.fail >= 30) add("login_fail", "warning", "Muchos inicios de sesión fallidos", `${r.auth.fail} en 5 minutos: puede ser alguien probando contraseñas.`);
  if (r.auth.reuse > 0) add("token_reuse", "warning", "Se reusó una sesión vieja", "Posible robo de sesión: se cerraron las sesiones de esa cuenta.");
  if (r.r429 >= 100) add("rate_limit", "info", "Muchas solicitudes limitadas", `${r.r429} respuestas «demasiadas solicitudes» en 5 minutos.`);

  // Notificaciones y sincronización
  if (r.push.fail >= 10 && r.push.fail / Math.max(1, r.push.ok + r.push.fail) > 0.5) add("push", "warning", "Las notificaciones están fallando", `${r.push.fail} fallidas y ${r.push.ok} enviadas en 5 minutos.`);
  if (r.sync.failed >= 10) add("sync_fail", "warning", "Acciones sin conexión rechazadas", `${r.sync.failed} acciones guardadas en celulares no se pudieron aplicar en 5 minutos.`);

  // Errores de la app y del servidor
  try {
    const since = new Date(Date.now() - 15 * 60e3).toISOString();
    const rows = await knex("error_log").where("at", ">=", since).select("source").count({ n: "*" }).groupBy("source");
    const app = +(rows.find((x) => x.source === "app")?.n || 0), srv = +(rows.find((x) => x.source === "server")?.n || 0);
    if (app >= 20) add("app_errors", "warning", "Muchos errores en las apps", `${app} errores reportados por las apps en 15 minutos.`);
    if (srv >= 10) add("server_errors", "warning", "Errores internos repetidos", `${srv} errores del servidor en 15 minutos.`);
  } catch { /* sin tabla */ }

  // Lo que no hace falta revisar tan seguido
  const d = await slowFacts();
  const upMin = (Date.now() - STARTED) / 60e3;
  if (upMin > 15 && (!d.job || Date.now() - Date.parse(d.job.at) > 20 * 60e3)) add("jobs_stale", "warning", "Las tareas programadas no corren", d.job ? `La última fue ${new Date(d.job.at).toLocaleString("es-EC")}.` : "Aún no se registra ninguna ejecución.");
  if (d.job && d.job.fails >= 3) add("jobs_fail", "warning", "Las tareas programadas fallan", d.job.error || "");
  if (d.boots >= 2) add("restarts", "warning", "El servidor se cayó y reinició", `${d.boots} reinicios inesperados en la última hora (sin contar publicaciones): revisa los registros del hosting.`);
  if (d.diskFreePct != null && d.diskFreePct < 3) add("disk", "critical", "Disco casi lleno", `Quedan ${d.diskFreeMb} MB (${d.diskFreePct}%).`);
  else if (d.diskFreePct != null && d.diskFreePct < 10) add("disk", "warning", "Poco espacio en disco", `Quedan ${d.diskFreeMb} MB (${d.diskFreePct}%).`);
  if (d.subsWaiting > 0) add("subs_waiting", "info", "Pagos de suscripción por revisar", `${d.subsWaiting} ${d.subsWaiting === 1 ? "lleva" : "llevan"} más de un día esperando.`);
  if (d.stuck > 0) add("devices_stuck", "info", "Equipos con cambios sin subir", `${d.stuck} ${d.stuck === 1 ? "equipo tiene" : "equipos tienen"} cambios guardados y no se conecta${d.stuck === 1 ? "" : "n"} hace más de un día (se suben solos al volver la señal).`);

  // Abrir / cerrar alertas
  const now = new Date().toISOString();
  const keys = new Set(out.map((a) => a.key));
  for (const a of out) {
    const prev = active.get(a.key);
    if (!prev || prev.level !== a.level) {
      active.set(a.key, { ...a, since: prev?.since || now, at: now });
      logAlert({ ...a, state: "open" });
      if (a.level !== "info") warnAdmins(a);
    } else active.set(a.key, { ...prev, detail: a.detail, title: a.title, at: now });
  }
  for (const [k, a] of active) {
    if (keys.has(k)) continue;
    active.delete(k);
    logAlert({ key: k, level: a.level, title: a.title, detail: "Se normalizó.", state: "resolved", since: a.since });
  }
  return activeAlerts();
}

function logAlert(a) {
  knex("metrics_log").insert({ at: new Date().toISOString(), kind: "alert", proc: PROC, data: S(a) }).catch(() => {});
}
async function warnAdmins(a) {
  try {
    const { notify, once } = await import("./notify.js");
    if (!(await once(`alert:${a.key}:${Math.floor(Date.now() / 1800e3)}`))) return;
    const admins = await knex("users").where({ role: "admin" }).select("id");
    for (const u of admins) notify(u.id, { title: `${a.level === "critical" ? "🔴" : "🟠"} ${a.title}`, body: a.detail.slice(0, 160), page: "sistema", tag: `alert-${a.key}`, kind: "error" }).catch(() => {});
  } catch { /* sin notificaciones */ }
}

export function startAlerts() {
  const t = setInterval(() => { evaluate().catch((e) => console.warn("[alertas]", e.message)); }, 30e3);
  t.unref();
  setTimeout(() => evaluate().catch(() => {}), 15e3).unref();
}
