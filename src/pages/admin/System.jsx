/* Monitor del sistema: todo lo que pasa en el servidor, la base de datos, las apps y los equipos.
   Se actualiza solo cada 10 segundos. Si algo se sale de lo normal aparece arriba como alerta
   (y te llega una notificación). */
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../ui/Icon";
import { Empty, Pill, Stat, run, toast } from "../../ui/kit";
import { clearErrors, fcmStatus, fetchSystem, removeFcmKey, runChecksNow, runJobsNow, saveFcmKey } from "../../store/db";
import { NotificationsPanel } from "../shared/Account";
import { ago } from "../../lib/format";

const dur = (s) => (s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} d`);
const ms = (v) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
const int = (v) => (v == null ? "—" : Math.round(v).toLocaleString("es-EC"));
const mb = (v) => (v == null ? "—" : v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${Math.round(v)} MB`);
const LEVEL = { critical: { tone: "bad", label: "Crítico", icon: "alert" }, warning: { tone: "warn", label: "Atención", icon: "alert" }, info: { tone: "info", label: "Aviso", icon: "bell" } };
const PLATFORM = { web: "Navegador", pwa: "App web instalada", "ios-pwa": "iPhone (app web)", android: "Android", apk: "Android", ios: "iPhone", "flutter-web": "Web (Flutter)" };
const fmtTime = (t, range) => new Date(t).toLocaleString("es-EC", range === "7d" ? { weekday: "short", hour: "2-digit" } : { hour: "2-digit", minute: "2-digit" });

/* ---------- gráfico de una serie con tooltip ---------- */
function Spark({ data, field, label, format = int, tone = "var(--blue)", range, height = 110, threshold }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const pts = data.filter((d) => d.has !== false);
  const W = 600, H = height, P = 4;
  const vals = data.map((d) => (d.has === false ? null : +d[field] || 0));
  const max = Math.max(1, threshold || 0, ...vals.filter((v) => v != null));
  const x = (i) => P + (i / Math.max(1, data.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - (v / max) * (H - 2 * P - 14);
  let path = "", area = "";
  vals.forEach((v, i) => {
    if (v == null) return;
    const cmd = i === 0 || vals[i - 1] == null ? "M" : "L";
    path += `${cmd}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
  });
  const runs = [];
  let curRun = [];
  vals.forEach((v, i) => { if (v == null) { if (curRun.length) runs.push(curRun); curRun = []; } else curRun.push(i); });
  if (curRun.length) runs.push(curRun);
  for (const r of runs) area += `M${x(r[0])},${H - P} ${r.map((i) => `L${x(i).toFixed(1)},${y(vals[i]).toFixed(1)}`).join(" ")} L${x(r.at(-1))},${H - P} Z `;
  const last = [...vals].reverse().find((v) => v != null);
  const peak = Math.max(0, ...vals.filter((v) => v != null));
  const move = (e) => {
    const r = ref.current.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  return (
    <div className="mon-chart">
      <div className="row" style={{ alignItems: "baseline" }}>
        <span className="small strong grow">{label}</span>
        <span className="tiny muted num">{hover != null && vals[hover] != null ? `${fmtTime(data[hover].t, range)} · ${format(vals[hover])}` : `ahora ${format(last ?? 0)} · máx ${format(peak)}`}</span>
      </div>
      {!pts.length ? <div className="tiny muted" style={{ height, display: "grid", placeItems: "center" }}>Aún sin datos para este periodo</div> : (
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block", touchAction: "none" }}
          onPointerMove={move} onPointerLeave={() => setHover(null)} role="img" aria-label={`${label}: máximo ${format(peak)}`}>
          <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {threshold && threshold < max * 1.01 && <line x1={P} x2={W - P} y1={y(threshold)} y2={y(threshold)} stroke="var(--yellow)" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          <path d={area} fill={tone} opacity=".12" />
          <path d={path} fill="none" stroke={tone} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {hover != null && vals[hover] != null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={P} y2={H - P} stroke="var(--ink-3, #999)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <circle cx={x(hover)} cy={y(vals[hover])} r="4" fill={tone} stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
      )}
      <div className="row tiny muted"><span className="grow">{data[0] ? fmtTime(data[0].t, range) : ""}</span><span>{data.at(-1) ? fmtTime(data.at(-1).t, range) : ""}</span></div>
    </div>
  );
}

function Section({ title, sub, right, children }) {
  return (
    <section className="panel">
      <div className="panel-head"><div><h2>{title}</h2>{sub && <p className="small muted" style={{ margin: "2px 0 0" }}>{sub}</p>}</div>{right}</div>
      <div className="panel-pad" style={{ paddingTop: 4 }}>{children}</div>
    </section>
  );
}
function KV({ rows }) {
  return (
    <div className="mon-kv">
      {rows.filter(Boolean).map(([k, v, tone]) => (
        <div key={k} className="row"><span className="grow muted small">{k}</span><span className={`small strong num ${tone ? `tone-${tone}` : ""}`}>{v}</span></div>
      ))}
    </div>
  );
}

export default function SystemPage() {
  const [d, setD] = useState(null);
  const [range, setRange] = useState("1h");
  const [open, setOpen] = useState(null);
  const [tab, setTab] = useState("resumen");
  const [failed, setFailed] = useState(false);
  const load = (r = range) => fetchSystem(r).then((x) => { if (x.error) { setFailed(true); if (!d) toast(x.error, "alert"); } else { setFailed(false); setD(x); } });
  useEffect(() => { load(range); const t = setInterval(() => { if (document.visibilityState === "visible") load(range); }, 10000); return () => clearInterval(t); }, [range]);

  const status = d?.status || "ok";
  const totals = useMemo(() => {
    if (!d?.people) return null;
    const a = d.people.active;
    const sum = (o) => Object.values(o || {}).reduce((x, y) => x + y, 0);
    return { now: sum(a.m5), hour: sum(a.h1), day: sum(a.d1), week: sum(a.d7) };
  }, [d]);

  const TABS = [["resumen", "Resumen"], ["rendimiento", "Rendimiento"], ["usuarios", "Usuarios y equipos"], ["datos", "Base de datos"], ["seguridad", "Seguridad"], ["errores", "Errores"], ["tareas", "Tareas y avisos"]];

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Sistema</h1><p>Monitoreo en vivo: servidor, base de datos, apps y equipos. Si algo se sale de lo normal aparece aquí y te llega una notificación.</p></div>
        <div className="row gap-xs">
          <button className="btn btn-quiet" onClick={() => load()}><Icon name="refresh" size={17} />Actualizar</button>
        </div>
      </div>
      {!d ? <section className="panel panel-pad muted">{failed ? "No pudimos conectar con el servidor." : "Cargando…"}</section> : (
        <>
          {/* ---------- Estado general y alertas ---------- */}
          <section className={`panel panel-pad mon-status ${status}`}>
            <div className="row gap-sm">
              <span className={`mon-dot ${status}`} aria-hidden />
              <div className="grow">
                <div className="strong">{status === "ok" ? "Todo funciona bien" : status === "warning" ? "Hay algo que revisar" : "Hay un problema importante"}</div>
                <div className="small muted">
                  {failed ? "Sin respuesta del servidor en la última actualización · " : ""}
                  Revisado {ago(d.now)} · {d.procs?.length || 1} {d.procs?.length === 1 ? "proceso" : "procesos"} · versión {d.process.version} · activo hace {dur(d.process.uptimeSec)}
                </div>
              </div>
              <button className="btn btn-quiet btn-sm" onClick={async () => { await runChecksNow(); load(); }}>Revisar ahora</button>
            </div>
            {d.alerts.length > 0 && (
              <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                {d.alerts.map((a) => (
                  <div key={a.key} className="mon-alert row gap-sm">
                    <Pill tone={LEVEL[a.level]?.tone}><Icon name={LEVEL[a.level]?.icon || "alert"} size={13} /> {LEVEL[a.level]?.label}</Pill>
                    <div className="grow" style={{ minWidth: 0 }}><div className="small strong">{a.title}</div><div className="tiny muted">{a.detail}</div></div>
                    <span className="tiny muted" style={{ whiteSpace: "nowrap" }}>desde {ago(a.since)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="stats">
            <Stat label="Conectados ahora" value={int(totals?.now)} sub={`${int(totals?.hour)} en 1 h · ${int(totals?.day)} hoy · ${int(totals?.week)} en 7 días`} icon="users" />
            <Stat label="Respuesta (95%)" value={ms(d.live.p95)} tone={d.live.p95 > 1500 ? "bad" : d.live.p95 > 600 ? "warn" : "ok"} sub={`mitad en ${ms(d.live.p50)} · ${int(d.live.rpm)} solicitudes/min`} icon="gauge" />
            <Stat label="Errores del servidor" value={`${d.live.errorRate}%`} tone={d.live.s5 ? "bad" : "ok"} sub={`${d.live.s5} en 5 min · ${d.errors24h} errores en 24 h`} icon="alert" />
            <Stat label="Base de datos" value={d.db ? ms(d.live.dbPing) : "Sin conexión"} tone={!d.db ? "bad" : d.live.dbPing > 300 ? "warn" : "ok"} sub={`${int(d.live.db.n / 5)} consultas/min · prom. ${ms(d.live.db.avg)}`} icon="activity" />
          </div>
          <div className="stats">
            <Stat label="CPU" value={`${d.process.cpu}%`} tone={d.process.cpu > 85 ? "bad" : d.process.cpu > 60 ? "warn" : "ok"} sub={`${d.process.cores} núcleos · carga ${d.process.load.join(" / ")}`} icon="gauge" />
            <Stat label="Memoria" value={mb(d.process.mem.rss)} tone={d.process.mem.rss > d.process.memLimitMb * 0.85 ? "bad" : "ok"} sub={`de ${mb(d.process.memLimitMb)} · heap ${mb(d.process.mem.heap)}`} icon="gauge" />
            <Stat label="Retraso de atención" value={ms(d.process.lagMs)} tone={d.process.lagMs > 500 ? "bad" : d.process.lagMs > 150 ? "warn" : "ok"} sub={`${d.process.inflight} solicitudes en curso`} icon="clock" />
            <Stat label="Carga" value={["Normal", "Ocupado", "Saturado"][d.live.load.level]} tone={["ok", "warn", "bad"][d.live.load.level]} sub={`las apps actualizan cada ${d.live.load.pollSec} s`} icon="activity" />
          </div>

          <div className="seg mon-tabs" role="tablist">
            {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
          </div>

          {(tab === "resumen" || tab === "rendimiento") && (
            <Section title="Historia" sub="Todos los procesos del servidor juntos"
              right={<div className="seg seg-sm">{[["1h", "1 hora"], ["24h", "24 horas"], ["7d", "7 días"]].map(([k, l]) => <button key={k} aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}</div>}>
              <div className="mon-grid">
                <Spark data={d.series} field="rpm" label="Solicitudes por minuto" range={range} />
                <Spark data={d.series} field="p95" label="Respuesta (el 95% tarda menos de)" format={ms} range={range} threshold={1500} tone="var(--purple, #AF52DE)" />
                <Spark data={d.series} field="users" label="Personas activas" range={range} tone="var(--green, #34C759)" />
                <Spark data={d.series} field="s5" label="Errores del servidor (5xx)" range={range} tone="var(--red)" />
                {tab === "rendimiento" && <>
                  <Spark data={d.series} field="cpu" label="CPU (%)" format={(v) => `${Math.round(v)}%`} range={range} threshold={85} tone="var(--orange, #FF9500)" />
                  <Spark data={d.series} field="rss" label="Memoria (MB)" format={mb} range={range} tone="var(--teal, #30B0C7)" />
                  <Spark data={d.series} field="lag" label="Retraso de atención" format={ms} range={range} threshold={500} tone="var(--indigo, #5856D6)" />
                  <Spark data={d.series} field="dbAvg" label="Tiempo promedio de consulta" format={ms} range={range} tone="var(--blue)" />
                  <Spark data={d.series} field="r503" label="Pedidos de esperar por carga" range={range} tone="var(--yellow)" />
                  <Spark data={d.series} field="slow" label="Consultas lentas (> 300 ms)" range={range} tone="var(--yellow)" />
                </>}
              </div>
            </Section>
          )}

          {tab === "rendimiento" && (
            <>
              <Section title="Rutas de la última hora" sub="Ordenadas por tiempo total de servidor">
                {d.routes.length === 0 ? <p className="muted small">Sin tráfico en la última hora.</p> : (
                  <div className="table-wrap"><table className="table mon-table">
                    <thead><tr><th>Ruta</th><th className="num">Veces</th><th className="num">Promedio</th><th className="num">Máximo</th><th className="num">Lentas</th><th className="num">Errores</th></tr></thead>
                    <tbody>{d.routes.slice(0, 25).map((r) => (
                      <tr key={r.route}><td><code className="tiny">{r.route}</code></td><td className="num">{int(r.n)}</td><td className={`num ${r.avg > 800 ? "tone-bad" : ""}`}>{ms(r.avg)}</td><td className="num">{ms(r.max)}</td><td className="num">{r.slow || ""}</td><td className={`num ${r.err ? "tone-bad" : ""}`}>{r.err || ""}</td></tr>
                    ))}</tbody>
                  </table></div>
                )}
              </Section>
              <div className="mon-two">
                <Section title="Estado de las apps (/api/state)" sub="Última hora">
                  <KV rows={[
                    ["Respondidas «sin cambios» (sin rearmar)", int(d.hour.state.notModified)],
                    ["Armadas completas", int(d.hour.state.full)],
                    ["Sin reenviar el historial", int(d.hour.state.keptHistory)],
                    ["Reutilizadas de memoria", int(d.hour.state.memo)],
                    ["Tiempo máx. para armar", ms(d.hour.state.maxBuildMs), d.hour.state.maxBuildMs > 2000 ? "bad" : null],
                    ["Pedidos de esperar por carga", int(d.hour.state.shed), d.hour.state.shed ? "warn" : null],
                    ["Datos enviados", mb(d.hour.state.bytes / 1048576)],
                    ["Fila para armar (ahora)", `${d.live.load.gate.active}/${d.live.load.gate.limit} · ${d.live.load.gate.waiting} esperando`],
                  ]} />
                </Section>
                <Section title="Procesos" sub="Cada proceso del servidor informa cada minuto">
                  <div className="list">
                    {(d.procs.length ? d.procs : [{ proc: d.process.proc, at: d.now, cpu: d.process.cpu, rss: d.process.mem.rss, lag: d.process.lagMs, req: 0 }]).map((p) => (
                      <div key={p.proc} className="list-row small">
                        <span className={`mon-dot ${Date.now() - Date.parse(p.at) > 150e3 ? "warning" : "ok"}`} />
                        <span className="grow ellipsis"><code className="tiny">{p.proc}</code>{p.proc === d.process.proc && <span className="muted tiny"> · este</span>}</span>
                        <span className="num muted tiny">CPU {p.cpu}% · {mb(p.rss)} · {ms(p.lag)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="tiny muted" style={{ marginTop: 10 }}>Contraseñas: {d.live.load.passwords.threads} hilos aparte, {d.live.load.passwords.queue} en espera · tiempo prom. {ms(d.live.pw.n ? d.live.pw.ms / d.live.pw.n : null)}</p>
                </Section>
              </div>
            </>
          )}

          {tab === "resumen" && (
            <div className="mon-two">
              <Section title="Sincronización sin conexión" sub="Cambios hechos sin señal que llegan después">
                <KV rows={[
                  ["Acciones recibidas (1 h)", int(d.hour.sync.ops)],
                  ["Reintentos sin duplicar (1 h)", int(d.hour.sync.replay)],
                  ["Rechazadas al sincronizar (24 h)", int(d.day.sync.failed), d.day.sync.failed ? "warn" : null],
                  ["Equipos con cambios por subir", int(d.people?.pendingDevices?.filter((x) => x.pending > 0).length), null],
                ]} />
              </Section>
              <Section title="Últimos reinicios y alertas">
                <div className="list">
                  {[...d.alertLog.slice(0, 6).map((a) => ({ at: a.at, k: `a${a.at}${a.key}`, el: <><Pill tone={a.state === "resolved" ? "ok" : LEVEL[a.level]?.tone}>{a.state === "resolved" ? "Normalizado" : LEVEL[a.level]?.label}</Pill><span className="grow ellipsis small">{a.title}</span></> })),
                    ...d.boots.slice(0, 4).map((b) => ({ at: b.at, k: `b${b.at}`, el: <><Pill tone="info">Arranque</Pill><span className="grow ellipsis small">Versión {b.version} · Node {b.node}</span></> }))]
                    .sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8)
                    .map((x) => <div key={x.k} className="list-row">{x.el}<span className="tiny muted" style={{ whiteSpace: "nowrap" }}>{ago(x.at)}</span></div>)}
                  {!d.alertLog.length && !d.boots.length && <p className="muted small">Sin eventos.</p>}
                </div>
              </Section>
            </div>
          )}

          {tab === "usuarios" && d.people && (
            <>
              <div className="mon-two">
                <Section title="Personas activas">
                  <div className="table-wrap"><table className="table mon-table">
                    <thead><tr><th /><th className="num">Ahora</th><th className="num">1 h</th><th className="num">Hoy</th><th className="num">7 días</th><th className="num">Total</th></tr></thead>
                    <tbody>{[["coach", "Entrenadores"], ["client", "Asesorados"], ["admin", "Administración"]].map(([r, l]) => (
                      <tr key={r}><td>{l}</td><td className="num">{int(d.people.active.m5[r] || 0)}</td><td className="num">{int(d.people.active.h1[r] || 0)}</td><td className="num">{int(d.people.active.d1[r] || 0)}</td><td className="num">{int(d.people.active.d7[r] || 0)}</td><td className="num">{int(d.people.totals[r] || 0)}</td></tr>
                    ))}</tbody>
                  </table></div>
                  <KV rows={[["Asesorados activos (no pausados)", int(d.people.activeClients)], ["Sesiones abiertas", int(d.people.sessions)]]} />
                </Section>
                <Section title="Apps y versiones" sub="Equipos usados en los últimos 7 días">
                  <div className="list">
                    {d.people.platforms.sort((a, b) => b.n - a.n).map((p) => (
                      <div key={`${p.platform}${p.version}`} className="list-row small"><span className="grow">{PLATFORM[p.platform] || p.platform}{p.version ? <span className="muted"> · v{p.version}</span> : ""}</span><span className="num strong">{int(p.n)}</span></div>
                    ))}
                    {!d.people.platforms.length && <p className="muted small">Aún sin datos.</p>}
                  </div>
                </Section>
              </div>
              <Section title="Equipos con cambios sin subir o con problemas" sub="Cambios hechos sin conexión que aún no llegan, o que el servidor rechazó">
                {!d.people.pendingDevices.length ? <Empty icon="check" title="Todo sincronizado" text="Ningún equipo tiene cambios pendientes." /> : (
                  <div className="table-wrap"><table className="table mon-table">
                    <thead><tr><th>Persona</th><th>Equipo</th><th className="num">Pendientes</th><th>Visto</th><th>Último problema</th></tr></thead>
                    <tbody>{d.people.pendingDevices.map((x, i) => (
                      <tr key={i}><td>{x.name}<div className="tiny muted">{x.role === "coach" ? "Entrenador" : x.role === "client" ? "Asesorado" : "Admin"}</div></td>
                        <td className="small">{PLATFORM[x.platform] || x.platform}{x.app_version ? ` v${x.app_version}` : ""}</td>
                        <td className={`num ${x.pending ? "tone-warn" : ""}`}>{x.pending}</td><td className="small">{ago(x.seen_at)}</td><td className="tiny muted">{x.last_error || "—"}</td></tr>
                    ))}</tbody>
                  </table></div>
                )}
              </Section>
            </>
          )}

          {tab === "datos" && (
            <>
              <div className="mon-two">
                <Section title="Base de datos">
                  <KV rows={[
                    ["Motor", d.dbClient === "mysql2" ? "MySQL / MariaDB" : "SQLite"],
                    ["Respuesta (ping)", ms(d.live.dbPing), d.live.dbPing > 300 ? "warn" : null],
                    ["Tamaño", mb(d.dbInfo?.sizeMb)],
                    ["Conexiones en uso", d.process.pool ? `${d.process.pool.used}/${d.process.pool.max} · ${d.process.pool.pending} esperando` : "—", d.process.pool?.pending > 3 ? "warn" : null],
                    ["Consultas (1 h)", int(d.hour.db.n)],
                    ["Lentas > 300 ms (1 h)", int(d.hour.db.slow), d.hour.db.slow ? "warn" : null],
                    ["Con error (1 h)", int(d.hour.db.err), d.hour.db.err ? "bad" : null],
                    ["La más lenta (1 h)", ms(d.hour.db.max)],
                  ]} />
                </Section>
                <Section title="Almacenamiento">
                  <KV rows={[
                    ["Archivos subidos", `${int(d.dbInfo?.uploadFiles)} · ${mb(d.dbInfo?.uploadsMb)}`],
                    ...(d.dbInfo?.files || []).map((f) => [`· ${f.kind === "photos" ? "Fotos de progreso" : f.kind === "receipts" ? "Comprobantes" : f.kind === "exercises" ? "Fotos de ejercicios" : f.kind}`, `${int(f.n)} · ${mb(f.mb)}`]),
                    ["Espacio libre en disco", d.dbInfo?.free ? `${mb(d.dbInfo.free.mb)} (${d.dbInfo.free.pct}%)` : "—", d.dbInfo?.free?.pct < 10 ? "bad" : null],
                  ]} />
                </Section>
              </div>
              <Section title="Registros por tabla">
                <div className="mon-tables">{Object.entries(d.dbInfo?.rows || {}).map(([t, n]) => <div key={t} className="small"><span className="muted">{t}</span> <strong className="num">{int(n)}</strong></div>)}</div>
              </Section>
              <Section title="Consultas lentas recientes" sub="De este proceso, sin datos personales">
                {!d.slowQueries.length ? <Empty icon="check" title="Sin consultas lentas" text="Todas responden en menos de 300 ms." /> : (
                  <div className="list">{d.slowQueries.slice(0, 20).map((q, i) => (
                    <div key={i} className="list-row" style={{ alignItems: "flex-start" }}><span className={`num small strong ${q.ms > 1000 ? "tone-bad" : "tone-warn"}`} style={{ minWidth: 64 }}>{ms(q.ms)}</span><code className="tiny grow" style={{ wordBreak: "break-all" }}>{q.sql}</code><span className="tiny muted">{ago(q.at)}</span></div>
                  ))}</div>
                )}
              </Section>
            </>
          )}

          {tab === "seguridad" && (
            <div className="mon-two">
              <Section title="Inicios de sesión" sub="Última hora · 24 horas">
                <KV rows={[
                  ["Correctos", `${int(d.hour.auth.ok)} · ${int(d.day.auth.ok)}`],
                  ["Fallidos", `${int(d.hour.auth.fail)} · ${int(d.day.auth.fail)}`, d.hour.auth.fail > 20 ? "warn" : null],
                  ["Intentos con cuenta bloqueada", `${int(d.hour.auth.locked)} · ${int(d.day.auth.locked)}`],
                  ["Cuentas bloqueadas ahora", int(d.people?.locked), d.people?.locked ? "warn" : null],
                  ["Renovaciones de sesión", `${int(d.hour.auth.refresh)} · ${int(d.day.auth.refresh)}`],
                  ["Renovaciones rechazadas", `${int(d.hour.auth.refreshFail)} · ${int(d.day.auth.refreshFail)}`],
                  ["Reuso de sesión (posible robo)", `${int(d.hour.auth.reuse)} · ${int(d.day.auth.reuse)}`, d.day.auth.reuse ? "bad" : null],
                  ["Inscripciones nuevas", `${int(d.hour.auth.signup)} · ${int(d.day.auth.signup)}`],
                ]} />
              </Section>
              <Section title="Límites de uso" sub="Protegen el servidor de abusos">
                <KV rows={[
                  ["Solicitudes limitadas (1 h)", int(d.hour.r429), d.hour.r429 > 100 ? "warn" : null],
                  ["Solicitudes limitadas (24 h)", int(d.day.r429)],
                  ["Errores 4xx (1 h)", int(d.hour.s4)],
                  ["Errores 5xx (24 h)", int(d.day.s5), d.day.s5 ? "bad" : null],
                ]} />
                <p className="tiny muted" style={{ marginTop: 10 }}>El límite es por persona (no por conexión): en un gimnasio todos pueden compartir el mismo wifi sin bloquearse.</p>
              </Section>
            </div>
          )}

          {tab === "tareas" && (
            <>
              <Section title="Tareas programadas" right={<button className="btn btn-quiet btn-sm" onClick={() => run(runJobsNow().then((r) => { load(); return r; }), "Tareas ejecutadas", "clock")}>Correr ahora</button>}>
                {!d.jobs.length ? <p className="muted small">Aún no corrió ninguna tarea.</p> : (
                  <div className="list">{d.jobs.map((j) => (
                    <div key={j.name} className="list-row">
                      <Pill tone={j.ok ? "ok" : "bad"}>{j.ok ? "Bien" : "Falló"}</Pill>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="small strong">{j.name === "avisos" ? "Recordatorios y avisos (cada 5 min)" : j.name === "limpieza" ? "Limpieza (cada 6 h)" : j.name}</div>
                        <div className="tiny muted">{j.error ? `Error: ${j.error}` : j.result && typeof j.result === "object" ? Object.entries(j.result).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k}: ${v}`).join(" · ") : ""} · tardó {ms(j.ms)} · {int(j.runs)} veces</div>
                      </div>
                      <span className="tiny muted">{ago(j.at)}</span>
                    </div>
                  ))}</div>
                )}
                {!d.cron && <div className="note-box small" style={{ marginTop: 10 }}><Icon name="clock" size={16} /><span>Las tareas corren cada 5 minutos mientras el servidor esté activo. Para asegurarlas aunque no haya visitas, define <code>CRON_KEY</code> y agrega un cron que llame a <code>/api/cron?key=…</code>.</span></div>}
              </Section>
              <Section title="Notificaciones" sub="Última hora · 24 horas">
                <KV rows={[
                  ["Equipos suscritos", int(d.pushSubs)],
                  ["Android (Firebase)", d.fcm ? "Configurado" : "Sin configurar", d.fcm ? null : "warn"],
                  ["Enviadas", `${int(d.hour.push.ok)} · ${int(d.day.push.ok)}`],
                  ["Fallidas", `${int(d.hour.push.fail)} · ${int(d.day.push.fail)}`, d.day.push.fail ? "warn" : null],
                  ["Equipos dados de baja", `${int(d.hour.push.gone)} · ${int(d.day.push.gone)}`],
                ]} />
              </Section>
              <FcmSetup onChange={load} />
              <NotificationsPanel />
            </>
          )}

          {(tab === "errores" || tab === "resumen") && (
            <section className="panel">
              <div className="panel-head"><h2>Errores recientes</h2>
                {d.groups.length > 0 && <button className="btn btn-ghost btn-sm" onClick={async () => { await clearErrors(); load(); }}>Limpiar todo</button>}
              </div>
              {d.groups.length === 0 ? <Empty icon="check" title="Sin errores en los últimos 7 días" text="Todo funciona bien." /> : (
                <div className="list">
                  {d.groups.slice(0, tab === "resumen" ? 5 : 60).map((g) => (
                    <div key={g.fingerprint} className="list-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                      <button className="row" onClick={() => setOpen(open === g.fingerprint ? null : g.fingerprint)} style={{ background: "none", border: 0, padding: 0, textAlign: "left", width: "100%", color: "inherit" }}>
                        <Pill tone={g.source === "server" ? "bad" : "warn"}>{g.source === "server" ? "Servidor" : "App"}</Pill>
                        <span className="grow strong ellipsis">{g.message}</span>
                        <span className="small muted num" style={{ whiteSpace: "nowrap" }}>{g.count}×{g.users ? ` · ${g.users} ${g.users === 1 ? "persona" : "personas"}` : ""} · {ago(g.last)}</span>
                      </button>
                      {open === g.fingerprint && (
                        <div className="small muted stack" style={{ gap: 4 }}>
                          <span>Primera vez {ago(g.first)} · última {ago(g.last)}</span>
                          {g.path && <span>Dónde: <code>{g.path}</code></span>}
                          {g.ua && <span className="ellipsis">Equipo: {g.ua}</span>}
                          {g.detail && <pre className="error-detail">{g.detail}</pre>}
                          <div><button className="btn btn-ghost btn-sm" onClick={async () => { await clearErrors(g.fingerprint); load(); }}>Marcar resuelto</button></div>
                        </div>
                      )}
                    </div>
                  ))}
                  {tab === "resumen" && d.groups.length > 5 && <button className="btn btn-quiet btn-sm" style={{ margin: 12 }} onClick={() => setTab("errores")}>Ver los {d.groups.length}</button>}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Notificaciones de la app Android: se sube el archivo de la cuenta de servicio de Firebase. */
function FcmSetup({ onChange }) {
  const [info, setInfo] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  useEffect(() => { fcmStatus().then((r) => setInfo(r.error ? null : r.fcm)); }, []);
  async function upload(file) {
    if (!file) return;
    if (file.size > 20000) return toast("Ese archivo es demasiado grande para ser la clave de Firebase", "alert");
    setBusy(true);
    const r = await saveFcmKey(await file.text());
    setBusy(false);
    if (r.error) return toast(r.error, "alert");
    setInfo(r.fcm); onChange?.();
    toast("¡Listo! Las notificaciones de Android quedaron conectadas", "bell");
  }
  async function remove() {
    if (!window.confirm("¿Quitar la clave de Firebase? La app Android dejará de recibir notificaciones.")) return;
    const r = await removeFcmKey();
    if (r.error) return toast(r.error, "alert");
    setInfo(r.fcm); onChange?.();
  }
  return (
    <section className="panel">
      <div className="panel-head"><h2>Notificaciones de la app Android</h2>{info && <Pill tone="ok">Conectado</Pill>}</div>
      <div className="panel-body stack">
        {info === undefined ? <p className="small muted">Revisando…</p> : info ? (
          <>
            <p className="small ink2">Proyecto de Firebase <b>{info.project}</b>. Los avisos (mensajes, pagos, reseñas…) llegan al celular aunque la app esté cerrada.</p>
            <p className="tiny muted">{info.email}{info.fromEnv ? " · definida en las variables del servidor" : ""}</p>
            {!info.fromEnv && <div className="row wrap gap-sm"><button className="btn btn-quiet btn-sm" onClick={() => input.current?.click()} disabled={busy}>Cambiar clave</button><button className="btn btn-ghost btn-sm" onClick={remove}>Quitar</button></div>}
          </>
        ) : (
          <>
            <p className="small ink2">Para que la app Android reciba notificaciones con la app cerrada, sube la <b>clave privada de la cuenta de servicio</b> de tu proyecto Firebase (un archivo .json).</p>
            <p className="tiny muted">Firebase → ⚙️ Configuración del proyecto → Cuentas de servicio → «Generar nueva clave privada».</p>
            <div><button className="btn btn-primary btn-sm" onClick={() => input.current?.click()} disabled={busy}><Icon name="upload" size={15} />{busy ? "Comprobando con Google…" : "Subir archivo .json"}</button></div>
          </>
        )}
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </section>
  );
}
