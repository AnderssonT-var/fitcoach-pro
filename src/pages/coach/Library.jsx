import { useState } from "react";
import Icon from "../../ui/Icon";
import { Confirm, Empty, Field, Modal, toast } from "../../ui/kit";
import { ImageDrop } from "../../ui/inputs";
import { ExerciseDetail, ExerciseFilters, ExerciseTile, GROUPS, LEVELS, MUSCLE_KEYS, useExerciseFilters } from "../../ui/exercises";
import MuscleMap, { MuscleLegend, muscleName } from "../../ui/MuscleMap";
import { useApp } from "../../context";
import { deleteExercise, deleteTemplate, exerciseById, exerciseInUse, upsertExercise, useDB } from "../../store/db";
import { clock, shortDate } from "../../lib/format";
import { progressImage } from "../../lib/image";

const EQUIP = ["Barra", "Barra Z", "Mancuernas", "Polea", "Máquina", "Hammer Strength", "Máquina Smith", "Peso corporal", "Barra fija", "Paralelas", "Kettlebell", "Banda elástica", "Balón medicinal", "Fitball", "Cajón", "Cuerda", "Disco", "Trineo", "Otro"];

export default function Library() {
  const [tab, setTab] = useState("ejercicios");
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Biblioteca</h1><p>Más de 200 ejercicios listos con fotos, músculos trabajados y técnica. Agrega los tuyos y arma plantillas.</p></div>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={tab === "ejercicios"} onClick={() => setTab("ejercicios")}>Ejercicios</button>
        <button role="tab" className="tab" aria-selected={tab === "plantillas"} onClick={() => setTab("plantillas")}>Plantillas</button>
      </div>
      {tab === "ejercicios" ? <Exercises /> : <Templates />}
    </div>
  );
}

function Exercises() {
  const db = useDB();
  const { me } = useApp();
  const list = db.exercises.filter((e) => e.coachId == null || e.coachId === me.id);
  const filters = useExerciseFilters(list, me.id);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const blank = { name: "", muscle: "Pecho", equipment: "Mancuernas", level: "Intermedio", primary: [], secondary: [], steps: [], cues: "", sets: 3, reps: "12", rest: 60, photo: null };

  return (
    <>
      <div className="row spread wrap gap-sm">
        <span className="small muted">{filters.shown.length} de {filters.total} ejercicios</span>
        <button className="btn btn-primary" onClick={() => setEdit(blank)}><Icon name="plus" size={18} />Nuevo ejercicio</button>
      </div>
      <ExerciseFilters state={filters} idPrefix="lib" showMine />
      {filters.shown.length === 0 ? (
        <section className="panel"><Empty icon="dumbbell" title="No hay ejercicios con esos filtros" text="Cambia la categoría o crea el ejercicio con tus propias indicaciones." /></section>
      ) : (
        <div className="ex-grid">
          {filters.shown.map((e) => <ExerciseTile key={e.id} ex={e} onOpen={setOpen} />)}
        </div>
      )}
      {open && (
        <ExerciseDetail ex={exerciseById(db, open.id)} onClose={() => setOpen(null)}
          footer={open.coachId === me.id ? <>
            <button className="btn btn-ghost" onClick={() => { setDel(open); setOpen(null); }}><Icon name="trash" size={16} />Eliminar</button>
            <button className="btn btn-primary" onClick={() => { setEdit(exerciseById(db, open.id)); setOpen(null); }}><Icon name="pencil" size={16} />Editar</button>
          </> : null} />
      )}
      {edit && <ExerciseModal ex={edit} onClose={() => setEdit(null)} onSave={(d) => { upsertExercise(me.id, d); toast(d.id ? "Ejercicio actualizado" : "Ejercicio creado"); setEdit(null); }} />}
      {del && (exerciseInUse(db, del.id)
        ? <Confirm title="No se puede eliminar" tone="primary" confirmLabel="Entendido" onConfirm={() => {}} onClose={() => setDel(null)} text={`${del.name} está en la rutina de al menos un cliente. Quítalo de esas rutinas primero.`} />
        : <Confirm title="Eliminar ejercicio" confirmLabel="Eliminar" onClose={() => setDel(null)} onConfirm={() => { deleteExercise(del.id); toast("Ejercicio eliminado", "trash"); }} text={`${del.name} se quitará de tu biblioteca.`} />)}
    </>
  );
}

function ExerciseModal({ ex, onClose, onSave }) {
  const [f, setF] = useState({ ...ex, stepsText: (ex.steps || []).join("\n") });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleMuscle = (m) => {
    const p = f.primary.includes(m), s = f.secondary.includes(m);
    // ninguno → principal → secundario → ninguno
    if (!p && !s) setF({ ...f, primary: [...f.primary, m] });
    else if (p) setF({ ...f, primary: f.primary.filter((x) => x !== m), secondary: [...f.secondary, m] });
    else setF({ ...f, secondary: f.secondary.filter((x) => x !== m) });
  };
  async function photo(files) {
    try { setF({ ...f, photo: await progressImage(files[0]) }); } catch (e) { toast(e.message, "alert"); }
  }
  function save() {
    const { stepsText, ...rest } = f;
    onSave({ ...rest, name: f.name.trim(), steps: stepsText.split("\n").map((x) => x.trim()).filter(Boolean), sets: +f.sets || 3, rest: +f.rest || 60 });
  }
  return (
    <Modal title={ex.id ? "Editar ejercicio" : "Nuevo ejercicio"} onClose={onClose} wide footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!f.name.trim()} onClick={save}>{ex.id ? "Guardar" : "Crear ejercicio"}</button>
    </>}>
      <div className="form-grid">
        <div className="full"><Field label="Nombre" id="ex-name"><input id="ex-name" className="input" value={f.name} onChange={set("name")} placeholder="Ej.: Sentadilla con pausa" /></Field></div>
        <Field label="Categoría" id="ex-group"><select id="ex-group" className="select" value={f.muscle} onChange={set("muscle")}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select></Field>
        <Field label="Equipo" id="ex-eq"><select id="ex-eq" className="select" value={f.equipment} onChange={set("equipment")}>{EQUIP.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Nivel" id="ex-level"><select id="ex-level" className="select" value={f.level} onChange={set("level")}>{LEVELS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <div className="row gap-sm" style={{ alignItems: "flex-end" }}>
          <Field label="Series" id="ex-sets"><input id="ex-sets" className="input num" type="number" min="1" value={f.sets} onChange={set("sets")} /></Field>
          <Field label="Reps" id="ex-reps"><input id="ex-reps" className="input num" value={f.reps} onChange={set("reps")} /></Field>
          <Field label="Desc. (s)" id="ex-rest"><input id="ex-rest" className="input num" type="number" min="0" value={f.rest} onChange={set("rest")} /></Field>
        </div>
        <div className="full field">
          <span className="label">Músculos trabajados <span className="muted" style={{ fontWeight: 400 }}>· toca el cuerpo o la lista: un toque principal, dos secundario, tres quita</span></span>
          <div className="body-picker stack gap-sm">
            <MuscleMap primary={f.primary} secondary={f.secondary} onSelect={toggleMuscle} height={220}
              describe={(m) => (f.primary.includes(m) ? "principal" : f.secondary.includes(m) ? "secundario" : "toca para marcar")} />
            {(f.primary.length > 0 || f.secondary.length > 0) && <MuscleLegend primary={f.primary} secondary={f.secondary} />}
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {MUSCLE_KEYS.map((m) => {
              const p = f.primary.includes(m), s = f.secondary.includes(m);
              return <button key={m} type="button" className="chip" aria-pressed={p} style={s ? { background: "var(--mm-secondary)", color: "var(--ink)", boxShadow: "none" } : null} onClick={() => toggleMuscle(m)}>{muscleName(m)}</button>;
            })}
          </div>
        </div>
        <div className="full"><Field label="Pasos (uno por línea)" id="ex-steps"><textarea id="ex-steps" className="textarea" rows={3} value={f.stepsText} onChange={set("stepsText")} /></Field></div>
        <div className="full"><Field label="Consejo técnico" id="ex-cues"><input id="ex-cues" className="input" value={f.cues} onChange={set("cues")} /></Field></div>
        <div className="full field">
          <span className="label">Imagen (opcional)</span>
          {f.photo ? (
            <div className="row gap-sm">
              <img src={f.photo} alt="" className="ex-thumb" style={{ width: 120, height: 80 }} />
              <button className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, photo: null })}>Quitar</button>
            </div>
          ) : <ImageDrop onFiles={photo} label="Subir imagen del ejercicio" hint="Si no subes una, se muestra el mapa muscular." />}
        </div>
      </div>
    </Modal>
  );
}

function Templates() {
  const db = useDB();
  const { me } = useApp();
  const [view, setView] = useState(null);
  const [del, setDel] = useState(null);
  const list = db.templates.filter((t) => t.coachId === me.id);
  return (
    <section className="panel">
      {list.length === 0 ? <Empty icon="layers" title="Sin plantillas" text="En la rutina de un cliente, usa “Guardar como plantilla” para reutilizarla." /> : (
        <div className="list">
          {list.map((t) => (
            <div key={t.id} className="list-row">
              <span className="avatar sm" style={{ background: "var(--blue-soft)", color: "var(--blue-ink)" }}><Icon name="layers" size={16} /></span>
              <button className="grow" style={{ background: "none", border: 0, padding: 0, textAlign: "left" }} onClick={() => setView(t)}>
                <div className="strong">{t.name}</div>
                <div className="small muted">{t.goal} · {t.days.length} {t.days.length === 1 ? "día" : "días"} · {t.frequency}×/semana · creada {shortDate(t.createdAt)}</div>
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setView(t)}>Ver</button>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDel(t)} aria-label={`Eliminar ${t.name}`}><Icon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
      )}
      {view && (
        <Modal title={view.name} onClose={() => setView(null)} wide>
          <p className="small muted">{view.goal} · {view.frequency} entrenamientos por semana. Para usarla, abre la rutina de un cliente y elige “Usar plantilla”.</p>
          <div className="grid-2">
            {view.days.map((d) => (
              <div key={d.id} className="panel">
                <div className="panel-head"><h2 style={{ fontSize: 18 }}>{d.name}</h2></div>
                <div className="list">{d.exercises.map((e) => (
                  <div key={e.uid} className="list-row small"><span className="grow">{exerciseById(db, e.exId).name}</span><span className="num muted">{e.sets}×{e.reps} · {clock(e.rest)}</span></div>
                ))}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {del && <Confirm title="Eliminar plantilla" confirmLabel="Eliminar" onClose={() => setDel(null)} onConfirm={() => { deleteTemplate(del.id); toast("Plantilla eliminada", "trash"); }} text={`Se elimina “${del.name}”. Las rutinas que ya creaste con ella no cambian.`} />}
    </section>
  );
}
