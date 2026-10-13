/* Formatos y fechas compartidos por toda la app */

export const CURRENCY = { code: "USD", locale: "es-EC" };
export const LICENSE_PLANS = [
  { months: 1,  price: 19,  label: "1 mes" },
  { months: 3,  price: 49,  label: "3 meses" },
  { months: 6,  price: 89,  label: "6 meses" },
  { months: 12, price: 159, label: "12 meses" },
];
export const planPrice = (m) => LICENSE_PLANS.find((p) => p.months === m)?.price ?? 0;

export const DAY = 86400000;

export function money(n) {
  return new Intl.NumberFormat(CURRENCY.locale, {
    style: "currency", currency: CURRENCY.code, maximumFractionDigits: n % 1 ? 2 : 0,
  }).format(n || 0);
}
export function kg(n) {
  if (n == null || Number.isNaN(+n)) return "—";
  return (Math.round(n * 100) / 100).toLocaleString("es-EC", { maximumFractionDigits: 2 });
}
export function tons(n) {
  return n >= 1000 ? `${(n / 1000).toLocaleString("es-EC", { maximumFractionDigits: 1 })} t` : `${kg(n)} kg`;
}
export function clock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}
export function minutes(sec) { return `${Math.round(sec / 60)} min`; }

export function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
export function weekStart(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function sameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }
export function daysUntil(iso) { return Math.ceil((new Date(iso) - startOfDay(new Date())) / DAY); }
export function daysSince(iso) { return Math.floor((startOfDay(new Date()) - startOfDay(iso)) / DAY); }

export function date(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(iso).toLocaleDateString("es-EC", opts);
}
export function shortDate(iso) {
  const sameYear = new Date(iso).getFullYear() === new Date().getFullYear();
  return date(iso, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}
export function weekdayDate(iso) { return date(iso, { weekday: "short", day: "numeric", month: "short" }); }
export function time(iso) { return new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }); }

export function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400 && sameDay(iso, new Date())) return `hace ${Math.floor(s / 3600)} h`;
  const d = daysSince(iso);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return shortDate(iso);
}

export function monthName(d = new Date()) {
  return new Date(d).toLocaleDateString("es-EC", { month: "long" });
}
export function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
export function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
export function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

/** "90s" → 90 · "2min" → 120 · "1:30" → 90 */
export function parseRest(rest) {
  if (rest == null || rest === "") return 90;
  if (typeof rest === "number") return rest;
  const s = String(rest).trim().toLowerCase();
  const mmss = s.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return +mmss[1] * 60 + +mmss[2];
  const n = parseFloat(s);
  if (Number.isNaN(n)) return 90;
  return /m/.test(s) ? Math.round(n * 60) : Math.round(n);
}
export function repsLow(reps) {
  const n = parseInt(String(reps), 10);
  return Number.isNaN(n) ? null : n;
}
