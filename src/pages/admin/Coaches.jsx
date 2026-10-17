import { useEffect, useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, Confirm, CopyButton, Empty, Modal, Pill, toast } from "../../ui/kit";
import { useApp } from "../../context";
import {
  LICENSE_LABEL, LICENSE_TONE, adminResetPassword, coachLicense, licenseStatus, revokeLicense, useDB, userById, weekCount, workoutsForCoach,
} from "../../store/db";
import { RenewModal } from "./Licenses";
import { ago, daysUntil, money, shortDate } from "../../lib/format";

export default function Coaches() {
  const db = useDB();
  const { params } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(params.id || null);
  useEffect(() => { if (params.id) setOpen(params.id); }, [params]);

  const coaches = db.users.filter((u) => u.role === "coach").map((c) => {
    const l = coachLicense(db, c.id);
    const clients = db.clients.filter((x) => x.coachId === c.id);
    const last = workoutsForCoach(db, c.id)[0];
    const week = clients.reduce((t, x) => t + weekCount(db, x.userId), 0);
    return { c, l, st: l ? licenseStatus(l) : "expired", clients, last, week };
  }).filter((x) => !q || `${x.c.name} ${x.c.email} ${x.c.city}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Entrenadores</h1><p>Quién usa la plataforma, el estado de su licencia y la actividad de sus clientes.</p></div>
      </div>
      <div className="search">
        <Icon name="search" size={18} />
        <label className="sr-only" htmlFor="coach-q">Buscar entrenador</label>
        <input id="coach-q" className="input" placeholder="Buscar por nombre, correo o ciudad" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <section className="panel">
        {coaches.length === 0 ? <Empty icon="users" title="Sin resultados" text="Prueba con otro nombre." /> : (
          <div className="list">
            <div className="list-row m-hide tiny muted strong" style={{ paddingBlock: 10 }}>
              <span style={{ width: 40 }} /><span className="grow">Entrenador</span>
              <span style={{ width: 90 }}>Clientes</span><span style={{ width: 130 }}>Entrenos (semana)</span><span style={{ width: 150 }}>Licencia</span><span style={{ width: 18 }} />
            </div>
            {coaches.map(({ c, l, st, clients, last, week }) => (
              <button key={c.id} className="list-row" onClick={() => setOpen(c.id)}>
                <Avatar name={c.name} id={c.id} />
                <div className="grow">
                  <div className="strong ellipsis">{c.name}</div>
                  <div className="small muted ellipsis">{c.brand?.businessName ? `${c.brand.businessName} · ` : ""}{c.city || "Sin ciudad"} · {last ? `último registro de un cliente ${ago(last.finishedAt)}` : "sin entrenamientos"}</div>
                </div>
                <span className="num m-hide" style={{ width: 90 }}>{clients.length}</span>
                <span className="num m-hide" style={{ width: 130 }}>{week}</span>
                <span className="stack gap-xs coach-status">
                  <Pill tone={LICENSE_TONE[st]}>{LICENSE_LABEL[st]}</Pill>
                  {l?.expiresAt && <span className="tiny muted num">{shortDate(l.expiresAt)}</span>}
                </span>
                <Icon name="right" size={18} />
              </button>
            ))}
          </div>
        )}
      </section>

      {open && <CoachModal id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CoachModal({ id, onClose }) {
  const db = useDB();
  const c = userById(db, id);
  const [renew, setRenew] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const [askPw, setAskPw] = useState(false);
  const [temp, setTemp] = useState(null);
  if (!c) return null;
  const l = coachLicense(db, id);
  const st = l ? licenseStatus(l) : "expired";
  const history = db.licenses.filter((x) => x.coachId === id).sort((a, b) => new Date(b.activatedAt) - new Date(a.activatedAt));
  const clients = db.clients.filter((x) => x.coachId === id).map((x) => ({ ...x, user: userById(db, x.userId) }));
  const d = l?.expiresAt ? daysUntil(l.expiresAt) : null;

  return (
    <>
      <Modal title={c.name} onClose={onClose} wide footer={<>
        <button className="btn btn-quiet" onClick={() => setAskPw(true)}><Icon name="lock" size={17} />Contraseña temporal</button>
        {l && st !== "revoked" && <button className="btn btn-ghost" onClick={() => setRevoke(true)}>Revocar</button>}
        {l && <button className="btn btn-primary" onClick={() => setRenew(true)}>Renovar licencia</button>}
      </>}>
        <div className="row wrap">
          <Avatar name={c.name} id={c.id} size="lg" />
          <div className="grow">
            <div className="small muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div>
            <div className="small muted">{c.city || "—"} · en la plataforma desde {shortDate(c.createdAt)}</div>
          </div>
          <Pill tone={LICENSE_TONE[st]}>{LICENSE_LABEL[st]}</Pill>
        </div>

        {l && (
          <div className={st === "expired" || st === "revoked" ? "error-box" : st === "expiring" ? "warn-box" : "note-box"}>
            <Icon name="key" size={18} />
            <span>
              {st === "revoked" ? `La licencia ${l.code} está revocada. El entrenador no puede entrar.` :
                d >= 0 ? `Licencia ${l.code} vigente hasta el ${shortDate(l.expiresAt)} (${d} días).` : `La licencia ${l.code} venció el ${shortDate(l.expiresAt)}. No puede entrar hasta renovar.`}
            </span>
          </div>
        )}

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head"><h2 style={{ fontSize: 18 }}>Clientes ({clients.length})</h2></div>
            <div className="list">
              {clients.length === 0 && <div className="list-row muted small">Todavía no agrega clientes.</div>}
              {clients.map((x) => (
                <div key={x.userId} className="list-row">
                  <Avatar name={x.user.name} id={x.userId} size="sm" />
                  <span className="grow ellipsis">{x.user.name}</span>
                  <span className="small muted num">{weekCount(db, x.userId)} esta semana</span>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2 style={{ fontSize: 18 }}>Historial de licencias</h2></div>
            <div className="list">
              {history.map((h) => (
                <div key={h.id} className="list-row">
                  <div className="grow">
                    <div className="num strong small">{h.code}</div>
                    <div className="tiny muted">{h.charges.map((ch) => `${ch.kind} ${shortDate(ch.at)} · ${money(ch.amount)}`).join(" · ")}</div>
                  </div>
                  <Pill tone={LICENSE_TONE[licenseStatus(h)]}>{LICENSE_LABEL[licenseStatus(h)]}</Pill>
                </div>
              ))}
            </div>
          </section>
        </div>
      </Modal>
      {renew && <RenewModal license={l} coach={c} onClose={() => setRenew(false)} />}
      {revoke && <Confirm title="Revocar licencia" confirmLabel="Revocar" onClose={() => setRevoke(false)}
        onConfirm={async () => { const r = await revokeLicense(l.id); toast(r.error || "Licencia revocada", r.error ? "alert" : "lock"); }}
        text={`${c.name} perderá el acceso de inmediato. Sus clientes y datos se conservan.`} />}
      {askPw && <Confirm title="Generar contraseña temporal" tone="primary" confirmLabel="Generar" onClose={() => setAskPw(false)}
        onConfirm={async () => { const r = await adminResetPassword(c.id); if (r.error) toast(r.error, "alert"); else setTemp(r.password); }}
        text={`Se cerrarán las sesiones de ${c.name.split(" ")[0]} y deberá crear una contraseña nueva al entrar. Úsalo solo si te lo pidió.`} />}
      {temp && (
        <Modal title="Contraseña temporal" onClose={() => setTemp(null)} footer={<button className="btn btn-primary" onClick={() => setTemp(null)}>Listo</button>}>
          <p className="ink2">Entrégasela a {c.name.split(" ")[0]} por un medio privado. Solo se muestra esta vez.</p>
          <div className="row gap-sm"><code className="num strong grow" style={{ fontSize: 22, letterSpacing: ".06em" }}>{temp}</code><CopyButton text={temp} small /></div>
        </Modal>
      )}
    </>
  );
}
