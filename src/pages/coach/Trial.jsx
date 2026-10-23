/* Plan de prueba: etiqueta, panel de seguimiento, rutina de prueba vs. plan completo. */
import { useState } from "react";
import Icon from "../../ui/Icon";
import { Confirm, Field, Modal, Pill, run } from "../../ui/kit";
import RoutineEditor from "./RoutineEditor";
import { cancelTrial, clientById, convertTrial, extendTrial, startTrial, useDB, userById } from "../../store/db";
import { TRIAL_OPTIONS, trialInfo, trialName } from "../../lib/trial";
import { money } from "../../lib/format";

const fmt = (iso) => new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short" });

export function TrialPill({ c, short }) {
  const t = trialInfo(c);
  if (!t) return null;
  return <Pill tone={t.running ? "info" : "warn"}><Icon name="clock" size={12} />{short ? (t.running ? `Prueba · ${t.daysLeft} d` : "Prueba terminada") : t.label}</Pill>;
}

/** Selector de días + precio de la prueba (lo usan el alta de cliente y «Ofrecer prueba»). */
export function TrialFields({ value, onChange, idp = "tr" }) {
  return (
    <>
      <div className="field full">
        <span className="label">Duración de la prueba</span>
        <div className="chips" role="group" aria-label="Duración de la prueba">
          {TRIAL_OPTIONS.map((d) => <button type="button" key={d} className="chip" aria-pressed={+value.days === d} onClick={() => onChange({ ...value, days: d })}>{d === 30 ? "1 mes" : `${d} días`}</button>)}
        </div>
      </div>
      <Field label="Precio de la prueba" id={`${idp}-fee`} hint="0 si es gratis"><input id={`${idp}-fee`} className="input num" type="number" inputMode="decimal" min="0" value={value.fee} onChange={(e) => onChange({ ...value, fee: e.target.value })} /></Field>
    </>
  );
}

/** Panel del resumen: progreso de la prueba y qué pasa al terminar. */
export function TrialPanel({ clientId, onTab }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const u = userById(db, clientId);
  const t = trialInfo(c);
  const [ask, setAsk] = useState(null);
  const [extend, setExtend] = useState(false);
  if (!t) return null;
  const first = u.name.split(" ")[0];
  const plan = c.planRoutine;
  return (
    <section className={`panel trial-panel ${t.running ? "" : "ended"}`}>
      <div className="panel-head">
        <div>
          <h2 className="row gap-sm"><Icon name="clock" size={20} />{trialName(t.days)}</h2>
          <div className="small muted">{fmt(t.start)} → {fmt(t.end)} · {t.fee > 0 ? `cobro de prueba ${money(t.fee)}` : "gratis"} · después {money(c.fee)} al mes</div>
        </div>
        <span className="strong num m-hide" style={{ whiteSpace: "nowrap" }}>{t.running ? `${t.daysLeft} ${t.daysLeft === 1 ? "día" : "días"}` : "Terminada"}</span>
      </div>
      <div className="panel-body stack">
        <div className={`progress ${t.running ? "" : "warn"}`}><i style={{ width: `${t.pct}%` }} /></div>
        <div className="trial-steps">
          <div className="trial-step">
            <span className={`trial-dot ${c.routine ? "ok" : ""}`}><Icon name={c.routine ? "check" : "dumbbell"} size={14} stroke={c.routine ? 3 : 2} /></span>
            <div className="grow"><div className="strong">Rutina de prueba</div><div className="small muted">{c.routine ? `${c.routine.name} · ${first} la ve ahora` : "Aún no la creas"}</div></div>
            <button className="btn btn-quiet btn-sm" onClick={() => onTab("rutina", "current")}>{c.routine ? "Editar" : "Crear"}</button>
          </div>
          <div className="trial-step">
            <span className={`trial-dot ${plan ? "ok" : ""}`}><Icon name={plan ? "check" : "trend"} size={14} stroke={plan ? 3 : 2} /></span>
            <div className="grow"><div className="strong">Plan completo</div><div className="small muted">{plan ? `${plan.name} · ${plan.goal} · se activa solo el ${fmt(t.end)}` : "Prepáralo para que se active solo al terminar la prueba"}</div></div>
            <button className={`btn btn-sm ${plan ? "btn-quiet" : "btn-primary"}`} onClick={() => onTab("rutina", "plan")}>{plan ? "Editar" : "Preparar"}</button>
          </div>
        </div>
        {!t.running && !plan && <div className="warn-box"><Icon name="alert" size={18} /><span>La prueba terminó y aún no hay plan completo. {first} sigue con la rutina de prueba hasta que decidas.</span></div>}
        <div className="row wrap gap-sm">
          <button className="btn btn-primary" onClick={() => setAsk("convert")} disabled={!plan && !c.routine}><Icon name="check" size={17} />Pasar al plan completo {t.running ? "ahora" : ""}</button>
          <button className="btn btn-quiet" onClick={() => setExtend(true)}><Icon name="plus" size={17} />Extender prueba</button>
          <button className="btn btn-ghost" style={{ color: "var(--red-ink)" }} onClick={() => setAsk("cancel")}>No continúa</button>
        </div>
      </div>
      {ask === "convert" && <Confirm title="Pasar al plan completo" confirmLabel="Activar plan completo" onClose={() => setAsk(null)}
        onConfirm={() => run(convertTrial(clientId), `${first} ya está en el plan completo`, "check")}
        text={`${plan ? `${first} empezará a ver «${plan.name}».` : `${first} seguirá con su rutina actual como plan completo.`} Se quita la etiqueta de prueba${c.fee > 0 ? ` y se registra su primera mensualidad de ${money(c.fee)}` : ""}. Le llegará un mensaje.`} />}
      {ask === "cancel" && <Confirm title="Terminar la prueba" confirmLabel="Terminar y pausar" onClose={() => setAsk(null)}
        onConfirm={() => run(cancelTrial(clientId, true), "Prueba terminada. Cliente en pausa", "pause")}
        text={`${first} no continúa: se cierra la prueba y queda en pausa (sin acceso ni mensualidades). Su historial se conserva y puedes reactivarlo cuando quieras.`} />}
      {extend && <ExtendModal clientId={clientId} onClose={() => setExtend(false)} />}
    </section>
  );
}

function ExtendModal({ clientId, onClose }) {
  const [days, setDays] = useState(7);
  return (
    <Modal title="Extender la prueba" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={() => { run(extendTrial(clientId, days), `Prueba extendida ${days} días`, "clock"); onClose(); }}>Extender</button>
    </>}>
      <div className="chips" role="group" aria-label="Días extra">
        {[3, 7, 14, 30].map((d) => <button key={d} className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>+{d} días</button>)}
      </div>
      <p className="small muted">No se genera otro cobro. Si quieres cobrar la extensión, regístralo en Pagos.</p>
    </Modal>
  );
}

/** Ofrecer prueba a un cliente que ya existe (pestaña Datos). */
export function OfferTrial({ clientId }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ days: 30, fee: "0" });
  if (trialInfo(c)) return null;
  return (
    <section className="panel panel-pad stack">
      <div><div className="strong">Plan de prueba</div>
        <p className="small muted">Dale un periodo de prueba con su propia rutina y precio. Al terminar pasa solo al plan completo que prepares.</p></div>
      <button className="btn btn-quiet" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}><Icon name="clock" size={17} />Ofrecer plan de prueba</button>
      {open && (
        <Modal title="Ofrecer plan de prueba" onClose={() => setOpen(false)} footer={<>
          <button className="btn btn-quiet" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={async () => { const r = await run(startTrial(clientId, v.days, v.fee), "Plan de prueba activado", "clock"); if (!r?.error) setOpen(false); }}>Activar prueba</button>
        </>}>
          <div className="form-grid"><TrialFields value={v} onChange={setV} idp="ot" /></div>
          {+v.fee > 0 && <p className="small muted">Se registra un cobro de {money(+v.fee)} por la prueba. Mientras dure no se generan mensualidades.</p>}
        </Modal>
      )}
    </section>
  );
}

/** Pestaña Rutina durante la prueba: rutina de prueba (la ve ahora) o plan completo (se activa al terminar). */
export function TrialRoutines({ clientId, slot, onSlot }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const t = trialInfo(c);
  if (!t) return <RoutineEditor key={clientId} clientId={clientId} />;
  return (
    <div className="stack">
      <div className="seg trial-seg" role="tablist" aria-label="Rutina a editar">
        <button role="tab" aria-selected={slot !== "plan"} onClick={() => onSlot("current")}>
          <span className="strong">Rutina de prueba</span><span className="tiny muted">La ve ahora</span></button>
        <button role="tab" aria-selected={slot === "plan"} onClick={() => onSlot("plan")}>
          <span className="strong">Plan completo {c.planRoutine && <Icon name="check" size={13} stroke={3} />}</span><span className="tiny muted">Se activa el {fmt(t.end)}</span></button>
      </div>
      <RoutineEditor key={`${clientId}-${slot}`} clientId={clientId} slot={slot === "plan" ? "plan" : "current"} />
    </div>
  );
}
