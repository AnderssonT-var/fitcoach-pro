/* Página de presentación de cada entrenador: vytra.fit/<enlace>
   - El entrenador la arma desde la app con secciones (texto, tarjetas, planes, reseñas, galería…).
   - El servidor arma el HTML: carga rápido, se ve bien al compartirlo por WhatsApp y no ejecuta scripts.
   - El esquema de secciones lo define el servidor y lo usan los dos editores (web y Android). */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { knex, J, S } from "./db.js";
import { config } from "./config.js";
import { nowISO } from "./util.js";

/* ============================================================
   Esquema
   ============================================================ */
const F = (k, label, type = "text", extra = {}) => ({ k, label, type, ...extra });
const opts = (...o) => o.map(([v, l]) => ({ v, l: l ?? v }));
const BG = F("bg", "Fondo de la sección", "select", { options: opts(["default", "Normal"], ["alt", "Alterno"], ["brand", "Color de marca"]) });
const TITLE = F("title", "Título", "text", { max: 90 });
const SUB = F("subtitle", "Subtítulo", "textarea", { max: 300 });

export const SCHEMA = {
  groups: [
    { k: "theme", label: "Estilo", icon: "sparkle", fields: [
      F("mode", "Tema", "select", { options: opts(["dark", "Oscuro"], ["light", "Claro"]) }),
      F("color", "Color principal", "color", { hint: "Vacío: el color de tu marca" }),
      F("font", "Tipografía", "select", { options: opts(["modern", "Moderna"], ["bold", "Impactante"], ["elegant", "Elegante"]) }),
      F("radius", "Esquinas", "select", { options: opts(["round", "Redondeadas"], ["soft", "Suaves"], ["square", "Rectas"]) }),
    ] },
    { k: "hero", label: "Portada", icon: "image", fields: [
      F("showLogo", "Mostrar logo", "toggle"),
      F("kicker", "Texto pequeño arriba del título", "text", { max: 60, placeholder: "Entrenador personal · Quito" }),
      F("title", "Título principal", "text", { max: 90, placeholder: "Transforma tu cuerpo con un plan hecho para ti" }),
      F("subtitle", "Subtítulo", "textarea", { max: 280 }),
      F("image", "Imagen de fondo", "image", { wide: true }),
      F("overlay", "Oscurecer la imagen", "range", { min: 0, max: 90, step: 5, unit: "%" }),
      F("align", "Alineación", "select", { options: opts(["center", "Centrado"], ["left", "A la izquierda"]) }),
    ] },
    { k: "contact", label: "Botones y contacto", icon: "chat", fields: [
      F("whatsapp", "Número de WhatsApp", "tel", { max: 20, hint: "Con código de país, ej.: 593991234567. Vacío: el teléfono de tu perfil" }),
      F("whatsappText", "Mensaje que te llega", "text", { max: 160 }),
      F("ctaLabel", "Texto del botón de WhatsApp", "text", { max: 30 }),
      F("floating", "Botón flotante de WhatsApp", "toggle"),
      F("showLogin", "Mostrar botón «Iniciar sesión»", "toggle"),
      F("loginLabel", "Texto del botón de acceso", "text", { max: 30 }),
    ] },
    { k: "social", label: "Redes sociales", icon: "community", fields: [
      F("instagram", "Instagram", "text", { max: 120, placeholder: "@tu.usuario" }),
      F("tiktok", "TikTok", "text", { max: 120, placeholder: "@tu.usuario" }),
      F("facebook", "Facebook", "text", { max: 160, placeholder: "Enlace o usuario" }),
      F("youtube", "YouTube", "text", { max: 160, placeholder: "Enlace o @canal" }),
      F("email", "Correo", "text", { max: 120 }),
      F("website", "Otra web", "url", { max: 200 }),
    ] },
    { k: "seo", label: "Al compartir el enlace", icon: "link", fields: [
      F("description", "Descripción (se ve en WhatsApp y Google)", "textarea", { max: 200 }),
      F("footer", "Texto del pie de página", "text", { max: 140 }),
    ] },
  ],
  sections: {
    about: { label: "Sobre mí", icon: "user", hint: "Tu historia, tu método y una foto tuya", fields: [
      TITLE, F("body", "Texto", "textarea", { max: 2500, hint: "Usa **negrita** y saltos de línea" }), F("image", "Foto", "image"),
      F("imageSide", "Foto a la", "select", { options: opts(["left", "Izquierda"], ["right", "Derecha"]) }), BG] },
    text: { label: "Texto libre", icon: "edit", hint: "Un bloque de texto con título", fields: [
      TITLE, SUB, F("body", "Texto", "textarea", { max: 4000 }), F("align", "Alineación", "select", { options: opts(["left", "Izquierda"], ["center", "Centrado"]) }), BG] },
    cards: { label: "Tarjetas", icon: "grid", hint: "Servicios, beneficios, cómo trabajas…", fields: [
      TITLE, SUB, F("columns", "Columnas en computadora", "select", { options: opts(["3"], ["2"], ["4"]) }), BG],
      item: { label: "Tarjeta", max: 12, fields: [F("image", "Imagen", "image"), F("icon", "Emoji (opcional)", "text", { max: 4, placeholder: "💪" }), F("title", "Título", "text", { max: 80 }), F("text", "Texto", "textarea", { max: 600 })] } },
    stats: { label: "Cifras", icon: "chart", hint: "Años de experiencia, alumnos, kilos perdidos…", fields: [TITLE, BG],
      item: { label: "Cifra", max: 6, fields: [F("value", "Número", "text", { max: 14, placeholder: "+150" }), F("title", "Qué significa", "text", { max: 60, placeholder: "Alumnos entrenados" })] } },
    plans: { label: "Planes y precios", icon: "wallet", hint: "Cada plan con su botón a WhatsApp", fields: [TITLE, SUB, BG],
      item: { label: "Plan", max: 6, fields: [F("title", "Nombre del plan", "text", { max: 60 }), F("price", "Precio", "text", { max: 20, placeholder: "$40" }),
        F("period", "Periodo", "text", { max: 24, placeholder: "/mes" }), F("text", "Qué incluye (un punto por línea)", "textarea", { max: 900 }),
        F("button", "Texto del botón", "text", { max: 30, placeholder: "Lo quiero" }), F("highlight", "Destacar como recomendado", "toggle")] } },
    reviews: { label: "Reseñas", icon: "star", hint: "Lo que dicen tus asesorados (en carrusel)", fields: [TITLE, SUB,
      F("fromClients", "Mostrar las reseñas que aprobaste de tus asesorados", "toggle", { default: true }), BG],
      item: { label: "Reseña", max: 24, fields: [F("image", "Foto (opcional)", "image", { square: true }), F("title", "Nombre", "text", { max: 60 }),
        F("detail", "Resultado o detalle", "text", { max: 70, placeholder: "-8 kg en 3 meses" }), F("rating", "Estrellas", "stars"), F("text", "Reseña", "textarea", { max: 700 })] } },
    gallery: { label: "Galería de fotos", icon: "image", hint: "Fotos de entrenos, resultados, tu espacio", fields: [TITLE, SUB, BG],
      item: { label: "Foto", max: 24, fields: [F("image", "Foto", "image"), F("title", "Pie de foto (opcional)", "text", { max: 90 })] } },
    faq: { label: "Preguntas frecuentes", icon: "info", hint: "Resuelve dudas antes de que te escriban", fields: [TITLE, BG],
      item: { label: "Pregunta", max: 20, fields: [F("title", "Pregunta", "text", { max: 160 }), F("text", "Respuesta", "textarea", { max: 900 })] } },
    video: { label: "Video", icon: "play", hint: "Un video de YouTube o Vimeo", fields: [TITLE, SUB, F("url", "Enlace del video", "url", { max: 300, placeholder: "https://youtu.be/…" }), BG] },
    cta: { label: "Llamado a la acción", icon: "send", hint: "Un bloque destacado con un botón", fields: [TITLE, F("body", "Texto", "textarea", { max: 500 }), F("button", "Texto del botón", "text", { max: 30 }),
      F("action", "El botón lleva a", "select", { options: opts(["whatsapp", "WhatsApp"], ["login", "Iniciar sesión"], ["link", "Otro enlace"]) }), F("link", "Enlace (si elegiste otro)", "url", { max: 300 }), BG] },
  },
  limits: { sections: 30, images: 80 },
};

/* ============================================================
   Valores iniciales (se arman con lo que ya tiene en su perfil)
   ============================================================ */
const sid = () => crypto.randomBytes(5).toString("hex");

export function defaultPage(u) {
  const p = J(u.profile, {}), b = J(u.brand, {});
  const name = b.businessName || u.name;
  const services = (p.services || []).slice(0, 6);
  const sections = [
    { id: sid(), type: "about", visible: true, title: `Hola, soy ${u.name.split(" ")[0]}`, body: p.bio || "Cuéntales quién eres, cómo empezaste y por qué tu método funciona.", image: "", imageSide: "left", bg: "default" },
    { id: sid(), type: "cards", visible: true, title: "Qué incluye entrenar conmigo", subtitle: "", columns: "3", bg: "alt",
      items: (services.length ? services : ["Rutina personalizada", "Seguimiento semanal", "Chat directo conmigo"]).map((t, i) => ({ id: sid(), image: "", icon: ["💪", "📈", "💬", "🥗", "🎯", "⏱️"][i % 6], title: t, text: "" })) },
  ];
  if (p.years) sections.push({ id: sid(), type: "stats", visible: true, title: "", bg: "default", items: [{ id: sid(), value: `${p.years}+`, title: "Años de experiencia" }] });
  sections.push(
    { id: sid(), type: "reviews", visible: true, title: "Lo que dicen mis asesorados", subtitle: "", bg: "alt", fromClients: true, items: [] },
    { id: sid(), type: "cta", visible: true, title: "¿Empezamos?", body: "Escríbeme y armamos tu plan.", button: "Trabajemos juntos", action: "whatsapp", link: "", bg: "brand" },
  );
  return {
    published: false,
    theme: { mode: "dark", color: "", font: "modern", radius: "round" },
    hero: { showLogo: true, kicker: [p.headline, p.city].filter(Boolean).join(" · ") || "Entrenador personal", title: b.tagline || `Entrena con ${name}`,
      subtitle: "Planes de entrenamiento personalizados, seguimiento real y resultados que se notan.", image: "", overlay: 55, align: "center" },
    contact: { whatsapp: "", whatsappText: `Hola ${u.name.split(" ")[0]}, vi tu página y quiero entrenar contigo.`, ctaLabel: "Trabajemos juntos", floating: true, showLogin: true, loginLabel: "Iniciar sesión" },
    social: { instagram: p.instagram || "", tiktok: "", facebook: "", youtube: "", email: "", website: "" },
    seo: { description: (p.bio || `Entrena con ${name}.`).slice(0, 200), footer: "" },
    sections,
  };
}

/* ============================================================
   Limpieza de lo que llega del editor
   ============================================================ */
const IMG_ID = /^f-[\w-]{4,40}$/;
function cleanField(f, v, imgs) {
  switch (f.type) {
    case "toggle": return v === undefined && f.default !== undefined ? f.default : v === true;
    case "range": { const n = Number(v); return Number.isFinite(n) ? Math.max(f.min, Math.min(f.max, Math.round(n))) : f.min; }
    case "stars": { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : 5; }
    case "select": return f.options.some((o) => o.v === v) ? v : f.options[0].v;
    case "color": return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "";
    case "image": return typeof v === "string" && IMG_ID.test(v) && (!imgs || imgs.has(v)) ? v : "";
    case "url": { const s = String(v ?? "").trim().slice(0, f.max || 300); return /^https?:\/\/[^\s"<>]+$/i.test(s) ? s : ""; }
    default: return String(v ?? "").replace(/\r/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, f.max || (f.type === "textarea" ? 1500 : 120));
  }
}
function cleanFields(fields, src, imgs) {
  const out = {};
  for (const f of fields) out[f.k] = cleanField(f, src?.[f.k], imgs);
  return out;
}

/** Deja solo lo que el esquema permite; las imágenes tienen que ser del propio entrenador. */
export function cleanPage(input, imgs) {
  const src = input && typeof input === "object" ? input : {};
  const out = { published: src.published === true };
  for (const g of SCHEMA.groups) out[g.k] = cleanFields(g.fields, src[g.k], imgs);
  out.sections = [];
  const seen = new Set();
  for (const s of Array.isArray(src.sections) ? src.sections.slice(0, SCHEMA.limits.sections) : []) {
    const def = SCHEMA.sections[s?.type];
    if (!def) continue;
    let id = typeof s.id === "string" && /^[\w-]{1,24}$/.test(s.id) && !seen.has(s.id) ? s.id : sid();
    seen.add(id);
    const sec = { id, type: s.type, visible: s.visible !== false, ...cleanFields(def.fields, s, imgs) };
    if (def.item) {
      sec.items = (Array.isArray(s.items) ? s.items.slice(0, def.item.max) : []).map((it) => ({
        id: typeof it?.id === "string" && /^[\w-]{1,24}$/.test(it.id) ? it.id : sid(), ...cleanFields(def.item.fields, it, imgs),
      }));
    }
    out.sections.push(sec);
  }
  return out;
}

export function imagesIn(page) {
  const set = new Set();
  const walk = (o) => { if (!o || typeof o !== "object") return; for (const v of Object.values(o)) { if (typeof v === "string" && IMG_ID.test(v)) set.add(v); else if (typeof v === "object") walk(v); } };
  walk(page);
  return set;
}

/* ============================================================
   Lectura y guardado
   ============================================================ */
export async function loadPage(u) {
  const row = await knex("coach_pages").where({ coach_id: u.id }).first();
  if (!row) return defaultPage(u);
  const page = J(row.data, null) || defaultPage(u);
  page.published = !!row.published && row.published !== "0";
  return page;
}

export async function savePage(u, input) {
  const mine = new Set((await knex("files").where({ owner_id: u.id, kind: "page" }).select("id")).map((r) => r.id));
  const page = cleanPage(input, mine);
  const data = S({ ...page, published: undefined });
  const row = { data, published: page.published, updated_at: nowISO() };
  const has = await knex("coach_pages").where({ coach_id: u.id }).first();
  if (has) await knex("coach_pages").where({ coach_id: u.id }).update(row);
  else await knex("coach_pages").insert({ coach_id: u.id, ...row });
  dropCache();
  // Fotos que ya no se usan: se borran las que tienen más de un día (las recién subidas pueden estar en otro borrador)
  const used = imagesIn(page);
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const stale = await knex("files").where({ owner_id: u.id, kind: "page" }).where("created_at", "<", dayAgo).select("id", "path");
  const { deleteFile } = await import("./files.js");
  for (const f of stale) if (!used.has(f.id)) await deleteFile(f.id).catch(() => {});
  return page;
}

export const previewSig = (coachId) => crypto.createHmac("sha256", config.fileSecret).update(`page:${coachId}`).digest("base64url").slice(0, 22);

/* ============================================================
   HTML
   ============================================================ */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Texto con **negrita**, saltos de línea y párrafos. */
function rich(s) {
  return String(s || "").split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`).join("");
}
const img = (id) => (id ? `/p/img/${id}` : "");

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lum([r, g, b]) { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
const rgbHex = (c) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

export function waNumber(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (/^0\d{9}$/.test(d)) d = `593${d.slice(1)}`; // número de Ecuador escrito como 09…
  return d.length >= 8 && d.length <= 15 ? d : "";
}
function socialUrl(k, v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const h = s.replace(/^@/, "").replace(/[^\w.\-]/g, "");
  if (!h) return "";
  return { instagram: `https://instagram.com/${h}`, tiktok: `https://www.tiktok.com/@${h}`, facebook: `https://facebook.com/${h}`, youtube: `https://www.youtube.com/@${h}`,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? `mailto:${s}` : "", website: "" }[k] || "";
}
function videoEmbed(url) {
  const u = String(url || "");
  let m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`;
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return "";
}

const ICONS = {
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>',
  login: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m5 12 5 5L20 7"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 8V6.3c0-.8.2-1.3 1.4-1.3H17V2h-2.6C11.4 2 10.5 3.8 10.5 6.2V8H8v3h2.5v11H14V11h2.7l.4-3Z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12c0 1.3.1 2.6.4 3.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.2.4-2.5.4-3.8s-.1-2.6-.4-3.8ZM10 15.2V8.8l5.2 3.2Z"/></svg>',
  email: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m3 7 9 6 9-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  website: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};

/**
 * @param {object} o
 *  page, coach (fila users), origin, slug, preview (vista del editor: sin iframes), draft (aviso «no publicada»)
 */
export function renderPage({ page, coach, origin = "", slug, preview = false, draft = false, clientReviews = [] }) {
  const p = J(coach.profile, {}), b = J(coach.brand, {});
  const name = b.businessName || coach.name;
  const t = page.theme || {}, hero = page.hero || {}, c = page.contact || {}, so = page.social || {}, seo = page.seo || {};
  const color = /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#007AFF";
  const rgb = hexRgb(color);
  const dark = t.mode !== "light";
  const onBrand = lum(rgb) > 0.45 ? "#0b0b0f" : "#ffffff";
  // Texto del color de marca legible sobre el fondo
  const accent = dark ? (lum(rgb) < 0.12 ? rgbHex(mix(rgb, [255, 255, 255], 0.45)) : color) : (lum(rgb) > 0.5 ? rgbHex(mix(rgb, [0, 0, 0], 0.45)) : color);
  const radius = { round: "22px", soft: "12px", square: "3px" }[t.radius] || "22px";
  const fonts = {
    modern: ["'Sora', system-ui, sans-serif", "700", "none", "-.02em"],
    bold: ["'Sora', system-ui, sans-serif", "800", "uppercase", "-.01em"],
    elegant: ["Georgia, 'Times New Roman', serif", "600", "none", "-.01em"],
  }[t.font] || ["'Sora', system-ui, sans-serif", "700", "none", "-.02em"];

  const wa = waNumber(c.whatsapp) || waNumber(p.phone);
  const waLink = (text) => (wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text || c.whatsappText || "Hola, quiero entrenar contigo.")}` : "");
  const loginHref = `${origin}/#${encodeURIComponent(slug)}`;
  const tgt = preview ? ' target="_blank" rel="noopener"' : ' target="_blank" rel="noopener"';
  const ctaBtn = (label, cls = "btn btn-brand") => (wa ? `<a class="${cls}" href="${esc(waLink())}"${tgt}>${ICONS.wa}<span>${esc(label || c.ctaLabel || "Trabajemos juntos")}</span></a>` : "");
  const loginBtn = (cls = "btn btn-ghost") => (c.showLogin !== false ? `<a class="${cls}" href="${esc(loginHref)}"${preview ? tgt : ""}>${ICONS.login}<span>${esc(c.loginLabel || "Iniciar sesión")}</span></a>` : "");

  const logo = b.logo && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(b.logo) ? b.logo : "";
  const mark = logo ? `<img class="mark" src="${esc(logo)}" alt="">` : `<span class="mark mark-txt">${esc(name.trim().charAt(0).toUpperCase() || "V")}</span>`;
  const photo = p.photo && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(p.photo) ? p.photo : "";

  const head = (s) => (s.title || s.subtitle ? `<header class="sec-head">${s.title ? `<h2>${esc(s.title)}</h2>` : ""}${s.subtitle ? `<p class="lead">${esc(s.subtitle)}</p>` : ""}</header>` : "");
  const stars = (n) => `<div class="stars" aria-label="${n} de 5 estrellas">${Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? "on" : ""}">${ICONS.star}</span>`).join("")}</div>`;

  const R = {
    about(s) {
      const im = img(s.image) || photo;
      return `<div class="wrap about ${im ? "has-img" : ""} ${s.imageSide === "right" ? "img-right" : ""}">
        ${im ? `<div class="about-img"><img src="${esc(im)}" alt="${esc(coach.name)}" loading="lazy"></div>` : ""}
        <div class="about-txt">${s.title ? `<h2>${esc(s.title)}</h2>` : ""}<div class="prose">${rich(s.body)}</div></div></div>`;
    },
    text(s) { return `<div class="wrap narrow ${s.align === "center" ? "center" : ""}">${head(s)}<div class="prose">${rich(s.body)}</div></div>`; },
    cards(s) {
      if (!s.items?.length) return "";
      return `<div class="wrap">${head(s)}<div class="grid cols-${Math.min(+s.columns || 3, s.items.length)}">${s.items.map((it) => `<article class="card">
        ${it.image ? `<img class="card-img" src="${img(it.image)}" alt="" loading="lazy">` : ""}
        <div class="card-body">${it.icon ? `<div class="emoji">${esc(it.icon)}</div>` : ""}${it.title ? `<h3>${esc(it.title)}</h3>` : ""}${it.text ? `<div class="prose sm">${rich(it.text)}</div>` : ""}</div></article>`).join("")}</div></div>`;
    },
    stats(s) {
      if (!s.items?.length) return "";
      return `<div class="wrap">${head(s)}<div class="stats">${s.items.map((it) => `<div class="stat"><strong>${esc(it.value)}</strong><span>${esc(it.title)}</span></div>`).join("")}</div></div>`;
    },
    plans(s) {
      if (!s.items?.length) return "";
      return `<div class="wrap">${head(s)}<div class="grid plans cols-${Math.min(3, s.items.length)}">${s.items.map((it) => {
        const lines = String(it.text || "").split("\n").map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
        const href = waLink(`Hola, me interesa el plan «${it.title}»${it.price ? ` (${it.price}${it.period || ""})` : ""}.`);
        return `<article class="card plan ${it.highlight ? "hl" : ""}">${it.highlight ? '<span class="badge">Recomendado</span>' : ""}
          <h3>${esc(it.title)}</h3><div class="price">${esc(it.price)}<small>${esc(it.period)}</small></div>
          ${lines.length ? `<ul>${lines.map((l) => `<li>${ICONS.check}<span>${esc(l)}</span></li>`).join("")}</ul>` : ""}
          ${href ? `<a class="btn ${it.highlight ? "btn-brand" : "btn-ghost"} block" href="${esc(href)}"${tgt}>${esc(it.button || "Lo quiero")}</a>` : ""}</article>`;
      }).join("")}</div></div>`;
    },
    reviews(s) {
      // Primero las de los asesorados (aprobadas por el entrenador), luego las que escribió él
      const list = [...(s.fromClients !== false ? clientReviews.map((r) => ({ ...r, src: r.photo })) : []), ...(s.items || []).map((it) => ({ ...it, src: img(it.image) }))];
      if (!list.length) return "";
      const card = (it) => `<figure class="card review">
        ${stars(it.rating || 5)}<blockquote>${rich(it.text)}</blockquote>
        <figcaption>${it.src ? `<img src="${esc(it.src)}" alt="" loading="lazy">` : `<span class="av">${esc((it.title || "?").charAt(0).toUpperCase())}</span>`}
        <span><b>${esc(it.title)}</b>${it.detail ? `<small>${esc(it.detail)}</small>` : ""}</span></figcaption></figure>`;
      // Carrusel de 2 filas × 2 columnas (en celular, 2 filas × 1 columna); se desliza con el dedo o con las flechas
      return `<div class="wrap">${head(s)}<div class="carousel" data-carousel>
        <div class="track ${list.length <= 2 ? "few" : ""} n${Math.min(list.length, 4)}" tabindex="0" aria-label="Reseñas">${list.map(card).join("")}</div>
        <div class="car-nav"><button type="button" class="car-btn car-prev" aria-label="Anteriores">‹</button><div class="dots"></div><button type="button" class="car-btn car-next" aria-label="Siguientes">›</button></div>
      </div></div>`;
    },
    gallery(s) {
      const items = (s.items || []).filter((it) => it.image);
      if (!items.length) return "";
      return `<div class="wrap">${head(s)}<div class="gallery">${items.map((it) => `<figure><a href="${img(it.image)}"${tgt}><img src="${img(it.image)}" alt="${esc(it.title)}" loading="lazy"></a>${it.title ? `<figcaption>${esc(it.title)}</figcaption>` : ""}</figure>`).join("")}</div></div>`;
    },
    faq(s) {
      if (!s.items?.length) return "";
      return `<div class="wrap narrow">${head(s)}<div class="faq">${s.items.map((it) => `<details><summary>${esc(it.title)}</summary><div class="prose sm">${rich(it.text)}</div></details>`).join("")}</div></div>`;
    },
    video(s) {
      const src = videoEmbed(s.url);
      if (!src) return "";
      const frame = preview
        ? `<a class="video-ph" href="${esc(s.url)}" target="_blank" rel="noopener">▶<span>El video se ve en la página publicada</span></a>`
        : `<iframe src="${esc(src)}" title="${esc(s.title || "Video")}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      return `<div class="wrap narrow">${head(s)}<div class="video">${frame}</div></div>`;
    },
    cta(s) {
      let btn = "";
      if (s.action === "login") btn = loginBtn(s.bg === "brand" ? "btn btn-light" : "btn btn-brand").replace(esc(c.loginLabel || "Iniciar sesión"), esc(s.button || c.loginLabel || "Iniciar sesión"));
      else if (s.action === "link" && s.link) btn = `<a class="btn ${s.bg === "brand" ? "btn-light" : "btn-brand"}" href="${esc(s.link)}"${tgt}><span>${esc(s.button || "Ver más")}</span></a>`;
      else btn = ctaBtn(s.button, s.bg === "brand" ? "btn btn-light" : "btn btn-brand");
      return `<div class="wrap narrow center cta">${s.title ? `<h2>${esc(s.title)}</h2>` : ""}${s.body ? `<div class="prose lead">${rich(s.body)}</div>` : ""}<div class="actions center">${btn}</div></div>`;
    },
  };

  const sections = (page.sections || []).filter((s) => s.visible !== false && R[s.type]).map((s) => {
    const html = R[s.type](s);
    return html ? `<section id="s-${esc(s.id)}" class="sec bg-${esc(s.bg || "default")} t-${esc(s.type)}">${html}</section>` : "";
  }).join("\n");

  const socials = Object.keys(ICONS).filter((k) => ["instagram", "tiktok", "facebook", "youtube", "email", "website"].includes(k))
    .map((k) => [k, k === "website" ? (/^https?:\/\//.test(so.website || "") ? so.website : "") : socialUrl(k, so[k])]).filter(([, u]) => u);
  const heroImg = img(hero.image);
  const ogImg = heroImg ? `${origin}${heroImg}` : "";
  const title = `${name}${hero.kicker ? ` · ${hero.kicker}` : ""}`;
  const desc = seo.description || hero.subtitle || "";
  const ov = Math.max(0, Math.min(90, +hero.overlay || 0)) / 100;

  const bg = dark ? "#0a0a0d" : "#ffffff", bg2 = dark ? "#121217" : "#f4f5f8", card = dark ? "#17171d" : "#ffffff";
  const text = dark ? "#f4f4f6" : "#111216", muted = dark ? "#a3a3ad" : "#5c5f6a", line = dark ? "rgba(255,255,255,.09)" : "rgba(15,20,40,.10)";

  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${bg}">
${draft || preview ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(`${origin}/${slug}`)}">`}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(`${origin}/${slug}`)}">${ogImg ? `<meta property="og:image" content="${esc(ogImg)}"><meta name="twitter:card" content="summary_large_image">` : ""}
${preview ? `<base href="${esc(origin)}/" target="_blank">` : ""}
<link rel="icon" href="${logo ? esc(logo) : "/icon-192.png"}">
<style>
@font-face{font-family:Sora;font-weight:600;font-display:swap;src:url(/fonts/sora-latin-600-normal.woff2) format("woff2")}
@font-face{font-family:Sora;font-weight:700;font-display:swap;src:url(/fonts/sora-latin-700-normal.woff2) format("woff2")}
@font-face{font-family:Sora;font-weight:800;font-display:swap;src:url(/fonts/sora-latin-800-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:400;font-display:swap;src:url(/fonts/inter-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:600;font-display:swap;src:url(/fonts/inter-latin-600-normal.woff2) format("woff2")}
:root{--brand:${color};--on:${onBrand};--accent:${accent};--bg:${bg};--bg2:${bg2};--card:${card};--text:${text};--muted:${muted};--line:${line};--r:${radius};
--hf:${fonts[0]};--hw:${fonts[1]};--ht:${fonts[2]};--hl:${fonts[3]};--rgb:${rgb.join(",")}}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:400 16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit}
h1,h2,h3{font-family:var(--hf);font-weight:var(--hw);text-transform:var(--ht);letter-spacing:var(--hl);line-height:1.12;margin:0 0 .5em}
h1{font-size:clamp(2.1rem,6.4vw,4.2rem)}h2{font-size:clamp(1.6rem,4vw,2.5rem)}h3{font-size:1.18rem}
.wrap{width:min(1120px,100% - 40px - env(safe-area-inset-left) - env(safe-area-inset-right));margin-inline:auto}.narrow{width:min(760px,100% - 40px)}.center{text-align:center}
.prose p{margin:0 0 1em}.prose p:last-child{margin:0}.prose.sm{font-size:.95rem;color:var(--muted)}.lead{color:var(--muted);font-size:1.08rem;max-width:62ch}
.center .lead,.sec-head.center .lead{margin-inline:auto}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.55em;min-height:50px;padding:0 1.5em;border-radius:calc(var(--r) * .7 + 6px);font:600 1rem/1 Inter,system-ui,sans-serif;text-decoration:none;border:1.5px solid transparent;transition:transform .15s,filter .15s,background .15s;cursor:pointer;white-space:nowrap}
.btn:hover{transform:translateY(-1px);filter:brightness(1.06)}.btn svg{width:20px;height:20px;flex:none}.btn.block{width:100%}
.btn-brand{background:var(--brand);color:var(--on);box-shadow:0 10px 30px -10px rgba(var(--rgb),.7)}
.btn-ghost{background:transparent;color:var(--text);border-color:var(--line)}.btn-ghost:hover{background:var(--bg2)}
.btn-light{background:var(--on);color:var(--brand)}
.top{position:sticky;top:0;z-index:20;padding-top:env(safe-area-inset-top);backdrop-filter:saturate(1.6) blur(14px);-webkit-backdrop-filter:saturate(1.6) blur(14px);background:color-mix(in srgb,var(--bg) 78%,transparent);border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;gap:12px;min-height:64px}.top .name{font-family:var(--hf);font-weight:700;font-size:1.05rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.top .btn{min-height:40px;padding:0 1em;font-size:.92rem}
.mark{width:38px;height:38px;border-radius:calc(var(--r) * .5);object-fit:contain;flex:none}.mark-txt{display:grid;place-items:center;background:var(--brand);color:var(--on);font:800 1.1rem var(--hf)}
.hero{position:relative;min-height:${heroImg ? "min(88vh,820px)" : "min(64vh,600px)"};display:flex;align-items:center;padding:90px 0 80px;overflow:hidden;isolation:isolate}
.hero .bgimg{position:absolute;inset:0;z-index:-2;width:100%;height:100%;object-fit:cover}
.hero::before{content:"";position:absolute;inset:0;z-index:-1;background:${heroImg ? `linear-gradient(180deg,rgba(0,0,0,${(ov * 0.75).toFixed(2)}),rgba(0,0,0,${ov.toFixed(2)}) 70%,var(--bg))` : `radial-gradient(90% 70% at 50% 0%,rgba(var(--rgb),.32),transparent 70%)`}}
.hero.has-img{color:#fff}.hero.has-img .lead{color:rgba(255,255,255,.85)}.hero.has-img .btn-ghost{color:#fff;border-color:rgba(255,255,255,.4);background:rgba(0,0,0,.18)}
.hero .kicker{display:inline-block;font:600 .8rem/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${heroImg ? "#fff" : "var(--accent)"};padding:.6em 1em;border-radius:99px;background:rgba(var(--rgb),.16);border:1px solid rgba(var(--rgb),.35);margin-bottom:1.3rem}
.hero .lead{font-size:clamp(1.05rem,2.2vw,1.25rem);margin:0 0 2rem}.hero.center{text-align:center}.hero.center .lead{margin-inline:auto}
.hero .hero-logo{width:84px;height:84px;margin:0 0 1.4rem;border-radius:calc(var(--r) * .8);object-fit:contain}.hero.center .hero-logo{margin-inline:auto}
.actions{display:flex;flex-wrap:wrap;gap:12px}.actions.center,.hero.center .actions{justify-content:center}
.sec{padding:clamp(56px,9vw,104px) 0}.bg-alt{background:var(--bg2)}
.bg-brand{background:linear-gradient(135deg,var(--brand),${rgbHex(mix(rgb, [0, 0, 0], 0.28))});color:var(--on)}.bg-brand .lead,.bg-brand .prose.sm{color:inherit;opacity:.88}
.bg-brand .card{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);color:inherit}
.sec-head{margin-bottom:2.2rem}.t-cards .sec-head,.t-plans .sec-head,.t-reviews .sec-head,.t-gallery .sec-head,.t-stats .sec-head{text-align:center}.t-cards .lead,.t-plans .lead,.t-reviews .lead,.t-gallery .lead{margin-inline:auto}
.about{display:grid;gap:clamp(28px,5vw,64px);align-items:center}.about.has-img{grid-template-columns:minmax(0,5fr) minmax(0,6fr)}.about.img-right .about-img{order:2}
.about-img img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--r);box-shadow:0 30px 60px -30px rgba(0,0,0,.5)}
.grid{display:grid;gap:18px}.cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.cols-1{grid-template-columns:minmax(0,420px);justify-content:center}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;position:relative}
.card-img{width:100%;aspect-ratio:16/10;object-fit:cover}.card-body{padding:22px}.emoji{font-size:1.9rem;line-height:1;margin-bottom:.6rem}
.stats{display:flex;flex-wrap:wrap;justify-content:center;gap:16px}.stat{flex:1 1 180px;max-width:260px;text-align:center;padding:26px 18px;border-radius:var(--r);background:var(--card);border:1px solid var(--line)}
.stat strong{display:block;font:var(--hw) clamp(2rem,5vw,2.9rem)/1 var(--hf);color:var(--accent);margin-bottom:.35em}.stat span{color:var(--muted);font-size:.95rem}
.bg-brand .stat strong{color:inherit}
.plan{padding:28px 24px;display:flex;flex-direction:column;gap:14px}.plan h3{margin:0}.plan.hl{border:2px solid var(--brand);box-shadow:0 24px 50px -28px rgba(var(--rgb),.8)}
.badge{position:absolute;top:16px;right:16px;font:600 .72rem/1 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:.5em .8em;border-radius:99px;background:var(--brand);color:var(--on)}
.price{font:800 2.4rem/1 var(--hf)}.price small{font:500 1rem Inter,sans-serif;color:var(--muted);margin-left:4px}
.plan ul{list-style:none;margin:0;padding:0;display:grid;gap:10px;flex:1}.plan li{display:flex;gap:10px;align-items:flex-start;font-size:.97rem}.plan li svg{width:18px;height:18px;color:var(--accent);flex:none;margin-top:3px}
.carousel{position:relative}
.track{display:grid;grid-auto-flow:column;grid-template-rows:repeat(2,auto);grid-auto-columns:calc((100% - 18px) / 2);gap:18px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:2px}
.track::-webkit-scrollbar{display:none}.track>*{scroll-snap-align:start;min-width:0}
.track.few{grid-auto-flow:row;grid-template-rows:none;grid-template-columns:repeat(2,minmax(0,1fr))}.track.few.n1{grid-template-columns:minmax(0,520px);justify-content:center}
.car-nav{display:none;align-items:center;justify-content:center;gap:16px;margin-top:22px}.carousel.nav-on .car-nav{display:flex}
.car-btn{width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--text);font:600 1.6rem/1 Inter,sans-serif;cursor:pointer;display:grid;place-items:center;padding:0 0 3px}
.car-btn:disabled{opacity:.35;cursor:default}.car-btn:not(:disabled):hover{background:var(--bg2)}
.dots{display:flex;gap:8px}.dots button{width:9px;height:9px;border-radius:99px;border:0;padding:0;background:var(--line);cursor:pointer;transition:width .2s,background .2s}
.dots button.on{width:26px;background:var(--brand)}
.review{margin:0;padding:24px;display:flex;flex-direction:column;gap:14px;height:100%}.review blockquote{margin:0;flex:1;font-size:1rem}
.stars{display:flex;gap:2px}.stars span{width:18px;height:18px;color:var(--line)}.stars span.on{color:#f5b301}.stars svg{width:100%;height:100%}
.review figcaption{display:flex;align-items:center;gap:12px}.review figcaption img,.review .av{width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none}
.review .av{display:grid;place-items:center;background:rgba(var(--rgb),.18);color:var(--accent);font:700 1.05rem var(--hf)}
.review figcaption b{display:block}.review figcaption small{display:block;color:var(--accent);font-weight:600;font-size:.85rem}
.gallery{columns:3 260px;column-gap:14px}.gallery figure{margin:0 0 14px;break-inside:avoid}.gallery img{width:100%;border-radius:calc(var(--r) * .7)}
.gallery figcaption{font-size:.88rem;color:var(--muted);padding:6px 4px 0}
.faq{display:grid;gap:10px}.faq details{background:var(--card);border:1px solid var(--line);border-radius:calc(var(--r) * .7);padding:0 20px}
.faq summary{cursor:pointer;list-style:none;padding:18px 28px 18px 0;font-weight:600;position:relative}.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:1.4rem;color:var(--accent);transition:transform .2s}
.faq details[open] summary::after{transform:translateY(-50%) rotate(45deg)}.faq details .prose{padding-bottom:18px}
.video{position:relative;aspect-ratio:16/9;border-radius:var(--r);overflow:hidden;background:#000}.video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.video-ph{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:10px;color:#fff;text-decoration:none;font-size:2.4rem}.video-ph span{font-size:.9rem;opacity:.75}
.cta h2{font-size:clamp(1.8rem,4.6vw,2.9rem)}.cta .prose{margin:0 auto 1.8rem}
footer{padding:44px 0 calc(44px + env(safe-area-inset-bottom));border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
footer .wrap{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between}
.socials{display:flex;gap:10px;flex-wrap:wrap}.socials a{width:42px;height:42px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--line);color:var(--text);transition:background .15s}
.socials a:hover{background:var(--bg2)}.socials svg{width:20px;height:20px}
.made{font-size:.8rem;opacity:.7}.made a{text-decoration:none;font-weight:600}
.float{position:fixed;right:18px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:30;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:#25D366;color:#fff;box-shadow:0 12px 30px -8px rgba(0,0,0,.5);transition:transform .15s}
.float:hover{transform:scale(1.06)}.float svg{width:30px;height:30px}
.draft{position:sticky;top:0;z-index:40;background:#f5b301;color:#1a1300;text-align:center;font:600 .85rem/1.3 Inter,sans-serif;padding:8px 14px}
@media (max-width:860px){.cols-3,.cols-4{grid-template-columns:repeat(2,minmax(0,1fr))}.about.has-img{grid-template-columns:1fr}.about.img-right .about-img{order:0}.about-img img{aspect-ratio:4/3;max-height:460px}}
@media (max-width:600px){.track{grid-auto-columns:100%;gap:14px}.car-nav{justify-content:flex-start}.track.few{grid-template-columns:1fr}.cols-2,.cols-3,.cols-4{grid-template-columns:1fr}.top .btn span{display:none}.top .btn{width:42px;padding:0}.hero{min-height:82vh;padding:70px 0 60px}.hero .actions .btn{flex:1 1 100%}.gallery{columns:2 140px;column-gap:10px}.gallery figure{margin-bottom:10px}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.btn,.float{transition:none}}
</style></head>
<body>
${draft ? '<div class="draft">Vista previa: tu página aún no está publicada. Solo tú ves este enlace.</div>' : ""}
<nav class="top"><div class="wrap">${mark}<span class="name">${esc(name)}</span>${loginBtn("btn btn-ghost")}${ctaBtn(c.ctaLabel, "btn btn-brand")}</div></nav>
<header class="hero ${heroImg ? "has-img" : ""} ${hero.align === "left" ? "" : "center"}">
  ${heroImg ? `<img class="bgimg" src="${heroImg}" alt="" fetchpriority="high">` : ""}
  <div class="wrap">
    ${hero.showLogo && logo ? `<img class="hero-logo" src="${esc(logo)}" alt="${esc(name)}">` : ""}
    ${hero.kicker ? `<span class="kicker">${esc(hero.kicker)}</span>` : ""}
    <h1>${esc(hero.title || name)}</h1>
    ${hero.subtitle ? `<p class="lead">${esc(hero.subtitle)}</p>` : ""}
    <div class="actions">${ctaBtn(c.ctaLabel)}${loginBtn()}</div>
  </div>
</header>
<main>
${sections}
</main>
<footer><div class="wrap">
  <div><strong>${esc(name)}</strong>${seo.footer ? `<div>${esc(seo.footer)}</div>` : ""}<div class="made">Hecho con <a href="${esc(origin || "/")}/"${tgt}>VYTRAFIT</a></div></div>
  ${socials.length ? `<div class="socials">${socials.map(([k, u]) => `<a href="${esc(u)}"${tgt} aria-label="${k}">${ICONS[k]}</a>`).join("")}</div>` : ""}
</div></footer>
${c.floating && wa ? `<a class="float" href="${esc(waLink())}"${tgt} aria-label="Escribir por WhatsApp">${ICONS.wa}</a>` : ""}
${preview ? "" : '<script src="/p/landing.js" defer></script>'}
</body></html>`;
}

/* ============================================================
   Rutas públicas: /<enlace> y /p/img/<id>
   ============================================================ */
/* Único script de la página: flechas y puntos del carrusel de reseñas (sin él, se desliza igual con el dedo) */
const LANDING_JS = `document.querySelectorAll("[data-carousel]").forEach(function (c) {
  var t = c.querySelector(".track"), prev = c.querySelector(".car-prev"), next = c.querySelector(".car-next"), dots = c.querySelector(".dots");
  function step() { return t.clientWidth + (parseFloat(getComputedStyle(t).columnGap) || 0); }
  function pages() { return Math.max(1, Math.ceil((t.scrollWidth - 4) / step() - 0.02)); }
  function update() {
    var n = pages(), end = t.scrollLeft >= t.scrollWidth - t.clientWidth - 4;
    var i = end ? n - 1 : Math.min(n - 1, Math.round(t.scrollLeft / step()));
    c.classList.toggle("nav-on", n > 1);
    if (dots.children.length !== n) {
      dots.innerHTML = "";
      for (var k = 0; k < n; k++) (function (k) {
        var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "Página " + (k + 1));
        b.onclick = function () { t.scrollTo({ left: k * step(), behavior: "smooth" }); }; dots.appendChild(b);
      })(k);
    }
    for (var j = 0; j < dots.children.length; j++) dots.children[j].classList.toggle("on", j === i);
    prev.disabled = i <= 0; next.disabled = i >= n - 1;
  }
  prev.onclick = function () { t.scrollBy({ left: -step(), behavior: "smooth" }); };
  next.onclick = function () { t.scrollBy({ left: step(), behavior: "smooth" }); };
  var raf = 0; t.addEventListener("scroll", function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
  addEventListener("resize", update); update();
});`;

const cache = new Map(); // slug -> { html, at }
export const dropCache = () => cache.clear();
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self'; script-src 'self'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; base-uri 'self'; form-action 'none'; frame-ancestors 'self'; object-src 'none'";

export function mountLanding(app) {
  app.get("/p/landing.js", (_req, res) => {
    res.type("application/javascript").setHeader("Cache-Control", "public, max-age=3600");
    res.send(LANDING_JS);
  });
  app.get("/p/img/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!IMG_ID.test(id)) return res.status(404).end();
      const f = await knex("files").where({ id, kind: "page" }).first();
      if (!f) return res.status(404).end();
      res.setHeader("Content-Type", f.mime);
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      fs.createReadStream(path.join(config.uploadDir, f.path)).on("error", () => res.status(404).end()).pipe(res);
    } catch (e) { next(e); }
  });

  app.get(/^\/([a-z0-9][a-z0-9-]{1,39})\/?$/, async (req, res, next) => {
    try {
      const slug = req.params[0];
      const preview = typeof req.query.preview === "string" ? req.query.preview : "";
      const origin = `${req.protocol}://${req.get("host")}`;
      const hit = !preview && cache.get(slug);
      if (hit && Date.now() - hit.at < 15e3) return send(res, hit.html);
      const coach = await knex("users").where({ brand_slug: slug, role: "coach" }).first();
      if (!coach) return next();
      const { coachLicenseRow } = await import("./auth.js");
      const row = await knex("coach_pages").where({ coach_id: coach.id }).first();
      const published = row && !!row.published && row.published !== "0";
      const isPreview = preview && preview === previewSig(coach.id);
      if (!isPreview && (!published || !(await coachLicenseRow(coach.id)))) {
        res.setHeader("Cache-Control", "no-cache");
        return res.redirect(302, `/#${slug}`); // sin página: va directo a su acceso
      }
      const page = row ? { ...defaultPage(coach), ...J(row.data, {}) } : defaultPage(coach);
      const { approvedReviews } = await import("./reviews.js");
      const html = renderPage({ page, coach, origin, slug, draft: isPreview && !published, clientReviews: await approvedReviews(coach.id) });
      if (!isPreview) cache.set(slug, { html, at: Date.now() });
      send(res, html, isPreview);
    } catch (e) { next(e); }
  });
}
function send(res, html, priv = false) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("Cache-Control", priv ? "no-store" : "public, max-age=30");
  res.type("html").send(html);
}
