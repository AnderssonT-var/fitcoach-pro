/* Seguridad de la cuenta y privacidad de los datos (desde el perfil). */
import { useState } from "react";
import Icon from "../../ui/Icon";
import { Confirm, Field, Modal, toast } from "../../ui/kit";
import { useApp } from "../../context";
import { deleteMyAccount, exportMyData, logoutAll, setPhotoConsent, useDB, userById } from "../../store/db";
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
