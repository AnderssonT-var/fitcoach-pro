import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { PlateLoader } from "../ui/charts";
import { Confirm, run, toast } from "../ui/kit";
import { DIFFICULTY } from "./SessionList";
import { ExerciseDetail } from "../ui/exercises";
import {
  bestSet, clientById, discardWorkout, exerciseById, exerciseImage, finishWorkout, updateWorkout, useDB, userById,
} from "../store/db";
import { SessionMuscles } from "./MuscleLoad";
import { clock, kg, parseRest, repsLow, tons } from "../lib/format";

/**
 * Entrenamiento en vivo: pantalla completa en móvil y PC.
 * Cada serie se registra con peso y repeticiones; al marcarla
 * arranca el descanso que definió el entrenador.
 */
export default function WorkoutSession({ clientId, onClose }) {
  const db = useDB();
  const live = db.active[clientId];
  const keep = useRef(live);
  if (live) keep.current = live;
  const s = live || keep.current;
  const client = clientById(db, clientId);
  const coach = userById(db, client.coachId);
  const coachFirst = coach.name.split(" ")[0];

  const [stage, setStage] = useState("train");
  const [now, setNow] = useState(Date.now());
  const [exit, setExit] = useState(false);
  const [flash, setFlash] = useState(false);
  const [difficulty, setDifficulty] = useState(3);
  const [comment, setComment] = useState("");
  const [share, setShare] = useState(true);
  const [result, setResult] = useState(null);
  const audio = useRef(null);
  const notified = useRef(null);
  const cards = useRef([]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  // Mantener la pantalla encendida
  useEffect(() => {
    let lock = null;
    const req = async () => { try { if (document.visibilityState === "visible") lock = await navigator.wakeLock?.request("screen"); } catch { /* no disponible */ } };
    req();
    const vis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); lock?.release?.().catch(() => {}); };
  }, []);

  // Fin del descanso
  useEffect(() => {
    if (!live?.restEndsAt || now < live.restEndsAt || notified.current === live.restEndsAt) return;
    notified.current = live.restEndsAt;
    try { navigator.vibrate?.([220, 120, 220]); } catch { /* nada */ }
    beep(audio.current);
    setFlash(true); setTimeout(() => setFlash(false), 2600);
    updateWorkout(clientId, (a) => { a.restEndsAt = null; });
  }, [now, live?.restEndsAt, clientId]);

  if (!s) return null;
  const all = s.exercises.flatMap((e) => e.sets);
  const done = all.filter((x) => x.done).length;
  const volume = s.exercises.reduce((t, e) => t + e.sets.filter((x) => x.done).reduce((a, x) => a + (+x.weight || 0) * (+x.reps || 0), 0), 0);
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const elapsed = (now - Date.parse(s.startedAt)) / 1000;
  const restLeft = live?.restEndsAt ? Math.ceil((live.restEndsAt - now) / 1000) : null;
  const current = s.exercises.findIndex((e) => e.sets.some((x) => !x.done));

  const upd = (fn) => updateWorkout(clientId, fn);
  function ensureAudio() {
    if (audio.current) { audio.current.resume?.(); return; }
    try { audio.current = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* sin audio */ }
  }
  function toggle(ei, si) {
    ensureAudio();
    let completedExercise = false;
    upd((a) => {
      const ex = a.exercises[ei], st = ex.sets[si];
      if (st.done) { st.done = false; return; }
      if (st.weight === "" && st.prevWeight != null) st.weight = String(st.prevWeight);
      if (st.reps === "") st.reps = String(st.prevReps ?? repsLow(ex.target.reps) ?? "");
      st.done = true;
      completedExercise = ex.sets.every((x) => x.done);
      const left = a.exercises.some((e) => e.sets.some((x) => !x.done));
      a.restTotal = parseRest(ex.target.rest);
      a.restEndsAt = left ? Date.now() + a.restTotal * 1000 : null;
    });
    try { navigator.vibrate?.(25); } catch { /* nada */ }
    if (completedExercise) setTimeout(() => cards.current[ei + 1]?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  }
  const edit = (ei, si, k, v) => upd((a) => { a.exercises[ei].sets[si][k] = v.replace(",", "."); });
  const addSet = (ei) => upd((a) => { const ss = a.exercises[ei].sets; const l = ss.at(-1); ss.push({ weight: l?.weight || "", reps: "", prevWeight: l?.prevWeight ?? null, prevReps: l?.prevReps ?? null, done: false }); });
  const removeSet = (ei) => upd((a) => { const ss = a.exercises[ei].sets; if (ss.length > 1 && !ss.at(-1).done) ss.pop(); });
  const adjust = (d) => upd((a) => { if (a.restEndsAt) { a.restEndsAt = Math.max(Date.now() + 1000, a.restEndsAt + d * 1000); a.restTotal = Math.max(1, a.restTotal + d); } });

  const [saving, setSaving] = useState(false);
  async function save() {
    if (saving) return;
    setSaving(true);
    const r = await finishWorkout(clientId, { difficulty, comment, share });
    setSaving(false);
    if (r?.error) return toast(`${r.error} Tus series no se perdieron: vuelve a tocar Guardar.`, "alert");
    setResult(r); setStage("done");
  }

  return (
    <div className="workout" role="dialog" aria-modal="true" aria-label={`Entrenamiento ${s.dayName}`}>
      <header className="workout-head">
        <div className="workout-inner row">
          {stage === "train" ? <button className="btn btn-quiet btn-icon" onClick={() => setExit(true)} aria-label="Salir del entrenamiento"><Icon name="x" /></button>
            : stage === "finish" ? <button className="btn btn-quiet btn-icon" onClick={() => setStage("train")} aria-label="Volver al entrenamiento"><Icon name="left" /></button>
            : <span style={{ width: 38 }} />}
          <div className="grow" style={{ textAlign: "center" }}>
            <div className="small muted ellipsis">{s.dayName} · {s.routineName}</div>
            <div className="display num" style={{ fontSize: 28, lineHeight: 1.05 }}>{clock(stage === "done" && result ? result.durationSec : elapsed)}</div>
          </div>
          {stage === "train" ? <button className="btn btn-primary" onClick={() => setStage("finish")}>Terminar</button> : <span style={{ width: 38 }} />}
        </div>
        <div className="workout-inner" style={{ padding: "10px 0 10px" }}>
          <div className={`progress ${pct === 100 ? "ok" : ""}`}><i style={{ width: `${pct}%` }} /></div>
          <div className="row spread tiny muted num" style={{ marginTop: 6 }}><span>{done} de {all.length} series</span><span>{tons(volume)} levantados</span></div>
        </div>
      </header>

      <div className="workout-body">
        <div className="workout-inner stack" style={{ padding: 16 }}>
          {stage === "train" && s.exercises.map((ex, ei) => (
            <ExerciseCard key={ei} refEl={(el) => (cards.current[ei] = el)} ex={ex} isCurrent={ei === current}
              info={exerciseById(db, ex.exId)} best={bestSet(db, clientId, ex.exId)} coachFirst={coachFirst}
              onToggle={(si) => toggle(ei, si)} onEdit={(si, k, v) => edit(ei, si, k, v)} onAdd={() => addSet(ei)} onRemove={() => removeSet(ei)} />
          ))}

          {stage === "finish" && (
            <div className="stack-lg">
              <h2 style={{ fontSize: 36 }}>Cierra tu sesión</h2>
              <div className="stats" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                <div className="stat"><span className="stat-label">Duración</span><span className="stat-value num" style={{ fontSize: 28 }}>{clock(elapsed)}</span></div>
                <div className="stat"><span className="stat-label">Series</span><span className="stat-value num" style={{ fontSize: 28 }}>{done}/{all.length}</span></div>
                <div className="stat"><span className="stat-label">Volumen</span><span className="stat-value num" style={{ fontSize: 28 }}>{tons(volume)}</span></div>
              </div>
              {all.length - done > 0 && (
                <div className="warn-box"><Icon name="alert" size={18} /><span className="grow">Te {all.length - done === 1 ? "falta 1 serie" : `faltan ${all.length - done} series`} sin marcar. Se guardan como no hechas.</span>
                  <button className="btn btn-quiet btn-sm" onClick={() => setStage("train")}>Volver</button></div>
              )}
              <div className="field">
                <span className="label">¿Qué tan duro fue?</span>
                <div className="diff-grid" role="radiogroup" aria-label="Dificultad">
                  {DIFFICULTY.map((d) => (
                    <button key={d.v} role="radio" aria-checked={difficulty === d.v} onClick={() => setDifficulty(d.v)}>
                      <span className="display num" style={{ fontSize: 24 }}>{d.v}</span>{d.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label htmlFor="wk-comment">Mensaje para {coachFirst} (opcional)</label>
                <textarea id="wk-comment" className="textarea" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ej.: me molestó un poco el hombro en el press" />
                <span className="hint">Le llega a sus mensajes.</span>
              </div>
              <label className="toggle"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /><span>Compartir el logro en la comunidad</span></label>
            </div>
          )}

          {stage === "done" && result && (
            <div className="stack-lg" style={{ alignItems: "center", textAlign: "center", paddingTop: 16 }}>
              <span className="avatar lg" style={{ width: 88, height: 88, background: "var(--green)", animation: "pop .4s ease-out" }}><Icon name="check" size={44} stroke={3} /></span>
              <div><h2 style={{ fontSize: 38 }}>Entrenamiento guardado</h2><p className="muted">{coach.name} ya puede ver tu sesión{result.comment ? " y tu mensaje" : ""}.</p></div>
              <div className="stats" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))", width: "100%" }}>
                <div className="stat"><span className="stat-label">Duración</span><span className="stat-value num" style={{ fontSize: 28 }}>{clock(result.durationSec)}</span></div>
                <div className="stat"><span className="stat-label">Series</span><span className="stat-value num" style={{ fontSize: 28 }}>{result.done}</span></div>
                <div className="stat"><span className="stat-label">Volumen</span><span className="stat-value num" style={{ fontSize: 28 }}>{tons(result.volume)}</span></div>
              </div>
              <SessionMuscles session={s} body={userById(db, clientId)?.body} />
              {result.prs.length > 0 && (
                <section className="panel" style={{ width: "100%", textAlign: "left", borderColor: "var(--yellow)" }}>
                  <div className="panel-head" style={{ background: "var(--yellow-soft)" }}><h2><Icon name="trophy" size={20} /> {result.prs.length === 1 ? "Nuevo récord" : "Nuevos récords"}</h2></div>
                  <div className="list">{result.prs.map((p) => (
                    <div key={p.exId} className="list-row"><span className="grow strong">{exerciseById(db, p.exId).name}</span><span className="num"><strong>{kg(p.weight)} kg</strong> <span className="muted">antes {kg(p.prev)}</span></span></div>
                  ))}</div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="workout-foot">
        <div className="workout-inner">
          {stage === "train" && restLeft > 0 && <RestPanel left={restLeft} total={live.restTotal} onAdjust={adjust} onSkip={() => upd((a) => { a.restEndsAt = null; })} />}
          {stage === "train" && !(restLeft > 0) && (flash
            ? <div className="display" style={{ textAlign: "center", fontSize: 24, color: "var(--blue-ink)", padding: "8px 0", animation: "pop .35s ease-out" }}>A por la siguiente serie</div>
            : <button className={`btn btn-lg btn-block ${pct === 100 ? "btn-success" : "btn-quiet"}`} onClick={() => setStage("finish")}>{pct === 100 ? "Terminar entrenamiento" : `Terminar entrenamiento · ${pct}%`}</button>)}
          {stage === "finish" && <button className="btn btn-primary btn-lg btn-block" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar entrenamiento"}</button>}
          {stage === "done" && <button className="btn btn-primary btn-lg btn-block" onClick={onClose}>Listo</button>}
        </div>
      </footer>

      {exit && (
        <ExitSheet onClose={() => setExit(false)} onLeave={onClose} onDiscard={() => { run(discardWorkout(clientId)); onClose(); }} />
      )}
    </div>
  );
}

function ExerciseCard({ ex, info, best, isCurrent, coachFirst, onToggle, onEdit, onAdd, onRemove, refEl }) {
  const complete = ex.sets.every((x) => x.done);
  const next = ex.sets.findIndex((x) => !x.done);
  const barbell = info.equipment === "Barra";
  const [how, setHow] = useState(false);
  const thumb = exerciseImage(info);
  const shownWeight = (() => { const st = ex.sets[next >= 0 ? next : ex.sets.length - 1]; return +(st.weight || st.prevWeight || 0); })();
  return (
    <section ref={refEl} className={`ex-card ${complete ? "complete" : ""}`} aria-label={info.name}>
      <div className="row" style={{ alignItems: "flex-start", marginBottom: 10 }}>
        {thumb ? (
          <button className="ex-thumb-btn" onClick={() => setHow(true)} aria-label={`Ver técnica de ${info.name}`} style={{ position: "relative" }}>
            <img className="ex-thumb" src={thumb} alt="" style={{ width: 64, height: 46 }} />
            {complete && <span className="avatar sm" style={{ position: "absolute", right: -6, bottom: -6, width: 22, height: 22, background: "var(--green)" }}><Icon name="check" size={13} stroke={3} /></span>}
          </button>
        ) : (
          <span className="avatar sm" style={{ background: complete ? "var(--green)" : "var(--surface-3)", color: complete ? "#fff" : "var(--ink-2)" }}>
            <Icon name={complete ? "check" : "dumbbell"} size={16} stroke={complete ? 3 : 2} />
          </span>
        )}
        <div className="grow">
          <div className="section-title" style={{ fontSize: 22 }}>{info.name}</div>
          <button className="link-btn" style={{ fontSize: 13 }} onClick={() => setHow(true)}>Ver técnica</button>
          <div className="small muted">Objetivo {ex.target.sets} × {ex.target.reps} · descanso {clock(parseRest(ex.target.rest))}</div>
        </div>
        {best && best.weight > 0 && <div style={{ textAlign: "right" }}><div className="tiny muted">Récord</div><div className="display num" style={{ fontSize: 20, color: "var(--yellow-ink)" }}>{kg(best.weight)} kg</div></div>}
      </div>
      {ex.notes && <div className="note-box small" style={{ marginBottom: 10 }}><Icon name="note" size={16} /><span><strong>{coachFirst}:</strong> {ex.notes}</span></div>}
      {how && <ExerciseDetail ex={info} coachName={coachFirst} onClose={() => setHow(false)} />}
      {barbell && shownWeight > 20 && !complete && <div style={{ marginBottom: 8 }}><PlateLoader weight={shownWeight} /></div>}

      <div className="set-grid tiny muted strong" style={{ padding: "0 4px 6px" }}>
        <span style={{ textAlign: "center" }}>Serie</span><span>Anterior</span><span style={{ textAlign: "center" }}>Kg</span><span style={{ textAlign: "center" }}>Reps</span><span />
      </div>
      {ex.sets.map((st, si) => {
        const isNext = isCurrent && si === next;
        return (
          <div key={si} className={`set-grid set-row ${st.done ? "done" : isNext ? "next" : ""}`}>
            <span className="display num" style={{ textAlign: "center", fontSize: 19 }}>{si + 1}</span>
            <span className="small muted ellipsis num">{st.prevWeight != null ? `${kg(st.prevWeight)} × ${st.prevReps}` : "—"}</span>
            <input className="set-input" inputMode="decimal" aria-label={`Peso serie ${si + 1}`} value={st.weight}
              placeholder={st.prevWeight != null ? String(st.prevWeight) : "kg"} onFocus={(e) => e.target.select()}
              onChange={(e) => /^\d{0,4}([.,]\d{0,2})?$/.test(e.target.value) && onEdit(si, "weight", e.target.value)} />
            <input className="set-input" inputMode="numeric" aria-label={`Repeticiones serie ${si + 1}`} value={st.reps}
              placeholder={String(st.prevReps ?? repsLow(ex.target.reps) ?? "")} onFocus={(e) => e.target.select()}
              onChange={(e) => /^\d{0,3}$/.test(e.target.value) && onEdit(si, "reps", e.target.value)} />
            <button className={`set-check ${st.done ? "on" : isNext ? "next" : ""}`} onClick={() => onToggle(si)} aria-pressed={st.done}
              aria-label={st.done ? `Desmarcar serie ${si + 1}` : `Completar serie ${si + 1}`}><Icon name="check" size={20} stroke={3} /></button>
          </div>
        );
      })}
      <div className="row gap-sm" style={{ marginTop: 8 }}>
        <button className="btn btn-ghost btn-sm grow" style={{ border: "1px dashed var(--line-strong)" }} onClick={onAdd}><Icon name="plus" size={15} />Serie</button>
        {ex.sets.length > 1 && !ex.sets.at(-1).done && <button className="btn btn-ghost btn-sm" onClick={onRemove}>Quitar última</button>}
      </div>
    </section>
  );
}

function RestPanel({ left, total, onAdjust, onSkip }) {
  const frac = total ? Math.min(1, left / total) : 0;
  const R = 24, Cc = 2 * Math.PI * R;
  return (
    <div className="row" style={{ animation: "rise .2s ease-out" }}>
      <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true">
        <circle cx="29" cy="29" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
        <circle cx="29" cy="29" r={R} fill="none" stroke="var(--blue)" strokeWidth="6" strokeLinecap="round" strokeDasharray={Cc} strokeDashoffset={Cc * (1 - frac)} transform="rotate(-90 29 29)" style={{ transition: "stroke-dashoffset .25s linear" }} />
      </svg>
      <div className="grow">
        <div className="tiny muted strong">Descanso</div>
        <div className="display num" role="timer" style={{ fontSize: 36, lineHeight: 1 }}>{clock(left)}</div>
      </div>
      <button className="btn btn-quiet" onClick={() => onAdjust(-15)} aria-label="Quitar 15 segundos">−15</button>
      <button className="btn btn-quiet" onClick={() => onAdjust(15)} aria-label="Sumar 15 segundos">+15</button>
      <button className="btn btn-primary" onClick={onSkip}>Saltar</button>
    </div>
  );
}

function ExitSheet({ onClose, onLeave, onDiscard }) {
  const [ask, setAsk] = useState(false);
  if (ask) return <Confirm title="Descartar entrenamiento" confirmLabel="Descartar" onClose={() => setAsk(false)} onConfirm={onDiscard} text="Se borran las series que registraste en esta sesión." />;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Salir del entrenamiento">
        <div className="modal-head"><h2>¿Salir del entrenamiento?</h2></div>
        <div className="modal-body">
          <p className="ink2">Tu progreso queda guardado. Puedes continuar desde Inicio cuando quieras.</p>
          <button className="btn btn-primary btn-lg btn-block" onClick={onClose}>Seguir entrenando</button>
          <button className="btn btn-quiet btn-block" onClick={onLeave}>Salir y continuar después</button>
          <button className="btn btn-danger btn-block" onClick={() => setAsk(true)}>Descartar entrenamiento</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function beep(ctx) {
  if (!ctx) return;
  try {
    [0, 0.22].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.18);
    });
  } catch { /* nada */ }
}
