/* Notificaciones en el dispositivo.
   - Navegador / web instalada: Web Push (service worker + VAPID).
   - App Android: notificaciones locales (descanso y recordatorios) y, si el servidor tiene Firebase, push.
   Todo falla en silencio: si algo no está disponible, la app sigue funcionando sin avisos. */
import { api, isNative } from "../store/api";

const KEY = "fcp.push"; // endpoint o token registrado en este equipo
let cfg = null;
const getCfg = async () => (cfg ||= await api("GET", "/api/push/config"));

const b64ToBytes = (b64) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* nada */ } };

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone;

/** 'on' | 'off' | 'denied' | 'unsupported' | 'ios-install' (iPhone: hay que agregarla a la pantalla de inicio) */
export async function pushStatus() {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const p = await LocalNotifications.checkPermissions();
      if (p.display === "denied") return "denied";
      return p.display === "granted" && lsGet(KEY) ? "on" : "off";
    } catch { return "unsupported"; }
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return isIOS() && !standalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch { return "off"; }
}

/** Pide permiso y registra este equipo en el servidor. Devuelve el nuevo estado o { error }. */
export async function enablePush() {
  const c = await getCfg();
  if (c.error) return { error: c.error };
  if (isNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const p = await LocalNotifications.requestPermissions();
      if (p.display !== "granted") return { error: "No diste permiso para notificaciones. Actívalo en los ajustes de Android." };
      await LocalNotifications.createChannel?.({ id: "avisos", name: "Avisos", importance: 4, vibration: true }).catch(() => {});
      await LocalNotifications.createChannel?.({ id: "descanso", name: "Fin de descanso", importance: 5, vibration: true }).catch(() => {});
      lsSet(KEY, "local");
      if (c.fcm) await registerFcm();
      return "on";
    } catch { return { error: "No se pudieron activar las notificaciones en este equipo." }; }
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return { error: isIOS() ? "En iPhone, primero agrega VYTRAFIT a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí." : "Este navegador no permite notificaciones." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { error: "No diste permiso para notificaciones. Puedes activarlo en los ajustes del navegador." };
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(c.vapidPublicKey) });
  const j = sub.toJSON();
  const r = await api("POST", "/api/push/subscribe", { kind: "web", endpoint: j.endpoint, keys: j.keys });
  if (r.error) return r;
  lsSet(KEY, j.endpoint);
  return "on";
}

async function registerFcm() {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const p = await PushNotifications.requestPermissions();
    if (p.receive !== "granted") return;
    await PushNotifications.removeAllListeners();
    PushNotifications.addListener("registration", async (t) => {
      await api("POST", "/api/push/subscribe", { kind: "fcm", token: t.value });
      lsSet(KEY, t.value);
    });
    PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
      const d = a.notification?.data || {};
      window.dispatchEvent(new CustomEvent("vytrafit:open", { detail: { page: d.page, params: d.clientId ? { clientId: +d.clientId, id: +d.clientId } : null } }));
    });
    await PushNotifications.register();
  } catch { /* sin Firebase configurado en esta compilación */ }
}

export async function disablePush() {
  const key = lsGet(KEY);
  if (!isNative()) {
    try { const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription(); await sub?.unsubscribe(); } catch { /* nada */ }
  } else {
    try { const { LocalNotifications } = await import("@capacitor/local-notifications"); const p = await LocalNotifications.getPending(); if (p.notifications.length) await LocalNotifications.cancel(p); } catch { /* nada */ }
  }
  if (key && key !== "local") await api("POST", "/api/push/unsubscribe", { key });
  lsSet(KEY, null);
  return "off";
}

export const testPush = async () => {
  if (isNative() && lsGet(KEY) === "local") {
    // Sin Firebase: se prueba con una notificación local
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.schedule({ notifications: [{ id: 9000, title: "¡Notificaciones activadas!", body: "Así te avisaremos del descanso y de tus entrenamientos.", channelId: "avisos", schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true } }] });
      return { sent: 1 };
    } catch { return { error: "No se pudo mostrar la notificación." }; }
  }
  return api("POST", "/api/push/test", {});
};

/* ---------- fin de descanso con la pantalla apagada ---------- */
const REST_ID = 1001;
let restAt = null;
export async function armRestAlarm(at) {
  if (at === restAt) return;
  restAt = at;
  if (isNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] }).catch(() => {});
      if (at && at > Date.now() + 1000) {
        await LocalNotifications.schedule({ notifications: [{ id: REST_ID, title: "¡Descanso terminado!", body: "A por la siguiente serie 💪", channelId: "descanso",
          schedule: { at: new Date(at), allowWhileIdle: true } }] });
      }
    } catch { /* sin permiso */ }
    return;
  }
  if (!lsGet(KEY)) return; // sin push en este navegador
  api("POST", "/api/client/rest-alarm", { at: at || null });
}

/* ---------- recordatorio de entrenar (app Android sin Firebase: notificaciones locales) ---------- */
export async function scheduleLocalReminders(rem) {
  if (!isNative() || lsGet(KEY) !== "local") return;
  try {
    const c = await getCfg();
    if (c.fcm) return; // con Firebase los manda el servidor
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const ids = [2000, 2001, 2002, 2003, 2004, 2005, 2006];
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => {});
    if (!rem?.on || !rem.time) return;
    const [hour, minute] = rem.time.split(":").map(Number);
    await LocalNotifications.schedule({ notifications: rem.days.map((d) => ({
      id: 2000 + d, title: "Hoy toca entrenar 💪", body: "Tu rutina te espera. ¡Vamos!", channelId: "avisos",
      schedule: { on: { weekday: d + 1, hour, minute }, allowWhileIdle: true },
    })) });
  } catch { /* nada */ }
}
