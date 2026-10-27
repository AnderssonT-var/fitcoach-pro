/* Cliente HTTP de la API con renovación automática de la sesión. */

const RT_KEY = "fcp.rt";
const SERVER_KEY = "fcp.server";

const safeGet = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { v == null ? window.localStorage.removeItem(k) : window.localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

/** En la app Android la dirección del servidor viene de la compilación (o se configura una vez). */
export const isNative = () => typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
export function apiBase() {
  const built = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  if (built) return built;
  if (isNative()) return (safeGet(SERVER_KEY) || "").replace(/\/+$/, "");
  return "";
}
export const needsServer = () => isNative() && !apiBase();
export function setServer(url) { safeSet(SERVER_KEY, url.replace(/\/+$/, "")); }
/** Convierte rutas del servidor (/api/files/...) en direcciones completas. */
export const abs = (u) => (u && u.startsWith("/api/") ? apiBase() + u : u);

let access = null;
export const hasSession = () => !!safeGet(RT_KEY);
export function setTokens(t) {
  access = t?.accessToken || null;
  safeSet(RT_KEY, t?.refreshToken || null);
}

let refreshing = null;
/* Varias pestañas comparten la sesión: la renovación se hace de a una (Web Locks) y cada una
   lee el token más reciente, para que el servidor no lo tome como reuso de un token robado. */
const withLock = (fn) => (typeof navigator !== "undefined" && navigator.locks?.request ? navigator.locks.request("fcp-refresh", fn) : fn());
async function refresh() {
  if (!safeGet(RT_KEY)) return false;
  const before = access;
  refreshing ||= withLock(async () => {
    const rt = safeGet(RT_KEY);
    if (!rt) return false;
    if (access && access !== before) return true; // otra llamada de esta pestaña ya renovó
    try {
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), 20e3) : null;
      const r = await fetch(`${apiBase()}/api/auth/refresh`, { method: "POST", signal: ctl?.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: rt }) })
        .finally(() => timer && clearTimeout(timer));
      // Servidor ocupado o caído: no se cierra la sesión (se reintenta luego)
      if (r.status >= 500 || r.status === 429) return null;
      if (!r.ok) { setTokens(null); return false; }
      setTokens(await r.json());
      return true;
    } catch { return null; } // sin conexión: no se cierra la sesión
  }).finally(() => { setTimeout(() => { refreshing = null; }, 0); });
  return refreshing;
}

let onSessionLost = () => {};
export const onLost = (fn) => { onSessionLost = fn; };

/**
 * Llama a la API. Nunca lanza: devuelve el JSON o { error, status, code }.
 * opts.opId / opts.opAt: acción guardada sin conexión (el servidor no la repite y usa la hora real).
 */
let stateTag = null; // ETag del último /api/state recibido
export const resetStateTag = () => { stateTag = null; };
export const setStateTag = (t) => { stateTag = t || null; };
export const getStateTag = () => stateTag;

/* Cada cuánto actualizar: lo sugiere el servidor según la carga (X-Poll-Interval) */
let pollHint = 20;
export const pollSeconds = () => pollHint;

/* Identificación del equipo (para el monitor del administrador) */
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
export function platform() {
  if (isNative()) return "android";
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent || "");
  return standalone ? (ios ? "ios-pwa" : "pwa") : "web";
}
const deviceId = (() => {
  let id = safeGet("fcp.device");
  if (!id) { id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; safeSet("fcp.device", id); }
  return id;
})();
let syncInfo = () => ({ pending: 0, failed: 0 });
export const setSyncInfo = (fn) => { syncInfo = fn; };

const TIMEOUT = 25e3;
export async function api(method, path, body, { conditional = false, opId = null, opAt = null, haveHistory = null, timeout = TIMEOUT } = {}) {
  const go = async () => {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
    const info = syncInfo();
    try {
      return await fetch(`${apiBase()}${path}`, {
        method, cache: "no-store", signal: ctl?.signal,
        headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(access ? { Authorization: `Bearer ${access}` } : {}),
          ...(conditional && stateTag ? { "If-None-Match": stateTag } : {}),
          ...(opId ? { "Idempotency-Key": opId } : {}), ...(opAt ? { "X-Op-At": String(opAt) } : {}),
          ...(haveHistory ? { "X-Have-History": haveHistory } : {}),
          "X-App": `${platform()}/${APP_VERSION}`, "X-Device": deviceId, "X-Pending": String(info.pending || 0), "X-Sync-Failed": String(info.failed || 0) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } finally { if (timer) clearTimeout(timer); }
  };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { error: "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.", status: 0, offline: true };
  }
  let r;
  try {
    if (!access && hasSession() && !path.startsWith("/api/auth/") && !path.startsWith("/api/public/")) await refresh();
    r = await go();
    if (r.status === 401 && hasSession() && !path.startsWith("/api/auth/login")) {
      const ok = await refresh();
      if (ok) r = await go();
      else if (ok === false) { onSessionLost(); }
      else return { error: "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.", status: 0, offline: true };
    }
  } catch {
    return { error: "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.", status: 0, offline: true };
  }
  const hint = +r.headers.get("X-Poll-Interval");
  if (hint >= 10 && hint <= 600) pollHint = hint;
  if (conditional && r.status === 304) return { notModified: true };
  if (conditional && r.ok) stateTag = r.headers.get("ETag");
  let data = {};
  try { data = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) return { error: data.error || "Algo salió mal. Intenta de nuevo.", status: r.status, code: data.code, retryAfter: +r.headers.get("Retry-After") || 0 };
  return data;
}
