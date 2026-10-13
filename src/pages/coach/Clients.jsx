import { useEffect, useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, CopyButton, Dots, Empty, Field, Modal, Pill, toast } from "../../ui/kit";
import { useApp } from "../../context";
import { addClient, clientsOf, paymentStatus, useDB, weekCount, workoutsOf } from "../../store/db";
import { ago, daysSince, money } from "../../lib/format";

export const GOALS = ["Hipertrofia", "Fuerza", "Pérdida de grasa", "Tonificación", "Recomposición", "Rendimiento", "Salud general"];

export default function Clients() {
  const db = useDB();
  const { me, go, params } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [create, setCreate] = useState(!!params.create);
  useEffect(() => { if (params.create) setCreate(true); }, [params]);

  const rows = clientsOf(db, me.id).map((c) => {
    const last = workoutsOf(db, c.userId)[0];
    const pays = db.payments.filter((p) => p.clientId === c.userId);
    const pay = pays.some((p) => paymentStatus(p) === "overdue") ? "overdue" : pays.some((p) => paymentStatus(p) === "pending") ? "pending" : "paid";
    const idle = c.routine && (!last || daysSince(last.finishedAt) >= 7);
    return { ...c, last, pay, idle, week: weekCount(db, c.userId) };
  });
  const F = {
    all: (r) => true, active: (r) => r.active, noroutine: (r) => r.active && !r.routine,
    overdue: (r) => r.pay === "overdue", idle: (r) => r.active && r.idle, paused: (r) => !r.active,
  };
  const LABELS = [["all", "Todos"], ["active", "Activos"], ["noroutine", "Sin rutina"], ["overdue", "Pago vencido"], ["idle", "Inactivos"], ["paused", "En pausa"]];
  const shown = rows.filter(F[filter]).filter((r) => !q || `${r.user.name} ${r.user.email} ${r.goal}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.user.name.localeCompare(b.user.name));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Clientes</h1><p>Cada cliente tiene su propia rutina, historial y control de pagos.</p></div>
        <button className="btn btn-primary" onClick={() => setCreate(true)}><Icon name="plus" size={18} />Nuevo cliente</button>
      </div>

      <div className="row wrap" style={{ gap: 10 }}>
        <div className="search">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="cl-q">Buscar cliente</label>
          <input id="cl-q" className="input" placeholder="Buscar por nombre, correo u objetivo" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips" role="group" aria-label="Filtrar clientes">
          {LABELS.map(([k, l]) => <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}<span className="chip-n">{rows.filter(F[k]).length}</span></button>)}
        </div>
      </div>

      <section className="panel">
        {shown.length === 0 ? (
          <Empty icon="users" title={rows.length ? "Nadie coincide con el filtro" : "Agrega tu primer cliente"}
            text={rows.length ? "Prueba con otro filtro o búsqueda." : "Le crearemos un acceso para que vea su rutina y registre sus entrenamientos."}
            action={!rows.length && <button className="btn btn-primary" onClick={() => setCreate(true)}>Nuevo cliente</button>} />
        ) : (
          <div className="list">
            {shown.map((r) => (
              <button key={r.userId} className="list-row" onClick={() => go("clientes", { id: r.userId })} style={r.active ? null : { opacity: .6 }}>
                <Avatar name={r.user.name} id={r.userId} />
                <div className="grow">
                  <div className="strong ellipsis">{r.user.name}</div>
                  <div className="small muted ellipsis">{r.goal} · {r.routine ? r.routine.name : "sin rutina"} · {r.last ? `entrenó ${ago(r.last.finishedAt)}` : "sin registros"}</div>
                </div>
                <span className="m-hide row gap-sm" style={{ width: 150 }}>
                  {r.routine ? <><Dots done={r.week} goal={r.routine.frequency} /><span className="small muted num">{r.week}/{r.routine.frequency}</span></> : <Pill tone="warn">Sin rutina</Pill>}
                </span>
                <span style={{ width: 104, textAlign: "right" }}>
                  {!r.active ? <Pill>En pausa</Pill> : r.pay === "overdue" ? <Pill tone="bad">Vencido</Pill> : r.pay === "pending" ? <Pill tone="warn">Pendiente</Pill> : <Pill tone="ok">Al día</Pill>}
                </span>
                <Icon name="right" size={18} />
              </button>
            ))}
          </div>
        )}
      </section>

      {create && <NewClientModal onClose={() => setCreate(false)} />}
    </div>
  );
}

function NewClientModal({ onClose }) {
  const { me, go } = useApp();
  const [f, setF] = useState({ name: "", email: "", phone: "", goal: "Hipertrofia", weight: "", height: "", fee: "50" });
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setError(""); };

  function save() {
    if (!f.name.trim()) return setError("Escribe el nombre del cliente.");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError("Escribe un correo válido: lo usará para entrar.");
    const r = addClient(me.id, f);
    if (r.error) return setError(r.error);
    setCreated(r);
    toast(`${f.name.split(" ")[0]} agregado`, "users");
  }

  if (created) {
    return (
      <Modal title="Cliente agregado" onClose={onClose} footer={<>
        <button className="btn btn-quiet" onClick={onClose}>Cerrar</button>
        <button className="btn btn-primary" onClick={() => { onClose(); go("clientes", { id: created.user.id, tab: "rutina" }); }}>Crear su rutina</button>
      </>}>
        <p className="ink2">Comparte estos datos con {created.user.name.split(" ")[0]} para que entre a la app. Podrá cambiar la contraseña después.</p>
        <div className="panel list">
          <div className="list-row"><span className="grow"><span className="tiny muted">Correo</span><br /><strong>{created.user.email}</strong></span><CopyButton text={created.user.email} small /></div>
          <div className="list-row"><span className="grow"><span className="tiny muted">Contraseña temporal</span><br /><strong className="num">{created.password}</strong></span><CopyButton text={created.password} small /></div>
        </div>
        {+f.fee > 0 && <div className="note-box"><Icon name="wallet" size={18} />Se registró la primera mensualidad de {money(+f.fee)} como pendiente.</div>}
      </Modal>
    );
  }

  return (
    <Modal title="Nuevo cliente" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={save}>Agregar cliente</button>
    </>}>
      <div className="form-grid">
        <div className="full"><Field label="Nombre completo" id="nc-name"><input id="nc-name" className="input" value={f.name} onChange={set("name")} autoComplete="off" /></Field></div>
        <Field label="Correo" id="nc-email"><input id="nc-email" className="input" type="email" value={f.email} onChange={set("email")} autoComplete="off" /></Field>
        <Field label="Teléfono" id="nc-phone"><input id="nc-phone" className="input" type="tel" value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Objetivo" id="nc-goal"><select id="nc-goal" className="select" value={f.goal} onChange={set("goal")}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></Field>
        <Field label="Mensualidad" id="nc-fee"><input id="nc-fee" className="input num" type="number" inputMode="decimal" value={f.fee} onChange={set("fee")} /></Field>
        <Field label="Peso actual (kg)" id="nc-w"><input id="nc-w" className="input num" type="number" inputMode="decimal" value={f.weight} onChange={set("weight")} /></Field>
        <Field label="Estatura (cm)" id="nc-h"><input id="nc-h" className="input num" type="number" inputMode="numeric" value={f.height} onChange={set("height")} /></Field>
      </div>
      {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
    </Modal>
  );
}
