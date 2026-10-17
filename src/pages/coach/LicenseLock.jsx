import Icon from "../../ui/Icon";
import { useApp } from "../../context";
import { coachLicense, licenseStatus, useDB } from "../../store/db";
import { shortDate } from "../../lib/format";
import { SubscriptionPanel } from "./Subscription";

/** Pantalla que ve un entrenador sin licencia vigente. */
export default function LicenseLock() {
  const db = useDB();
  const { me } = useApp();
  const l = coachLicense(db, me.id);
  const st = l ? licenseStatus(l) : null;
  const clients = db.clients.filter((c) => c.coachId === me.id).length;
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <section className="panel panel-pad stack" style={{ marginTop: 12 }}>
        <span className="avatar lg" style={{ background: "var(--red-soft)", color: "var(--red-ink)" }}><Icon name="lock" size={28} /></span>
        <h1 style={{ fontSize: 32 }}>{st === "revoked" ? "Tu licencia fue revocada" : l ? "Tu licencia venció" : "Activa tu licencia"}</h1>
        <p className="ink2">
          {l?.expiresAt && st !== "revoked" ? `Venció el ${shortDate(l.expiresAt)}. ` : ""}
          Tus {clients} {clients === 1 ? "asesorado" : "asesorados"}, sus rutinas y su historial siguen guardados. Mientras tanto ellos no pueden entrar.
          Elige un plan y envía tu comprobante, o canjea un código.
        </p>
      </section>
      <SubscriptionPanel />
    </div>
  );
}
