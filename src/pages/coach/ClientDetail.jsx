import { useEffect, useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, Confirm, CopyButton, Field, Modal, Pill, Stat, toast } from "../../ui/kit";
import SessionList from "../../workout/SessionList";
import { AdherenceChart, Records, VolumeChart, WeightChart, quickStats } from "../../workout/ProgressWidgets";
import RoutineEditor from "./RoutineEditor";
import { Measurements, Notes, Photos } from "./Tracking";
import { PayRow, PaymentModal } from "./Payments";
import { GOALS } from "./Clients";
import { useApp } from "../../context";
import {
  addBodyWeight, clientById, paymentStatus, resetClientPassword, updateClient, useDB, userById, weekStreak, workoutsOf,
} from "../../store/db";
import { ago, kg, money, shortDate } from "../../lib/format";

const TABS = [["resumen", "Resumen"], ["rutina", "Rutina"], ["historial", "Entrenamientos"], ["medidas", "Medidas"], ["fotos", "Fotos"], ["notas", "Notas"], ["pagos", "Pagos"], ["datos", "Datos"]];

export default function ClientDetail({ clientId, tab: initialTab }) {
  const db = useDB();
  const { go } = useApp();
  const [tab, setTab] = useState(initialTab || "resumen");
  useEffect(() => { setTab(initialTab || "resumen"); }, [clientId, initialTab]);
  const c = clientById(db, clientId);
  const u = userById(db, clientId);
  if (!c || !u) return <div className="page"><p>Cliente no encontrado.</p></div>;

  const ws = workoutsOf(db, clientId);
  const pays = db.payments.filter((p) => p.clientId === clientId);
  const overdue = pays.filter((p) => paymentStatus(p) === "overdue");

  return (
    <div className="page">
      <button className="link-btn row gap-xs" style={{ alignSelf: "flex-start" }} onClick={() => go("clientes")}><Icon name="left" size={18} />Clientes</button>
      <div className="page-head" style={{ alignItems: "center" }}>
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={u.name} id={u.id} size="lg" />
          <div>
            <h1 style={{ fontSize: 36 }}>{u.name}</h1>
            <div className="row wrap gap-sm small muted" style={{ marginTop: 4 }}>
              <span>{c.goal}</span><span>·</span><span>cliente desde {shortDate(c.joinedAt)}</span>
              {!c.active && <Pill>En pausa</Pill>}
              {overdue.length > 0 && <Pill tone="bad">Pago vencido</Pill>}
            </div>
          </div>
        </div>
        <button className="btn btn-quiet" onClick={() => go("mensajes", { clientId })}><Icon name="chat" size={18} />Enviar mensaje</button>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{k === "pagos" && overdue.length > 0 && <span className="nav-count" style={{ marginLeft: 2 }}>{overdue.length}</span>}</button>)}
      </div>

      {tab === "resumen" && <Summary clientId={clientId} onTab={setTab} />}
      {tab === "rutina" && <RoutineEditor key={clientId} clientId={clientId} />}
      {tab === "historial" && <section className="panel"><SessionList sessions={ws} /></section>}
      {tab === "medidas" && <Measurements clientId={clientId} canEdit />}
      {tab === "fotos" && <Photos clientId={clientId} canUpload canDelete />}
      {tab === "notas" && <Notes clientId={clientId} />}
      {tab === "pagos" && <ClientPayments clientId={clientId} />}
      {tab === "datos" && <ClientData key={clientId} clientId={clientId} />}
    </div>
  );
}

function Summary({ clientId, onTab }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const s = quickStats(db, clientId);
  const ws = workoutsOf(db, clientId);
  const lastComment = ws.find((w) => w.comment);
  const streak = weekStreak(db, clientId, s.goal);
  const w = c.weights.at(-1);
  return (
    <>
      <div className="stats">
        <Stat label="Esta semana" value={s.goal ? `${s.week}/${s.goal}` : s.week} sub="entrenamientos" tone={s.goal && s.week >= s.goal ? "ok" : ""} icon="calendar" />
        <Stat label="Semanas cumpliendo" value={streak} sub="seguidas" icon="flame" />
        <Stat label="Volumen del mes" value={s.tonsLabel} sub={`${s.month} sesiones · ${s.avgMin} min de media`} icon="dumbbell" />
        <Stat label="Peso actual" value={w ? `${kg(w.kg)} kg` : "—"} sub={w ? `registrado ${ago(w.date)}` : "sin registro"} icon="scale" />
      </div>
      {!c.routine && (
        <div className="warn-box"><Icon name="alert" size={18} /><span className="grow">Este cliente aún no tiene rutina.</span><button className="btn btn-quiet btn-sm" onClick={() => onTab("rutina")}>Crear rutina</button></div>
      )}
      {userById(db, clientId)?.injuries && (
        <div className="error-box" style={{ alignItems: "center" }}><Icon name="alert" size={18} /><span className="grow"><strong>Lesiones reportadas por el cliente:</strong> {userById(db, clientId).injuries}</span></div>
      )}
      {(c.notes || []).filter((n) => n.pinned).map((n) => (
        <div key={n.id} className="warn-box"><Icon name="note" size={18} /><span className="grow"><strong>{n.category}:</strong> {n.text}</span>
          <button className="btn btn-quiet btn-sm" onClick={() => onTab("notas")}>Ver notas</button></div>
      ))}
      {lastComment && (
        <div className="note-box"><Icon name="chat" size={18} /><span className="grow">Último comentario ({lastComment.dayName}, {ago(lastComment.finishedAt)}): “{lastComment.comment}”</span></div>
      )}
      <div className="grid-2">
        <AdherenceChart clientId={clientId} />
        <WeightChart clientId={clientId} />
      </div>
      <div className="grid-2">
        <VolumeChart clientId={clientId} />
        <Records clientId={clientId} />
      </div>
    </>
  );
}

function ClientPayments({ clientId }) {
  const db = useDB();
  const [add, setAdd] = useState(false);
  const c = clientById(db, clientId);
  const pays = db.payments.filter((p) => p.clientId === clientId).sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
  const paid = pays.filter((p) => p.paidAt).reduce((t, p) => t + p.amount, 0);
  const open = pays.filter((p) => !p.paidAt).reduce((t, p) => t + p.amount, 0);
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>Pagos</h2><div className="small muted">Mensualidad {money(c.fee)} · día {c.billingDay} de cada mes · pagado {money(paid)} · por cobrar {money(open)}</div></div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}><Icon name="plus" size={16} />Registrar cobro</button>
      </div>
      {pays.length === 0 ? <div className="panel-body muted">Sin cobros registrados.</div> : <div className="list">{pays.map((p) => <PayRow key={p.id} p={p} />)}</div>}
      {add && <PaymentModal clientId={clientId} onClose={() => setAdd(false)} />}
    </section>
  );
}

function ClientData({ clientId }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const u = userById(db, clientId);
  const [f, setF] = useState({ name: u.name, email: u.email, phone: c.phone || "", goal: c.goal, heightCm: c.heightCm || "", fee: c.fee, billingDay: c.billingDay });
  const [weightOpen, setWeightOpen] = useState(false);
  const [pause, setPause] = useState(false);
  const [newPass, setNewPass] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dirty = f.name !== u.name || f.email !== u.email || f.phone !== (c.phone || "") || f.goal !== c.goal || +f.heightCm !== +(c.heightCm || 0) || +f.fee !== +c.fee || +f.billingDay !== +c.billingDay;

  function save() {
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) return toast("Revisa el nombre y el correo", "alert");
    if (db.users.some((x) => x.id !== clientId && x.email.toLowerCase() === f.email.trim().toLowerCase())) return toast("Ese correo ya lo usa otra cuenta", "alert");
    updateClient(clientId, { name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone, goal: f.goal, heightCm: +f.heightCm || null, fee: +f.fee || 0, billingDay: Math.min(28, Math.max(1, +f.billingDay || 1)) });
    toast("Datos guardados");
  }

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <section className="panel">
        <div className="panel-head"><h2>Datos del cliente</h2></div>
        <div className="panel-body stack">
          <div className="form-grid">
            <div className="full"><Field label="Nombre" id="cd-name"><input id="cd-name" className="input" value={f.name} onChange={set("name")} /></Field></div>
            <Field label="Correo" id="cd-email"><input id="cd-email" className="input" type="email" value={f.email} onChange={set("email")} /></Field>
            <Field label="Teléfono" id="cd-phone"><input id="cd-phone" className="input" value={f.phone} onChange={set("phone")} /></Field>
            <Field label="Objetivo" id="cd-goal"><select id="cd-goal" className="select" value={f.goal} onChange={set("goal")}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="Estatura (cm)" id="cd-h"><input id="cd-h" className="input num" type="number" value={f.heightCm} onChange={set("heightCm")} /></Field>
            <Field label="Mensualidad" id="cd-fee"><input id="cd-fee" className="input num" type="number" value={f.fee} onChange={set("fee")} /></Field>
            <Field label="Día de cobro" id="cd-day" hint="Del 1 al 28"><input id="cd-day" className="input num" type="number" min="1" max="28" value={f.billingDay} onChange={set("billingDay")} /></Field>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" disabled={!dirty} onClick={save}>Guardar cambios</button></div>
        </div>
      </section>

      <div className="stack-lg">
        <section className="panel">
          <div className="panel-head"><h2>Acceso a la app</h2></div>
          <div className="panel-body stack">
            <div className="row"><span className="grow"><span className="tiny muted">Correo</span><br /><strong>{u.email}</strong></span><CopyButton text={u.email} small /></div>
            {newPass && <div className="row"><span className="grow"><span className="tiny muted">Contraseña nueva</span><br /><strong className="num">{newPass}</strong></span><CopyButton text={newPass} small /></div>}
            <button className="btn btn-quiet" onClick={() => { setNewPass(resetClientPassword(clientId)); toast("Contraseña restablecida", "key"); }}><Icon name="key" size={17} />Restablecer contraseña</button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Peso corporal</h2><button className="btn btn-quiet btn-sm" onClick={() => setWeightOpen(true)}><Icon name="plus" size={16} />Registrar</button></div>
          <div className="list">
            {[...c.weights].reverse().slice(0, 5).map((w, i) => <div key={i} className="list-row"><span className="grow small">{shortDate(w.date)}</span><strong className="num">{kg(w.kg)} kg</strong></div>)}
            {!c.weights.length && <div className="list-row muted small">Sin registros.</div>}
          </div>
        </section>
        <section className="panel panel-pad stack">
          <div><div className="strong">{c.active ? "Pausar cliente" : "Reactivar cliente"}</div>
            <p className="small muted">{c.active ? "No podrá entrar a la app ni se le generarán mensualidades. Su historial se conserva." : "Vuelve a tener acceso con su misma rutina e historial."}</p></div>
          <button className={`btn ${c.active ? "btn-danger" : "btn-primary"}`} onClick={() => (c.active ? setPause(true) : (updateClient(clientId, { active: true }), toast("Cliente reactivado")))}>
            {c.active ? "Pausar cliente" : "Reactivar cliente"}
          </button>
        </section>
      </div>

      {weightOpen && <WeightModal clientId={clientId} onClose={() => setWeightOpen(false)} />}
      {pause && <Confirm title="Pausar cliente" confirmLabel="Pausar" onClose={() => setPause(false)} onConfirm={() => { updateClient(clientId, { active: false }); toast("Cliente en pausa", "pause"); }}
        text={`${u.name} no podrá entrar a la app hasta que lo reactives.`} />}
    </div>
  );
}

export function WeightModal({ clientId, onClose }) {
  const db = useDB();
  const last = clientById(db, clientId).weights.at(-1);
  const [v, setV] = useState(last ? String(last.kg) : "");
  const ok = +v > 20 && +v < 400;
  return (
    <Modal title="Registrar peso" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!ok} onClick={() => { addBodyWeight(clientId, +v); toast(`${kg(+v)} kg registrados`, "scale"); onClose(); }}>Guardar</button>
    </>}>
      <Field label="Peso de hoy (kg)" id="bw" hint={last ? `Último: ${kg(last.kg)} kg, ${shortDate(last.date)}` : undefined}>
        <input id="bw" className="input num" type="number" inputMode="decimal" step="0.1" value={v} onChange={(e) => setV(e.target.value)} style={{ fontSize: 22, fontWeight: 700 }} />
      </Field>
    </Modal>
  );
}
