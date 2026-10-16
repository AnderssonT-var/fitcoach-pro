import { useMemo, useState } from "react";
import Icon from "../../ui/Icon";
import { Confirm, Empty, Field, Modal, toast } from "../../ui/kit";
import { useApp } from "../../context";
import { exerciseById, exerciseImage, newUid, saveRoutine, saveTemplate, useDB, userById } from "../../store/db";
import { ExerciseDetail, ExerciseFilters, ExerciseTile, useExerciseFilters } from "../../ui/exercises";
import { clock } from "../../lib/format";
import { GOALS } from "./Clients";

const RESTS = [30, 45, 60, 75, 90, 120, 150, 180, 240];
const blank = () => ({ name: "", goal: "Hipertrofia", frequency: 3, notes: "", days: [{ id: newUid(), name: "Día 1", exercises: [] }] });
const cloneWithIds = (r) => ({ ...structuredClone(r), days: r.days.map((d) => ({ ...structuredClone(d), id: newUid(), exercises: d.exercises.map((e) => ({ ...e, uid: newUid() })) })) });

export default function RoutineEditor({ clientId }) {
  const db = useDB();
  const { me } = useApp();
  const client = db.clients.find((c) => c.userId === clientId);
  const user = userById(db, clientId);
  const first = user.name.split(" ")[0];
  const [draft, setDraft] = useState(() => (client.routine ? structuredClone(client.routine) : null));
  const [dayIdx, setDayIdx] = useState(0);
  const [picker, setPicker] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [asTemplate, setAsTemplate] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [askDelDay, setAskDelDay] = useState(false);
  const [view, setView] = useState(null);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(client.routine ?? null), [draft, client.routine]);

  if (!draft) {
    return (
      <section className="panel">
        <Empty icon="dumbbell" title={`${first} todavía no tiene rutina`} text="Empieza desde cero o parte de una de tus plantillas y ajústala a su nivel."
          action={<div className="row wrap" style={{ justifyContent: "center" }}>
            <button className="btn btn-quiet" onClick={() => setTemplates(true)}><Icon name="layers" size={18} />Usar plantilla</button>
            <button className="btn btn-primary" onClick={() => setDraft({ ...blank(), goal: client.goal, name: `Plan de ${first}` })}><Icon name="plus" size={18} />Empezar desde cero</button>
          </div>} />
        {templates && <TemplatePicker onClose={() => setTemplates(false)} onPick={(t) => { setDraft(cloneWithIds(t)); setDayIdx(0); setTemplates(false); }} />}
      </section>
    );
  }

  const day = draft.days[Math.min(dayIdx, draft.days.length - 1)];
  const up = (fn) => setDraft((d) => { const n = structuredClone(d); fn(n); return n; });
  const upDay = (fn) => up((n) => fn(n.days[Math.min(dayIdx, n.days.length - 1)]));
  const total = draft.days.reduce((t, d) => t + d.exercises.length, 0);

  function save() {
    if (!draft.name.trim()) return toast("Ponle un nombre a la rutina", "alert");
    if (!total) return toast("Agrega al menos un ejercicio", "alert");
    saveRoutine(clientId, draft);
    toast(`Rutina guardada. ${first} ya la ve en su app`);
  }

  return (
    <div className="stack-lg">
      <section className="panel panel-pad stack">
        <div className="form-grid">
          <Field label="Nombre de la rutina" id="re-name"><input id="re-name" className="input" value={draft.name} onChange={(e) => up((n) => { n.name = e.target.value; })} /></Field>
          <Field label="Objetivo" id="re-goal"><select id="re-goal" className="select" value={draft.goal} onChange={(e) => up((n) => { n.goal = e.target.value; })}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></Field>
          <div className="full field">
            <span className="label">Entrenamientos por semana</span>
            <div className="chips" role="group" aria-label="Entrenamientos por semana">
              {[1, 2, 3, 4, 5, 6].map((k) => <button key={k} className="chip" aria-pressed={draft.frequency === k} onClick={() => up((n) => { n.frequency = k; })} style={{ minWidth: 44, justifyContent: "center" }}>{k}</button>)}
            </div>
          </div>
          <div className="full"><Field label="Indicaciones generales" id="re-notes"><textarea id="re-notes" className="textarea" rows={2} value={draft.notes} placeholder={`Ej.: calienta 10 min antes de empezar`} onChange={(e) => up((n) => { n.notes = e.target.value; })} /></Field></div>
        </div>
        <div className="row wrap gap-sm">
          <button className="btn btn-quiet btn-sm" onClick={() => setTemplates(true)}><Icon name="layers" size={16} />Reemplazar con plantilla</button>
          <button className="btn btn-quiet btn-sm" onClick={() => setAsTemplate(true)} disabled={!total}><Icon name="copy" size={16} />Guardar como plantilla</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <div className="chips" role="tablist" aria-label="Días de la rutina">
            {draft.days.map((d, i) => (
              <button key={d.id} role="tab" className="chip" aria-selected={i === dayIdx} aria-pressed={i === dayIdx} onClick={() => setDayIdx(i)}>
                {d.name || `Día ${i + 1}`}<span className="chip-n">{d.exercises.length}</span>
              </button>
            ))}
            <button className="chip" onClick={() => { up((n) => { n.days.push({ id: newUid(), name: `Día ${n.days.length + 1}`, exercises: [] }); }); setDayIdx(draft.days.length); }}>
              <Icon name="plus" size={15} />Día
            </button>
          </div>
        </div>
        <div className="panel-body stack">
          <div className="row wrap" style={{ alignItems: "flex-end" }}>
            <div className="grow" style={{ maxWidth: 320 }}>
              <Field label="Nombre del día" id="re-day"><input id="re-day" className="input" value={day.name} onChange={(e) => upDay((d) => { d.name = e.target.value; })} placeholder="Ej.: Torso" /></Field>
            </div>
            {draft.days.length > 1 && <button className="btn btn-ghost btn-sm" onClick={() => setAskDelDay(true)}><Icon name="trash" size={16} />Quitar día</button>}
          </div>

          {day.exercises.length === 0 && <div className="note-box"><Icon name="dumbbell" size={18} />Este día no tiene ejercicios. Agrega el primero desde tu biblioteca.</div>}

          <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 10 }}>
            {day.exercises.map((e, i) => {
              const info = exerciseById(db, e.exId);
              const set = (k, v) => upDay((d) => { d.exercises[i][k] = v; });
              return (
                <li key={e.uid} className="panel" style={{ padding: 12, background: "var(--surface-2)" }}>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <span className="display num" style={{ fontSize: 22, width: 22, color: "var(--muted)" }}>{i + 1}</span>
                    <div className="grow stack" style={{ gap: 10 }}>
                      <div className="row spread wrap gap-sm">
                        <div className="row gap-sm" style={{ minWidth: 0 }}>
                          {exerciseImage(info) && <button className="ex-thumb-btn" onClick={() => setView(info)} aria-label={`Ver ${info.name}`}><img className="ex-thumb" src={exerciseImage(info)} alt="" /></button>}
                          <div style={{ minWidth: 0 }}><div className="strong">{info.name}</div><div className="tiny muted">{info.muscle} · {info.equipment}</div></div>
                        </div>
                        <div className="row gap-xs">
                          <button className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => upDay((d) => { [d.exercises[i - 1], d.exercises[i]] = [d.exercises[i], d.exercises[i - 1]]; })} aria-label={`Subir ${info.name}`}><Icon name="arrowUp" size={17} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" disabled={i === day.exercises.length - 1} onClick={() => upDay((d) => { [d.exercises[i + 1], d.exercises[i]] = [d.exercises[i], d.exercises[i + 1]]; })} aria-label={`Bajar ${info.name}`}><Icon name="arrowDown" size={17} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => upDay((d) => { d.exercises.splice(i, 1); })} aria-label={`Quitar ${info.name}`}><Icon name="trash" size={17} /></button>
                        </div>
                      </div>
                      <div className="row wrap gap-sm">
                        <label className="field" style={{ width: 84 }}><span className="tiny muted strong">Series</span>
                          <input className="input num" type="number" inputMode="numeric" min="1" max="10" value={e.sets} onChange={(ev) => set("sets", Math.max(1, Math.min(10, +ev.target.value || 1)))} /></label>
                        <label className="field" style={{ width: 96 }}><span className="tiny muted strong">Reps</span>
                          <input className="input num" value={e.reps} onChange={(ev) => set("reps", ev.target.value.slice(0, 7))} placeholder="8-10" /></label>
                        <label className="field" style={{ width: 110 }}><span className="tiny muted strong">Descanso</span>
                          <select className="select num" value={e.rest} onChange={(ev) => set("rest", +ev.target.value)}>{RESTS.map((r) => <option key={r} value={r}>{clock(r)}</option>)}</select></label>
                        <label className="field grow" style={{ minWidth: 180 }}><span className="tiny muted strong">Nota para {first}</span>
                          <input className="input" value={e.notes} onChange={(ev) => set("notes", ev.target.value)} placeholder="Opcional" /></label>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <button className="btn btn-quiet" onClick={() => setPicker(true)} style={{ borderStyle: "dashed" }}><Icon name="plus" size={18} />Agregar ejercicio a {day.name || "este día"}</button>
        </div>
      </section>

      <div className="panel panel-pad row wrap spread" style={{ position: "sticky", bottom: 12, zIndex: 5, boxShadow: "var(--shadow)", paddingBlock: 12 }}>
        <span className="small muted">{dirty ? "Tienes cambios sin guardar" : client.routine ? `${first} ve esta versión` : "Aún no se ha guardado"} · {draft.days.length} {draft.days.length === 1 ? "día" : "días"}, {total} ejercicios</span>
        <div className="row gap-sm">
          {dirty && client.routine && <button className="btn btn-ghost" onClick={() => setAskDiscard(true)}>Descartar</button>}
          <button className="btn btn-primary" onClick={save} disabled={!dirty && !!client.routine}>Guardar rutina</button>
        </div>
      </div>

      {picker && <ExercisePicker dayName={day.name} onClose={() => setPicker(false)}
        onPick={(ex) => { upDay((d) => { d.exercises.push({ uid: newUid(), exId: ex.id, sets: ex.sets || 3, reps: String(ex.reps || "10"), rest: RESTS.includes(+ex.rest) ? +ex.rest : 90, notes: "" }); }); toast(`${ex.name} agregado`); }} />}
      {templates && <TemplatePicker onClose={() => setTemplates(false)} onPick={(t) => { setDraft({ ...cloneWithIds(t), name: draft.name || t.name }); setDayIdx(0); setTemplates(false); toast("Plantilla aplicada. Revisa y guarda"); }} />}
      {asTemplate && <TemplateNameModal initial={draft.name} onClose={() => setAsTemplate(false)} onSave={(name) => { saveTemplate(me.id, draft, name); toast("Plantilla guardada en tu biblioteca", "layers"); setAsTemplate(false); }} />}
      {view && <ExerciseDetail ex={view} onClose={() => setView(null)} />}
      {askDiscard && <Confirm title="Descartar cambios" confirmLabel="Descartar" onClose={() => setAskDiscard(false)} onConfirm={() => { setDraft(structuredClone(client.routine)); setDayIdx(0); }} text="Vuelves a la última versión guardada de la rutina." />}
      {askDelDay && <Confirm title={`Quitar ${day.name}`} confirmLabel="Quitar día" onClose={() => setAskDelDay(false)} onConfirm={() => { up((n) => { n.days.splice(dayIdx, 1); }); setDayIdx(0); }} text={`Se quitan sus ${day.exercises.length} ejercicios. El cambio se aplica cuando guardes la rutina.`} />}
    </div>
  );
}

export function ExercisePicker({ onClose, onPick, dayName }) {
  const db = useDB();
  const { me } = useApp();
  const list = db.exercises.filter((e) => e.coachId == null || e.coachId === me.id);
  const filters = useExerciseFilters(list, me.id);
  const [open, setOpen] = useState(null);
  const [added, setAdded] = useState({});
  const add = (e) => { onPick(e); setAdded((a) => ({ ...a, [e.id]: (a[e.id] || 0) + 1 })); };
  return (
    <Modal title={`Agregar a ${dayName || "este día"}`} onClose={onClose} wide footer={<button className="btn btn-primary" onClick={onClose}>Listo</button>}>
      <ExerciseFilters state={filters} idPrefix="pick" showMine />
      <span className="small muted">{filters.shown.length} ejercicios</span>
      <div className="ex-grid">
        {filters.shown.map((e) => (
          <ExerciseTile key={e.id} ex={e} onOpen={setOpen}
            action={<button className={`btn btn-sm ${added[e.id] ? "btn-success" : "btn-primary"}`} onClick={() => add(e)} aria-label={`Agregar ${e.name}`}>
              <Icon name={added[e.id] ? "check" : "plus"} size={14} />{added[e.id] ? "Agregado" : "Agregar"}
            </button>} />
        ))}
      </div>
      {open && <ExerciseDetail ex={open} onClose={() => setOpen(null)} footer={<button className="btn btn-primary" onClick={() => { add(open); setOpen(null); }}><Icon name="plus" size={16} />Agregar a {dayName || "este día"}</button>} />}
    </Modal>
  );
}

function TemplatePicker({ onClose, onPick }) {
  const db = useDB();
  const { me } = useApp();
  const list = db.templates.filter((t) => t.coachId === me.id);
  return (
    <Modal title="Elegir plantilla" onClose={onClose}>
      {list.length === 0 ? <p className="muted">Aún no tienes plantillas. Guarda una rutina como plantilla para reutilizarla.</p> : (
        <div className="panel list">
          {list.map((t) => (
            <button key={t.id} className="list-row" onClick={() => onPick(t)}>
              <Icon name="layers" />
              <div className="grow"><div className="strong">{t.name}</div><div className="small muted">{t.goal} · {t.days.length} {t.days.length === 1 ? "día" : "días"} · {t.frequency}×/semana · {t.days.reduce((n, d) => n + d.exercises.length, 0)} ejercicios</div></div>
              <Icon name="right" size={18} />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function TemplateNameModal({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial);
  return (
    <Modal title="Guardar como plantilla" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Guardar plantilla</button>
    </>}>
      <Field label="Nombre de la plantilla" id="tpl-name"><input id="tpl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <p className="small muted">La plantilla queda en tu biblioteca para usarla con otros clientes.</p>
    </Modal>
  );
}
