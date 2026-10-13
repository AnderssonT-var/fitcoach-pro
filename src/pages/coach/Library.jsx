import { useState } from "react";
import Icon from "../../ui/Icon";
import { Confirm, Empty, Field, Modal, toast } from "../../ui/kit";
import { useApp } from "../../context";
import { deleteExercise, deleteTemplate, exerciseById, exerciseInUse, upsertExercise, useDB } from "../../store/db";
import { clock, shortDate } from "../../lib/format";

const EQUIP = ["Barra", "Mancuernas", "Polea", "Máquina", "Peso corporal", "Kettlebell", "Banda elástica", "Accesorio"];

export default function Library() {
  const [tab, setTab] = useState("ejercicios");
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Biblioteca</h1><p>Los ejercicios y plantillas que usas para armar rutinas.</p></div>
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
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("Todos");
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const list = db.exercises.filter((e) => e.coachId == null || e.coachId === me.id);
  const muscles = ["Todos", "Tuyos", ...new Set(list.map((e) => e.muscle))];
  const shown = list
    .filter((e) => muscle === "Todos" || (muscle === "Tuyos" ? e.coachId === me.id : e.muscle === muscle))
    .filter((e) => !q || `${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="row wrap" style={{ gap: 10 }}>
        <div className="search">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="lib-q">Buscar ejercicio</label>
          <input id="lib-q" className="input" placeholder="Buscar ejercicio" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => setEdit({ name: "", muscle: "Pecho", equipment: "Barra", cues: "" })}><Icon name="plus" size={18} />Nuevo ejercicio</button>
      </div>
      <div className="chips">{muscles.map((m) => <button key={m} className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(m)}>{m}</button>)}</div>
      <section className="panel">
        {shown.length === 0 ? <Empty icon="dumbbell" title="Sin resultados" text="Crea el ejercicio con tus propias indicaciones." /> : (
          <div className="list">
            {shown.map((e) => (
              <div key={e.id} className="list-row" style={{ alignItems: "flex-start" }}>
                <span className="avatar sm" style={{ background: "var(--surface-3)", color: "var(--ink-2)" }}><Icon name="dumbbell" size={16} /></span>
                <div className="grow">
                  <div className="row wrap gap-sm"><span className="strong">{e.name}</span>{e.coachId && <span className="tag">Tuyo</span>}</div>
                  <div className="small muted">{e.muscle} · {e.equipment}</div>
                  {e.cues && <div className="small ink2" style={{ marginTop: 4 }}>{e.cues}</div>}
                </div>
                {e.coachId === me.id && (
                  <div className="row gap-xs">
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit(e)} aria-label={`Editar ${e.name}`}><Icon name="pencil" size={16} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDel(e)} aria-label={`Eliminar ${e.name}`}><Icon name="trash" size={16} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {edit && <ExerciseModal ex={edit} muscles={[...new Set(list.map((e) => e.muscle))]} onClose={() => setEdit(null)} onSave={(d) => { upsertExercise(me.id, d); toast(d.id ? "Ejercicio actualizado" : "Ejercicio creado"); setEdit(null); }} />}
      {del && (exerciseInUse(db, del.id)
        ? <Confirm title="No se puede eliminar" tone="primary" confirmLabel="Entendido" onConfirm={() => {}} onClose={() => setDel(null)} text={`${del.name} está en la rutina de al menos un cliente. Quítalo de esas rutinas primero.`} />
        : <Confirm title="Eliminar ejercicio" confirmLabel="Eliminar" onClose={() => setDel(null)} onConfirm={() => { deleteExercise(del.id); toast("Ejercicio eliminado", "trash"); }} text={`${del.name} se quitará de tu biblioteca.`} />)}
    </>
  );
}

function ExerciseModal({ ex, muscles, onClose, onSave }) {
  const [f, setF] = useState(ex);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={ex.id ? "Editar ejercicio" : "Nuevo ejercicio"} onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!f.name.trim()} onClick={() => onSave({ ...f, name: f.name.trim() })}>{ex.id ? "Guardar" : "Crear ejercicio"}</button>
    </>}>
      <Field label="Nombre" id="ex-name"><input id="ex-name" className="input" value={f.name} onChange={set("name")} placeholder="Ej.: Sentadilla búlgara" /></Field>
      <div className="form-grid">
        <Field label="Grupo muscular" id="ex-muscle">
          <input id="ex-muscle" className="input" list="ex-muscles" value={f.muscle} onChange={set("muscle")} />
          <datalist id="ex-muscles">{muscles.map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
        <Field label="Equipo" id="ex-eq"><select id="ex-eq" className="select" value={f.equipment} onChange={set("equipment")}>{EQUIP.map((m) => <option key={m}>{m}</option>)}</select></Field>
      </div>
      <Field label="Indicaciones técnicas" id="ex-cues" hint="Tus clientes las ven mientras entrenan."><textarea id="ex-cues" className="textarea" value={f.cues} onChange={set("cues")} /></Field>
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
