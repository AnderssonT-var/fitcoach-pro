import { useState } from "react";
import Icon from "../../ui/Icon";
import { Empty } from "../../ui/kit";
import { useApp } from "../../context";
import { bestSet, clientById, exerciseById, lastPerformance, nextDay, useDB, userById } from "../../store/db";
import { clock, kg, parseRest } from "../../lib/format";
import { estimateMin } from "./ClientHome";

export default function MyRoutine() {
  const db = useDB();
  const { me, openWorkout } = useApp();
  const c = clientById(db, me.id);
  const coach = userById(db, c.coachId);
  const [dayId, setDayId] = useState(() => nextDay(db, me.id)?.id);
  const active = db.active[me.id];

  if (!c.routine) {
    return <div className="page"><section className="panel"><Empty icon="dumbbell" title="Aún no tienes rutina" text={`${coach.name.split(" ")[0]} la está preparando.`} /></section></div>;
  }
  const day = c.routine.days.find((d) => d.id === dayId) || c.routine.days[0];

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <div>
          <h1>{c.routine.name}</h1>
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
                <span className="display num" style={{ fontSize: 30, width: 28, lineHeight: 1, color: "var(--muted)" }}>{i + 1}</span>
                <div className="grow">
                  <div className="section-title">{info.name}</div>
                  <div className="small muted">{info.muscle} · {info.equipment}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="display num" style={{ fontSize: 26, lineHeight: 1 }}>{e.sets} × {e.reps}</div>
                  <div className="tiny muted num">descanso {clock(parseRest(e.rest))}</div>
                </div>
              </div>
              {info.cues && <p className="small ink2">{info.cues}</p>}
              {e.notes && <div className="note-box small"><Icon name="note" size={16} /><span><strong>{coach.name.split(" ")[0]}:</strong> {e.notes}</span></div>}
              {(last || best) && (
                <div className="row wrap small muted gap-sm">
                  {last && <span>Última vez: <span className="num ink2">{last.sets.map((s) => `${kg(s.weight)}×${s.reps}`).join(" · ")}</span></span>}
                  {best && best.weight > 0 && <span className="tag" style={{ background: "var(--yellow-soft)", color: "var(--yellow-ink)" }}><Icon name="trophy" size={13} />{kg(best.weight)} kg</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
