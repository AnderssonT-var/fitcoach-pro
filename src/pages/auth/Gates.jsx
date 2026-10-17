/* Pantallas previas a la app: carga, sin conexión, servidor (Android),
   contraseña temporal, aviso de privacidad y cuenta pausada. */
import { useState } from "react";
import Icon from "../../ui/Icon";
import { DevCredit, Field, PlatesLogo, toast } from "../../ui/kit";
import { useApp } from "../../context";
import { acceptConsent, changePassword, reload } from "../../store/db";
import { setServer } from "../../store/api";
import { SensitiveSummary } from "../legal/Legal";

export function Splash() {
  return (
    <div className="auth" aria-busy="true">
      <div className="auth-card" style={{ alignItems: "center", textAlign: "center" }}>
        <PlatesLogo size={76} />
        <p className="muted">Cargando…</p>
      </div>
    </div>
  );
}

export function OfflineScreen({ message }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="auth">
      <div className="auth-card" style={{ alignItems: "center", textAlign: "center" }}>
        <span className="app-icon" style={{ width: 64, height: 64, borderRadius: 15, background: "var(--surface-3)", color: "var(--ink-2)" }}><Icon name="wifi" size={30} /></span>
        <h1 style={{ fontSize: 28 }}>Sin conexión</h1>
        <p className="muted">{message || "No pudimos conectar con el servidor."}</p>
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={async () => { setBusy(true); await reload(); setBusy(false); }}>Reintentar</button>
      </div>
    </div>
  );
}

/** Solo en la app Android si se compiló sin la dirección del servidor. */
export function ServerSetup() {
  const [url, setUrl] = useState("https://");
  const [error, setError] = useState("");
  async function save(e) {
    e.preventDefault();
    let u = url.trim();
    if (!/^https:\/\/[^\s/]+\.[^\s]+/.test(u)) return setError("Escribe la dirección completa, por ejemplo https://app.tudominio.com");
    try {
      const r = await fetch(`${u.replace(/\/+$/, "")}/api/health`);
      if (!r.ok) throw new Error();
    } catch { return setError("No respondió un servidor de FitCoach Pro en esa dirección."); }
    setServer(u);
    window.location.reload();
  }
  return (
    <form className="auth" onSubmit={save}>
      <div className="auth-card">
        <div className="auth-hero">
          <span className="app-icon" style={{ width: 64, height: 64, borderRadius: 15 }}><Icon name="server" size={30} /></span>
          <h1 style={{ fontSize: 28 }}>Conectar con el servidor</h1>
          <p>Escribe la dirección de FitCoach Pro que te dio tu entrenador o el administrador.</p>
        </div>
        <div className="auth-box">
          <Field label="Dirección" id="srv-url"><input id="srv-url" className="input" inputMode="url" value={url} onChange={(e) => { setUrl(e.target.value); setError(""); }} /></Field>
          {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" type="submit">Conectar</button>
        </div>
      </div>
    </form>
  );
}

export function ChangePasswordForm({ onDone, forced }) {
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setError(""); };
  const rules = [
    ["Al menos 8 caracteres", f.next.length >= 8],
    ["Letras y números", /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(f.next) && /\d/.test(f.next)],
    ["Las dos coinciden", f.next && f.next === f.again],
  ];
  async function submit(e) {
    e.preventDefault();
    if (!rules.every((r) => r[1])) return setError("Revisa los requisitos de la contraseña.");
    setBusy(true);
    const r = await changePassword(f.current, f.next);
    setBusy(false);
    if (r.error) return setError(r.error);
    toast("Contraseña actualizada", "lock");
    setF({ current: "", next: "", again: "" });
    onDone?.();
  }
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <Field label={forced ? "Contraseña temporal" : "Contraseña actual"} id="pw-cur">
        <input id="pw-cur" className="input" type="password" autoComplete="current-password" value={f.current} onChange={set("current")} />
      </Field>
      <Field label="Nueva contraseña" id="pw-new"><input id="pw-new" className="input" type="password" autoComplete="new-password" value={f.next} onChange={set("next")} /></Field>
      <Field label="Repite la nueva contraseña" id="pw-again"><input id="pw-again" className="input" type="password" autoComplete="new-password" value={f.again} onChange={set("again")} /></Field>
      <ul className="pw-rules">{rules.map(([l, ok]) => <li key={l} className={ok ? "ok" : ""}><Icon name={ok ? "check" : "x"} size={14} stroke={3} />{l}</li>)}</ul>
      {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
    </form>
  );
}

export function ChangePasswordScreen() {
  const { me, signOut } = useApp();
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-hero">
          <span className="app-icon" style={{ width: 64, height: 64, borderRadius: 15 }}><Icon name="lock" size={30} /></span>
          <h1 style={{ fontSize: 28 }}>Crea tu contraseña</h1>
          <p>Hola {me.name.split(" ")[0]}. Entraste con una contraseña temporal; elige una propia que solo tú conozcas.</p>
        </div>
        <div className="auth-box"><ChangePasswordForm forced /></div>
        <button className="link-btn" onClick={signOut}>Salir</button>
      </div>
    </div>
  );
}

export function ConsentScreen() {
  const { me, signOut, openLegal } = useApp();
  const client = me.role === "client";
  const [accept, setAccept] = useState(false);
  const [photos, setPhotos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (!accept) return setError(client ? "Para continuar acepta el aviso de privacidad." : "Para continuar acepta los términos.");
    setBusy(true);
    const r = await acceptConsent(client ? photos : undefined);
    setBusy(false);
    if (r.error) setError(r.error);
  }
  return (
    <form className="auth" onSubmit={submit}>
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-hero">
          <span className="app-icon" style={{ width: 64, height: 64, borderRadius: 15 }}><Icon name="shield" size={30} /></span>
          <h1 style={{ fontSize: 28 }}>{client ? "Tu privacidad" : "Antes de empezar"}</h1>
          <p>{client
            ? "Tu entrenador registrará datos de tu salud y progreso. Queremos que sepas cómo los cuidamos."
            : "Vas a guardar datos de salud de tus asesorados. Revisa cómo se protegen y tus compromisos."}</p>
        </div>
        {client ? <SensitiveSummary /> : (
          <ul className="legal-points">
            <li><Icon name="lock" size={18} /><span>Registra solo los datos necesarios de cada asesorado y no los compartas fuera de la plataforma.</span></li>
            <li><Icon name="camera" size={18} /><span>Las fotos del cuerpo son datos sensibles: solo podrás subirlas si el asesorado activó su permiso.</span></li>
            <li><Icon name="trash" size={18} /><span>Atiende los pedidos de tus asesorados para corregir o eliminar sus datos.</span></li>
          </ul>
        )}
        <div className="auth-box">
          <label className="check-row">
            <input type="checkbox" checked={accept} onChange={(e) => { setAccept(e.target.checked); setError(""); }} />
            <span>{client ? "Acepto el " : "Acepto los "}
              {client
                ? <><button type="button" className="link-btn" onClick={() => openLegal("privacidad")}>aviso de privacidad</button> y el tratamiento de mis datos de salud para mi asesoría.</>
                : <><button type="button" className="link-btn" onClick={() => openLegal("terminos")}>términos de uso</button> y la <button type="button" className="link-btn" onClick={() => openLegal("privacidad")}>política de privacidad</button>.</>}
            </span>
          </label>
          {client && (
            <label className="check-row">
              <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
              <span><strong>Opcional:</strong> permito que mi entrenador y yo guardemos fotos de mi cuerpo para seguir mi progreso. Puedo retirar este permiso cuando quiera.</span>
            </label>
          )}
          {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>Continuar</button>
        </div>
        <button type="button" className="link-btn" onClick={signOut}>Salir</button>
        <DevCredit />
      </div>
    </form>
  );
}

export function BlockedScreen({ message }) {
  const { signOut } = useApp();
  return (
    <div className="auth">
      <div className="auth-card" style={{ alignItems: "center", textAlign: "center" }}>
        <span className="app-icon" style={{ width: 64, height: 64, borderRadius: 15, background: "var(--surface-3)", color: "var(--ink-2)" }}><Icon name="lock" size={30} /></span>
        <h1 style={{ fontSize: 28 }}>Acceso pausado</h1>
        <p className="muted">{message}</p>
        <div className="row gap-sm">
          <button className="btn btn-quiet" onClick={() => reload()}>Reintentar</button>
          <button className="btn btn-primary" onClick={signOut}>Salir</button>
        </div>
      </div>
    </div>
  );
}
