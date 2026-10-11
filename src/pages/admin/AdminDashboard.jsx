import { C } from '../../constants/colors';
import { initClients, LICENSES } from '../../constants/data';
import { Badge, StatCard } from '../../components/ui';

export default function AdminDashboard() {
  return (
    <div>
      <h2 style={{ fontFamily: "Syne", fontSize: 24, margin: "0 0 3px", color: C.text }}>Panel de Control</h2>
      <p style={{ color: C.muted, margin: "0 0 22px", fontFamily: "DM Sans", fontSize: 13 }}>Visión general del sistema</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Entrenadores activos" value="2"       icon="🏋️" color={C.accent} />
        <StatCard label="Usuarios totales"      value="20"     icon="👥" color={C.blue}   />
        <StatCard label="Licencias vigentes"    value="2"      icon="🔑" color={C.purple} />
        <StatCard label="Ingresos (MXN)"        value="$4,800" icon="💰" color={C.warn}   />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Recent activity */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontFamily: "Syne", color: C.text, margin: "0 0 16px", fontSize: 14 }}>Actividad Reciente</h3>
          {[
            { t: "Carlos Méndez activó su licencia", s: "Hace 2h",     d: C.accent  },
            { t: "Nuevo cliente: Sofía López",       s: "Hace 5h",     d: C.blue    },
            { t: "Licencia de Diego Ruiz expiró",    s: "Ayer",        d: C.warn    },
            { t: "Ana Torres añadió 3 rutinas",      s: "Hace 2 días", d: C.purple  },
          ].map((x, i) => (
            <div key={i} style={{ display: "flex", gap: 9, marginBottom: 11 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: x.d, flexShrink: 0, marginTop: 5 }} />
              <div>
                <div style={{ fontSize: 12, color: C.text, fontFamily: "DM Sans" }}>{x.t}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{x.s}</div>
              </div>
            </div>
          ))}
        </div>

        {/* License status */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontFamily: "Syne", color: C.text, margin: "0 0 16px", fontSize: 14 }}>Estado de Licencias</h3>
          {LICENSES.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9, padding: "8px 11px", background: C.surface, borderRadius: 9, border: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "DM Sans" }}>{l.coach}</div>
                <div style={{ fontSize: 10, color: C.muted }}>Vence: {l.expires}</div>
              </div>
              <Badge color={l.status === "active" ? C.accent : C.warn}>{l.status === "active" ? "Activa" : "Expirada"}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
