/* Cuenta del administrador: datos, contraseña y sesiones. */
import { Avatar } from "../../ui/kit";
import { useApp } from "../../context";
import { SecurityPanel } from "../shared/Account";
import { shortDate } from "../../lib/format";

export default function AdminAccount() {
  const { me } = useApp();
  return (
    <div className="page">
      <div className="page-head"><div><h1>Mi cuenta</h1><p>Tu acceso de administrador.</p></div></div>
      <section className="panel panel-pad">
        <div className="row gap-sm">
          <Avatar name={me.name} id={me.id} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong">{me.name}</div>
            <div className="small muted ellipsis">{me.email}</div>
            {me.createdAt && <div className="tiny muted">Administrador desde el {shortDate(me.createdAt)}</div>}
          </div>
        </div>
      </section>
      <SecurityPanel />
      <p className="small muted">Usa una contraseña larga que no uses en otro sitio. Al cambiarla se cierran tus sesiones en los demás equipos.</p>
    </div>
  );
}
