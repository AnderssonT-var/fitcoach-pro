import { useState } from "react";
import MuscleMap, { muscleName } from "../ui/MuscleMap";
import { Empty } from "../ui/kit";
import { useDB, userById } from "../store/db";
import {
  KEY_MUSCLES, SESSION_LEVELS, WEEK_LEVELS, fmtSets, muscleSets, orderedMuscles,
  routineMuscleSets, sessionLevel, sessionMuscleSets, toHeat, weekLevel,
} from "./muscleLoad";

function Scale({ levels, unit }) {
  return (
    <div className="mm-scale" aria-label={`Escala de ${unit}`}>
      <span>{unit}</span>
      {levels.map((l) => <span key={l.lv} className="row" style={{ gap: 4 }}><i style={{ background: `var(--mm-h${l.lv})` }} />{l.label}</span>)}
    </div>
  );
}

/** Mapa + barras: series por músculo (por semana). */
export function MuscleVolume({ body, sets, levelFn = weekLevel, levels = WEEK_LEVELS, unit = "Series por semana", zone = [10, 20], per = "/sem", mapHeight = 280, showMissing = true }) {
  const [focus, setFocus] = useState(null);
  const heat = toHeat(sets, levelFn);
  const list = orderedMuscles(sets);
  const max = Math.max(zone ? zone[1] + 4 : 0, ...list.map((m) => sets[m]));
  const missing = KEY_MUSCLES.filter((m) => !(sets[m] > 0));
  const describe = (m) => (sets[m] > 0 ? `${fmtSets(sets[m])}${per}` : "sin series");
  return (
    <div className="ml-layout">
      <div className="stack gap-sm" style={{ alignItems: "center" }}>
        <MuscleMap body={body} heat={heat} selected={focus} onSelect={(m) => setFocus(focus === m ? null : m)} describe={describe} height={mapHeight} bodyToggle hint="Toca un músculo para ver sus series" />
        <Scale levels={levels} unit={unit} />
      </div>
      <div className="stack">
        <div className="ml-bars" role="list">
          {list.map((m) => {
            const lv = levelFn(sets[m]);
            return (
              <button key={m} type="button" role="listitem" className="ml-bar" aria-pressed={focus === m} onClick={() => setFocus(focus === m ? null : m)}
                style={focus && focus !== m ? { opacity: 0.45 } : null}>
                <span className={focus === m ? "strong" : ""}>{muscleName(m)}</span>
                <span className="ml-track">
                  {zone && <span className="ml-zone" style={{ left: `${(zone[0] / max) * 100}%`, width: `${((zone[1] - zone[0]) / max) * 100}%` }} />}
                  <span style={{ width: `${Math.max(3, (sets[m] / max) * 100)}%`, background: `var(--mm-h${Math.max(1, lv)})` }} />
                </span>
                <span className="num small" style={{ textAlign: "right" }}>{String(Math.round(sets[m] * 2) / 2).replace(".", ",")}</span>
              </button>
            );
          })}
        </div>
        {zone && <p className="tiny muted">Las líneas punteadas marcan {zone[0]}–{zone[1]} series semanales, el rango que suele recomendarse para ganar músculo. Los ejercicios secundarios cuentan media serie.</p>}
        {showMissing && missing.length > 0 && (
          <div className="stack gap-xs">
            <span className="small strong">Sin trabajar</span>
            <div className="row wrap gap-xs">{missing.map((m) => <span key={m} className="tag">{muscleName(m)}</span>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Panel para el progreso del cliente (lo ven cliente y entrenador). */
export function MuscleLoadPanel({ clientId, title = "Músculos trabajados" }) {
  const db = useDB();
  const [days, setDays] = useState(7);
  const data = muscleSets(db, clientId, days);
  const has = Object.keys(data.perWeek).length > 0;
  return (
    <section className="panel">
      <div className="panel-head" style={{ flexWrap: "wrap" }}>
        <div>
          <h2>{title}</h2>
          <span className="small muted">{data.sessions} {data.sessions === 1 ? "entrenamiento" : "entrenamientos"} {days === 7 ? "en los últimos 7 días" : "en los últimos 30 días · promedio semanal"}</span>
        </div>
        <div className="seg" role="group" aria-label="Periodo">
          <button aria-pressed={days === 7} onClick={() => setDays(7)}>7 días</button>
          <button aria-pressed={days === 30} onClick={() => setDays(30)}>30 días</button>
        </div>
      </div>
      <div className="panel-body">
        {has ? <MuscleVolume body={userById(db, clientId)?.body} sets={data.perWeek} /> : <Empty icon="dumbbell" title="Sin entrenamientos en este periodo" text="El mapa se colorea con cada serie que se registra." />}
      </div>
    </section>
  );
}

/** Balance de la rutina que arma el entrenador. */
export function RoutineBalance({ routine, body }) {
  const db = useDB();
  const sets = routineMuscleSets(db, routine);
  const has = Object.keys(sets).length > 0;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Balance muscular</h2>
          <span className="small muted">Series semanales que plantea esta rutina con {routine.frequency || routine.days.length} {(routine.frequency || routine.days.length) === 1 ? "sesión" : "sesiones"} por semana</span>
        </div>
      </div>
      <div className="panel-body">
        {has ? <MuscleVolume body={body} sets={sets} mapHeight={270} /> : <Empty icon="dumbbell" title="Agrega ejercicios" text="Verás aquí qué músculos cubre la rutina y cuáles quedan sin trabajar." />}
      </div>
    </section>
  );
}

/** Resumen al terminar un entrenamiento. */
export function SessionMuscles({ session, body }) {
  const db = useDB();
  const sets = sessionMuscleSets(db, session);
  const list = orderedMuscles(sets);
  if (!list.length) return null;
  return (
    <section className="panel" style={{ width: "100%", textAlign: "left" }}>
      <div className="panel-head"><h2>Músculos de hoy</h2></div>
      <div className="panel-body stack" style={{ alignItems: "center" }}>
        <MuscleMap body={body} heat={toHeat(sets, sessionLevel)} describe={(m) => (sets[m] ? fmtSets(sets[m]) : "")} height={230} />
        <Scale levels={SESSION_LEVELS} unit="Series" />
        <div className="row wrap gap-xs" style={{ justifyContent: "center" }}>
          {list.map((m) => <span key={m} className="tag"><strong>{muscleName(m)}</strong>&nbsp;{fmtSets(sets[m])}</span>)}
        </div>
      </div>
    </section>
  );
}
