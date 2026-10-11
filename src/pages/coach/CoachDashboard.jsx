import { C } from '../../constants/colors';
import { initClients } from '../../constants/data';
import { Badge, StatCard } from '../../components/ui';

export default function CoachDashboard() {
  const overdue   = initClients.filter((c) => c.payments?.some((p) => p.status === "overdue"));
  const sinRutina = initClients.filter((c) => !c.routine);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontFamily: "Syne", fontSize: 24, margin: "0 0 3px", color: C.text }}>Hola, Carlos 👋</h2>
          <p style={{ color: C.muted, margin: 0, fontFamily: "DM Sans", fontSize: 13 }}>Resumen de tu equipo hoy</p>
        </div>
        <div style={{ background: C.accentSoft, border: `1px solid ${C.accent}40`, borderRadius: 10, padding: "7px 13px", textAlign: "right" }}>
          <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: 0.5 }}>LICENCIA ACTIVA</div>
          <div style={{ fontSize: 11, color: C.muted }}>Vence: 2026-08-01</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard label="Clientes activos" value="3"                  icon="👥" color={C.accent} />
        <StatCard label="Sin rutina"        value={sinRutina.length}   icon="⚠️" color={C.warn}   />
        <StatCard label="Cobrado este mes"  value="$2,150"             icon="💰" color={C.green}  />
        <StatCard label="Pagos vencidos"    value={overdue.length}     icon="🚨" color={C.red}    />
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div style={{ background: C.redDim, border: `1px solid ${C.red}30`, borderRadius: 11, padding: "13px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 7, fontFamily: "Syne" }}>🚨 Pagos vencidos</div>
          {overdue.map((c) => (
            <div key={c.id} style={{ fontSize: 12, color: C.muted, fontFamily: "DM Sans" }}>
              • {c.name} — ${c.payments.find((p) => p.status === "overdue")?.amount.toLocaleString()} MXN
            </div>
          ))}
        </div>
      )}

      {/* No-routine alerts */}
      {sinRutina.map((c) => (
        <div key={c.id} style={{ background: C.warnDim, border: `1px solid ${C.warn}30`, borderRadius: 11, padding: "12px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.warn, fontFamily: "DM Sans" }}>
            ⚠️ <strong>{c.name}</strong> no tiene rutina asignada — ve a <em>Mis Clientes</em> para crearla.
          </div>
        </div>
      ))}

      {/* Team status table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontFamily: "Syne", color: C.text, margin: "0 0 14px", fontSize: 14 }}>Estado del equipo</h3>
        {initClients.map((c) => {
          const ov = c.payments?.some((p) => p.status === "overdue");
          return (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: C.blue + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: C.blue, fontFamily: "Syne" }}>
                  {c.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "DM Sans" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>🔥 {c.streak} días racha</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                {c.routine ? <Badge color={C.accent}>Con rutina</Badge> : <Badge color={C.warn}>Sin rutina</Badge>}
                {ov ? <Badge color={C.red}>Pago vencido</Badge> : <Badge color={C.green}>Al corriente</Badge>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
