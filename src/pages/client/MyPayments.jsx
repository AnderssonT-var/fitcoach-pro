import { useState } from "react";
import Icon from "../../ui/Icon";
import { Empty, Field, Modal, Pill, run } from "../../ui/kit";
import { ImageDrop } from "../../ui/inputs";
import { progressImage } from "../../lib/image";
import { useApp } from "../../context";
import { PAY_LABEL, PAY_TONE, clientById, paymentStatus, sendReceipt, useDB, userById } from "../../store/db";
import { daysUntil, money, shortDate } from "../../lib/format";

export default function MyPayments() {
  const db = useDB();
  const { me, go } = useApp();
  const c = clientById(db, me.id);
  const coach = userById(db, c.coachId);
  const pays = db.payments.filter((p) => p.clientId === me.id).map((p) => ({ ...p, st: paymentStatus(p) })).sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
  const overdue = pays.filter((p) => p.st === "overdue");
  const pending = pays.filter((p) => p.st === "pending");
  const bill = coach?.billing || {};
  const [paying, setPaying] = useState(null);
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
                  {p.st !== "paid" && p.clientPaidAt ? <Pill tone="info">Por confirmar</Pill> : <Pill tone={PAY_TONE[p.st]}>{PAY_LABEL[p.st]}</Pill>}
                  {p.st !== "paid" && <button className="btn btn-primary btn-sm" onClick={() => setPaying(p)}>{p.clientPaidAt ? "Ver" : "Pagar"}</button>}
                </div>
              );
            })}
          </div>
        )}
      </section>
      {(bill.plans || []).length > 0 && (
        <section className="panel panel-pad stack">
          <h2 className="section-title">Planes de {coach.name.split(" ")[0]}</h2>
          <div className="plan-cards">{bill.plans.map((pl) => <div key={pl.id} className="plan-card"><strong>{pl.name}</strong><span className="display num">{money(pl.price)}</span><span className="tiny muted">{pl.period === "única" ? "pago único" : `por ${pl.period}`}</span></div>)}</div>
        </section>
      )}
      {paying && <PaySheet p={paying} bill={bill} coach={coach} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PaySheet({ p, bill, coach, onClose }) {
  const [src, setSrc] = useState(null);
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    const r = await run(sendReceipt(p.id, src, bill.payLabel || (src ? "Transferencia" : "")), `Le avisamos a ${coach.name.split(" ")[0]}. Lo confirmará en breve`);
    setBusy(false);
    if (!r?.error) onClose();
  }
  return (
    <Modal title={`Pagar ${money(p.amount)}`} onClose={onClose} footer={<button className="btn btn-primary" disabled={busy} onClick={send}>{busy ? "Enviando…" : p.clientPaidAt ? "Volver a avisar" : "Ya pagué: avisar"}</button>}>
      <p className="ink2">{p.concept}</p>
      {p.clientPaidAt && <div className="note-box small"><Icon name="clock" size={15} /><span>Ya avisaste que pagaste. {coach.name.split(" ")[0]} lo confirmará.</span></div>}
      {bill.payLink ? (
        <a className="btn btn-primary btn-lg btn-block" href={bill.payLink} target="_blank" rel="noopener noreferrer"><Icon name="wallet" size={18} />Pagar en línea{bill.payLabel ? ` con ${bill.payLabel}` : ""}</a>
      ) : <span className="small muted">{coach.name.split(" ")[0]} aún no tiene pago en línea. Paga por transferencia o en efectivo y avísale aquí.</span>}
      {bill.instructions && <div className="note-box small" style={{ whiteSpace: "pre-line" }}><Icon name="note" size={15} /><span>{bill.instructions}</span></div>}
      <Field label="Comprobante (opcional)" id="rc-img">
        {src ? <img src={src} alt="Comprobante" style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 12 }} />
          : <ImageDrop compact onFiles={async ([f]) => setSrc(await progressImage(f))} label="Subir foto del comprobante" />}
      </Field>
    </Modal>
  );
}
