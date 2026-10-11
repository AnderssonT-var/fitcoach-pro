import { useState } from "react";
import { C } from '../../constants/colors';
import { LICENSES } from '../../constants/data';
import { Badge, Btn, Input, Modal, Pill } from '../../components/ui';

export default function AdminLicencias() {
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState({ coach: "", email: "", plan: "1" });
  const [generated, setGenerated] = useState(null);

  function generate() {
    const code = `FIT-${Math.random().toString(36).substr(2, 4).toUpperCase()}-2026`;
    const d = new Date();
    d.setMonth(d.getMonth() + parseInt(form.plan));
    setGenerated({ code, expires: d.toISOString().split("T")[0], coach: form.coach });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontFamily: "Syne", fontSize: 24, margin: "0 0 3px", color: C.text }}>Gestión de Licencias</h2>
          <p style={{ color: C.muted, margin: 0, fontSize: 13, fontFamily: "DM Sans" }}>Genera y controla el acceso de entrenadores</p>
        </div>
        <Btn onClick={() => { setShowModal(true); setGenerated(null); }}>+ Nueva Licencia</Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {LICENSES.map((l) => (
          <div key={l.id} style={{
            background: C.card,
            border: `1px solid ${l.status === "expired" ? C.warn + "40" : C.border}`,
            borderRadius: 13, padding: "13px 18px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: l.status === "active" ? C.accentDim : C.warnDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                🔑
              </div>
              <div>
                <div style={{ fontWeight: 700, color: C.text, fontSize: 14, fontFamily: "Syne" }}>{l.coach}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: C.accent, marginTop: 2 }}>{l.code}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Emitida: {l.issued} · Vence: {l.expires}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge color={l.status === "active" ? C.accent : C.warn}>{l.status === "active" ? "Activa" : "Expirada"}</Badge>
              <Btn size="sm" variant="ghost">Renovar</Btn>
              <Btn size="sm" variant="danger">Revocar</Btn>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title="Generar Nueva Licencia" onClose={() => setShowModal(false)}>
          {!generated ? (
            <>
              <Input label="Nombre del entrenador" placeholder="Ej: Carlos Méndez"
                value={form.coach} onChange={(e) => setForm({ ...form, coach: e.target.value })} />
              <Input label="Email" type="email" placeholder="entrenador@mail.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: C.muted, marginBottom: 8, fontFamily: "DM Sans", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Duración
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["1", "2", "3", "6", "12"].map((m) => (
                    <Pill key={m} active={form.plan === m} onClick={() => setForm({ ...form, plan: m })}>
                      {m} {m === "1" ? "mes" : "meses"}
                    </Pill>
                  ))}
                </div>
              </div>
              <Btn full onClick={generate} disabled={!form.coach}>🔑 Generar Código</Btn>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
              <h3 style={{ fontFamily: "Syne", color: C.accent, fontSize: 18, margin: "0 0 5px" }}>¡Licencia Generada!</h3>
              <p style={{ color: C.muted, fontSize: 13, marginBottom: 16, fontFamily: "DM Sans" }}>
                {generated.coach} · Vence: {generated.expires}
              </p>
              <div style={{ background: C.bg, border: `2px dashed ${C.accent}`, borderRadius: 12, padding: "15px 20px", marginBottom: 16 }}>
                <div style={{ fontFamily: "monospace", fontSize: 22, color: C.accent, fontWeight: 700, letterSpacing: 2 }}>
                  {generated.code}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn full variant="ghost" onClick={() => setGenerated(null)}>Nueva</Btn>
                <Btn full onClick={() => setShowModal(false)}>Listo</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
