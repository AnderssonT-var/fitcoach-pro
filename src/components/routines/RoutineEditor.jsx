import { useState } from "react";
import { C } from '../../constants/colors';
import { EXERCISES_DB, TEMPLATE_ROUTINES } from '../../constants/data';
import { Btn, Divider, Input, Modal, Select } from '../ui';

export default function RoutineEditor({ client, onSave, onClose }) {
  const ex = client.routine;
  const [name,       setName]       = useState(ex?.name     || "");
  const [category,   setCategory]   = useState(ex?.category || "Hipertrofia");
  const [days,       setDays]       = useState(ex?.days     || 5);
  const [exercises,  setExercises]  = useState(ex?.exercises || []);
  const [showImport, setShowImport] = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [newEx, setNewEx] = useState({ exId: "1", sets: "3", reps: "10", rest: "90s", notes: "" });

  function addEx() {
    setExercises([...exercises, {
      exId: parseInt(newEx.exId), sets: parseInt(newEx.sets),
      reps: newEx.reps, rest: newEx.rest, notes: newEx.notes,
    }]);
    setNewEx({ exId: "1", sets: "3", reps: "10", rest: "90s", notes: "" });
    setShowAdd(false);
  }

  function removeEx(i) {
    setExercises(exercises.filter((_, j) => j !== i));
  }

  function importTmpl(t) {
    setName(t.name + " — " + client.name.split(" ")[0]);
    setCategory(t.category);
    setDays(t.days);
    setExercises([...t.exercises]);
    setShowImport(false);
  }

  function getName(id) {
    return EXERCISES_DB.find((e) => e.id === id)?.name || "Ejercicio";
  }

  return (
    <Modal title={`Rutina de ${client.name}`} onClose={onClose} wide>
      {/* Import banner */}
      {showImport && (
        <div style={{ background: C.bg, border: `1px solid ${C.accent}30`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10, fontFamily: "Syne" }}>
            📥 Selecciona una plantilla base (podrás editarla después)
          </div>
          {TEMPLATE_ROUTINES.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "DM Sans" }}>{t.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{t.exercises.length} ejercicios · {t.days} días/sem · {t.category}</div>
              </div>
              <Btn size="sm" onClick={() => importTmpl(t)}>Importar</Btn>
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <Btn size="sm" variant="subtle" onClick={() => setShowImport(false)}>Cancelar</Btn>
          </div>
        </div>
      )}

      {/* Basic info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 12 }}>
        <div style={{ gridColumn: "span 1" }}>
          <Input
            label="Nombre de la rutina"
            placeholder="Ej: Push/Pull/Legs personalizado"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Select label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)}>
          {["Hipertrofia", "Fuerza", "Powerlifting", "Funcional", "Cardio", "Mixta"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Input label="Días/sem" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <Btn size="sm" variant="ghost" onClick={() => setShowImport(!showImport)}>📥 Importar plantilla</Btn>
        <span style={{ fontSize: 12, color: C.muted, fontFamily: "DM Sans" }}>
          Importa como punto de partida y personaliza para este cliente
        </span>
      </div>

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "Syne" }}>
          Ejercicios {exercises.length > 0 && `(${exercises.length})`}
        </div>
        <Btn size="sm" onClick={() => setShowAdd(!showAdd)}>+ Añadir ejercicio</Btn>
      </div>

      {/* Add exercise form */}
      {showAdd && (
        <div style={{ background: C.bg, border: `1px solid ${C.accent}30`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10 }}>
            <Select label="Ejercicio" value={newEx.exId} onChange={(e) => setNewEx({ ...newEx, exId: e.target.value })}>
              {EXERCISES_DB.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Input label="Series"  type="number" value={newEx.sets}  onChange={(e) => setNewEx({ ...newEx, sets: e.target.value })} />
            <Input label="Reps"               value={newEx.reps}  onChange={(e) => setNewEx({ ...newEx, reps: e.target.value })} />
            <Input label="Descanso"           value={newEx.rest}  onChange={(e) => setNewEx({ ...newEx, rest: e.target.value })} />
          </div>
          <Input
            label="Nota para el cliente"
            placeholder="Indicación especial…"
            value={newEx.notes}
            onChange={(e) => setNewEx({ ...newEx, notes: e.target.value })}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn size="sm" onClick={addEx}>Agregar</Btn>
            <Btn size="sm" variant="subtle" onClick={() => setShowAdd(false)}>Cancelar</Btn>
          </div>
        </div>
      )}

      {/* Exercise list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 260, overflowY: "auto" }}>
        {exercises.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13, fontFamily: "DM Sans" }}>
            Sin ejercicios — añade o importa una plantilla.
          </div>
        )}
        {exercises.map((exItem, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 13px",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7, background: C.accentDim,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
            }}>💪</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "DM Sans" }}>{getName(exItem.exId)}</div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {exItem.sets} series · {exItem.reps} reps · ⏱ {exItem.rest}
                {exItem.notes && <span style={{ color: C.accent }}> · {exItem.notes}</span>}
              </div>
            </div>
            <button onClick={() => removeEx(i)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <Btn variant="ghost" full onClick={onClose}>Cancelar</Btn>
        <Btn full onClick={() => onSave({ name, category, days: parseInt(days), exercises })}>
          💾 Guardar rutina de {client.name.split(" ")[0]}
        </Btn>
      </div>
    </Modal>
  );
}
