/* Suscripción del entrenador: estado de la licencia, precio fijado por el
   administrador, datos para pagar, envío del comprobante y canje de códigos. */
import { useState } from "react";
import Icon from "../../ui/Icon";
import { Field, Pill, toast } from "../../ui/kit";
import { ImageDrop } from "../../ui/inputs";
import { useApp } from "../../context";
import { LICENSE_LABEL, LICENSE_TONE, coachLicense, licenseStatus, normalizeCode, plansOf, redeemCode, requestSubscription, useDB } from "../../store/db";
import { daysUntil, money, shortDate } from "../../lib/format";
import { progressImage } from "../../lib/image";

const SUB_LABEL = { pending: "En revisión", approved: "Aprobado", rejected: "Rechazado" };
const SUB_TONE = { pending: "warn", approved: "ok", rejected: "bad" };
const METHODS = ["Transferencia", "Depósito", "Deuna / pago móvil", "Efectivo", "Otro"];

export default function Subscription() {
  const db = useDB();
  const { me } = useApp();
  const lic = coachLicense(db, me.id);
  const st = lic ? licenseStatus(lic) : null;
  const left = lic?.expiresAt ? daysUntil(lic.expiresAt) : 0;
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div><h1>Suscripción</h1><p>Tu licencia de VYTRAFIT y tus pagos.</p></div>
      </div>
      <section className="panel panel-pad row wrap" style={{ gap: 16 }}>
        <span className="avatar lg" style={{ background: st === "active" ? "var(--green-soft)" : st === "expiring" ? "var(--yellow-soft)" : "var(--red-soft)", color: st === "active" ? "var(--green-ink)" : st === "expiring" ? "var(--yellow-ink)" : "var(--red-ink)" }}>
          <Icon name="key" size={26} />
        </span>
        <div className="grow" style={{ minWidth: 200 }}>
          <div className="row gap-sm wrap"><strong style={{ fontSize: 19 }}>Licencia</strong>{st && <Pill tone={LICENSE_TONE[st]}>{LICENSE_LABEL[st]}</Pill>}</div>
          <p className="ink2 small" style={{ marginTop: 4 }}>
            {!lic ? "Aún no tienes una licencia." : lic.unlimited && st !== "revoked" ? <>Tu licencia es <strong>indefinida</strong>: no vence y no necesitas renovarla.</> : ["active", "expiring"].includes(st)
              ? <>Vigente hasta el <strong>{shortDate(lic.expiresAt)}</strong> · quedan {left} {left === 1 ? "día" : "días"}. Lo que pagues ahora se suma a esa fecha.</>
              : <>Venció el {shortDate(lic.expiresAt)}. Paga un plan para volver a trabajar; tus asesorados y su historial siguen guardados.</>}
          </p>
        </div>
      </section>
      {!(lic?.unlimited && st !== "revoked") && <SubscriptionPanel />}
    </div>
  );
}

/** Planes, pago y canje. También se usa en la pantalla de licencia vencida. */
export function SubscriptionPanel() {
  const db = useDB();
  const { me } = useApp();
  const plans = plansOf(db);
  const pricing = db.settings?.pricing;
  const subs = db.subscriptions.filter((s) => s.coachId === me.id);
  const pending = subs.find((s) => s.status === "pending");
  const [months, setMonths] = useState(1);
  const [f, setF] = useState({ method: METHODS[0], reference: "", receipt: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const plan = plans.find((p) => p.months === months);
  const bank = pricing?.bank || {};
  const hasBank = bank.name || bank.number;

  async function receipt(files) {
    try { setF({ ...f, receipt: await progressImage(files[0]) }); setError(""); }
    catch (e) { toast(e.message, "alert"); }
  }
  async function submit(e) {
    e.preventDefault();
    if (!f.receipt) return setError("Sube la foto o captura del comprobante.");
    setBusy(true);
    const r = await requestSubscription({ months, method: f.method, reference: f.reference.trim(), receipt: f.receipt });
    setBusy(false);
    if (r.error) return setError(r.error);
    toast("Pago enviado. Te avisamos cuando el administrador lo apruebe.", "check");
    setF({ method: METHODS[0], reference: "", receipt: null });
  }

  return (
    <>
      {pending && (
        <div className="note-box"><Icon name="clock" size={18} /><span className="grow">
          Tu pago de <strong>{money(pending.amount)}</strong> por {pending.months} {pending.months === 1 ? "mes" : "meses"} está en revisión desde el {shortDate(pending.createdAt)}. Cuando el administrador lo apruebe, tu licencia se extiende sola.
        </span></div>
      )}

      {!pending && (
        <section className="panel">
          <div className="panel-head"><h2>Elige tu plan</h2><span className="small muted">Precio en {pricing?.currency || "USD"}</span></div>
          <div className="panel-body stack">
            <div className="plan-grid" role="radiogroup" aria-label="Plan">
              {plans.map((p) => (
                <button key={p.months} type="button" role="radio" aria-checked={months === p.months} className="plan-card" onClick={() => setMonths(p.months)}>
                  <span className="small muted">{p.label}</span>
                  <strong className="num" style={{ fontSize: 26 }}>{money(p.price)}</strong>
                  <span className="tiny muted">{money(p.price / p.months)} / mes</span>
                  {p.discount > 0 && <span className="pill ok" style={{ marginTop: 4 }}>Ahorras {p.discount}%</span>}
                </button>
              ))}
            </div>

            <div className="pay-box">
              <strong>Cómo pagar</strong>
              {hasBank && (
                <dl className="bank">
                  {bank.name && <><dt>Banco</dt><dd>{bank.name}</dd></>}
                  {bank.type && <><dt>Tipo de cuenta</dt><dd>{bank.type}</dd></>}
                  {bank.number && <><dt>Número</dt><dd className="num">{bank.number}</dd></>}
                  {bank.holder && <><dt>Titular</dt><dd>{bank.holder}</dd></>}
                  {bank.id && <><dt>Cédula / RUC</dt><dd className="num">{bank.id}</dd></>}
                </dl>
              )}
              {pricing?.instructions && <p className="small ink2" style={{ whiteSpace: "pre-line" }}>{pricing.instructions}</p>}
              {!hasBank && !pricing?.instructions && <p className="small muted">El administrador aún no publicó los datos de pago. Escríbele para coordinar.</p>}
            </div>

            <form className="stack" onSubmit={submit} noValidate>
              <div className="form-grid">
                <Field label="Forma de pago" id="sub-method">
                  <select id="sub-method" className="select" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
                </Field>
                <Field label="Número de comprobante (opcional)" id="sub-ref">
                  <input id="sub-ref" className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} maxLength={120} />
                </Field>
              </div>
              <div className="field">
                <span className="label">Comprobante de pago</span>
                {f.receipt ? (
                  <div className="row gap-sm">
                    <img src={f.receipt} alt="Comprobante" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10 }} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, receipt: null })}>Cambiar</button>
                  </div>
                ) : <ImageDrop onFiles={receipt} label="Subir foto o captura" hint="Solo lo ve el administrador." />}
              </div>
              {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
              <button className="btn btn-primary btn-lg" type="submit" disabled={busy || !plan}>
                {busy ? "Enviando…" : `Enviar pago de ${plan ? money(plan.price) : ""}`}
              </button>
            </form>
          </div>
        </section>
      )}

      {subs.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Tus pagos</h2></div>
          <div className="list">
            {subs.map((s) => (
              <div key={s.id} className="list-row">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="strong">{money(s.amount)} · {s.months} {s.months === 1 ? "mes" : "meses"}</div>
                  <div className="small muted">{shortDate(s.createdAt)} · {s.method}{s.adminNote ? ` · ${s.adminNote}` : ""}</div>
                </div>
                <Pill tone={SUB_TONE[s.status]}>{SUB_LABEL[s.status]}</Pill>
              </div>
            ))}
          </div>
        </section>
      )}
      <RedeemBox />
    </>
  );
}

function RedeemBox() {
  const { me } = useApp();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const r = await redeemCode(me.id, code);
    setBusy(false);
    if (r.error) return setError(r.error);
    setCode("");
    toast("Código canjeado. Tu licencia se extendió.", "key");
  }
  return (
    <section className="panel">
      <div className="panel-head"><h2>¿Tienes un código de licencia?</h2></div>
      <form className="panel-body row wrap gap-sm" onSubmit={submit} noValidate style={{ alignItems: "flex-end" }}>
        <div className="grow" style={{ minWidth: 220 }}>
          <Field label="Código" id="redeem-code">
            <input id="redeem-code" className="input num" style={{ letterSpacing: ".08em", fontWeight: 600 }} placeholder="FIT-XXXX-XXXX-XXXX" autoComplete="off"
              value={code} onChange={(e) => { setCode(normalizeCode(e.target.value)); setError(""); }} />
          </Field>
        </div>
        <button className="btn btn-quiet" type="submit" disabled={code.length < 18 || busy}>Canjear</button>
        {error && <div className="error-box" role="alert" style={{ width: "100%" }}><Icon name="alert" size={18} />{error}</div>}
      </form>
    </section>
  );
}
