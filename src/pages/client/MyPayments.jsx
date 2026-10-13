import Icon from "../../ui/Icon";
import { Empty, Pill } from "../../ui/kit";
import { useApp } from "../../context";
import { PAY_LABEL, PAY_TONE, clientById, paymentStatus, useDB, userById } from "../../store/db";
import { daysUntil, money, shortDate } from "../../lib/format";

export default function MyPayments() {
  const db = useDB();
  const { me, go } = useApp();
  const c = clientById(db, me.id);
  const coach = userById(db, c.coachId);
  const pays = db.payments.filter((p) => p.clientId === me.id).map((p) => ({ ...p, st: paymentStatus(p) })).sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
  const overdue = pays.filter((p) => p.st === "overdue");
  const pending = pays.filter((p) => p.st === "pending");
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-head"><div><h1>Tus pagos</h1><p>Mensualidad de {money(c.fee)} con {coach.name}, el día {c.billingDay} de cada mes.</p></div></div>
      {overdue.length ? (
        <div className="error-box"><Icon name="alert" size={18} /><span className="grow">Tienes {overdue.length === 1 ? "un pago vencido" : `${overdue.length} pagos vencidos`} por {money(overdue.reduce((t, p) => t + p.amount, 0))}. Coordina con tu entrenador.</span>
          <button className="btn btn-quiet btn-sm" onClick={() => go("mensajes")}>Escribirle</button></div>
      ) : pending.length ? (
        <div className="warn-box"><Icon name="clock" size={18} />Tu próximo pago de {money(pending[0].amount)} vence el {shortDate(pending[0].dueDate)}.</div>
      ) : (
        <div className="note-box" style={{ background: "var(--green-soft)" }}><Icon name="check" size={18} />Estás al día. ¡Gracias!</div>
      )}
      <section className="panel">
        {pays.length === 0 ? <Empty icon="wallet" title="Sin pagos registrados" /> : (
          <div className="list">
            {pays.map((p) => {
              const d = daysUntil(p.dueDate);
              return (
                <div key={p.id} className="list-row">
                  <div className="grow">
                    <div className="strong">{p.concept}</div>
                    <div className="small muted">{p.st === "paid" ? `Pagado el ${shortDate(p.paidAt)} · ${p.method}` : p.st === "overdue" ? `Venció hace ${-d} ${-d === 1 ? "día" : "días"}` : `Vence el ${shortDate(p.dueDate)}`}</div>
                  </div>
                  <span className="display num" style={{ fontSize: 22 }}>{money(p.amount)}</span>
                  <Pill tone={PAY_TONE[p.st]}>{PAY_LABEL[p.st]}</Pill>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
