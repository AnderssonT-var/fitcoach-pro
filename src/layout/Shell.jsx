import { useState } from "react";
import Icon from "../ui/Icon";
import { Avatar, BrandMark, Modal, DevCredit } from "../ui/kit";
import { NAV, ROLE_LABEL, useApp } from "../context";
import { brandOf, dismissSyncError, flushOutbox, reload, unreadFor, useDB } from "../store/db";

const MAX_TABS = 5;

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem("fcp2.theme") || "system"; } catch { return "system"; }
  });
  function setTheme(t) {
    setThemeState(t);
    try { localStorage.setItem("fcp2.theme", t); } catch { /* nada */ }
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  return [theme, setTheme];
}
export function applyStoredTheme() {
  try {
    const t = localStorage.getItem("fcp2.theme");
    if (t && t !== "system") document.documentElement.setAttribute("data-theme", t);
  } catch { /* nada */ }
}
const isDark = (t) => t === "dark" || (t === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

export default function Shell({ children }) {
  const { me, page, go, signOut } = useApp();
  const db = useDB();
  const [theme, setTheme] = useTheme();
  const [sheet, setSheet] = useState(false);
  const items = NAV[me.role];
  const unread = unreadFor(db, me.id);
  const pendingSubs = me.role === "admin" ? db.subscriptions.filter((x) => x.status === "pending").length : 0;
  const pendingReviews = me.role === "coach" ? (db.reviews || []).filter((r) => r.status === "pending").length : 0;
  const badge = (it) => (it.badge === "unread" ? unread : it.badge === "pendingSubs" ? pendingSubs : it.badge === "reviews" ? pendingReviews : 0);
  const tabs = items.length > MAX_TABS ? items.slice(0, MAX_TABS - 1) : items;
  const extra = items.length > MAX_TABS ? items.slice(MAX_TABS - 1) : [];
  const dark = isDark(theme);
  const brand = brandOf(db, me);
  const brandName = brand?.name || "";

  const [syncing, setSyncing] = useState(false);
  async function sync() { setSyncing(true); await flushOutbox(); await reload(); setSyncing(false); }
  const pending = db.pendingOps?.length || 0;
  const errors = db.syncErrors || [];
  const [showPending, setShowPending] = useState(false);
  const offlineText = me.role === "client"
    ? "Sin conexión. Puedes seguir usando la app: todo se guarda en tu equipo y se sube solo."
    : "Sin conexión. Puedes seguir trabajando: los cambios se guardan y se suben solos al volver la señal.";

  return (
    <div className="shell">
      {/* ---------- Barra lateral (PC) ---------- */}
      <aside className="sidebar" aria-label="Menú principal">
        <div className="brand">
          <BrandMark brand={brand} size={32} />
          <span className="brand-name ellipsis">{brandName || <>VYTRA<span>FIT</span></>}</span>
        </div>
        <nav className="nav">
          {items.map((it) => (
            <button key={it.id} className="nav-item" aria-current={page === it.id ? "page" : undefined} onClick={() => go(it.id)}>
              <Icon name={it.icon} />{it.label}
              {badge(it) > 0 && <span className="nav-count">{badge(it)}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="row" style={{ padding: "2px 2px" }}>
            <button className="nav-item grow" style={{ padding: "6px 6px" }} onClick={() => go(me.role === "admin" ? "cuenta" : "perfil")}>
              <Avatar name={me.name} id={me.id} size="sm" />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="strong ellipsis small" style={{ display: "block" }}>{me.name}</span>
                <span className="tiny" style={{ opacity: .7 }}>{me.role === "admin" ? "Mi cuenta" : "Ver mi perfil"}</span>
              </span>
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión"><Icon name="logout" size={18} /></button>
          </div>
          <DevCredit className="in-sidebar" />
        </div>
      </aside>

      <div className="main">
        {/* ---------- Barra superior (PC) ---------- */}
        <header className="topbar">
          <span className="small muted grow">{ROLE_LABEL[me.role]} · {me.name}</span>
          <button className="btn btn-ghost btn-icon" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"} title="Cambiar tema">
            <Icon name={dark ? "sun" : "moon"} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={sync} disabled={syncing} aria-label="Actualizar datos" title="Actualizar"><Icon name="refresh" /></button>
        </header>

        {/* ---------- Barra superior (móvil) ---------- */}
        <header className="mobile-top">
          <div className="row gap-sm" style={{ minWidth: 0 }}><BrandMark brand={brand} size={28} /><span className="brand-name ellipsis">{brandName || <>VYTRA<span>FIT</span></>}</span></div>
          <button className="btn btn-ghost btn-icon" onClick={() => setSheet(true)} aria-label="Cuenta y opciones" style={{ padding: 0 }}>
            <Avatar name={me.name} id={me.id} size="sm" />
          </button>
        </header>

        <div className="content" id="content">
          {(db.offline || db.busy || pending > 0) && (
            <div className={`net-bar ${db.offline ? "off" : ""}`} role="status">
              <Icon name="wifi" size={16} />
              <span className="grow">
                {db.offline ? offlineText : db.busy ? "Mucha gente conectada: tus datos se actualizan en unos segundos." : ""}
                {pending > 0 && <> {" "}<button className="link-btn" onClick={() => setShowPending((v) => !v)}>{pending === 1 ? "1 cambio" : `${pending} cambios`} por subir</button>{db.offline ? "." : "…"}</>}
              </span>
              {!db.offline && pending > 0 && <button className="btn btn-quiet btn-sm" onClick={sync} disabled={syncing}>Subir ahora</button>}
            </div>
          )}
          {showPending && pending > 0 && (
            <div className="net-list">
              {db.pendingOps.map((o) => (
                <div key={o.id} className="row gap-sm small"><span className="dot-pending" /><span className="grow ellipsis">{o.label}</span><span className="muted tiny">{new Date(o.at).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}</span></div>
              ))}
            </div>
          )}
          {errors.length > 0 && (
            <div className="net-bar err" role="alert">
              <Icon name="alert" size={16} />
              <span className="grow">
                {errors.length === 1 ? <>No se pudo guardar «{errors[0].label}»: {errors[0].error}</> : <>{errors.length} cambios no se pudieron guardar. El último: «{errors.at(-1).label}»: {errors.at(-1).error}</>}
              </span>
              <button className="btn btn-quiet btn-sm" onClick={() => dismissSyncError()}>Entendido</button>
            </div>
          )}
          {children}
        </div>
      </div>

      {/* ---------- Pestañas inferiores (móvil) ---------- */}
      <nav className="bottom-nav" aria-label="Navegación">
        {tabs.map((it) => (
          <button key={it.id} aria-current={page === it.id ? "page" : undefined} onClick={() => go(it.id)}>
            <span className="ico"><Icon name={it.icon} size={21} /></span>
            <span className="lbl">{it.label}</span>
            {badge(it) > 0 && <span className="nav-count">{badge(it)}</span>}
          </button>
        ))}
        {extra.length > 0 && (
          <button aria-current={extra.some((e) => e.id === page) ? "page" : undefined} onClick={() => setSheet(true)}>
            <span className="ico"><Icon name="menu" size={21} /></span><span className="lbl">Más</span>
            {extra.reduce((t, it) => t + badge(it), 0) > 0 && <span className="nav-count">{extra.reduce((t, it) => t + badge(it), 0)}</span>}
          </button>
        )}
      </nav>

      {sheet && (
        <Modal title="Menú" onClose={() => setSheet(false)}>
          <div className="row">
            <Avatar name={me.name} id={me.id} />
            <div className="grow"><div className="strong">{me.name}</div><div className="small muted">{me.email} · {ROLE_LABEL[me.role]}</div></div>
          </div>
          {extra.length > 0 && (
            <div className="panel list">
              {extra.map((it) => (
                <button key={it.id} className="list-row" onClick={() => { go(it.id); setSheet(false); }}>
                  <Icon name={it.icon} /><span className="grow strong">{it.label}</span>
                  {badge(it) > 0 && <span className="nav-count">{badge(it)}</span>}
                  <Icon name="right" size={18} />
                </button>
              ))}
            </div>
          )}
          <div className="field">
            <span className="label">Tema</span>
            <div className="seg" role="group" aria-label="Tema" style={{ display: "flex" }}>
              {[["system", "Sistema"], ["light", "Claro"], ["dark", "Oscuro"]].map(([v, l]) => (
                <button key={v} style={{ flex: 1 }} aria-pressed={theme === v} onClick={() => setTheme(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="row">
            <button className="btn btn-quiet grow" onClick={() => { setSheet(false); sync(); }}><Icon name="refresh" size={17} />Actualizar</button>
            <button className="btn btn-danger grow" onClick={() => { setSheet(false); signOut(); }}><Icon name="logout" size={17} />Cerrar sesión</button>
          </div>
          <DevCredit />
        </Modal>
      )}

    </div>
  );
}
