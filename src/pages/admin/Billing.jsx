/* Administrador: precio mensual, datos de pago, revisión de comprobantes y datos legales. */
import { useState } from "react";
import Icon from "../../ui/Icon";
import { Empty, Field, Modal, Pill, toast } from "../../ui/kit";
import { approveSubscription, plansOf, rejectSubscription, saveLegal, savePricing, useDB, userById } from "../../store/db";
import { money, shortDate } from "../../lib/format";

export default function Billing() {
  const db = useDB();
  const subs = db.subscriptions.map((s) => ({ ...s, coach: userById(db, s.coachId) }));
  const pending = subs.filter((s) => s.status === "pending");
  const done = subs.filter((s) => s.status !== "pending");
  const [view, setView] = useState(null);
  const [reject, setReject] = useState(null);
  const month = new Date().getMonth();
  const collected = subs.filter((s) => s.status === "approved" && new Date(s.reviewedAt).getMonth() === month).reduce((t, s) => t + s.amount, 0);

  async function approve(s) {
    const r = await approveSubscription(s.id);
    if (r.error) return toast(r.error, "alert");
    toast(`Pago aprobado. La licencia de ${s.coach?.name || "el entrenador"} se extendió ${s.months} ${s.months === 1 ? "mes" : "meses"}.`, "check");
    setView(null);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Cobros</h1><p>Define el precio, revisa los pagos de los entrenadores y aprueba sus licencias.</p></div>
      </div>
      <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="stat"><span className="stat-label">Por revisar</span><span className="stat-value num">{pending.length}</span></div>
        <div className="stat"><span className="stat-label">Aprobado este mes</span><span className="stat-value num">{money(collected)}</span></div>
        <div className="stat"><span className="stat-label">Precio mensual</span><span className="stat-value num">{money(db.settings?.pricing?.monthly || 0)}</span></div>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Pagos por revisar</h2>{pending.length > 0 && <Pill tone="warn">{pending.length}</Pill>}</div>
        {pending.length === 0 ? <Empty icon="check" title="Todo al día" text="Cuando un entrenador envíe un comprobante aparecerá aquí." /> : (
          <div className="list">
            {pending.map((s) => (
              <div key={s.id} className="list-row">
                <button className="receipt-thumb" onClick={() => setView(s)} aria-label={`Ver comprobante de ${s.coach?.name}`}>
                  {s.receipt ? <img src={s.receipt} alt="" /> : <Icon name="wallet" />}
                </button>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="strong ellipsis">{s.coach?.name || "Entrenador"}</div>
                  <div className="small muted">{money(s.amount)} · {s.months} {s.months === 1 ? "mes" : "meses"} · {s.method}{s.reference ? ` · ref. ${s.reference}` : ""} · {shortDate(s.createdAt)}</div>
                </div>
                <div className="row gap-xs">
                  <button className="btn btn-quiet btn-sm" onClick={() => setReject(s)}>Rechazar</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setView(s)}>Revisar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <PricingForm />
      <LegalForm />

      {done.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Historial</h2></div>
          <div className="list">
            {done.slice(0, 50).map((s) => (
              <div key={s.id} className="list-row">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="strong ellipsis">{s.coach?.name || "Entrenador"} · {money(s.amount)}</div>
                  <div className="small muted">{s.months} {s.months === 1 ? "mes" : "meses"} · enviado {shortDate(s.createdAt)}{s.reviewedAt ? ` · revisado ${shortDate(s.reviewedAt)}` : ""}{s.adminNote ? ` · ${s.adminNote}` : ""}</div>
                </div>
                <Pill tone={s.status === "approved" ? "ok" : "bad"}>{s.status === "approved" ? "Aprobado" : "Rechazado"}</Pill>
              </div>
            ))}
          </div>
        </section>
      )}

      {view && (
        <Modal title={`Pago de ${view.coach?.name || "entrenador"}`} onClose={() => setView(null)} wide footer={view.status === "pending" ? <>
          <button className="btn btn-quiet" onClick={() => { setReject(view); setView(null); }}>Rechazar</button>
          <button className="btn btn-primary" onClick={() => approve(view)}>Aprobar y extender licencia</button>
        </> : null}>
          <p className="ink2">{money(view.amount)} por {view.months} {view.months === 1 ? "mes" : "meses"} · {view.method}{view.reference ? ` · comprobante ${view.reference}` : ""}. Revisa que el dinero haya llegado a tu cuenta antes de aprobar.</p>
          {view.receipt && <img src={view.receipt} alt="Comprobante de pago" style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", borderRadius: 12, background: "var(--surface-2)" }} />}
        </Modal>
      )}
      {reject && <RejectModal sub={reject} onClose={() => setReject(null)} />}
    </div>
  );
}

function RejectModal({ sub, onClose }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  async function submit() {
    const r = await rejectSubscription(sub.id, note.trim());
    if (r.error) return setError(r.error);
    toast("Pago rechazado. El entrenador verá el motivo.", "x");
    onClose();
  }
  return (
    <Modal title="Rechazar pago" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-danger" onClick={submit} disabled={note.trim().length < 3}>Rechazar</button>
    </>}>
      <Field label="Motivo (lo verá el entrenador)" id="rej-note">
        <textarea id="rej-note" className="textarea" rows={3} value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} placeholder="Ej.: el monto no llegó a la cuenta" maxLength={300} />
      </Field>
      {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
    </Modal>
  );
}

function PricingForm() {
  const db = useDB();
  const p = db.settings?.pricing || { monthly: 0, discounts: {}, bank: {}, instructions: "" };
  const init = { monthly: String(p.monthly ?? ""), d3: String(p.discounts?.[3] ?? 0), d6: String(p.discounts?.[6] ?? 0), d12: String(p.discounts?.[12] ?? 0),
    instructions: p.instructions || "", ...Object.fromEntries(["name", "type", "number", "holder", "id"].map((k) => [`b_${k}`, p.bank?.[k] || ""])) };
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const preview = plansOf({ settings: { pricing: { monthly: +f.monthly || 0, discounts: { 1: 0, 3: +f.d3 || 0, 6: +f.d6 || 0, 12: +f.d12 || 0 } } } });
  const dirty = JSON.stringify(f) !== JSON.stringify(init);

  async function save() {
    const monthly = +f.monthly;
    if (!(monthly >= 0)) return toast("Escribe un precio válido.", "alert");
    setBusy(true);
    const r = await savePricing({ monthly, discounts: { 3: +f.d3 || 0, 6: +f.d6 || 0, 12: +f.d12 || 0 }, instructions: f.instructions,
      bank: { name: f.b_name, type: f.b_type, number: f.b_number, holder: f.b_holder, id: f.b_id } });
    setBusy(false);
    if (r.error) return toast(r.error, "alert");
    toast("Precios guardados. Los entrenadores ya ven el nuevo precio.", "check");
  }

  return (
    <section className="panel">
      <div className="panel-head"><h2>Precio de la licencia</h2></div>
      <div className="panel-body stack">
        <div className="form-grid">
          <Field label="Precio por mes (USD)" id="pr-month"><input id="pr-month" className="input num" type="number" min="0" step="0.5" value={f.monthly} onChange={set("monthly")} /></Field>
          <Field label="Descuento 3 meses (%)" id="pr-3"><input id="pr-3" className="input num" type="number" min="0" max="90" value={f.d3} onChange={set("d3")} /></Field>
          <Field label="Descuento 6 meses (%)" id="pr-6"><input id="pr-6" className="input num" type="number" min="0" max="90" value={f.d6} onChange={set("d6")} /></Field>
          <Field label="Descuento 12 meses (%)" id="pr-12"><input id="pr-12" className="input num" type="number" min="0" max="90" value={f.d12} onChange={set("d12")} /></Field>
        </div>
        <div className="plan-grid">
          {preview.map((pl) => (
            <div key={pl.months} className="plan-card static">
              <span className="small muted">{pl.label}</span>
              <strong className="num" style={{ fontSize: 22 }}>{money(pl.price)}</strong>
              <span className="tiny muted">{money(pl.price / pl.months)} / mes</span>
            </div>
          ))}
        </div>
        <span className="section-title" style={{ fontSize: 17 }}>Datos para que te paguen</span>
        <div className="form-grid">
          <Field label="Banco" id="b-name"><input id="b-name" className="input" value={f.b_name} onChange={set("b_name")} placeholder="Ej.: Banco Pichincha" /></Field>
          <Field label="Tipo de cuenta" id="b-type"><input id="b-type" className="input" value={f.b_type} onChange={set("b_type")} placeholder="Ahorros / Corriente" /></Field>
          <Field label="Número de cuenta" id="b-number"><input id="b-number" className="input num" value={f.b_number} onChange={set("b_number")} /></Field>
          <Field label="Titular" id="b-holder"><input id="b-holder" className="input" value={f.b_holder} onChange={set("b_holder")} /></Field>
          <Field label="Cédula o RUC" id="b-id"><input id="b-id" className="input num" value={f.b_id} onChange={set("b_id")} /></Field>
        </div>
        <Field label="Indicaciones adicionales" id="pr-ins">
          <textarea id="pr-ins" className="textarea" rows={3} maxLength={1000} value={f.instructions} onChange={set("instructions")} placeholder="Ej.: también aceptamos Deuna al 099…; envía el comprobante desde la app." />
        </Field>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-primary" onClick={save} disabled={!dirty || busy}>{busy ? "Guardando…" : "Guardar precios"}</button>
        </div>
      </div>
    </section>
  );
}

function LegalForm() {
  const db = useDB();
  const l = db.settings?.legal || {};
  const init = { company: l.company || "", contactEmail: l.contactEmail || "", city: l.city || "" };
  const [f, setF] = useState(init);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save() {
    const r = await saveLegal(f);
    if (r.error) return toast(r.error, "alert");
    toast("Datos guardados en la política de privacidad", "check");
  }
  return (
    <section className="panel">
      <div className="panel-head"><h2>Datos legales</h2><span className="small muted">Aparecen en la política de privacidad</span></div>
      <div className="panel-body stack">
        <div className="form-grid">
          <Field label="Responsable (nombre o empresa)" id="lg-co"><input id="lg-co" className="input" value={f.company} onChange={set("company")} /></Field>
          <Field label="Correo de contacto para privacidad" id="lg-mail"><input id="lg-mail" className="input" type="email" value={f.contactEmail} onChange={set("contactEmail")} /></Field>
          <Field label="Ciudad" id="lg-city"><input id="lg-city" className="input" value={f.city} onChange={set("city")} /></Field>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-quiet" onClick={save} disabled={JSON.stringify(f) === JSON.stringify(init)}>Guardar</button>
        </div>
      </div>
    </section>
  );
}
