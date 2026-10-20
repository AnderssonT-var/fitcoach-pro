/* Etiquetar un ejercicio en el chat: comentario, nota, técnica o molestia. */
import { useState } from "react";
import Icon from "../../ui/Icon";
import { Modal } from "../../ui/kit";
import { clientById, exerciseById, exerciseImage, useDB } from "../../store/db";

export const TAGS = [
  { v: "comentario", l: "Comentario", icon: "chat" },
  { v: "nota", l: "Nota", icon: "note" },
  { v: "tecnica", l: "Técnica", icon: "dumbbell" },
  { v: "molestia", l: "Molestia", icon: "alert" },
];
export const tagInfo = (v) => TAGS.find((t) => t.v === v) || TAGS[0];
const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tarjeta del ejercicio dentro de una burbuja o sobre el campo de texto. */
export function ExerciseChip({ exId, tag, onOpen, onRemove, mine }) {
  const db = useDB();
  const ex = exerciseById(db, exId);
  const img = exerciseImage(ex);
  const t = tagInfo(tag);
  const body = (
    <>
      {img ? <img src={img} alt="" className="ex-chip-img" /> : <span className="ex-chip-img ex-chip-icon"><Icon name="dumbbell" size={16} /></span>}
      <span className="grow" style={{ minWidth: 0 }}>
        <span className={`ex-chip-tag tag-${t.v}`}><Icon name={t.icon} size={11} />{t.l}</span>
        <span className="ex-chip-name ellipsis">{ex.name}</span>
      </span>
    </>
  );
  return (
    <div className={`ex-chip ${mine ? "mine" : ""}`}>
      {onOpen ? <button type="button" className="ex-chip-main" onClick={onOpen} aria-label={`Ver ${ex.name}`}>{body}</button> : <span className="ex-chip-main">{body}</span>}
      {onRemove && <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onRemove} aria-label="Quitar ejercicio etiquetado"><Icon name="x" size={16} /></button>}
    </div>
  );
}

/** Elegir ejercicio: primero los de la rutina del asesorado, luego toda la biblioteca. */
export function ExercisePicker({ coachId, clientId, initial, onPick, onClose }) {
  const db = useDB();
  const [tag, setTag] = useState(initial?.tag || "comentario");
  const [q, setQ] = useState("");
  const routine = clientById(db, clientId)?.routine;
  const inRoutine = [];
  for (const d of routine?.days || []) for (const e of d.exercises) if (!inRoutine.some((x) => x.exId === e.exId)) inRoutine.push({ exId: e.exId, day: d.name });
  const lib = db.exercises.filter((e) => e.coachId == null || e.coachId === coachId);
  const nq = norm(q.trim());
  const match = (ex) => !nq || norm(`${ex.name} ${ex.muscle} ${ex.equipment}`).includes(nq);
  const routineList = inRoutine.map((x) => ({ ...x, ex: exerciseById(db, x.exId) })).filter((x) => match(x.ex));
  const others = nq ? lib.filter((e) => match(e) && !inRoutine.some((x) => x.exId === e.id)).slice(0, 40) : [];
  const row = (ex, sub) => (
    <button key={ex.id} className="list-row" onClick={() => onPick({ exId: ex.id, tag })}>
      {exerciseImage(ex) ? <img className="ex-thumb" src={exerciseImage(ex)} alt="" style={{ width: 52, height: 38 }} /> : <span className="avatar sm"><Icon name="dumbbell" size={16} /></span>}
      <span className="grow" style={{ minWidth: 0, textAlign: "left" }}><span className="strong ellipsis" style={{ display: "block" }}>{ex.name}</span><span className="tiny muted">{sub}</span></span>
      <Icon name="right" size={16} />
    </button>
  );
  return (
    <Modal title="Etiquetar un ejercicio" onClose={onClose}>
      <div className="stack">
        <div className="field">
          <span className="label">Tipo de mensaje</span>
          <div className="row wrap gap-xs" role="radiogroup" aria-label="Tipo de mensaje">
            {TAGS.map((t) => (
              <button key={t.v} type="button" role="radio" aria-checked={tag === t.v} className={`chip ${tag === t.v ? "on" : ""}`} onClick={() => setTag(t.v)}>
                <Icon name={t.icon} size={14} />{t.l}</button>
            ))}
          </div>
        </div>
        <div className="search" style={{ maxWidth: "none" }}>
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="tag-q">Buscar ejercicio</label>
          <input id="tag-q" className="input" placeholder="Buscar en toda la biblioteca" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        {routineList.length > 0 && <div className="tiny muted strong">DE LA RUTINA</div>}
        <div className="list" style={{ margin: "0 -4px" }}>{routineList.map((x) => row(x.ex, `${x.day} · ${x.ex.muscle}`))}</div>
        {others.length > 0 && <div className="tiny muted strong">BIBLIOTECA</div>}
        <div className="list" style={{ margin: "0 -4px" }}>{others.map((e) => row(e, `${e.muscle} · ${e.equipment}`))}</div>
        {!routineList.length && !others.length && <p className="small muted">{nq ? "No hay ejercicios con ese nombre." : "Escribe para buscar un ejercicio."}</p>}
      </div>
    </Modal>
  );
}
