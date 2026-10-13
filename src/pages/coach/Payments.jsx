import { useEffect, useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, Confirm, Empty, Field, Modal, Pill, Stat, toast } from "../../ui/kit";
import { useApp } from "../../context";
import {
  PAY_LABEL, PAY_TONE, addPayment, clientsOf, deletePayment, generateMonthly, markPaid, markUnpaid, paymentStatus, useDB, userById,
} from "../../store/db";
import { capitalize, daysUntil, money, monthName, shortDate } from "../../lib/format";

export const METHODS = ["Transferencia", "Efectivo", "Tarjeta", "Depósito", "PayPal", "Otro"];

export default function Payments() {
  const db = useDB();
  const { me, params } = useApp();
  const [filter, setFilter] = useState(params.filter || "open");
  const [add, setAdd] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => { if (params.filter) setFilter(params.filter); }, [params]);

  const pays = db.payments.filter((p) => p.coachId === me.id).map((p) => ({ ...p, st: paymentStatus(p), client: userById(db, p.clientId) }));
  const now = new Date();
  const inMonth = (iso) => { const d = new Date(iso); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); };
  const collected = pays.filter((p) => p.paidAt && inMonth(p.paidAt)).reduce((t, p) => t + p.amount, 0);
  const pending = pays.filter((p) => p.st === "pending");
  const overdue = pays.filter((p) => p.st === "overdue");
  const expected = pays.filter((p) => inMonth(p.dueDate)).reduce((t, p) => t + p.amount, 0);

  const F = { open: (p) => p.st !== "paid", overdue: (p) => p.st === "overdue", pending: (p) => p.st === "pending", paid: (p) => p.st === "paid", all: () => true };
  const LBL = [["open", "Por cobrar"], ["overdue", "Vencidos"], ["pending", "Pendientes"], ["paid", "Pagados"], ["all", "Todos"]];
  const shown = pays.filter(F[filter]).filter((p) => !q || `${p.client?.name} ${p.concept}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (filter === "paid" ? new Date(b.paidAt) - new Date(a.paidAt) : new Date(a.dueDate) - new Date(b.dueDate)));
  const month = capitalize(monthName());

  function runMonthly() {
    const n = generateMonthly(me.id);
    toast(n ? `Se crearon ${n} ${n === 1 ? "mensualidad" : "mensualidades"} de ${month.toLowerCase()}` : `Todos tus clientes ya tienen la mensualidad de ${month.toLowerCase()}`, "wallet");
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Pagos</h1><p>Mensualidades y cobros de tus clientes. Lo que pasa su fecha sin pagarse se marca como vencido.</p></div>
        <div className="row wrap gap-sm">
          <button className="btn btn-quiet" onClick={runMonthly}><Icon name="calendar" size={18} />Generar mensualidades de {month.toLowerCase()}</button>
          <button className="btn btn-primary" onClick={() => setAdd(true)}><Icon name="plus" size={18} />Registrar cobro</button>
        </div>
      </div>

      <div className="stats">
        <Stat label={`Cobrado en ${month.toLowerCase()}`} value={money(collected)} tone="ok" sub={expected ? `${Math.round((collected / expected) * 100)}% de lo esperado en el mes` : undefined} icon="check" />
        <Stat label="Pendiente" value={money(pending.reduce((t, p) => t + p.amount, 0))} tone="warn" sub={`${pending.length} ${pending.length === 1 ? "cobro" : "cobros"} aún en fecha`} icon="clock" />
        <Stat label="Vencido" value={money(overdue.reduce((t, p) => t + p.amount, 0))} tone={overdue.length ? "bad" : ""} sub={`${overdue.length} ${overdue.length === 1 ? "cobro" : "cobros"} atrasados`} icon="alert" />
        <Stat label="Esperado este mes" value={money(expected)} icon="wallet" />
      </div>

      <div className="row wrap" style={{ gap: 10 }}>
        <div className="search">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="pay-q">Buscar cobro</label>
          <input id="pay-q" className="input" placeholder="Buscar cliente o concepto" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips" role="group" aria-label="Filtrar cobros">
          {LBL.map(([k, l]) => <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}<span className="chip-n">{pays.filter(F[k]).length}</span></button>)}
        </div>
      </div>

      <section className="panel">
        {shown.length === 0 ? <Empty icon="wallet" title={filter === "open" ? "No hay nada por cobrar" : "Sin cobros en este filtro"} text={filter === "open" ? "Todos tus clientes están al día." : "Cambia el filtro para ver otros cobros."} /> : (
          <div className="list">{shown.map((p) => <PayRow key={p.id} p={p} showClient />)}</div>
        )}
      </section>

      {add && <PaymentModal onClose={() => setAdd(false)} />}
    </div>
  );
}

export function PayRow({ p, showClient }) {
  const [pay, setPay] = useState(false);
  const [del, setDel] = useState(false);
  const st = p.st || paymentStatus(p);
  const d = daysUntil(p.dueDate);
  return (
    <div className="list-row m-stack">
      <div className="row grow">
        {showClient && p.client && <Avatar name={p.client.name} id={p.client.id} size="sm" />}
        <div className="grow">
          <div className="strong ellipsis">{showClient && p.client ? `${p.client.name} · ` : ""}{p.concept}</div>
          <div className="small muted">
            {st === "paid" ? `Pagado el ${shortDate(p.paidAt)} · ${p.method}` : st === "overdue" ? `Venció hace ${-d} ${-d === 1 ? "día" : "días"} (${shortDate(p.dueDate)})` : d === 0 ? "Vence hoy" : `Vence en ${d} ${d === 1 ? "día" : "días"} (${shortDate(p.dueDate)})`}
          </div>
        </div>
        <span className="display num" style={{ fontSize: 22 }}>{money(p.amount)}</span>
        <Pill tone={PAY_TONE[st]}>{PAY_LABEL[st]}</Pill>
      </div>
      <div className="row gap-xs">
        {st !== "paid" ? <button className="btn btn-success btn-sm" onClick={() => setPay(true)}><Icon name="check" size={16} />Marcar pagado</button>
          : <button className="btn btn-ghost btn-sm" onClick={() => { markUnpaid(p.id); toast("Pago desmarcado", "refresh"); }}>Deshacer</button>}
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDel(true)} aria-label={`Eliminar ${p.concept}`}><Icon name="trash" size={16} /></button>
      </div>
      {pay && <MarkPaidModal p={p} onClose={() => setPay(false)} />}
      {del && <Confirm title="Eliminar cobro" confirmLabel="Eliminar" onClose={() => setDel(false)} onConfirm={() => { deletePayment(p.id); toast("Cobro eliminado", "trash"); }}
        text={`Se elimina “${p.concept}” por ${money(p.amount)}${p.client ? ` de ${p.client.name}` : ""}.`} />}
    </div>
  );
}

function MarkPaidModal({ p, onClose }) {
  const [method, setMethod] = useState("Transferencia");
  return (
    <Modal title="Registrar pago" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-success" onClick={() => { markPaid(p.id, method); toast(`${money(p.amount)} cobrados`, "wallet"); onClose(); }}>Confirmar {money(p.amount)}</button>
    </>}>
      <p className="ink2">{p.client?.name ? `${p.client.name} · ` : ""}{p.concept}</p>
      <div className="field"><span className="label">Método de pago</span>
        <div className="chips">{METHODS.map((m) => <button key={m} className="chip" aria-pressed={method === m} onClick={() => setMethod(m)}>{m}</button>)}</div>
      </div>
    </Modal>
  );
}

export function PaymentModal({ onClose, clientId }) {
  const db = useDB();
  const { me } = useApp();
  const clients = clientsOf(db, me.id).filter((c) => c.active);
  const firstClient = clients.find((c) => c.userId === clientId) || clients[0];
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ clientId: firstClient?.userId || "", concept: `Mensualidad ${monthName()}`, amount: firstClient?.fee || "", dueDate: today, paid: false, method: "Transferencia" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const ok = f.clientId && f.concept.trim() && +f.amount > 0 && f.dueDate;
  return (
    <Modal title="Registrar cobro" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!ok} onClick={() => { addPayment(me.id, f); toast(f.paid ? "Pago registrado" : "Cobro pendiente registrado", "wallet"); onClose(); }}>Registrar</button>
    </>}>
      <div className="form-grid">
        {!clientId && (
          <div className="full"><Field label="Cliente" id="pm-client">
            <select id="pm-client" className="select" value={f.clientId} onChange={(e) => { const c = clients.find((x) => x.userId === +e.target.value); setF({ ...f, clientId: +e.target.value, amount: c?.fee || f.amount }); }}>
              {clients.map((c) => <option key={c.userId} value={c.userId}>{c.user.name}</option>)}
            </select>
          </Field></div>
        )}
        <div className="full"><Field label="Concepto" id="pm-concept"><input id="pm-concept" className="input" value={f.concept} onChange={set("concept")} /></Field></div>
        <Field label="Monto" id="pm-amount"><input id="pm-amount" className="input num" type="number" inputMode="decimal" value={f.amount} onChange={set("amount")} /></Field>
        <Field label="Fecha límite" id="pm-due"><input id="pm-due" className="input num" type="date" value={f.dueDate} onChange={set("dueDate")} /></Field>
        <label className="full toggle"><input type="checkbox" checked={f.paid} onChange={set("paid")} /><span>Ya lo pagó</span></label>
        {f.paid && (
          <div className="full field"><span className="label">Método</span>
            <div className="chips">{METHODS.map((m) => <button key={m} className="chip" aria-pressed={f.method === m} onClick={() => setF({ ...f, method: m })}>{m}</button>)}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
