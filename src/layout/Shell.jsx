import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { Avatar, BrandMark, Confirm, Modal, toast, DevCredit } from "../ui/kit";
import { NAV, ROLE_LABEL, useApp } from "../context";
import { brandOf, loginAs, resetDemo, unreadFor, useDB } from "../store/db";

const DEMO = [
  { id: 1, label: "Admin" },
  { id: 2, label: "Entrenador" },
  { id: 10, label: "Cliente" },
];
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
  const [askReset, setAskReset] = useState(false);
  const items = NAV[me.role];
  const unread = unreadFor(db, me.id);
  const badge = (it) => (it.badge === "unread" && unread ? unread : 0);
  const tabs = items.length > MAX_TABS ? items.slice(0, MAX_TABS - 1) : items;
  const extra = items.length > MAX_TABS ? items.slice(MAX_TABS - 1) : [];
  const dark = isDark(theme);
  const brand = brandOf(db, me);
  const brandName = brand?.name || "";

  useEffect(() => {
    const full = () => toast("No queda espacio en este navegador para más fotos. Elimina algunas.", "alert");
    window.addEventListener("fcp:storage-full", full);
    return () => window.removeEventListener("fcp:storage-full", full);
  }, []);

  function switchTo(id) {
    if (id === me.id) return;
    loginAs(id); go("inicio"); setSheet(false);
  }
  const doReset = () => { resetDemo(); go("inicio"); toast("Datos del demo restablecidos", "refresh"); };

  return (
    <div className="shell">
      {/* ---------- Barra lateral (PC) ---------- */}
      <aside className="sidebar" aria-label="Menú principal">
        <div className="brand">
          <BrandMark brand={brand} size={32} />
          <span className="brand-name ellipsis">{brandName || <>FitCoach <span>Pro</span></>}</span>
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
            <button className="nav-item grow" style={{ padding: "6px 6px" }} onClick={() => me.role !== "admin" && go("perfil")} disabled={me.role === "admin"}>
              <Avatar name={me.name} id={me.id} size="sm" />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="strong ellipsis small" style={{ display: "block" }}>{me.name}</span>
                <span className="tiny" style={{ opacity: .7 }}>{me.role === "admin" ? ROLE_LABEL[me.role] : "Ver mi perfil"}</span>
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
          <span className="small muted grow">Demo con datos de ejemplo · los cambios se guardan en este navegador</span>
          <div className="demo-switch" role="group" aria-label="Ver el demo como">
            {DEMO.map((d) => (
              <button key={d.id} aria-pressed={me.role === { 1: "admin", 2: "coach", 10: "client" }[d.id]} onClick={() => switchTo(d.id)}>{d.label}</button>
            ))}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"} title="Cambiar tema">
            <Icon name={dark ? "sun" : "moon"} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => setAskReset(true)} aria-label="Restablecer datos del demo" title="Restablecer datos del demo"><Icon name="refresh" /></button>
        </header>

        {/* ---------- Barra superior (móvil) ---------- */}
        <header className="mobile-top">
          <div className="row gap-sm" style={{ minWidth: 0 }}><BrandMark brand={brand} size={28} /><span className="brand-name ellipsis">{brandName || <>FitCoach <span>Pro</span></>}</span></div>
          <button className="btn btn-ghost btn-icon" onClick={() => setSheet(true)} aria-label="Cuenta y opciones del demo" style={{ padding: 0 }}>
            <Avatar name={me.name} id={me.id} size="sm" />
          </button>
        </header>

        <div className="content" id="content">{children}</div>
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
            <span className="label">Ver el demo como</span>
            <div className="seg" role="group" aria-label="Ver el demo como" style={{ display: "flex" }}>
              {DEMO.map((d) => (
                <button key={d.id} style={{ flex: 1 }} aria-pressed={me.role === { 1: "admin", 2: "coach", 10: "client" }[d.id]} onClick={() => switchTo(d.id)}>{d.label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">Tema</span>
            <div className="seg" role="group" aria-label="Tema" style={{ display: "flex" }}>
              {[["system", "Sistema"], ["light", "Claro"], ["dark", "Oscuro"]].map(([v, l]) => (
                <button key={v} style={{ flex: 1 }} aria-pressed={theme === v} onClick={() => setTheme(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="row">
            <button className="btn btn-quiet grow" onClick={() => { setSheet(false); setAskReset(true); }}><Icon name="refresh" size={17} />Restablecer demo</button>
            <button className="btn btn-danger grow" onClick={() => { setSheet(false); signOut(); }}><Icon name="logout" size={17} />Cerrar sesión</button>
          </div>
          <DevCredit />
        </Modal>
      )}

      {askReset && (
        <Confirm title="Restablecer el demo" confirmLabel="Restablecer" onConfirm={doReset} onClose={() => setAskReset(false)}
          text="Se borran los cambios que hiciste (clientes, pagos, entrenamientos, licencias) y vuelven los datos de ejemplo." />
      )}
    </div>
  );
}
