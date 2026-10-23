/* Estado del sistema: servidor, base de datos, notificaciones y errores recientes. */
import { useEffect, useState } from "react";
import Icon from "../../ui/Icon";
import { Empty, Pill, Stat, run, toast } from "../../ui/kit";
import { clearErrors, fetchSystem, runJobsNow } from "../../store/db";
import { NotificationsPanel } from "../shared/Account";
import { ago } from "../../lib/format";

const dur = (s) => (s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} d`);

export default function SystemPage() {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => fetchSystem().then((r) => (r.error ? toast(r.error, "alert") : setD(r)));
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Sistema</h1><p>Si algo falla en el servidor o en la app de alguien, aparece aquí y te llega una notificación.</p></div>
        <button className="btn btn-quiet" onClick={load}><Icon name="refresh" size={17} />Actualizar</button>
      </div>
      {!d ? <section className="panel panel-pad muted">Cargando…</section> : (
        <>
          <div className="stats">
            <Stat label="Servidor" value={d.db ? "En línea" : "Sin base"} tone={d.db ? "ok" : "bad"} sub={`activo hace ${dur(d.uptimeSec)} · Node ${d.node}`} icon="activity" />
            <Stat label="Errores (24 h)" value={d.errors24h} tone={d.errors24h ? "bad" : "ok"} sub={`${d.errors7d} en 7 días`} icon="alert" />
            <Stat label="Equipos con avisos" value={d.pushSubs} sub={d.fcm ? "web y Android (Firebase)" : "web · Android sin Firebase"} icon="bell" />
            <Stat label="Memoria" value={`${d.memoryMb} MB`} sub={`base ${d.dbClient === "mysql2" ? "MySQL" : "SQLite"}`} icon="gauge" />
          </div>
          {!d.cron && <div className="note-box small"><Icon name="clock" size={16} /><span>Las tareas programadas (recordatorios y avisos de pagos) corren cada 5 minutos mientras el servidor esté activo. Para asegurarlas aunque no haya visitas, define <code>CRON_KEY</code> y agrega un cron que llame a <code>/api/cron?key=…</code> (ver README).</span></div>}
          <section className="panel">
            <div className="panel-head"><h2>Errores recientes</h2>
              <div className="row gap-xs">
                <button className="btn btn-quiet btn-sm" onClick={() => run(runJobsNow(), "Tareas ejecutadas", "clock")}>Correr tareas</button>
                {d.groups.length > 0 && <button className="btn btn-ghost btn-sm" onClick={async () => { await clearErrors(); load(); }}>Limpiar</button>}
              </div>
            </div>
            {d.groups.length === 0 ? <Empty icon="check" title="Sin errores en los últimos 7 días" text="Todo funciona bien." /> : (
              <div className="list">
                {d.groups.map((g) => (
                  <div key={g.fingerprint} className="list-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                    <button className="row" onClick={() => setOpen(open === g.fingerprint ? null : g.fingerprint)} style={{ background: "none", border: 0, padding: 0, textAlign: "left", width: "100%" }}>
                      <Pill tone={g.source === "server" ? "bad" : "warn"}>{g.source === "server" ? "Servidor" : "App"}</Pill>
                      <span className="grow strong ellipsis">{g.message}</span>
                      <span className="small muted num" style={{ whiteSpace: "nowrap" }}>{g.count}× · {ago(g.last)}</span>
                    </button>
                    {open === g.fingerprint && (
                      <div className="small muted stack" style={{ gap: 4 }}>
                        {g.path && <span>Dónde: <code>{g.path}</code></span>}
                        {g.ua && <span className="ellipsis">Equipo: {g.ua}</span>}
                        {g.detail && <pre className="error-detail">{g.detail}</pre>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
          <NotificationsPanel />
        </>
      )}
    </div>
  );
}
