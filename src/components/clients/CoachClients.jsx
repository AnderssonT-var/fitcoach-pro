import { useState } from "react";
import { C } from '../../constants/colors';
import { EXERCISES_DB, initClients } from '../../constants/data';
import { Badge, Btn, Input, Modal, ProgressBar, Select, StatCard } from '../ui';
import RoutineEditor from '../routines/RoutineEditor';

const STATUS_COLOR = { paid: C.green, pending: C.warn, overdue: C.red };
const STATUS_LABEL = { paid: "Pagado", pending: "Pendiente", overdue: "Vencido" };

export default function CoachClients() {
  const [clients,     setClients]     = useState(initClients);
  const [sel,         setSel]         = useState(null);
  const [editRoutine, setEditRoutine] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [tab,         setTab]         = useState("info");

  function saveRoutine(routine) {
    setClients((prev) => prev.map((c) => c.id === sel.id ? { ...c, routine } : c));
    setSel((prev) => ({ ...prev, routine }));
    setEditRoutine(false);
  }

  function open(c) { setSel(c); setTab("info"); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontFamily: "Syne", fontSize: 24, margin: "0 0 3px", color: C.text }}>Mis Clientes</h2>
          <p style={{ color: C.muted, margin: 0, fontSize: 13, fontFamily: "DM Sans" }}>
            Cada cliente tiene su propia rutina personalizada
          </p>
        </div>
        <Btn onClick={() => setShowNew(true)}>+ Agregar Cliente</Btn>
      </div>

      {/* Client list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {clients.map((c) => {
          const overdue = c.payments?.some((p) => p.status === "overdue");
          const hasPend = c.payments?.some((p) => p.status === "pending");
          return (
            <div key={c.id} onClick={() => open(c)} style={{
              background: C.card, border: `1px solid ${overdue ? C.red + "40" : C.border}`,
              borderRadius: 13, padding: "14px 18px", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: C.blue + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: C.blue, fontFamily: "Syne" }}>
                  {c.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14, fontFamily: "Syne" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{c.goal} · {c.email}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {c.routine
                  ? <Badge color={C.accent}>{c.routine.name.length > 22 ? c.routine.name.slice(0, 20) + "…" : c.routine.name}</Badge>
                  : <Badge color={C.warn}>⚠ Sin rutina</Badge>}
                {overdue
                  ? <Badge color={C.red}>Pago vencido</Badge>
                  : hasPend
                    ? <Badge color={C.warn}>Pendiente</Badge>
                    : <Badge color={C.green}>Al corriente</Badge>}
                <div style={{ textAlign: "center", minWidth: 50 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.warn, fontFamily: "Syne" }}>🔥{c.streak}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>racha</div>
                </div>
                <div style={{ width: 64 }}>
                  <div style={{ fontSize: 10, color: C.muted, textAlign: "right", marginBottom: 3 }}>{c.progress}%</div>
                  <ProgressBar value={c.progress} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Client detail modal */}
      {sel && !editRoutine && (
        <Modal title={sel.name} onClose={() => setSel(null)} wide>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 14 }}>
            {[
              { id: "info",     l: "👤 Perfil" },
              { id: "rutina",   l: "📋 Rutina" },
              { id: "pagos",    l: "💰 Pagos" },
              { id: "progreso", l: "📈 Progreso" },
            ].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: tab === t.id ? C.accentDim : "transparent",
                border: `1px solid ${tab === t.id ? C.accent + "50" : C.border}`,
                color: tab === t.id ? C.accent : C.muted,
                borderRadius: 8, padding: "6px 14px",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans",
              }}>
                {t.l}
              </button>
            ))}
          </div>

          {/* PERFIL tab */}
          {tab === "info" && (
            <div>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <StatCard label="Racha activa" value={`🔥 ${sel.streak}d`} icon="" color={C.warn} />
                <StatCard label="Progreso"     value={`${sel.progress}%`}  icon="" color={C.accent} />
                <StatCard label="Peso"         value={`${sel.weight}kg`}   icon="" color={C.blue} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  ["EMAIL",        sel.email],
                  ["OBJETIVO",     sel.goal],
                  ["ESTATURA",     sel.height + " cm"],
                  ["PESO INICIAL", sel.weight + " kg"],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: C.bg, borderRadius: 9, padding: 13, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 13, color: C.text, fontFamily: "DM Sans" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RUTINA tab */}
          {tab === "rutina" && (
            <div>
              {sel.routine ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: C.text }}>{sel.routine.name}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {sel.routine.category} · {sel.routine.days} días/semana · {sel.routine.exercises.length} ejercicios
                      </div>
                    </div>
                    <Btn size="sm" variant="ghost" onClick={() => setEditRoutine(true)}>✏️ Editar</Btn>
                  </div>
                  {sel.routine.exercises.map((exItem, i) => {
                    const d = EXERCISES_DB.find((e) => e.id === exItem.exId);
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 13px", marginBottom: 7, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9 }}>
                        <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                          <div style={{ width: 30, height: 30, borderRadius: 7, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>💪</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "DM Sans" }}>{d?.name}</div>
                            {exItem.notes && <div style={{ fontSize: 11, color: C.accent }}>{exItem.notes}</div>}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, fontFamily: "Syne" }}>
                          {exItem.sets}×{exItem.reps} · ⏱{exItem.rest}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8, fontFamily: "Syne" }}>Sin rutina asignada</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
                    Crea una rutina personalizada o importa una plantilla como base
                  </div>
                  <Btn onClick={() => setEditRoutine(true)}>📋 Crear Rutina para {sel.name.split(" ")[0]}</Btn>
                </div>
              )}
            </div>
          )}

          {/* PAGOS tab */}
          {tab === "pagos" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "Syne" }}>Historial de pagos</div>
                <Btn size="sm">+ Registrar cobro</Btn>
              </div>
              {(sel.payments || []).map((pay) => (
                <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 13px", marginBottom: 7, background: C.bg, border: `1px solid ${STATUS_COLOR[pay.status]}30`, borderRadius: 9 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "DM Sans" }}>{pay.concept}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{pay.date}{pay.method ? ` · ${pay.method}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "Syne" }}>${pay.amount.toLocaleString()}</span>
                    <Badge color={STATUS_COLOR[pay.status]}>{STATUS_LABEL[pay.status]}</Badge>
                  </div>
                </div>
              ))}
              {(!sel.payments || sel.payments.length === 0) && (
                <div style={{ textAlign: "center", color: C.muted, padding: "20px 0", fontSize: 13 }}>Sin registros</div>
              )}
            </div>
          )}

          {/* PROGRESO tab */}
          {tab === "progreso" && (
            <div>
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <StatCard label="Progreso plan" value={`${sel.progress}%`}   icon="📈" color={C.accent} />
                <StatCard label="Racha activa"  value={`${sel.streak} días`} icon="🔥" color={C.warn} />
              </div>
              <div style={{ background: C.bg, borderRadius: 11, padding: 14, border: `1px solid ${C.border}`, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, fontFamily: "Syne" }}>Avance del plan</div>
                <ProgressBar value={sel.progress} />
                <div style={{ textAlign: "right", fontSize: 11, color: C.muted, marginTop: 5 }}>{sel.progress}% completado</div>
              </div>
              <Btn size="sm" variant="ghost">📷 Ver fotos de progreso</Btn>
            </div>
          )}
        </Modal>
      )}

      {/* Routine editor modal */}
      {sel && editRoutine && (
        <RoutineEditor client={sel} onSave={saveRoutine} onClose={() => setEditRoutine(false)} />
      )}

      {/* New client modal */}
      {showNew && (
        <Modal title="Agregar Nuevo Cliente" onClose={() => setShowNew(false)}>
          <Input label="Nombre completo" placeholder="Ej: Juan Pérez" />
          <Input label="Email" type="email" placeholder="juan@mail.com" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Peso (kg)"      type="number" placeholder="75" />
            <Input label="Estatura (cm)"  type="number" placeholder="175" />
          </div>
          <Select label="Objetivo principal">
            {["Hipertrofia", "Fuerza", "Pérdida de grasa", "Tonificación", "Rendimiento", "Salud general"].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
          <Btn full onClick={() => setShowNew(false)}>Enviar Invitación al Cliente</Btn>
        </Modal>
      )}
    </div>
  );
}
