import { useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, Pill, Stat } from "../../ui/kit";
import { BarChart } from "../../ui/charts";
import { useApp } from "../../context";
import { LICENSE_LABEL, LICENSE_TONE, coachLicense, licenseStatus, useDB, userById } from "../../store/db";
import { ago, capitalize, daysUntil, money, shortDate } from "../../lib/format";
import { RenewModal } from "./Licenses";

export default function AdminHome() {
  const db = useDB();
  const { go } = useApp();
  const [renew, setRenew] = useState(null);

  const coaches = db.users.filter((u) => u.role === "coach");
  const withStatus = coaches.map((c) => { const l = coachLicense(db, c.id); return { c, l, st: l ? licenseStatus(l) : "expired" }; });
  const activeCoaches = withStatus.filter((x) => ["active", "expiring"].includes(x.st)).length;
  const attention = withStatus.filter((x) => ["expiring", "expired"].includes(x.st)).sort((a, b) => new Date(a.l?.expiresAt) - new Date(b.l?.expiresAt));
  const unused = db.licenses.filter((l) => licenseStatus(l) === "available");
  const activeClients = db.clients.filter((c) => c.active && withStatus.find((x) => x.c.id === c.coachId && ["active", "expiring"].includes(x.st))).length;

  // Ingresos por mes (ventas y renovaciones de licencias)
  const charges = db.licenses.flatMap((l) => l.charges);
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const value = charges.filter((c) => { const x = new Date(c.at); return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear(); })
      .reduce((t, c) => t + c.amount, 0);
    return { label: capitalize(d.toLocaleDateString("es-EC", { month: "short" }).replace(".", "")), value };
  });
  const yearTotal = charges.filter((c) => new Date(c.at).getFullYear() === now.getFullYear()).reduce((t, c) => t + c.amount, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Resumen</h1>
          <p>Estado de las licencias y de los entrenadores en la plataforma.</p>
        </div>
        <button className="btn btn-primary" onClick={() => go("licencias", { generate: true })}><Icon name="plus" size={18} />Generar licencias</button>
      </div>

      <div className="stats">
        <Stat label="Entrenadores activos" value={activeCoaches} sub={`de ${coaches.length} registrados`} icon="users" />
        <Stat label="Por vencer o vencidas" value={attention.length} tone={attention.length ? "warn" : ""} sub="necesitan renovación" icon="alert" />
        <Stat label="Códigos sin usar" value={unused.length} tone="info" sub="listos para entregar" icon="key" />
        <Stat label={`Ingresos ${now.getFullYear()}`} value={money(yearTotal)} sub={`${activeClients} clientes entrenando`} icon="dollar" />
      </div>

      <div className="split">
        <section className="panel">
          <div className="panel-head"><h2>Requieren atención</h2>{attention.length > 0 && <Pill tone="warn">{attention.length}</Pill>}</div>
          {attention.length === 0 ? (
            <div className="panel-body muted">Todas las licencias están al día.</div>
          ) : (
            <div className="list">
              {attention.map(({ c, l, st }) => {
                const d = daysUntil(l.expiresAt);
                return (
                  <div key={c.id} className="list-row m-stack">
                    <div className="row grow">
                      <Avatar name={c.name} id={c.id} />
                      <div className="grow">
                        <div className="strong">{c.name}</div>
                        <div className="small muted">{d >= 0 ? `Vence en ${d} ${d === 1 ? "día" : "días"} · ${shortDate(l.expiresAt)}` : `Venció hace ${-d} días · ${shortDate(l.expiresAt)}`}</div>
                      </div>
                      <Pill tone={LICENSE_TONE[st]}>{LICENSE_LABEL[st]}</Pill>
                    </div>
                    <button className="btn btn-quiet btn-sm" onClick={() => setRenew(l)}>Renovar</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Ingresos por licencias</h2></div>
          <div className="panel-body"><BarChart data={months} format={(v) => money(v)} label="Ingresos por licencias de los últimos 6 meses" /></div>
        </section>
      </div>

      <div className="split">
        <section className="panel">
          <div className="panel-head"><h2>Entrenadores</h2><button className="link-btn" onClick={() => go("entrenadores")}>Ver todos</button></div>
          <div className="list">
            {withStatus.map(({ c, l, st }) => (
              <button key={c.id} className="list-row" onClick={() => go("entrenadores", { id: c.id })}>
                <Avatar name={c.name} id={c.id} size="sm" />
                <span className="grow strong ellipsis">{c.name}</span>
                <span className="small muted m-hide num">{db.clients.filter((x) => x.coachId === c.id).length} clientes</span>
                <Pill tone={LICENSE_TONE[st]}>{LICENSE_LABEL[st]}</Pill>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Actividad reciente</h2></div>
          <div className="list">
            {db.activity.slice(0, 7).map((a) => (
              <div key={a.id} className="list-row" style={{ alignItems: "flex-start" }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, flexShrink: 0, background: { license: "var(--blue)", client: "var(--green)", coach: "var(--yellow)", expired: "var(--red)" }[a.kind] || "var(--muted)" }} />
                <div className="grow"><div className="small">{a.text}</div><div className="tiny muted">{ago(a.at)}</div></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {renew && <RenewModal license={renew} coach={userById(db, renew.coachId)} onClose={() => setRenew(null)} />}
    </div>
  );
}
