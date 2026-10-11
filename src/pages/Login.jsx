import { useState } from "react";
import { C } from '../constants/colors';

// Static credentials — demo only
const USERS = [
  { email: "admin@fitcoach.com",   password: "admin123", role: "admin", name: "Administrador",  page: "dashboard" },
  { email: "carlos@fitcoach.com",  password: "coach123", role: "coach", name: "Carlos Méndez",  page: "clientes"  },
  { email: "sofia@fitcoach.com",   password: "user123",  role: "user",  name: "Sofía López",    page: "dashboard" },
];

const ROLE_COLOR = { admin: C.purple, coach: C.accent, user: C.blue };
const ROLE_LABEL = { admin: "Admin", coach: "Entrenador", user: "Usuario" };

const DEMO_HINTS = [
  { role: "admin", email: "admin@fitcoach.com",  password: "admin123", icon: "🛡️" },
  { role: "coach", email: "carlos@fitcoach.com", password: "coach123", icon: "🏋️" },
  { role: "user",  email: "sofia@fitcoach.com",  password: "user123",  icon: "👤" },
];

export default function Login({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  function attempt(e, pw) {
    setError("");
    setLoading(true);
    setTimeout(() => {
      const found = USERS.find((u) => u.email === e && u.password === pw);
      if (found) {
        onLogin({ role: found.role, name: found.name, email: found.email, page: found.page });
      } else {
        setError("Credenciales incorrectas. Revisa tu email y contraseña.");
      }
      setLoading(false);
    }, 500);
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    if (!email || !password) { setError("Completa todos los campos."); return; }
    attempt(email, password);
  }

  function quickLogin(hint) {
    setEmail(hint.email);
    setPassword(hint.password);
    attempt(hint.email, hint.password);
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "DM Sans",
    }}>
      {/* Background glow */}
      <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, background: C.accent + "07", borderRadius: "50%", filter: "blur(100px)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, position: "relative" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: C.accent + "20", border: `1px solid ${C.accent}40`, marginBottom: 14, fontSize: 26 }}>
            ⚡
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 800, color: C.accent, letterSpacing: -0.5 }}>
            FitCoach<span style={{ color: C.text }}>Pro</span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Plataforma de entrenamiento</div>
        </div>

        {/* Card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "32px 28px" }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            Iniciar sesión
          </h2>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 24 }}>Accede a tu cuenta para continuar</p>

          <form onSubmit={handleSubmit} autoComplete="off">
            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Email
              </label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                autoComplete="username"
                style={{ width: "100%", background: C.card, border: `1px solid ${error ? C.red + "80" : C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 13, fontFamily: "DM Sans", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  autoComplete="current-password"
                  style={{ width: "100%", background: C.card, border: `1px solid ${error ? C.red + "80" : C.border}`, borderRadius: 10, padding: "11px 44px 11px 14px", color: C.text, fontSize: 13, fontFamily: "DM Sans", outline: "none", boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 15, color: C.muted, padding: 2 }}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{ background: C.redDim, border: `1px solid ${C.red}40`, borderRadius: 9, padding: "9px 13px", marginBottom: 16, fontSize: 12, color: C.red, fontFamily: "DM Sans" }}>
                ⚠️ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", background: loading ? C.accent + "80" : C.accent, color: C.bg, border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, fontFamily: "DM Sans", cursor: loading ? "not-allowed" : "pointer", letterSpacing: 0.3 }}
            >
              {loading ? "Verificando…" : "Entrar →"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0 18px" }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>Acceso rápido demo</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          {/* Quick login buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DEMO_HINTS.map((h) => {
              const rc = ROLE_COLOR[h.role];
              return (
                <button
                  key={h.role}
                  onClick={() => quickLogin(h)}
                  disabled={loading}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: rc + "10", border: `1px solid ${rc}30`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", textAlign: "left", width: "100%" }}
                >
                  <span style={{ fontSize: 18 }}>{h.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: "DM Sans" }}>{ROLE_LABEL[h.role]}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{h.email}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: rc, background: rc + "20", borderRadius: 5, padding: "2px 7px", letterSpacing: 0.4, textTransform: "uppercase" }}>
                    {ROLE_LABEL[h.role]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: C.subtle }}>
          Sistema demo · Los datos son ficticios
        </div>
      </div>
    </div>
  );
}
