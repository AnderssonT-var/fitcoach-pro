import { C } from '../../constants/colors';
import { NAV } from '../../constants/data';
import Badge from '../ui/Badge';

const ROLE_COLORS = { admin: C.purple, coach: C.accent, user: C.blue };
const ROLE_LABELS = { admin: "Admin", coach: "Entrenador", user: "Usuario" };

export default function Sidebar({ role, active, onNav, onRoleChange, onLogout }) {
  const rc = ROLE_COLORS[role];

  return (
    <div style={{
      width: 228, background: C.surface, borderRight: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column", height: "100%", flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "22px 20px 16px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 800, color: C.accent, letterSpacing: -0.5 }}>
          FitCoach<span style={{ color: C.text }}>Pro</span>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Plataforma de entrenamiento</div>
      </div>

      {/* Role switcher (demo) */}
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
          Vista demo
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {Object.keys(ROLE_LABELS).map((r) => (
            <button
              key={r}
              onClick={() => onRoleChange(r)}
              style={{
                background: role === r ? ROLE_COLORS[r] + "20" : "transparent",
                border: `1px solid ${role === r ? ROLE_COLORS[r] : C.border}`,
                color: role === r ? ROLE_COLORS[r] : C.muted,
                borderRadius: 7, padding: "5px 10px",
                fontSize: 12, cursor: "pointer", textAlign: "left",
                fontFamily: "DM Sans", fontWeight: 600,
              }}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 8px", overflowY: "auto" }}>
        {NAV[role].map((item) => (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            style={{
              width: "100%",
              background: active === item.id ? C.accentDim : "transparent",
              border: `1px solid ${active === item.id ? C.accent + "40" : "transparent"}`,
              color: active === item.id ? C.accent : C.muted,
              borderRadius: 9, padding: "9px 12px",
              fontSize: 12, cursor: "pointer", textAlign: "left",
              fontFamily: "DM Sans", fontWeight: 500,
              display: "flex", alignItems: "center", gap: 8, marginBottom: 2,
            }}
          >
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* User info + logout */}
      <div style={{ padding: "12px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: rc + "30",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, color: rc, fontWeight: 700, fontFamily: "Syne",
          }}>
            {role === "admin" ? "A" : role === "coach" ? "C" : "S"}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "DM Sans" }}>
              {role === "admin" ? "Administrador" : role === "coach" ? "Carlos Méndez" : "Sofía López"}
            </div>
            <Badge color={rc}>{ROLE_LABELS[role]}</Badge>
          </div>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            style={{ width: "100%", background: C.redDim, border: `1px solid ${C.red}30`, color: C.red, borderRadius: 8, padding: "7px 0", fontSize: 12, fontWeight: 600, fontFamily: "DM Sans", cursor: "pointer" }}
          >
            ↩ Cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}
