import { useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, BrandMark, Field, PlatesLogo, toast, DevCredit } from "../../ui/kit";
import { activateLicense, clientsOf, coachBySlug, login, normalizeCode, useDB } from "../../store/db";

const DEMOS = [
  { email: "carlos@fitcoach.com", password: "coach123", role: "Entrenador", what: "Clientes, rutinas, pagos y mensajes" },
  { email: "sofia@fitcoach.com", password: "user123", role: "Cliente", what: "Rutina, entrenamiento en vivo y progreso" },
  { email: "admin@fitcoach.com", password: "admin123", role: "Administrador", what: "Licencias y entrenadores" },
];

export default function Login({ slug = "", onBrand }) {
  const db = useDB();
  const [mode, setMode] = useState("login");
  const coach = coachBySlug(db, slug);
  return (
    <div className="auth">
      {mode === "login"
        ? <LoginForm key={coach?.id || "general"} db={db} coach={coach} unknownSlug={slug && !coach ? slug : ""} onBrand={onBrand} onActivate={() => setMode("activate")} />
        : <ActivateForm db={db} onBack={() => setMode("login")} />}
    </div>
  );
}

function LoginForm({ db, coach, unknownSlug, onBrand, onActivate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const b = coach?.brand || {};
  const brand = coach ? { coach, name: b.businessName, logo: b.logo, color: b.color } : null;

  // Cuentas de ejemplo: con marca, solo el entrenador y sus asesorados
  const demos = coach
    ? [
        { email: coach.email, password: coach.password, role: "Entrenador", what: b.businessName ? `Panel de ${b.businessName}` : "Tu panel de entrenador", id: coach.id, name: coach.name },
        ...clientsOf(db, coach.id).filter((c) => c.active).slice(0, 2).map((c) => ({ email: c.user.email, password: c.user.password, role: "Asesorado", what: c.routine ? c.routine.name : c.goal, id: c.userId, name: c.user.name })),
      ]
    : DEMOS.map((d) => { const u = db.users.find((x) => x.email === d.email); return { ...d, id: u?.id, name: u?.name }; });
  const branded = db.users.filter((u) => u.role === "coach" && u.brand?.slug && (u.brand.businessName || u.brand.logo));

  function submit(e) {
    e.preventDefault();
    if (!email || !password) { setError("Escribe tu correo y tu contraseña."); return; }
    const r = login(email, password, coach?.id);
    if (r.error) setError(r.error);
  }
  function quick(d) { const r = login(d.email, d.password, coach?.id); if (r.error) setError(r.error); }

  return (
    <div className="auth-card">
      {coach ? (
        <div className="auth-hero">
          <BrandMark brand={brand} size={84} />
          <h1>{b.businessName || coach.name}</h1>
          {b.tagline && <p>{b.tagline}</p>}
          <span className="coach-chip"><Avatar name={coach.name} id={coach.id} size="sm" />con {coach.name}</span>
        </div>
      ) : (
        <div className="auth-hero">
          <PlatesLogo size={76} />
          <h1>FitCoach Pro</h1>
          <p>Rutinas, seguimiento y pagos de tus clientes, en un solo lugar.</p>
        </div>
      )}

      {unknownSlug && <div className="warn-box"><Icon name="alert" size={18} />El enlace “#{unknownSlug}” no corresponde a ningún entrenador. Puedes entrar desde aquí.</div>}

      <div className="stack gap-sm">
        <span className="small muted" style={{ paddingLeft: 16 }}>Probar con una cuenta de ejemplo</span>
        <div className="demo-accounts">
          {demos.map((d) => (
            <button key={d.email} className="demo-account" onClick={() => quick(d)}>
              <Avatar name={d.name || d.role} id={d.id} />
              <div className="grow">
                <div className="strong">{d.name} <span className="muted" style={{ fontWeight: 400 }}>· {d.role}</span></div>
                <div className="small muted ellipsis">{d.what}</div>
              </div>
              <Icon name="right" size={18} />
            </button>
          ))}
        </div>
      </div>

      <form className="auth-box" onSubmit={submit} noValidate>
        <Field label="Correo" id="login-email">
          <input id="login-email" className={`input ${error ? "invalid" : ""}`} type="email" autoComplete="username" placeholder="tu@correo.com"
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
        <button className="btn btn-primary btn-lg btn-block" type="submit">Iniciar sesión</button>
      </form>

      {coach ? (
        <p className="small muted" style={{ textAlign: "center" }}>
          Acceso exclusivo para {b.businessName || coach.name} y sus asesorados ·{" "}
          <button className="link-btn" style={{ fontSize: 13 }} onClick={() => onBrand?.("")}>Ir al acceso general</button>
        </p>
      ) : (
        <>
          {branded.length > 0 && (
            <div className="stack gap-sm">
              <span className="small muted" style={{ paddingLeft: 16 }}>Acceso con la marca de cada entrenador</span>
              <div className="demo-accounts">
                {branded.map((u) => (
                  <button key={u.id} className="demo-account" onClick={() => onBrand?.(u.brand.slug)}>
                    <BrandMark brand={{ coach: u, name: u.brand.businessName, logo: u.brand.logo, color: u.brand.color }} size={38} />
                    <div className="grow">
                      <div className="strong">{u.brand.businessName || u.name}</div>
                      <div className="small muted ellipsis">#{u.brand.slug} · {u.name}</div>
                    </div>
                    <Icon name="right" size={18} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="small muted" style={{ textAlign: "center" }}>
            ¿Eres entrenador y tienes un código de licencia?{" "}
            <button className="link-btn" style={{ fontSize: 13 }} onClick={onActivate}>Activa tu cuenta</button>
          </p>
        </>
      )}
      <DevCredit />
    </div>
  );
}

function ActivateForm({ db, onBack }) {
  const free = db.licenses.find((l) => !l.coachId && !l.revoked);
  const [f, setF] = useState({ code: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const set = (k) => (e) => { setF({ ...f, [k]: k === "code" ? normalizeCode(e.target.value) : e.target.value }); setError(""); };

  function submit(e) {
    e.preventDefault();
    if (f.code.length < 13) return setError("El código tiene el formato FIT-XXXX-XXXX.");
    if (!f.name.trim() || !f.email.includes("@")) return setError("Escribe tu nombre y un correo válido.");
    if (f.password.length < 6) return setError("La contraseña necesita al menos 6 caracteres.");
    const r = activateLicense(f);
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
      <Field label="Código de licencia" id="act-code" hint={free ? `Para probar puedes usar ${free.code}` : undefined}>
        <input id="act-code" className="input num" style={{ letterSpacing: ".08em", fontWeight: 600 }} placeholder="FIT-XXXX-XXXX" value={f.code} onChange={set("code")} autoCapitalize="characters" />
      </Field>
      <Field label="Nombre completo" id="act-name"><input id="act-name" className="input" value={f.name} onChange={set("name")} autoComplete="name" /></Field>
      <Field label="Correo" id="act-email"><input id="act-email" className="input" type="email" value={f.email} onChange={set("email")} autoComplete="email" /></Field>
      <Field label="Contraseña" id="act-pass"><input id="act-pass" className="input" type="password" value={f.password} onChange={set("password")} autoComplete="new-password" /></Field>
      {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" type="submit">Activar y entrar</button>
      </div>
    </form>
  );
}
