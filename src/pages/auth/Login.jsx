import { isNative } from "../../store/api";
import { useState } from "react";
import Icon from "../../ui/Icon";
import { BrandMark, Field, PlatesLogo, toast, DevCredit } from "../../ui/kit";
import { useApp } from "../../context";
import { activateLicense, login, normalizeCode, signupWithCoach } from "../../store/db";
import { GOALS } from "../coach/Clients";
import { money } from "../../lib/format";

export default function Login({ slug = "", brand, onBrand }) {
  const [mode, setMode] = useState("login");
  const coach = brand?.data;
  return (
    <div className="auth">
      {mode === "signup" && coach?.signup?.open ? <SignupForm slug={slug} coach={coach} onBack={() => setMode("login")} />
        : mode === "login" || mode === "signup"
        ? <LoginForm key={coach?.coachId || "general"} slug={slug} coach={coach} loading={brand?.loading}
            unknownSlug={slug && !brand?.loading && !coach ? slug : ""} onBrand={onBrand} onActivate={() => setMode("activate")} onSignup={() => setMode("signup")} />
        : <ActivateForm onBack={() => setMode("login")} />}
    </div>
  );
}

function LegalLinks() {
  const { openLegal } = useApp();
  return (
    <p className="tiny muted" style={{ textAlign: "center" }}>
      <button type="button" className="link-btn tiny" onClick={() => openLegal("privacidad")}>Privacidad</button>
      {" · "}
      <button type="button" className="link-btn tiny" onClick={() => openLegal("terminos")}>Términos</button>
    </p>
  );
}

function LoginForm({ slug, coach, loading, unknownSlug, onBrand, onActivate, onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const brand = coach ? { coach: { name: coach.coachName, photo: coach.coachPhoto }, name: coach.businessName, logo: coach.logo, color: coach.color } : null;

  async function submit(e) {
    e.preventDefault();
    if (!email || !password) { setError("Escribe tu correo y tu contraseña."); return; }
    setBusy(true);
    const r = await login(email, password, coach ? slug : null);
    setBusy(false);
    if (r.error) setError(r.error);
  }

  return (
    <div className="auth-card">
      {coach ? (
        <div className="auth-hero">
          <BrandMark brand={brand} size={84} />
          <h1>{coach.businessName || coach.coachName}</h1>
          {coach.tagline && <p>{coach.tagline}</p>}
          <span className="coach-chip">con {coach.coachName}</span>
          {coach.page && !isNative() && <a className="small link-btn" style={{ marginTop: 8 }} href={`/${coach.slug}`}>Conoce mi página →</a>}
        </div>
      ) : (
        <div className="auth-hero">
          <PlatesLogo size={76} />
          <h1>VYTRAFIT</h1>
          <p>{loading ? "Cargando…" : "Rutinas, seguimiento y pagos de tus clientes, en un solo lugar."}</p>
        </div>
      )}

      {unknownSlug && <div className="warn-box"><Icon name="alert" size={18} />El enlace “#{unknownSlug}” no corresponde a ningún entrenador. Puedes entrar desde aquí.</div>}

      <form className="auth-box" onSubmit={submit} noValidate>
        <Field label="Correo" id="login-email">
          <input id="login-email" className={`input ${error ? "invalid" : ""}`} type="email" autoComplete="username" placeholder="tu@correo.com" inputMode="email" autoCapitalize="none"
            value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
        </Field>
        <Field label="Contraseña" id="login-pass">
          <div style={{ position: "relative" }}>
            <input id="login-pass" className={`input ${error ? "invalid" : ""}`} type={show ? "text" : "password"} autoComplete="current-password"
              value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} style={{ paddingRight: 44 }} />
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setShow(!show)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="eye" size={18} /></button>
          </div>
        </Field>
        {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>{busy ? "Entrando…" : "Iniciar sesión"}</button>
        <button type="button" className="link-btn small" style={{ alignSelf: "center" }} onClick={() => setForgot(!forgot)}>¿Olvidaste tu contraseña?</button>
        {forgot && (
          <div className="note-box small"><Icon name="lock" size={16} /><span>
            Si eres asesorado, pídele a tu entrenador una contraseña temporal desde tu ficha. Si eres entrenador, escríbele al administrador de la plataforma. Por seguridad, al entrar tendrás que crear una nueva.
          </span></div>
        )}
      </form>

      {coach?.signup?.open && (
        <div className="signup-cta">
          <div><strong>¿Eres nuevo?</strong> Inscríbete con {coach.coachName.split(" ")[0]}{coach.signup.trialDays ? <> y empieza tu {coach.signup.trialDays === 30 ? "mes" : `prueba de ${coach.signup.trialDays} días`} de prueba{coach.signup.trialFee ? ` (${money(coach.signup.trialFee)})` : " gratis"}</> : null}.</div>
          <button type="button" className="btn btn-quiet btn-block" onClick={onSignup}><Icon name="plus" size={17} />Crear mi cuenta</button>
        </div>
      )}
      {coach ? (
        <p className="small muted" style={{ textAlign: "center" }}>
          Acceso exclusivo para {coach.businessName || coach.coachName} y sus asesorados ·{" "}
          <button className="link-btn" style={{ fontSize: 13 }} onClick={() => onBrand?.("")}>Ir al acceso general</button>
        </p>
      ) : (
        <button type="button" className="auth-link" onClick={onActivate}>
          <span className="ico-badge"><Icon name="key" size={18} /></span>
          <span className="grow"><small>¿Eres entrenador y tienes un código?</small><strong>Activa tu cuenta</strong></span>
          <Icon name="right" size={18} />
        </button>
      )}
      <LegalLinks />
      <DevCredit />
    </div>
  );
}

function ActivateForm({ onBack }) {
  const { openLegal } = useApp();
  const [f, setF] = useState({ code: "", name: "", email: "", password: "", acceptTerms: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: k === "code" ? normalizeCode(e.target.value) : k === "acceptTerms" ? e.target.checked : e.target.value }); setError(""); };

  async function submit(e) {
    e.preventDefault();
    if (f.code.length < 18) return setError("El código tiene el formato FIT-XXXX-XXXX-XXXX.");
    if (!f.name.trim() || !f.email.includes("@")) return setError("Escribe tu nombre y un correo válido.");
    if (f.password.length < 8 || !/\d/.test(f.password) || !/[a-zA-Z]/.test(f.password)) return setError("La contraseña necesita al menos 8 caracteres, con letras y números.");
    if (!f.acceptTerms) return setError("Acepta los términos y la política de privacidad.");
    setBusy(true);
    const r = await activateLicense(f);
    setBusy(false);
    if (r.error) setError(r.error);
    else toast("Licencia activada. ¡Bienvenido!", "key");
  }

  return (
    <form className="auth-card" onSubmit={submit} noValidate>
      <button type="button" className="link-btn row gap-xs" onClick={onBack} style={{ alignSelf: "flex-start" }}><Icon name="left" size={18} />Iniciar sesión</button>
      <div className="auth-hero">
        <span className="app-icon" style={{ width: 64, height: 64, borderRadius: 15 }}><Icon name="key" size={32} stroke={2} /></span>
        <h1 style={{ fontSize: 32 }}>Activa tu licencia</h1>
        <p>Crea tu cuenta de entrenador con el código que te dio el administrador. La licencia empieza a contar hoy.</p>
      </div>
      <div className="auth-box">
        <Field label="Código de licencia" id="act-code">
          <input id="act-code" className="input num" style={{ letterSpacing: ".08em", fontWeight: 600 }} placeholder="FIT-XXXX-XXXX-XXXX" value={f.code} onChange={set("code")} autoCapitalize="characters" autoComplete="off" />
        </Field>
        <Field label="Nombre completo" id="act-name"><input id="act-name" className="input" value={f.name} onChange={set("name")} autoComplete="name" /></Field>
        <Field label="Correo" id="act-email"><input id="act-email" className="input" type="email" value={f.email} onChange={set("email")} autoComplete="email" autoCapitalize="none" /></Field>
        <Field label="Contraseña" id="act-pass" hint="Mínimo 8 caracteres, con letras y números."><input id="act-pass" className="input" type="password" value={f.password} onChange={set("password")} autoComplete="new-password" /></Field>
        <label className="check-row">
          <input type="checkbox" checked={f.acceptTerms} onChange={set("acceptTerms")} />
          <span>Acepto los <button type="button" className="link-btn" onClick={() => openLegal("terminos")}>términos de uso</button> y la <button type="button" className="link-btn" onClick={() => openLegal("privacidad")}>política de privacidad</button>, y me comprometo a cuidar los datos de mis asesorados.</span>
        </label>
        {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>{busy ? "Activando…" : "Activar y entrar"}</button>
      </div>
      <DevCredit />
    </form>
  );
}

/* Inscripción desde el enlace del entrenador */
function SignupForm({ slug, coach, onBack }) {
  const { openLegal } = useApp();
  const [f, setF] = useState({ name: "", email: "", phone: "", goal: "Hipertrofia", password: "", accept: false, photos: false, website: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }); setError(""); };
  const brand = { coach: { name: coach.coachName, photo: coach.coachPhoto }, name: coach.businessName, logo: coach.logo, color: coach.color };
  const s = coach.signup;
  async function submit(e) {
    e.preventDefault();
    if (f.name.trim().length < 3) return setError("Escribe tu nombre completo.");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError("Escribe un correo válido: lo usarás para entrar.");
    if (f.password.length < 8 || !/\d/.test(f.password) || !/[a-zA-Z]/.test(f.password)) return setError("La contraseña necesita al menos 8 caracteres, con letras y números.");
    if (!f.accept) return setError("Acepta el aviso de privacidad para inscribirte.");
    setBusy(true);
    const r = await signupWithCoach({ slug, name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone, goal: f.goal, password: f.password, acceptTerms: true, photos: f.photos, website: f.website });
    setBusy(false);
    if (r.error) return setError(r.error);
    toast(`¡Bienvenido/a, ${f.name.split(" ")[0]}!`, "check");
  }
  return (
    <div className="auth-card">
      <div className="auth-hero">
        <BrandMark brand={brand} size={64} />
        <h1 style={{ fontSize: 28 }}>Inscríbete con {coach.businessName || coach.coachName}</h1>
        <p>{s.trialDays ? `Empiezas con ${s.trialDays === 30 ? "un mes" : `${s.trialDays} días`} de prueba${s.trialFee ? ` por ${money(s.trialFee)}` : " gratis"}${s.fee ? `; luego ${money(s.fee)} al mes` : ""}.` : s.fee ? `Mensualidad: ${money(s.fee)}.` : "Crea tu cuenta para empezar a entrenar."}</p>
      </div>
      <form className="auth-box" onSubmit={submit} noValidate>
        <Field label="Nombre completo" id="su-name"><input id="su-name" className="input" autoComplete="name" value={f.name} onChange={set("name")} /></Field>
        <Field label="Correo" id="su-email"><input id="su-email" className="input" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" placeholder="tu@correo.com" value={f.email} onChange={set("email")} /></Field>
        <div className="form-grid">
          <Field label="Teléfono" id="su-phone"><input id="su-phone" className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} /></Field>
          <Field label="Objetivo" id="su-goal"><select id="su-goal" className="select" value={f.goal} onChange={set("goal")}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></Field>
        </div>
        <Field label="Crea tu contraseña" id="su-pass" hint="Al menos 8 caracteres, con letras y números">
          <div style={{ position: "relative" }}>
            <input id="su-pass" className="input" type={show ? "text" : "password"} autoComplete="new-password" value={f.password} onChange={set("password")} style={{ paddingRight: 44 }} />
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setShow(!show)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="eye" size={18} /></button>
          </div>
        </Field>
        {/* campo trampa: las personas no lo ven */}
        <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
        <label className="check-row"><input type="checkbox" checked={f.accept} onChange={set("accept")} />
          <span>Acepto el <button type="button" className="link-btn small" onClick={() => openLegal("privacidad")}>aviso de privacidad</button> y los <button type="button" className="link-btn small" onClick={() => openLegal("terminos")}>términos</button>. Mis medidas y lesiones son datos sensibles y solo los verá mi entrenador.</span></label>
        <label className="check-row"><input type="checkbox" checked={f.photos} onChange={set("photos")} />
          <span><strong>Opcional:</strong> permito que mi entrenador y yo guardemos fotos de mi cuerpo para seguir mi progreso. Puedo retirarlo cuando quiera.</span></label>
        {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>{busy ? "Creando tu cuenta…" : "Crear mi cuenta"}</button>
        <button type="button" className="link-btn small" style={{ alignSelf: "center" }} onClick={onBack}>Ya tengo cuenta: iniciar sesión</button>
      </form>
      <DevCredit />
    </div>
  );
}
