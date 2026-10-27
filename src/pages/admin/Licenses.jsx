import { useEffect, useMemo, useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, Confirm, CopyButton, Empty, Field, Modal, Pill, toast } from "../../ui/kit";
import { useApp } from "../../context";
import {
  LICENSE_LABEL, LICENSE_TONE, deleteLicense, generateLicenses, licenseStatus, plansOf, renewLicense, restoreLicense, revokeLicense, useDB, userById,
} from "../../store/db";
import { addMonths, daysUntil, money, shortDate } from "../../lib/format";

const planLabel = (m) => (m ? `${m} ${m === 1 ? "mes" : "meses"}` : "Indefinida");
const unlimited = (l) => !!l.unlimited || (l.expiresAt || "").startsWith("9999");

const FILTERS = [
  ["all", "Todas"], ["unlimited", "Indefinidas"], ["active", "Activas"], ["expiring", "Por vencer"], ["expired", "Vencidas"], ["available", "Sin usar"], ["revoked", "Revocadas"],
];

export default function Licenses() {
  const db = useDB();
  const { params } = useApp();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [gen, setGen] = useState(!!params.generate);
  const [renew, setRenew] = useState(null);
  const [ask, setAsk] = useState(null);

  useEffect(() => { if (params.generate) setGen(true); }, [params]);

  const rows = useMemo(() => db.licenses.map((l) => ({ l, st: licenseStatus(l), coach: userById(db, l.coachId) })), [db]);
  const match = (r, k) => k === "all" || (k === "unlimited" ? unlimited(r.l) && r.st !== "revoked" : r.st === k);
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, rows.filter((r) => match(r, k)).length]));
  const shown = rows
    .filter((r) => match(r, filter))
    .filter((r) => !q || `${r.l.code} ${r.coach?.name || ""} ${r.l.note}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Licencias</h1>
          <p>Cada entrenador necesita una licencia vigente para usar la plataforma. Genera códigos, entrégalos y renuévalos antes de que venzan.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setGen(true)}><Icon name="plus" size={18} />Generar licencias</button>
      </div>

      <div className="row wrap" style={{ gap: 10 }}>
        <div className="search">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="lic-q">Buscar licencia</label>
          <input id="lic-q" className="input" placeholder="Buscar código o entrenador" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips" role="group" aria-label="Filtrar por estado">
          {FILTERS.map(([k, l]) => (
            <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}<span className="chip-n">{counts[k]}</span></button>
          ))}
        </div>
      </div>

      <section className="panel">
        {shown.length === 0 ? (
          <Empty icon="key" title="No hay licencias en este filtro" text="Cambia el filtro o genera códigos nuevos." />
        ) : (
          <div className="list">
            {shown.map(({ l, st, coach }) => {
              const d = l.expiresAt ? daysUntil(l.expiresAt) : null;
              const total = l.activatedAt ? (new Date(l.expiresAt) - new Date(l.activatedAt)) : 1;
              const used = l.activatedAt ? Math.min(1, Math.max(0, (Date.now() - new Date(l.activatedAt)) / total)) : 0;
              return (
                <div key={l.id} className="list-row m-stack" style={{ alignItems: "center" }}>
                  <div className="row grow" style={{ alignItems: "flex-start" }}>
                    {coach ? <Avatar name={coach.name} id={coach.id} /> : <span className="avatar" style={{ background: "var(--surface-3)", color: "var(--muted)" }}><Icon name="key" size={18} /></span>}
                    <div className="grow stack" style={{ gap: 4 }}>
                      <div className="row wrap gap-sm">
                        <span className="strong">{coach ? coach.name : "Sin asignar"}</span>
                        <Pill tone={LICENSE_TONE[st]}>{LICENSE_LABEL[st]}</Pill>
                        {unlimited(l) && <Pill tone="info">Sin vencimiento</Pill>}
                      </div>
                      <div className="row wrap gap-sm small">
                        <code className="num strong" style={{ letterSpacing: ".06em" }}>{l.code}</code>
                        <span className="muted">{planLabel(l.months)} · {money(l.charges.reduce((t, c) => t + c.amount, 0))}</span>
                      </div>
                      {l.activatedAt && unlimited(l) ? (
                        <div className="tiny muted">Activa desde el {shortDate(l.activatedAt)} · no vence</div>
                      ) : l.activatedAt ? (
                        <div className="row gap-sm" style={{ maxWidth: 420 }}>
                          <div className={`progress grow ${st === "active" ? "ok" : ""}`} aria-hidden="true"><i style={{ width: `${used * 100}%`, background: st === "expired" || st === "revoked" ? "var(--red)" : st === "expiring" ? "var(--yellow)" : undefined }} /></div>
                          <span className="tiny muted num" style={{ whiteSpace: "nowrap" }}>
                            {d >= 0 ? `${d} días restantes` : `vencida hace ${-d} días`} · {shortDate(l.expiresAt)}
                          </span>
                        </div>
                      ) : (
                        <div className="tiny muted">Creada {shortDate(l.createdAt)}{l.note ? ` · ${l.note}` : ""}</div>
                      )}
                    </div>
                  </div>
                  <div className="row gap-sm wrap">
                    {st === "available" && <CopyButton text={l.code} small label="Copiar código" />}
                    {coach && st !== "revoked" && !unlimited(l) && <button className="btn btn-quiet btn-sm" onClick={() => setRenew(l)}>Renovar</button>}
                    {st === "revoked" && <button className="btn btn-quiet btn-sm" onClick={async () => { const r = await restoreLicense(l.id); toast(r.error || "Licencia reactivada", r.error ? "alert" : "check"); }}>Reactivar</button>}
                    {st !== "revoked" && st !== "available" && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setAsk({ kind: "revoke", l, coach })}>Revocar</button>
                    )}
                    <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Eliminar ${l.code} para siempre`} title="Eliminar para siempre" onClick={() => setAsk({ kind: "delete", l, coach })}><Icon name="trash" size={17} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {gen && <GenerateModal onClose={() => setGen(false)} />}
      {renew && <RenewModal license={renew} coach={userById(db, renew.coachId)} onClose={() => setRenew(null)} />}
      {ask?.kind === "revoke" && (
        <Confirm title="Revocar licencia" confirmLabel="Revocar" onClose={() => setAsk(null)}
          onConfirm={async () => { const r = await revokeLicense(ask.l.id); toast(r.error || "Licencia revocada", r.error ? "alert" : "lock"); }}
          text={`${ask.coach?.name ?? "El entrenador"} perderá el acceso de inmediato. Sus clientes y datos se conservan, y podrá volver a entrar si reactivas la licencia o canjea un código nuevo.`} />
      )}
      {ask?.kind === "delete" && (
        <Confirm title="Eliminar licencia para siempre" confirmLabel="Eliminar para siempre" onClose={() => setAsk(null)}
          onConfirm={async () => { const r = await deleteLicense(ask.l.id); toast(r.error || "Licencia eliminada", r.error ? "alert" : "trash"); }}
          text={ask.coach
            ? `La licencia ${ask.l.code} se borra por completo, con su historial de cobros. ${ask.coach.name} pierde el tiempo de acceso que le daba (si no tiene otra licencia vigente, no podrá trabajar). Sus asesorados y datos se conservan. No se puede deshacer.`
            : `El código ${ask.l.code} se borra y deja de funcionar. No se puede deshacer.`} />
      )}
    </div>
  );
}

function GenerateModal({ onClose }) {
  const db = useDB();
  const PLANS = plansOf(db);
  const [busy, setBusy] = useState(false);
  const [months, setMonths] = useState(3);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(null);
  const price = PLANS.find((p) => p.months === months)?.price || 0;
  async function generate() {
    setBusy(true);
    const r = await generateLicenses(months, qty, note.trim());
    setBusy(false);
    if (r.error) return toast(r.error, "alert");
    setDone(r);
    toast(qty === 1 ? "Licencia generada" : "Licencias generadas", "key");
  }

  if (done) {
    return (
      <Modal title={done.length === 1 ? "Licencia generada" : `${done.length} licencias generadas`} onClose={onClose}
        footer={<button className="btn btn-primary" onClick={onClose}>Listo</button>}>
        <p className="ink2">Entrega el código al entrenador. Lo activa desde “Activa tu cuenta” en la pantalla de inicio de sesión y la licencia empieza a contar desde ese día.</p>
        <div className="panel list">
          {done.map((l) => (
            <div key={l.id} className="list-row">
              <code className="grow num strong" style={{ fontSize: 18, letterSpacing: ".08em" }}>{l.code}</code>
              <CopyButton text={l.code} small />
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Generar licencias" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={busy} onClick={generate}>
        Generar {qty > 1 ? `${qty} códigos` : "código"}
      </button>
    </>}>
      <div className="field">
        <span className="label">Duración</span>
        <div className="grid-2" style={{ gap: 8 }}>
          {PLANS.map((p) => (
            <button key={p.months} className="chip" style={{ justifyContent: "space-between", borderRadius: 12, padding: "11px 14px" }} aria-pressed={months === p.months} onClick={() => setMonths(p.months)}>
              <span>{p.label}</span><span className="chip-n num">{money(p.price)}</span>
            </button>
          ))}
          <button className="chip" style={{ justifyContent: "space-between", borderRadius: 12, padding: "11px 14px" }} aria-pressed={months === 0} onClick={() => setMonths(0)}>
            <span>Indefinida</span><span className="chip-n">no vence</span>
          </button>
        </div>
        {months === 0 && <p className="small muted" style={{ margin: "8px 0 0" }}>Sin vencimiento ni cobro registrado. Útil para socios, cortesías o tu propio gimnasio. Puedes revocarla cuando quieras.</p>}
      </div>
      <div className="form-grid">
        <Field label="Cantidad" id="gen-qty">
          <input id="gen-qty" className="input num" type="number" min="1" max="50" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(50, +e.target.value || 1)))} />
        </Field>
        <Field label="Total" id="gen-total"><div id="gen-total" className="input num strong" style={{ background: "var(--surface-2)" }}>{money(price * qty)}</div></Field>
        <div className="full">
          <Field label="Nota interna (opcional)" id="gen-note"><input id="gen-note" className="input" placeholder="Ej.: Gimnasio Músculo Norte" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

export function RenewModal({ license, coach, onClose }) {
  const db = useDB();
  const PLANS = plansOf(db);
  const [months, setMonths] = useState(license.months || 1);
  const base = license.expiresAt && new Date(license.expiresAt) > new Date() ? new Date(license.expiresAt) : new Date();
  const newEnd = addMonths(base, months);
  const isUnl = unlimited(license);
  return (
    <Modal title="Renovar licencia" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      {!isUnl && <button className="btn btn-primary" onClick={async () => { const r = await renewLicense(license.id, months); if (r.error) return toast(r.error, "alert"); toast(months ? `Licencia renovada hasta el ${shortDate(newEnd)}` : "La licencia ya no vence", "key"); onClose(); }}>
        {months ? `Renovar por ${money(PLANS.find((p) => p.months === months)?.price || 0)}` : "Dejar indefinida"}
      </button>}
    </>}>
      <div className="row">
        {coach && <Avatar name={coach.name} id={coach.id} />}
        <div className="grow"><div className="strong">{coach?.name}</div><div className="small muted num">{license.code}</div></div>
      </div>
      {isUnl ? <div className="note-box"><Icon name="key" size={18} /><span>Esta licencia es indefinida: no vence y no necesita renovarse.</span></div> : <>
        <div className="chips" role="group" aria-label="Meses a sumar">
          {PLANS.map((p) => <button key={p.months} className="chip" aria-pressed={months === p.months} onClick={() => setMonths(p.months)}>+{p.label}</button>)}
          <button className="chip" aria-pressed={months === 0} onClick={() => setMonths(0)}>Indefinida</button>
        </div>
        <div className="note-box"><Icon name="calendar" size={18} />
          {months ? <span>Nuevo vencimiento: <strong>{shortDate(newEnd)}</strong>{license.expiresAt && new Date(license.expiresAt) > new Date() ? " (se suma a los días que le quedan)" : " (desde hoy)"}</span>
            : <span>La licencia <strong>no vencerá nunca</strong>. Puedes revocarla cuando quieras.</span>}
        </div>
      </>}
    </Modal>
  );
}
