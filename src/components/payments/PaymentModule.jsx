import { useState } from "react";
import { C } from '../../constants/colors';
import { Btn, Input, Modal, Select, StatCard } from '../ui';
import Badge from '../ui/Badge';

const STATUS_COLOR = { paid: C.green, pending: C.warn, overdue: C.red };
const STATUS_LABEL = { paid: "Pagado", pending: "Pendiente", overdue: "Vencido" };

export default function PaymentModule({ initialClients }) {
  const [clients,  setClients]  = useState(initialClients);
  const [showAdd,  setShowAdd]  = useState(false);
  const [selId,    setSelId]    = useState(initialClients[0].id);
  const [form, setForm] = useState({ concept: "", amount: "", date: "", method: "Transferencia" });

  const allPays   = clients.flatMap((c) => (c.payments || []).map((p) => ({ ...p, clientName: c.name, clientId: c.id })));
  const cobrado   = allPays.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendiente = allPays.filter((p) => p.status !== "paid").reduce((s, p) => s + p.amount, 0);
  const vencidos  = allPays.filter((p) => p.status === "overdue").length;

  function addPayment() {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== selId ? c : {
          ...c,
          payments: [...(c.payments || []), { id: Date.now(), ...form, amount: parseFloat(form.amount), status: "pending" }],
        }
      )
    );
    setForm({ concept: "", amount: "", date: "", method: "Transferencia" });
    setShowAdd(false);
  }

  function markPaid(cid, pid) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== cid ? c : {
          ...c,
          payments: c.payments.map((p) => p.id !== pid ? p : { ...p, status: "paid", method: "Transferencia" }),
        }
      )
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontFamily: "Syne", fontSize: 24, margin: "0 0 3px", color: C.text }}>Control de Pagos</h2>
          <p style={{ color: C.muted, margin: 0, fontSize: 13, fontFamily: "DM Sans" }}>Seguimiento de cobros por cliente</p>
        </div>
        <Btn onClick={() => setShowAdd(true)}>+ Registrar Cobro</Btn>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard label="Cobrado este mes" value={`$${cobrado.toLocaleString()}`}   icon="✅" color={C.green} />
        <StatCard label="Por cobrar"        value={`$${pendiente.toLocaleString()}`} icon="⏳" color={C.warn}  />
        <StatCard label="Pagos vencidos"    value={vencidos}                          icon="🚨" color={C.red}   />
        <StatCard label="Clientes"          value={clients.length}                    icon="👥" color={C.blue}  />
      </div>

      {/* Client payment cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {clients.map((c) => {
          const pays   = c.payments || [];
          const cob    = pays.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
          const pend   = pays.filter((p) => p.status !== "paid").reduce((s, p) => s + p.amount, 0);
          const overdue = pays.some((p) => p.status === "overdue");

          return (
            <div key={c.id} style={{ background: C.card, border: `1px solid ${overdue ? C.red + "50" : C.border}`, borderRadius: 14, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", background: overdue ? C.redDim : "transparent" }}>
                <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: C.blue + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.blue, fontFamily: "Syne" }}>
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14, fontFamily: "Syne" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{c.email}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.green, fontFamily: "Syne" }}>${cob.toLocaleString()} cobrado</div>
                    {pend > 0 && <div style={{ fontSize: 12, color: overdue ? C.red : C.warn }}>${pend.toLocaleString()} pendiente</div>}
                  </div>
                  <Btn size="sm" variant="ghost" onClick={() => { setSelId(c.id); setShowAdd(true); }}>+ Cobro</Btn>
                </div>
              </div>

              {/* Payment rows */}
              <div style={{ padding: "0 18px 12px" }}>
                {pays.length === 0 && (
                  <div style={{ fontSize: 12, color: C.muted, padding: "10px 0", textAlign: "center" }}>Sin registros</div>
                )}
                {pays.map((pay) => (
                  <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[pay.status], flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, color: C.text, fontFamily: "DM Sans", fontWeight: 500 }}>{pay.concept}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{pay.date}{pay.method ? ` · ${pay.method}` : ""}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: C.text, fontFamily: "Syne" }}>${pay.amount.toLocaleString()}</span>
                      <Badge color={STATUS_COLOR[pay.status]}>{STATUS_LABEL[pay.status]}</Badge>
                      {pay.status !== "paid" && (
                        <Btn size="sm" variant="green" onClick={() => markPaid(c.id, pay.id)}>✓ Cobrado</Btn>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add payment modal */}
      {showAdd && (
        <Modal title="Registrar Cobro" onClose={() => setShowAdd(false)}>
          <Select label="Cliente" value={selId} onChange={(e) => setSelId(parseInt(e.target.value))}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Concepto" placeholder="Ej: Mensualidad Mayo 2026"
            value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Monto (MXN)" type="number" placeholder="800"
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Input label="Fecha vencimiento" type="date"
              value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <Select label="Método de pago" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {["Transferencia", "Efectivo", "Tarjeta", "OXXO Pay", "PayPal", "Otro"].map((m) => <option key={m}>{m}</option>)}
          </Select>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Btn variant="ghost" full onClick={() => setShowAdd(false)}>Cancelar</Btn>
            <Btn full onClick={addPayment} disabled={!form.concept || !form.amount}>Registrar Cobro</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
