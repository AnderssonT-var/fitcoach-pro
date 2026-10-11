import { C } from '../../constants/colors';
import { initClients, EXERCISES_DB } from '../../constants/data';
import { Badge } from '../../components/ui';
import Btn from '../../components/ui/Btn';

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WEEK_DONE = [true, true, true, false, false, false, false];

export default function ClientDashboard() {
  const me = initClients[0];

  return (
    <div>
      <h2 style={{ fontFamily: "Syne", fontSize: 24, margin: "0 0 3px", color: C.text }}>
        ¡Vamos, Sofía! 🔥
      </h2>
      <p style={{ color: C.muted, margin: "0 0 18px", fontFamily: "DM Sans", fontSize: 13 }}>
        {me.routine ? me.routine.name : "Sin rutina asignada"} · Semana 3
      </p>

      {/* Streak banner */}
      <div style={{ background: `linear-gradient(135deg,${C.warn}20,${C.warn}05)`, border: `1px solid ${C.warn}40`, borderRadius: 13, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 42 }}>🔥</div>
        <div>
          <div style={{ fontFamily: "Syne", fontSize: 30, fontWeight: 800, color: C.warn }}>{me.streak} días</div>
          <div style={{ color: C.muted, fontSize: 13 }}>Racha activa · ¡No la rompas!</div>
        </div>
      </div>

      {/* Weekly calendar */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontFamily: "Syne", color: C.text, margin: "0 0 12px", fontSize: 13 }}>Esta semana</h3>
        <div style={{ display: "flex", gap: 6 }}>
          {WEEK_DAYS.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", padding: "7px 2px", borderRadius: 8, background: WEEK_DONE[i] ? C.accentDim : C.surface, border: `1px solid ${WEEK_DONE[i] ? C.accent : C.border}` }}>
              <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>{d}</div>
              <div style={{ fontSize: 15 }}>{WEEK_DONE[i] ? "✅" : i === 3 ? "⚡" : "○"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's routine */}
      {me.routine && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontFamily: "Syne", color: C.text, margin: 0, fontSize: 13 }}>Rutina de Hoy</h3>
            <Badge color={C.blue}>{me.routine.category}</Badge>
          </div>
          {me.routine.exercises.map((ex, i) => {
            const d = EXERCISES_DB.find((e) => e.id === ex.exId);
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < me.routine.exercises.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 7, background: C.blue + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>💪</div>
                  <div>
                    <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{d?.name}</div>
                    {ex.notes && <div style={{ fontSize: 11, color: C.accent }}>{ex.notes}</div>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, fontFamily: "Syne" }}>{ex.sets}×{ex.reps}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>⏱ {ex.rest}</div>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 14 }}>
            <Btn full>▶ Iniciar Entrenamiento</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
