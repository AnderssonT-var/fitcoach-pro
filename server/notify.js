/* Notificaciones push.
   - Navegador y app web instalada: Web Push con claves VAPID (se crean solas y se guardan en la base).
   - App Android: Firebase Cloud Messaging, solo si se define FCM_SERVICE_ACCOUNT (JSON de la cuenta de servicio).
   Nunca bloquean la respuesta: si falla un envío, se registra y se sigue. */
import crypto from "node:crypto";
import webpush from "web-push";
import jwt from "jsonwebtoken";
import { knex, J, S } from "./db.js";
import { getLegal } from "./state.js";
import { nowISO, uid } from "./util.js";

const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

/* ---------- claves VAPID (iguales para todos los procesos: se guardan en settings) ---------- */
let vapid = null;
export async function getVapid() {
  if (vapid) return vapid;
  let row = await knex("settings").where({ key: "vapid" }).first();
  if (!row) {
    const keys = webpush.generateVAPIDKeys();
    try { await knex("settings").insert({ key: "vapid", value: S(keys) }); } catch { /* otro proceso la creó */ }
    row = await knex("settings").where({ key: "vapid" }).first();
  }
  vapid = J(row.value);
  const legal = await getLegal();
  webpush.setVapidDetails(legal.contactEmail ? `mailto:${legal.contactEmail}` : "https://vytra.fit", vapid.publicKey, vapid.privateKey);
  return vapid;
}

/* ---------- Firebase (opcional) ---------- */
let fcmAccount;
function fcmConfig() {
  if (fcmAccount !== undefined) return fcmAccount;
  const raw = process.env.FCM_SERVICE_ACCOUNT || "";
  try {
    const txt = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const a = JSON.parse(txt);
    fcmAccount = a.client_email && a.private_key && a.project_id ? a : null;
  } catch { fcmAccount = null; }
  return fcmAccount;
}
export const fcmEnabled = () => !!fcmConfig();
let fcmToken = { value: null, exp: 0 };
async function fcmAccessToken() {
  if (fcmToken.value && fcmToken.exp > Date.now() + 60e3) return fcmToken.value;
  const a = fcmConfig();
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign({ iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 },
    a.private_key, { algorithm: "RS256" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const d = await r.json();
  if (!r.ok) throw new Error(`FCM token: ${d.error || r.status}`);
  fcmToken = { value: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return fcmToken.value;
}
async function sendFcm(token, msg) {
  const a = fcmConfig();
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
    method: "POST", headers: { Authorization: `Bearer ${await fcmAccessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title: msg.title, body: msg.body },
      data: { page: msg.page || "", clientId: String(msg.params?.clientId || ""), kind: msg.kind || "" },
      android: { priority: "high", notification: { tag: msg.tag || undefined, sound: "default" } } } }),
  });
  if (r.ok) return { ok: true };
  const d = await r.json().catch(() => ({}));
  const gone = r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(JSON.stringify(d));
  return { ok: false, gone, error: d.error?.message || r.status };
}

/* ---------- suscripciones ---------- */
export async function saveSubscription(userId, sub, ua = "") {
  const key = sub.kind === "web" ? sub.endpoint : sub.token;
  const data = sub.kind === "web" ? { endpoint: sub.endpoint, keys: sub.keys } : { token: sub.token };
  const hash = sha(key);
  const exists = await knex("push_subs").where({ endpoint_hash: hash }).first();
  if (exists) await knex("push_subs").where({ id: exists.id }).update({ user_id: userId, data: S(data), ua: String(ua).slice(0, 200) });
  else await knex("push_subs").insert({ id: uid("ps-"), user_id: userId, kind: sub.kind, endpoint_hash: hash, data: S(data), ua: String(ua).slice(0, 200), created_at: nowISO() });
}
export const removeSubscription = (userId, key) => knex("push_subs").where({ user_id: userId, endpoint_hash: sha(key) }).delete();

/**
 * Envía una notificación a todos los dispositivos de un usuario.
 * msg: { title, body, page?, params?, tag?, kind?, only? ("web" | "fcm") }
 */
export async function notify(userId, msg) {
  try {
    const subs = await knex("push_subs").where({ user_id: userId });
    if (!subs.length) return 0;
    let sent = 0;
    for (const s of subs) {
      if (msg.only && s.kind !== msg.only) continue;
      const d = J(s.data, {});
      try {
        if (s.kind === "web") {
          await getVapid();
          await webpush.sendNotification({ endpoint: d.endpoint, keys: d.keys },
            JSON.stringify({ title: msg.title, body: msg.body, page: msg.page, params: msg.params, tag: msg.tag, kind: msg.kind }),
            { TTL: msg.kind === "rest" ? 120 : 24 * 3600, urgency: msg.kind === "rest" || msg.kind === "message" ? "high" : "normal" });
          sent++;
        } else if (s.kind === "fcm" && fcmEnabled()) {
          const r = await sendFcm(d.token, msg);
          if (r.ok) sent++; else if (r.gone) await knex("push_subs").where({ id: s.id }).delete();
        }
      } catch (e) {
        // 404/410: el navegador dio de baja la suscripción
        if (e?.statusCode === 404 || e?.statusCode === 410) await knex("push_subs").where({ id: s.id }).delete();
        else console.warn("[push]", e?.statusCode || "", e?.body || e?.message);
      }
    }
    return sent;
  } catch (e) { console.warn("[push]", e.message); return 0; }
}
/** Igual que notify, pero sin esperar (para no demorar la respuesta). */
export const notifyLater = (userId, msg) => { notify(userId, msg).catch(() => {}); };

/** Marca un aviso como enviado; devuelve false si ya se había enviado (entre todos los procesos). */
export async function once(key) {
  try { await knex("notif_log").insert({ key: key.slice(0, 160), at: nowISO() }); return true; }
  catch { return false; }
}

/* ---------- alarma de fin de descanso (cuando la app queda en segundo plano) ---------- */
const alarms = new Map();
export function setRestAlarm(userId, at) {
  clearTimeout(alarms.get(userId));
  alarms.delete(userId);
  if (!at) return;
  const ms = at - Date.now();
  if (ms < 0 || ms > 15 * 60e3) return;
  alarms.set(userId, setTimeout(() => {
    alarms.delete(userId);
    notify(userId, { title: "¡Descanso terminado!", body: "A por la siguiente serie 💪", tag: "rest", kind: "rest", only: "web" });
  }, ms));
}
