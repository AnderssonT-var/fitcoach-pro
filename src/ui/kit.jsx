import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { initials, sameDay, weekStart, addDays } from "../lib/format";
import { useDB, userById } from "../store/db";

/* ---------- Avatar: monograma como en Contactos ---------- */
const AVATAR_HUES = [212, 262, 330, 24, 152, 190, 284, 8];
export function Avatar({ name, id, size, photo }) {
  const db = useDB();
  const src = photo !== undefined ? photo : id ? userById(db, id)?.photo : null;
  const hue = AVATAR_HUES[Math.abs(+id || 0) % AVATAR_HUES.length];
  return (
    <span className={`avatar ${size || ""}`} aria-hidden="true" style={{ "--av-h": hue }}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

/** Logo del entrenador (o el icono de la app si no tiene). */
export function BrandMark({ brand, size = 30 }) {
  if (brand?.logo) {
    return <img className="brand-logo" src={brand.logo} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: size * 0.2237 }} />;
  }
  if (brand?.color) {
    return (
      <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.2237, background: brand.color, fontSize: size * 0.42, fontWeight: 700 }} aria-hidden="true">
        {initials(brand.name || brand.coach?.name || "")}
      </span>
    );
  }
  return <AppIcon size={size} />;
}

export function Pill({ tone, children, plain }) {
  return <span className={`pill ${tone || ""} ${plain ? "plain" : ""}`}>{children}</span>;
}

/** Icono de la app: mancuerna sobre degradado, con esquinas de icono de iOS. */
export function AppIcon({ size = 30 }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.2237 }} aria-hidden="true">
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
      </svg>
    </span>
  );
}
export const PlatesLogo = AppIcon;

/* ---------- Modal / hoja inferior en móvil ---------- */
export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const first = ref.current?.querySelector("input, select, textarea");
    first?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Se monta en <body> para quedar siempre encima (p. ej. sobre la pantalla de entrenamiento).
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Confirmación dentro de la página (los diálogos del navegador no están disponibles). */
export function Confirm({ title, text, confirmLabel, tone = "danger", onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
    </>}>
      <p className="ink2">{text}</p>
    </Modal>
  );
}

/* ---------- Toasts ---------- */
let toasts = [];
const tl = new Set();
const emitT = () => tl.forEach((l) => l());
export function toast(text, icon = "check") {
  const t = { id: Math.random(), text, icon };
  toasts = [...toasts, t]; emitT();
  setTimeout(() => { toasts = toasts.filter((x) => x !== t); emitT(); }, 2800);
}
export function Toasts() {
  const list = useSyncExternalStore((l) => { tl.add(l); return () => tl.delete(l); }, () => toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => <div key={t.id} className="toast"><Icon name={t.icon} size={18} />{t.text}</div>)}
    </div>
  );
}

export function CopyButton({ text, label = "Copiar", small }) {
  const [ok, setOk] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setOk(true); toast("Copiado", "copy"); setTimeout(() => setOk(false), 1500); }
    catch { toast("Selecciona el texto y cópialo manualmente", "alert"); }
  }
  return (
    <button className={`btn btn-quiet ${small ? "btn-sm" : ""}`} onClick={copy} aria-label={`${label} ${text}`}>
      <Icon name={ok ? "check" : "copy"} size={small ? 15 : 17} />{label}
    </button>
  );
}

/* ---------- KPI ---------- */
export function Stat({ label, value, sub, tone, icon }) {
  return (
    <div className="stat">
      <span className={`stat-label ${tone || ""}`}>{icon && <span className={`stat-ico ${tone || ""}`}><Icon name={icon} size={16} stroke={2.2} /></span>}<span>{label}</span></span>
      <span className={`stat-value ${tone || ""}`}>{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Empty({ icon = "sparkle", title, text, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/* ---------- Semana actual ---------- */
const WD = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export function WeekStrip({ workouts }) {
  const mon = weekStart(new Date());
  return (
    <div className="week">
      {WD.map((w, i) => {
        const d = addDays(mon, i);
        const done = workouts.some((x) => sameDay(x.finishedAt, d));
        const today = sameDay(d, new Date());
        return (
          <div key={w} className={`week-day ${done ? "done" : ""} ${today ? "today" : ""}`} aria-label={`${w} ${d.getDate()}${done ? ", entrenado" : ""}`}>
            <div className="wd">{w[0] === "M" && w.startsWith("Mi") ? "X" : w[0]}</div>
            <div className="dn">{done ? <Icon name="check" size={18} stroke={3} /> : d.getDate()}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Dots({ done, goal }) {
  const n = Math.max(goal || 0, done);
  return (
    <span className="dots" aria-label={`${done} de ${goal} entrenamientos`}>
      {Array.from({ length: n }, (_, i) => <i key={i} className={i < done ? "on" : ""} />)}
    </span>
  );
}

export function Field({ label, id, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** Crédito del desarrollador. */
export function DevCredit({ className = "" }) {
  return (
    <p className={`dev-credit ${className}`}>
      Desarrollado por <a href="https://anderssont-var.github.io/" target="_blank" rel="noopener">A.T.</a>
    </p>
  );
}

/** Espera una acción del servidor: muestra su error o el mensaje de éxito. */
export async function run(p, ok, icon = "check") {
  const r = await p;
  if (r && r.error) { toast(r.error, "alert"); return r; }
  if (ok) toast(ok, icon);
  return r;
}
