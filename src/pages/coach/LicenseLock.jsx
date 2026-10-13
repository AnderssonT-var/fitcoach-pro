import { useState } from "react";
import Icon from "../../ui/Icon";
import { Field, toast } from "../../ui/kit";
import { useApp } from "../../context";
import { LICENSE_LABEL, coachLicense, licenseStatus, normalizeCode, redeemCode, useDB } from "../../store/db";
import { shortDate } from "../../lib/format";

/** Pantalla que ve un entrenador sin licencia vigente. */
export default function LicenseLock() {
  const db = useDB();
  const { me } = useApp();
  const l = coachLicense(db, me.id);
  const st = l ? licenseStatus(l) : null;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const free = db.licenses.find((x) => !x.coachId && !x.revoked);
  const clients = db.clients.filter((c) => c.coachId === me.id).length;

  function submit(e) {
    e.preventDefault();
    const r = redeemCode(me.id, code);
    if (r.error) setError(r.error);
    else toast(`Licencia activada hasta el ${shortDate(r.license.expiresAt)}`, "key");
  }

  return (
    <div className="page" style={{ maxWidth: 620 }}>
      <section className="panel panel-pad stack-lg" style={{ marginTop: 24 }}>
        <span className="avatar lg" style={{ background: "var(--red-soft)", color: "var(--red-ink)" }}><Icon name="lock" size={28} /></span>
        <div className="stack gap-sm">
          <h1 style={{ fontSize: 36 }}>{st === "revoked" ? "Tu licencia fue revocada" : "Tu licencia venció"}</h1>
          <p className="ink2">
            {l ? `${LICENSE_LABEL[st]}: ${l.code}${l.expiresAt ? `, vigente hasta el ${shortDate(l.expiresAt)}` : ""}. ` : ""}
            Tus {clients} clientes, sus rutinas y su historial siguen guardados. Ingresa un código nuevo para volver a entrar.
          </p>
        </div>
        <form className="stack" onSubmit={submit} noValidate>
          <Field label="Código de licencia" id="lock-code" hint={free ? `Para probar el demo puedes usar ${free.code}` : "Pide un código al administrador."}>
            <input id="lock-code" className="input num" style={{ letterSpacing: ".08em", fontWeight: 600 }} placeholder="FIT-XXXX-XXXX"
              value={code} onChange={(e) => { setCode(normalizeCode(e.target.value)); setError(""); }} />
          </Field>
          {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={code.length < 13}>Activar licencia</button>
        </form>
      </section>
    </div>
  );
}
