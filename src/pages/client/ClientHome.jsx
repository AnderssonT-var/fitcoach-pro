import { useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, Empty, WeekStrip } from "../../ui/kit";
import { useApp } from "../../context";
import {
  clientById, doneSetCount, exerciseById, nextDay, sessionVolume, thread, useDB, userById, weekCount, weekStreak, workoutsOf,
} from "../../store/db";
import { ago, capitalize, clock, parseRest, sameDay, tons } from "../../lib/format";
import { trialInfo, trialName } from "../../lib/trial";

export function estimateMin(day) {
  const sec = day.exercises.reduce((t, e) => t + e.sets * (40 + parseRest(e.rest)), 0);
  return Math.round(sec / 60 / 5) * 5;
}

export default function ClientHome() {
  const db = useDB();
  const { me, go, openWorkout } = useApp();
  const c = clientById(db, me.id);
  const coach = userById(db, c.coachId);
  const active = db.active[me.id];
  const suggested = nextDay(db, me.id);
  const [dayId, setDayId] = useState(null);
  const day = c.routine?.days.find((d) => d.id === dayId) || suggested;
  const ws = workoutsOf(db, me.id);
  const goal = c.routine?.frequency || 0;
  const week = weekCount(db, me.id);
  const streak = weekStreak(db, me.id, goal);
  const trainedToday = ws.some((w) => sameDay(w.finishedAt, new Date()));
  const last = ws[0];
  const coachMsgs = thread(db, c.coachId, me.id).filter((m) => m.from === c.coachId);
  const lastCoach = coachMsgs.at(-1);
  const unread = coachMsgs.filter((m) => !m.read).length;
  const today = capitalize(new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" }));

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <div><h1>Hola, {me.name.split(" ")[0]}</h1><p>{today}</p></div>
      </div>

      {trialInfo(c)?.running && (() => { const t = trialInfo(c); return (
        <section className="panel panel-pad stack trial-client" style={{ gap: 10 }}>
          <div className="row spread wrap gap-sm">
            <span className="pill info"><Icon name="clock" size={12} />Plan de prueba</span>
            <span className="small strong num">{t.daysLeft <= 1 ? "Termina hoy" : `Te quedan ${t.daysLeft} días`}</span>
          </div>
          <div className="progress"><i style={{ width: `${t.pct}%` }} /></div>
          <div className="small ink2">Estás en tu {trialName(t.days).toLowerCase()} con {coach.name.split(" ")[0]}. Al terminar pasas a tu plan completo, armado para tus objetivos.</div>
        </section>); })()}
      {active && (
        <section className="panel panel-pad row wrap spread" style={{ borderColor: "var(--blue)", background: "var(--blue-soft)" }}>
          <div>
            <div className="section-title">Tienes un entrenamiento a medias</div>
            <div className="small ink2">{active.dayName} · {active.exercises.flatMap((e) => e.sets).filter((s) => s.done).length} de {active.exercises.flatMap((e) => e.sets).length} series · empezaste {ago(active.startedAt)}</div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => openWorkout()}><Icon name="play" size={18} />Continuar</button>
        </section>
      )}

      {!c.routine ? (
        <section className="panel">
          <Empty icon="dumbbell" title={`${coach.name.split(" ")[0]} está preparando tu rutina`} text="Te avisaremos aquí apenas esté lista. Mientras tanto puedes escribirle."
            action={<button className="btn btn-primary" onClick={() => go("mensajes")}>Escribir a mi entrenador</button>} />
        </section>
      ) : !active && (
        <section className="panel" style={{ overflow: "hidden" }}>
          <div className="panel-pad stack hero-card">
            <div className="row spread wrap gap-sm">
              <span className="small" style={{ opacity: .75 }}>{trainedToday ? "Ya entrenaste hoy. Si quieres, registra otra sesión" : dayId ? "Elegiste" : "Te toca hoy"}</span>
              <span className="small num" style={{ opacity: .75 }}>{day.exercises.length} ejercicios · ~{estimateMin(day)} min</span>
            </div>
            <h2 style={{ fontSize: 44, lineHeight: 1.05 }}>{day.name}</h2>
            <div className="small" style={{ opacity: .8 }}>{c.routine.name}</div>
          </div>
          <div className="list">
            {day.exercises.map((e) => (
              <div key={e.uid} className="list-row">
                <span className="grow strong ellipsis">{exerciseById(db, e.exId).name}</span>
                <span className="num small muted">{e.sets} × {e.reps} · {clock(parseRest(e.rest))}</span>
              </div>
            ))}
          </div>
          <div className="panel-pad stack" style={{ borderTop: "1px solid var(--line)" }}>
            {c.routine.days.length > 1 && (
              <div className="chips" role="group" aria-label="Elegir día">
                {c.routine.days.map((d) => <button key={d.id} className="chip" aria-pressed={d.id === day.id} onClick={() => setDayId(d.id)}>{d.name}{d.id === suggested.id && <span className="chip-n">sugerido</span>}</button>)}
              </div>
            )}
            <button className="btn btn-primary btn-lg btn-block" onClick={() => openWorkout(day.id)}><Icon name="play" size={18} />Empezar {day.name}</button>
          </div>
        </section>
      )}

      {c.routine && (
        <section className="panel panel-pad stack">
          <div className="row spread wrap gap-sm">
            <h2 className="section-title">Tu semana</h2>
            <span className="small strong" style={{ color: week >= goal ? "var(--green-ink)" : "var(--ink-2)" }}>{week} de {goal} entrenamientos</span>
          </div>
          <WeekStrip workouts={ws} />
          <div className="row small ink2"><Icon name="flame" size={18} />{streak > 0 ? `${streak} ${streak === 1 ? "semana" : "semanas"} seguidas cumpliendo tu meta` : "Cumple tu meta esta semana para empezar una racha"}</div>
        </section>
      )}

      <div className="grid-2">
        {lastCoach && (
          <button className="panel panel-pad stack" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go("mensajes")}>
            <div className="row">
              <Avatar name={coach.name} id={coach.id} size="sm" />
              <div className="grow"><div className="strong">{coach.name}</div><div className="tiny muted">{ago(lastCoach.at)}</div></div>
              {unread > 0 && <span className="nav-count">{unread}</span>}
            </div>
            <p className="ink2" style={{ overflowWrap: "anywhere" }}>{lastCoach.text}</p>
            <span className="link-btn">Responder</span>
          </button>
        )}
        {last && (
          <button className="panel panel-pad stack" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go("progreso")}>
            <div className="small muted">Última sesión · {ago(last.finishedAt)}</div>
            <div className="section-title">{last.dayName}</div>
            <div className="row wrap small ink2 num"><span>{clock(last.durationSec)}</span><span>·</span><span>{doneSetCount(last)} series</span><span>·</span><span>{tons(sessionVolume(last))}</span></div>
            {last.prs?.length > 0 && <div className="small strong" style={{ color: "var(--yellow-ink)" }}><Icon name="trophy" size={15} /> Récord en {exerciseById(db, last.prs[0].exId).name}</div>}
            <span className="link-btn">Ver mi progreso</span>
          </button>
        )}
      </div>
    </div>
  );
}
