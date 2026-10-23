import { useState } from "react";
import Icon from "../../ui/Icon";
import { Empty } from "../../ui/kit";
import { useApp } from "../../context";
import { bestSet, clientById, exerciseById, exerciseImage, lastPerformance, nextDay, useDB, userById } from "../../store/db";
import { ExerciseDetail } from "../../ui/exercises";
import { clock, kg, parseRest } from "../../lib/format";
import { estimateMin } from "./ClientHome";
import { dropLabel, isDrop, setText } from "../../workout/dropset";
import { trialInfo } from "../../lib/trial";

export default function MyRoutine() {
  const db = useDB();
  const { me, openWorkout, go } = useApp();
  const c = clientById(db, me.id);
  const coach = userById(db, c.coachId);
  const [dayId, setDayId] = useState(() => nextDay(db, me.id)?.id);
  const active = db.active[me.id];
  const [view, setView] = useState(null);

  if (!c.routine) {
    return <div className="page"><section className="panel"><Empty icon="dumbbell" title="Aún no tienes rutina" text={`${coach.name.split(" ")[0]} la está preparando.`} /></section></div>;
  }
  const day = c.routine.days.find((d) => d.id === dayId) || c.routine.days[0];

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <div>
          <h1>{c.routine.name}</h1>
          {trialInfo(c)?.running && <span className="pill info" style={{ marginTop: 6 }}><Icon name="clock" size={12} />Rutina de prueba · quedan {trialInfo(c).daysLeft} días</span>}
          <p>{c.routine.goal} · {c.routine.frequency} entrenamientos por semana · preparada por {coach.name}</p>
        </div>
        <button className="btn btn-primary" onClick={() => openWorkout(active ? undefined : day.id)}><Icon name="play" size={18} />{active ? "Continuar entrenamiento" : `Empezar ${day.name}`}</button>
      </div>

      {c.routine.notes && <div className="note-box"><Icon name="note" size={18} /><span><strong>{coach.name.split(" ")[0]}:</strong> {c.routine.notes}</span></div>}

      <div className="tabs" role="tablist">
        {c.routine.days.map((d) => <button key={d.id} role="tab" className="tab" aria-selected={d.id === day.id} onClick={() => setDayId(d.id)}>{d.name}<span className="tiny muted num">{d.exercises.length}</span></button>)}
      </div>
      <p className="small muted">{day.exercises.length} ejercicios · unos {estimateMin(day)} minutos</p>

      <ol className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {day.exercises.map((e, i) => {
          const info = exerciseById(db, e.exId);
          const last = lastPerformance(db, me.id, e.exId);
          const best = bestSet(db, me.id, e.exId);
          return (
            <li key={e.uid} className="panel panel-pad stack" style={{ gap: 10 }}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                {exerciseImage(info) ? (
                  <button className="ex-thumb-btn" onClick={() => setView(info)} aria-label={`Ver técnica de ${info.name}`}>
                    <img className="ex-thumb" src={exerciseImage(info)} alt="" style={{ width: 84, height: 60 }} />
                  </button>
                ) : <span className="display num" style={{ fontSize: 30, width: 28, lineHeight: 1, color: "var(--muted)" }}>{i + 1}</span>}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="section-title" style={{ overflowWrap: "anywhere" }}>{info.name}</div>
                  <div className="small muted">{info.muscle} · {info.equipment}</div>
                  <div className="narrow-only small strong num" style={{ marginTop: 2 }}>{e.sets} × {e.reps} <span className="muted" style={{ fontWeight: 400 }}>· descanso {clock(parseRest(e.rest))}</span></div>
                  <button className="link-btn small" style={{ fontSize: 13 }} onClick={() => setView(info)}>Ver técnica</button>
                </div>
                <div className="wide-only" style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="display num" style={{ fontSize: 24, lineHeight: 1, whiteSpace: "nowrap" }}>{e.sets} × {e.reps}</div>
                  <div className="tiny muted num">descanso {clock(parseRest(e.rest))}</div>
                </div>
              </div>
              {isDrop(e) && <span className="drop-badge" style={{ alignSelf: "flex-start" }}><Icon name="trend" size={13} />{dropLabel(e.drops)}</span>}
              {info.cues && <p className="small ink2">{info.cues}</p>}
              {e.notes && <div className="note-box small"><Icon name="note" size={16} /><span><strong>{coach.name.split(" ")[0]}:</strong> {e.notes}</span></div>}
              {(last || best) && (
                <div className="row wrap small muted gap-sm">
                  {last && <span>Última vez: <span className="num ink2">{last.sets.map((s) => setText(s)).join(" · ")}</span></span>}
                  {best && best.weight > 0 && <span className="tag" style={{ background: "var(--yellow-soft)", color: "var(--yellow-ink)" }}><Icon name="trophy" size={13} />{kg(best.weight)} kg</span>}
                </div>
              )}
              <button className="link-btn small" style={{ alignSelf: "flex-start", fontSize: 13 }} onClick={() => go("mensajes", { exId: e.exId, tag: "comentario" })}>
                <Icon name="chat" size={14} /> Comentar a {coach.name.split(" ")[0]} sobre este ejercicio</button>
            </li>
          );
        })}
      </ol>
      {view && <ExerciseDetail ex={view} coachName={coach.name.split(" ")[0]} onClose={() => setView(null)} />}
    </div>
  );
}
