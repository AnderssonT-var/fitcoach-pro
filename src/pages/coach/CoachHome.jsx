import Icon from "../../ui/Icon";
import { Avatar, Dots, Pill, Stat } from "../../ui/kit";
import SessionList from "../../workout/SessionList";
import { useApp } from "../../context";
import {
  clientsOf, coachLicense, licenseStatus, paymentStatus, thread, useDB, weekCount, workoutsForCoach, workoutsOf,
} from "../../store/db";
import { capitalize, daysSince, daysUntil, money, shortDate } from "../../lib/format";
import { trialInfo } from "../../lib/trial";
import { NotifyPrompt } from "../shared/Account";

export default function CoachHome() {
  const db = useDB();
  const { me, go } = useApp();

  const lic = coachLicense(db, me.id);
  const licDays = lic?.expiresAt ? daysUntil(lic.expiresAt) : 0;
  const clients = clientsOf(db, me.id);
  const active = clients.filter((c) => c.active);
  const pays = db.payments.filter((p) => p.coachId === me.id);
  const now = new Date();
  const thisMonth = (iso) => { const d = new Date(iso); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); };
  const collected = pays.filter((p) => p.paidAt && thisMonth(p.paidAt)).reduce((t, p) => t + p.amount, 0);
  const overdue = pays.filter((p) => paymentStatus(p) === "overdue");
  const pending = pays.filter((p) => paymentStatus(p) !== "paid");
  const weekDone = active.reduce((t, c) => t + weekCount(db, c.userId), 0);
  const weekGoal = active.reduce((t, c) => t + (c.routine?.frequency || 0), 0);

  // Lista de pendientes
  const todo = [];
  overdue.forEach((p) => {
    const c = clients.find((x) => x.userId === p.clientId);
    todo.push({ key: p.id, tone: "bad", icon: "wallet", who: c?.user, text: `${p.concept} vencida (${money(p.amount)})`, action: "Cobrar", run: () => go("pagos", { filter: "overdue" }) });
  });
  active.forEach((c) => {
    const t = trialInfo(c);
    if (!t) return;
    if (!t.running) todo.push({ key: `t${c.userId}`, tone: "bad", icon: "clock", who: c.user, text: "Terminó su prueba y falta el plan completo", action: "Decidir", run: () => go("clientes", { id: c.userId }) });
    else if (!c.planRoutine && t.daysLeft <= 5) todo.push({ key: `t${c.userId}`, tone: "warn", icon: "clock", who: c.user, text: `Su prueba termina en ${t.daysLeft} ${t.daysLeft === 1 ? "día" : "días"}: prepara el plan completo`, action: "Preparar", run: () => go("clientes", { id: c.userId, tab: "rutina", slot: "plan" }) });
  });
  active.filter((c) => !c.routine).forEach((c) => todo.push({ key: `r${c.userId}`, tone: "warn", icon: "dumbbell", who: c.user, text: "No tiene rutina asignada", action: "Crear rutina", run: () => go("clientes", { id: c.userId, tab: "rutina" }) }));
  active.filter((c) => c.routine).forEach((c) => {
    const last = workoutsOf(db, c.userId)[0];
    const d = last ? daysSince(last.finishedAt) : null;
    if (d == null || d >= 7) todo.push({ key: `i${c.userId}`, tone: "warn", icon: "clock", who: c.user, text: last ? `Lleva ${d} días sin entrenar` : "Aún no registra entrenamientos", action: "Escribir", run: () => go("mensajes", { clientId: c.userId }) });
  });
  clients.forEach((c) => {
    const unread = thread(db, me.id, c.userId).filter((m) => !m.read && m.from !== me.id);
    if (unread.length) todo.push({ key: `m${c.userId}`, tone: "info", icon: "chat", who: c.user, text: `${unread.length} ${unread.length === 1 ? "mensaje nuevo" : "mensajes nuevos"}: “${unread.at(-1).text.slice(0, 60)}${unread.at(-1).text.length > 60 ? "…" : ""}”`, action: "Responder", run: () => go("mensajes", { clientId: c.userId }) });
  });

  const today = capitalize(now.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" }));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Hola, {me.name.split(" ")[0]}</h1><p>{today}</p></div>
        <button className="btn btn-primary" onClick={() => go("clientes", { create: true })}><Icon name="plus" size={18} />Nuevo cliente</button>
      </div>

      <NotifyPrompt />
      {lic && licenseStatus(lic) === "expiring" && (
        <div className="warn-box">
          <Icon name="key" size={18} />
          <span className="grow">Tu licencia vence en <strong>{licDays} {licDays === 1 ? "día" : "días"}</strong> ({shortDate(lic.expiresAt)}). Renuévala para que tus clientes no pierdan el seguimiento.</span>
          <button className="btn btn-quiet btn-sm" onClick={() => go("suscripcion")}>Renovar</button>
        </div>
      )}

      <div className="stats">
        <Stat label="Clientes activos" value={active.length} sub={`${clients.length - active.length} en pausa`} icon="users" />
        <Stat label="Entrenamientos esta semana" value={<>{weekDone}<span className="muted" style={{ fontSize: 22 }}>/{weekGoal}</span></>} sub="registrados / planificados" icon="dumbbell" />
        <Stat label={`Cobrado en ${now.toLocaleDateString("es-EC", { month: "long" })}`} value={money(collected)} tone="ok" icon="wallet" />
        <Stat label="Por cobrar" value={money(pending.reduce((t, p) => t + p.amount, 0))} tone={overdue.length ? "bad" : "warn"} sub={overdue.length ? `${overdue.length} ${overdue.length === 1 ? "pago vencido" : "pagos vencidos"}` : "nada vencido"} icon="clock" />
      </div>

      <div className="split">
        <section className="panel">
          <div className="panel-head"><h2>Pendientes</h2>{todo.length > 0 && <Pill tone="bad">{todo.length}</Pill>}</div>
          {todo.length === 0 ? <div className="panel-body muted">Todo al día. Buen trabajo.</div> : (
            <div className="list">
              {todo.map((t) => (
                <div key={t.key} className="list-row">
                  <span className="avatar sm" style={{ background: `var(--${{ bad: "red", warn: "yellow", info: "blue" }[t.tone]}-soft)`, color: `var(--${{ bad: "red", warn: "yellow", info: "blue" }[t.tone]}-ink)` }}><Icon name={t.icon} size={16} /></span>
                  <div className="grow">
                    <div className="strong ellipsis">{t.who?.name}</div>
                    <div className="small muted" style={{ overflowWrap: "anywhere" }}>{t.text}</div>
                  </div>
                  <button className="btn btn-quiet btn-sm" onClick={t.run}>{t.action}</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Cumplimiento semanal</h2></div>
          <div className="list">
            {active.map((c) => {
              const n = weekCount(db, c.userId);
              const goal = c.routine?.frequency || 0;
              return (
                <button key={c.userId} className="list-row" onClick={() => go("clientes", { id: c.userId })}>
                  <Avatar name={c.user.name} id={c.userId} size="sm" />
                  <span className="grow ellipsis strong">{c.user.name}</span>
                  {goal ? <Dots done={n} goal={goal} /> : <span className="tiny muted">sin rutina</span>}
                  <span className="small num muted" style={{ width: 32, textAlign: "right" }}>{goal ? `${n}/${goal}` : ""}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Últimos entrenamientos</h2><span className="small muted m-hide">Toca uno para ver cada serie</span></div>
        <SessionList sessions={workoutsForCoach(db, me.id)} showClient limit={6} onReply={(clientId) => go("mensajes", { clientId })} />
      </section>

    </div>
  );
}
