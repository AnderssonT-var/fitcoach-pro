import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import { Modal } from "./kit";
import MuscleMap, { muscleName } from "./MuscleMap";
import { exerciseImage } from "../store/db";
import { clock, parseRest } from "../lib/format";

export const GROUPS = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Antebrazos", "Abdomen", "Glúteos", "Cuádriceps", "Isquiotibiales", "Pantorrillas", "Cuerpo completo", "Cardio", "Estiramiento"];
export const LEVELS = ["Principiante", "Intermedio", "Avanzado"];
export const MUSCLE_KEYS = ["chest", "shoulders", "biceps", "triceps", "forearms", "abdominals", "lats", "middle back", "lower back", "traps", "glutes", "quadriceps", "hamstrings", "adductors", "abductors", "calves", "neck"];
const LEVEL_TONE = { Principiante: "ok", Intermedio: "info", Avanzado: "warn" };

/* ---------- filtros ---------- */
export function useExerciseFilters(list, coachId) {
  const [f, setF] = useState({ q: "", group: "Todos", equipment: "", level: "", mine: false });
  const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const base = useMemo(() => list.filter((e) =>
    (!f.q || norm(`${e.name} ${e.muscle} ${e.equipment} ${(e.primary || []).map(muscleName).join(" ")}`).includes(norm(f.q))) &&
    (!f.equipment || e.equipment === f.equipment) &&
    (!f.level || e.level === f.level) &&
    (!f.mine || e.coachId === coachId)), [list, f.q, f.equipment, f.level, f.mine, coachId]);
  const shown = useMemo(() => base.filter((e) => f.group === "Todos" || e.muscle === f.group).sort((a, b) => a.name.localeCompare(b.name, "es")), [base, f.group]);
  const groups = useMemo(() => {
    const extra = [...new Set(list.map((e) => e.muscle))].filter((g) => g && !GROUPS.includes(g));
    return ["Todos", ...GROUPS, ...extra].map((g) => ({ g, n: g === "Todos" ? base.length : base.filter((e) => e.muscle === g).length })).filter((x) => x.g === "Todos" || x.n > 0 || x.g === f.group);
  }, [list, base, f.group]);
  const equipment = useMemo(() => [...new Set(list.map((e) => e.equipment).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [list]);
  return { f, setF, shown, groups, equipment, total: list.length };
}

export function ExerciseFilters({ state, idPrefix = "ex", showMine }) {
  const { f, setF, groups, equipment } = state;
  const active = f.equipment || f.level || f.mine || f.q;
  return (
    <div className="stack gap-sm">
      <div className="row wrap" style={{ gap: 10 }}>
        <div className="search">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor={`${idPrefix}-q`}>Buscar ejercicio</label>
          <input id={`${idPrefix}-q`} className="input" placeholder="Buscar por nombre o músculo" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
        <label className="sr-only" htmlFor={`${idPrefix}-eq`}>Equipo</label>
        <select id={`${idPrefix}-eq`} className="select" style={{ width: "auto", minWidth: 170 }} value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })}>
          <option value="">Todo el equipo</option>
          {equipment.map((x) => <option key={x}>{x}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Nivel">
          <button aria-pressed={!f.level} onClick={() => setF({ ...f, level: "" })}>Todos</button>
          {LEVELS.map((l) => <button key={l} aria-pressed={f.level === l} onClick={() => setF({ ...f, level: l })}>{l}</button>)}
        </div>
        {showMine && <label className="toggle small"><input type="checkbox" checked={f.mine} onChange={(e) => setF({ ...f, mine: e.target.checked })} />Solo míos</label>}
        {active && <button className="link-btn small" onClick={() => setF({ q: "", group: f.group, equipment: "", level: "", mine: false })}>Limpiar filtros</button>}
      </div>
      <div className="chips ex-groups" role="group" aria-label="Grupo muscular">
        {groups.map(({ g, n }) => (
          <button key={g} className="chip" aria-pressed={f.group === g} onClick={() => setF({ ...f, group: g })}>{g}<span className="chip-n">{n}</span></button>
        ))}
      </div>
    </div>
  );
}

/* ---------- tarjeta ---------- */
export function ExerciseTile({ ex, onOpen, action }) {
  const img0 = exerciseImage(ex, 0), img1 = exerciseImage(ex, 1);
  return (
    <div className="ex-tile">
      <button className="ex-tile-media" onClick={() => onOpen(ex)} aria-label={`Ver ${ex.name}`}>
        {img0 ? (
          <>
            <img src={img0} alt="" loading="lazy" />
            {img1 && img1 !== img0 && <img src={img1} alt="" loading="lazy" className="alt" />}
          </>
        ) : <div className="ex-tile-map"><MuscleMap primary={ex.primary || []} secondary={ex.secondary || []} size={150} /></div>}
        {ex.coachId && <span className="ex-badge">Tuyo</span>}
      </button>
      <div className="ex-tile-body">
        <button className="ex-tile-name" onClick={() => onOpen(ex)}>{ex.name}</button>
        <div className="tiny muted ellipsis">{ex.muscle} · {ex.equipment}</div>
        <div className="row spread gap-sm" style={{ marginTop: 6 }}>
          {ex.level ? <span className={`pill ${LEVEL_TONE[ex.level] || ""}`}>{ex.level}</span> : <span />}
          {action}
        </div>
      </div>
    </div>
  );
}

/* ---------- ficha ---------- */
export function ExerciseDetail({ ex, onClose, footer, coachName }) {
  const frames = [exerciseImage(ex, 0), exerciseImage(ex, 1)].filter(Boolean);
  const unique = [...new Set(frames)];
  const [frame, setFrame] = useState(0);
  const [play, setPlay] = useState(unique.length > 1);
  useEffect(() => {
    if (!play || unique.length < 2) return;
    const t = setInterval(() => setFrame((x) => (x + 1) % unique.length), 1100);
    return () => clearInterval(t);
  }, [play, unique.length]);
  const steps = ex.steps || [];
  return (
    <Modal title={ex.name} onClose={onClose} wide footer={footer}>
      <div className="ex-detail">
        <div className="stack gap-sm">
          {unique.length ? (
            <div className="ex-frames">
              {unique.map((src, i) => <img key={src} src={src} alt={i === 0 ? "Posición inicial" : "Posición final"} className={i === frame ? "on" : ""} />)}
            </div>
          ) : null}
          {unique.length > 1 && (
            <div className="row spread wrap gap-sm">
              <div className="seg" role="group" aria-label="Posición">
                <button aria-pressed={frame === 0 && !play} onClick={() => { setPlay(false); setFrame(0); }}>Inicio</button>
                <button aria-pressed={frame === 1 && !play} onClick={() => { setPlay(false); setFrame(1); }}>Final</button>
              </div>
              <button className="btn btn-quiet btn-sm" onClick={() => setPlay(!play)}><Icon name={play ? "pause" : "play"} size={14} />{play ? "Pausar" : "Animar"}</button>
            </div>
          )}
          <div className="row wrap gap-xs">
            <span className="pill info">{ex.muscle}</span>
            <span className="tag">{ex.equipment}</span>
            {ex.level && <span className={`pill ${LEVEL_TONE[ex.level] || ""}`}>{ex.level}</span>}
            {ex.type && <span className="tag">{ex.type}</span>}
          </div>
          {(ex.sets || ex.reps) && (
            <p className="small muted">Sugerido: <strong className="ink2 num">{ex.sets} × {ex.reps}</strong> · descanso {clock(parseRest(ex.rest))}</p>
          )}
        </div>
        <div className="stack">
          <div className="ex-map-box">
            <MuscleMap primary={ex.primary || []} secondary={ex.secondary || []} size={230} />
            <div className="stack gap-xs small">
              {ex.primary?.length > 0 && <div><span className="mm-dot primary" />Principales: <strong>{ex.primary.map(muscleName).join(", ")}</strong></div>}
              {ex.secondary?.length > 0 && <div><span className="mm-dot secondary" />Secundarios: {ex.secondary.map(muscleName).join(", ")}</div>}
            </div>
          </div>
          {steps.length > 0 && (
            <div className="stack gap-sm">
              <span className="section-title" style={{ fontSize: 17 }}>Cómo se hace</span>
              <ol className="ex-steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}
          {ex.cues && <div className="note-box small"><Icon name="note" size={16} /><span><strong>{coachName ? `${coachName}:` : "Consejo:"}</strong> {ex.cues}</span></div>}
          {ex.source && <p className="tiny muted">Imágenes: Free Exercise DB (dominio público).</p>}
        </div>
      </div>
    </Modal>
  );
}
