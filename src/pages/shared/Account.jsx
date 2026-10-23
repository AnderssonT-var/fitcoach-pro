/* Seguridad de la cuenta y privacidad de los datos (desde el perfil). */
import { useEffect, useState } from "react";
import Icon from "../../ui/Icon";
import { Confirm, Field, Modal, toast } from "../../ui/kit";
import { useApp } from "../../context";
import { deleteMyAccount, exportMyData, logoutAll, saveReminder, setPhotoConsent, useDB, userById } from "../../store/db";
import { disablePush, enablePush, pushStatus, scheduleLocalReminders, testPush } from "../../lib/notify";
import { ChangePasswordForm } from "../auth/Gates";
import { shortDate } from "../../lib/format";

export function SecurityPanel() {
  const [pw, setPw] = useState(false);
  const [all, setAll] = useState(false);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Seguridad</h2></div>
      <div className="list">
        <button className="list-row" onClick={() => setPw(true)}>
          <Icon name="lock" /><span className="grow"><span className="strong">Cambiar contraseña</span><br /><span className="small muted">Se cerrará tu sesión en los demás dispositivos.</span></span><Icon name="right" size={18} />
        </button>
        <button className="list-row" onClick={() => setAll(true)}>
          <Icon name="logout" /><span className="grow"><span className="strong">Cerrar sesión en todos los dispositivos</span><br /><span className="small muted">Útil si perdiste tu teléfono o entraste en otro equipo.</span></span><Icon name="right" size={18} />
        </button>
      </div>
      {pw && <Modal title="Cambiar contraseña" onClose={() => setPw(false)}><ChangePasswordForm onDone={() => setPw(false)} /></Modal>}
      {all && <Confirm title="Cerrar todas las sesiones" tone="primary" confirmLabel="Cerrar sesiones" onClose={() => setAll(false)}
        onConfirm={() => logoutAll()} text="Tendrás que volver a iniciar sesión en todos tus dispositivos, incluido este." />}
    </section>
  );
}

export function PrivacyPanel() {
  const db = useDB();
  const { me, openLegal } = useApp();
  const u = userById(db, me.id);
  const [askOff, setAskOff] = useState(false);
  const [del, setDel] = useState(false);
  async function toggle(v) {
    if (!v) return setAskOff(true);
    const r = await setPhotoConsent(true);
    toast(r.error || "Permiso de fotos activado", r.error ? "alert" : "camera");
  }
  return (
    <section className="panel">
      <div className="panel-head"><h2>Privacidad y datos</h2></div>
      <div className="panel-body stack">
        <label className="check-row">
          <input type="checkbox" checked={!!u.photoConsent} onChange={(e) => toggle(e.target.checked)} />
          <span><strong>Permitir fotos de mi cuerpo.</strong> Mi entrenador y yo podemos guardar fotos de progreso. Solo las vemos nosotros dos y nunca se publican.</span>
        </label>
        {u.consentAt && <p className="tiny muted">Aceptaste el aviso de privacidad el {shortDate(u.consentAt)}.</p>}
        <div className="row wrap gap-sm">
          <button className="btn btn-quiet btn-sm" onClick={() => openLegal("privacidad")}><Icon name="shield" size={16} />Política de privacidad</button>
          <button className="btn btn-quiet btn-sm" onClick={async () => { const r = await exportMyData(); if (r.error) toast(r.error, "alert"); }}><Icon name="download" size={16} />Descargar mis datos</button>
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--red-ink)" }} onClick={() => setDel(true)}><Icon name="trash" size={16} />Eliminar mi cuenta</button>
        </div>
      </div>
      {askOff && <Confirm title="Retirar permiso de fotos" tone="primary" confirmLabel="Retirar permiso" onClose={() => setAskOff(false)}
        onConfirm={async () => { const r = await setPhotoConsent(false); toast(r.error || "Permiso retirado. No se podrán subir fotos nuevas.", r.error ? "alert" : "lock"); }}
        text="Tu entrenador ya no podrá subir fotos nuevas. Las que ya existen se conservan hasta que las borres o le pidas que las borre." />}
      {del && <DeleteAccount onClose={() => setDel(false)} />}
    </section>
  );
}

function DeleteAccount({ onClose }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const r = await deleteMyAccount(pw);
    setBusy(false);
    if (r.error) return setError(r.error);
    toast("Tu cuenta y tus datos fueron eliminados", "trash");
  }
  return (
    <Modal title="Eliminar mi cuenta" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-danger" disabled={!pw || busy} onClick={submit}>Eliminar definitivamente</button>
    </>}>
      <p className="ink2">Se borrarán tu cuenta, tus entrenamientos, medidas, fotos, mensajes y pagos. <strong>No se puede deshacer.</strong> Si quieres conservar una copia, descarga tus datos antes.</p>
      <Field label="Escribe tu contraseña para confirmar" id="del-pw"><input id="del-pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }} /></Field>
      {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
    </Modal>
  );
}

/* ---------- Notificaciones ---------- */
const DAYS = [["L", 1], ["M", 2], ["X", 3], ["J", 4], ["V", 5], ["S", 6], ["D", 0]];
const TIMES = Array.from({ length: 31 }, (_, i) => { const m = 5 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`; });

export function NotificationsPanel() {
  const db = useDB();
  const { me } = useApp();
  const u = userById(db, me.id);
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const saved = u?.notif?.reminder || { on: false, days: [1, 3, 5], time: "18:00" };
  const [rem, setRem] = useState(saved);
  const dirty = JSON.stringify(rem) !== JSON.stringify(saved);
  useEffect(() => { pushStatus().then(setStatus); }, []);
  useEffect(() => { if (me.role === "client") scheduleLocalReminders(saved); }, [JSON.stringify(saved)]);

  async function enable() {
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    if (r?.error) return toast(r.error, "alert");
    setStatus(r);
    toast("Notificaciones activadas", "bell");
    testPush();
  }
  async function disable() { setBusy(true); setStatus(await disablePush()); setBusy(false); toast("Notificaciones desactivadas en este equipo", "bell"); }
  async function saveRem() {
    const r = await saveReminder(rem);
    if (r?.error) return toast(r.error, "alert");
    toast(rem.on ? "Recordatorio guardado" : "Recordatorio desactivado", "bell");
    scheduleLocalReminders(rem);
  }
  const what = me.role === "coach" ? "mensajes de tus asesorados, entrenamientos terminados, pagos vencidos y pruebas por terminar"
    : "mensajes de tu entrenador, cambios en tu rutina, pagos y el fin del descanso con la pantalla apagada";

  return (
    <section className="panel">
      <div className="panel-head"><h2>Notificaciones</h2>{status === "on" && <span className="pill ok"><Icon name="check" size={12} />Activas</span>}</div>
      <div className="panel-body stack">
        <p className="small muted" style={{ margin: 0 }}>Te avisamos de {what}.</p>
        {status === "loading" ? null : status === "on" ? (
          <div className="row wrap gap-sm">
            <button className="btn btn-quiet" onClick={() => testPush().then((r) => toast(r?.error || "Enviamos una notificación de prueba", r?.error ? "alert" : "bell"))}><Icon name="bell" size={17} />Enviar una de prueba</button>
            <button className="btn btn-ghost" onClick={disable} disabled={busy}>Desactivar en este equipo</button>
          </div>
        ) : status === "denied" ? (
          <div className="warn-box"><Icon name="alert" size={18} /><span>Las notificaciones están bloqueadas para VYTRAFIT. Actívalas en los ajustes del navegador o del teléfono y vuelve aquí.</span></div>
        ) : status === "ios-install" ? (
          <div className="note-box"><Icon name="bell" size={18} /><span>En iPhone, primero agrega VYTRAFIT a la pantalla de inicio (Compartir → <strong>Agregar a inicio</strong>) y ábrela desde ahí para activar las notificaciones.</span></div>
        ) : status === "unsupported" ? (
          <div className="note-box"><Icon name="bell" size={18} /><span>Este navegador no permite notificaciones. Prueba con Chrome o con la app de Android.</span></div>
        ) : (
          <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={enable} disabled={busy}><Icon name="bell" size={17} />{busy ? "Activando…" : "Activar notificaciones"}</button>
        )}

        {me.role === "client" && (
          <div className="reminder-box stack" style={{ gap: 10 }}>
            <label className="toggle"><input type="checkbox" checked={rem.on} onChange={(e) => setRem({ ...rem, on: e.target.checked })} />
              <span><strong>Recordarme entrenar</strong><br /><span className="small muted">Solo si ese día aún no registraste tu entrenamiento.</span></span></label>
            {rem.on && (
              <>
                <div className="chips" role="group" aria-label="Días del recordatorio">
                  {DAYS.map(([l, d]) => <button key={d} type="button" className="chip" aria-pressed={rem.days.includes(d)} style={{ minWidth: 40, justifyContent: "center" }}
                    onClick={() => setRem({ ...rem, days: rem.days.includes(d) ? rem.days.filter((x) => x !== d) : [...rem.days, d].sort() })}>{l}</button>)}
                </div>
                <label className="field" style={{ maxWidth: 160 }}><span className="label">Hora</span>
                  <select className="select num" value={rem.time} onChange={(e) => setRem({ ...rem, time: e.target.value })}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select></label>
              </>
            )}
            {dirty && <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} onClick={saveRem}>Guardar recordatorio</button>}
            {rem.on && status !== "on" && <span className="tiny muted">Activa las notificaciones de arriba para recibir el recordatorio.</span>}
          </div>
        )}
      </div>
    </section>
  );
}

/** Aviso en Inicio para activar las notificaciones (se puede cerrar). */
export function NotifyPrompt() {
  const [st, setSt] = useState(null);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("fcp.notifyPrompt") === "no"; } catch { return false; } });
  useEffect(() => { if (!hidden) pushStatus().then(setSt); }, [hidden]);
  if (hidden || st !== "off") return null;
  const close = () => { try { localStorage.setItem("fcp.notifyPrompt", "no"); } catch { /* nada */ } setHidden(true); };
  return (
    <div className="note-box notify-prompt">
      <Icon name="bell" size={18} />
      <span className="grow">Activa las notificaciones para enterarte de mensajes, pagos y entrenamientos al instante.</span>
      <button className="btn btn-primary btn-sm" onClick={async () => { const r = await enablePush(); if (r?.error) toast(r.error, "alert"); else { toast("Notificaciones activadas", "bell"); setSt(r); } }}>Activar</button>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={close} aria-label="Cerrar aviso"><Icon name="x" size={16} /></button>
    </div>
  );
}
