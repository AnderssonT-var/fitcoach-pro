import { BarChart, LineChart } from "../ui/charts";
import Icon from "../ui/Icon";
import { bestSet, clientById, exerciseById, sessionVolume, useDB, weekCount, workoutsOf } from "../store/db";
import { addDays, kg, shortDate, tons, weekStart } from "../lib/format";

export function weeklySeries(db, clientId, n = 8) {
  const mon = weekStart(new Date());
  return Array.from({ length: n }, (_, i) => {
    const from = addDays(mon, -7 * (n - 1 - i));
    const to = addDays(from, 7);
    const ws = workoutsOf(db, clientId).filter((w) => new Date(w.finishedAt) >= from && new Date(w.finishedAt) < to);
    return {
      label: i === n - 1 ? "Esta" : `${from.getDate()}/${from.getMonth() + 1}`,
      count: ws.length,
      volume: ws.reduce((t, w) => t + sessionVolume(w), 0),
    };
  });
}

export function AdherenceChart({ clientId }) {
  const db = useDB();
  const data = weeklySeries(db, clientId).map((w) => ({ label: w.label, value: w.count }));
  const goal = clientById(db, clientId)?.routine?.frequency;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Entrenamientos por semana</h2>{goal && <span className="small muted">meta: {goal} por semana</span>}</div>
      <div className="panel-body"><BarChart data={data} label="Entrenamientos por semana, últimas 8 semanas" /></div>
    </section>
  );
}

export function VolumeChart({ clientId }) {
  const db = useDB();
  const data = weeklySeries(db, clientId).map((w) => ({ label: w.label, value: w.volume }));
  return (
    <section className="panel">
      <div className="panel-head"><h2>Volumen por semana</h2><span className="small muted">kg levantados</span></div>
      <div className="panel-body"><BarChart data={data} format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}t` : kg(v))} label="Volumen semanal en kilogramos" /></div>
    </section>
  );
}

export function WeightChart({ clientId, action }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const pts = (c?.weights || []).slice(-10).map((w) => ({ label: shortDate(w.date), value: w.kg }));
  const delta = pts.length > 1 ? pts.at(-1).value - pts[0].value : 0;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Peso corporal</h2>
        {pts.length > 1 && <span className={`small strong ${delta <= 0 ? "" : ""}`} style={{ color: "var(--ink-2)" }}>{delta > 0 ? "+" : ""}{kg(delta)} kg</span>}
        {action}
      </div>
      <div className="panel-body">
        {pts.length > 1 ? <LineChart points={pts} format={(v) => `${kg(Math.round(v * 10) / 10)}`} label="Evolución del peso corporal" />
          : <p className="muted small">{pts.length ? `Último registro: ${kg(pts[0].value)} kg. Se dibuja la curva con dos registros o más.` : "Sin registros de peso todavía."}</p>}
      </div>
    </section>
  );
}

export function Records({ clientId }) {
  const db = useDB();
  const ws = workoutsOf(db, clientId);
  const ids = [...new Set(ws.flatMap((w) => w.exercises.map((e) => e.exId)))];
  const rows = ids.map((id) => {
    const chrono = [...ws].reverse();
    const first = chrono.find((w) => w.exercises.some((e) => e.exId === id));
    const firstTop = Math.max(0, ...first.exercises.find((e) => e.exId === id).sets.filter((x) => x.done).map((x) => +x.weight));
    const best = bestSet(db, clientId, id);
    return { id, best, gain: best ? best.weight - firstTop : 0 };
  }).filter((r) => r.best && r.best.weight > 0).sort((a, b) => b.best.weight - a.best.weight);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Récords personales</h2><Icon name="trophy" size={20} /></div>
      {rows.length === 0 ? <div className="panel-body muted small">Aparecerán cuando registre entrenamientos con peso.</div> : (
        <div className="list">
          {rows.map((r) => (
            <div key={r.id} className="list-row">
              <div className="grow"><div className="strong ellipsis">{exerciseById(db, r.id).name}</div><div className="tiny muted">{shortDate(r.best.at)}</div></div>
              <div style={{ textAlign: "right" }}>
                <div className="display num" style={{ fontSize: 22 }}>{kg(r.best.weight)} kg <span className="muted" style={{ fontSize: 16 }}>× {r.best.reps}</span></div>
                {r.gain > 0 && <div className="tiny strong" style={{ color: "var(--green-ink)" }}>+{kg(r.gain)} kg desde el inicio</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function quickStats(db, clientId) {
  const ws = workoutsOf(db, clientId);
  const c = clientById(db, clientId);
  const month = ws.filter((w) => { const d = new Date(w.finishedAt), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); });
  return {
    total: ws.length,
    week: weekCount(db, clientId),
    goal: c?.routine?.frequency || 0,
    month: month.length,
    monthVolume: month.reduce((t, w) => t + sessionVolume(w), 0),
    avgMin: ws.length ? Math.round(ws.reduce((t, w) => t + w.durationSec, 0) / ws.length / 60) : 0,
    tonsLabel: tons(month.reduce((t, w) => t + sessionVolume(w), 0)),
  };
}
