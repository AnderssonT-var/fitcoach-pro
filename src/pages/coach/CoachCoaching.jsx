/* Seguimiento del entrenador: cumplimiento 7/30/90, cuestionario, check-ins (lado a lado),
   hábitos, nutrición, programa por fases, etiquetas y automatizaciones con cobro en línea. */
import { useMemo, useState } from "react";
import Icon from "../../ui/Icon";
import { Empty, Field, Modal, Pill, run, toast } from "../../ui/kit";
import { TagInput } from "../../ui/inputs";
import { useApp } from "../../context";
import {
  clientById, newUid, reviewCheckin, saveAutomations, saveBilling, saveCheckinCfg, saveHabits, saveNutrition, saveProgram, saveTags, useDB, userById,
} from "../../store/db";
import {
  DEFAULT_HABITS, WEEKDAYS, checkinCfgOf, complianceSet, complianceTone, habitCompliance, habitDone, habitsOf, phaseInfo, todayKey,
} from "../../lib/coaching";
import { addDays, date, money } from "../../lib/format";

const EXP = { nuevo: "Recién empieza", intermedio: "Intermedio", avanzado: "Avanzado" };
const PLACE = { gimnasio: "Gimnasio completo", casa: "Casa con mancuernas", "peso-corporal": "Solo peso corporal" };
const DAYS = ["D", "L", "M", "X", "J", "V", "S"];

/* ---------- cumplimiento ---------- */
export function ComplianceCard({ c, workouts }) {
  const p = complianceSet(c, workouts);
  const h = habitCompliance(c, 7);
  const drop = p.d7 != null && p.d30 != null && p.d30 - p.d7 >= 20;
  return (
    <section className={`panel panel-pad stack ${drop ? "panel-bad" : ""}`} style={{ gap: 10 }}>
      <div className="row spread"><span className="kicker" style={drop ? { color: "var(--red-ink)" } : null}>Cumplimiento</span>{drop && <span className="small strong bad-ink">−{p.d30 - p.d7} puntos</span>}</div>
      {p.d7 == null ? <span className="small muted">Asigna una rutina para medir su cumplimiento.</span> : (
        <div className="comp-grid">
          {[["d7", "7 días"], ["d30", "30 días"], ["d90", "90 días"]].map(([k, l]) => (
            <div key={k}><strong className={`num ${complianceTone(p[k])}-ink`}>{p[k]}%</strong><span>{l}</span></div>
          ))}
          <div><strong className={`num ${complianceTone(h)}-ink`}>{h ?? "—"}{h != null ? "%" : ""}</strong><span>hábitos 7 días</span></div>
        </div>
      )}
    </section>
  );
}

/* ---------- respuestas del cuestionario ---------- */
export function OnboardingAnswers({ c }) {
  const o = c.onboarding;
  if (!o) return null;
  return (
    <section className="panel panel-pad stack">
      <div className="row spread"><h2 className="section-title">Cuestionario de inicio</h2><span className="tiny muted">{date(o.at)}</span></div>
      <div className="facts">
        <div><span>Objetivo</span><strong>{o.goal}</strong></div>
        <div><span>Experiencia</span><strong>{EXP[o.experience] || o.experience}</strong></div>
        <div><span>Días</span><strong>{o.days?.length ? o.days.map((d) => DAYS[d]).join(" ") : "—"}</strong></div>
        <div><span>Lugar</span><strong>{PLACE[o.place] || o.place}</strong></div>
      </div>
      {o.injuries && <div className="warn-box small"><Icon name="alert" size={16} /><span><strong>Lesiones o molestias:</strong> {o.injuries}</span></div>}
      {o.notes && <p className="small ink2">{o.notes}</p>}
    </section>
  );
}

/* ---------- etiquetas ---------- */
export function TagsEditor({ c }) {
  const [tags, setTags] = useState(c.tags || []);
  const dirty = JSON.stringify(tags) !== JSON.stringify(c.tags || []);
  return (
    <section className="panel panel-pad stack">
      <h2 className="section-title">Etiquetas</h2>
      <TagInput id={`tags-${c.userId}`} value={tags} onChange={setTags} placeholder="Ej. Presencial, Competidor" max={8} />
      {dirty && <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => run(saveTags(c.userId, tags), "Etiquetas guardadas")}>Guardar etiquetas</button>}
    </section>
  );
}

/* ---------- check-ins ---------- */
const ROWS = [["weight", "Peso", "kg", -1], ["waist", "Cintura", "cm", -1], ["energy", "Energía", "", 1], ["sleep", "Sueño", "", 1], ["stress", "Estrés", "", -1], ["hunger", "Hambre", "", 0]];
export function CheckinsTab({ clientId }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const u = userById(db, clientId);
  const list = [...(c.checkins || [])].reverse();
  const [sel, setSel] = useState(list.find((x) => !x.reviewedAt)?.id || list[0]?.id);
  const [cfg, setCfg] = useState(false);
  const i = list.findIndex((x) => x.id === sel);
  const cur = list[i], prev = list[i + 1];
  const photoOf = (id) => c.photos.find((p) => p.id === id);
  return (
    <>
      <div className="row spread wrap gap-sm">
        <span className="small muted">Lo pide los {WEEKDAYS[checkinCfgOf(c).day].toLowerCase()} · {list.length} {list.length === 1 ? "check-in" : "check-ins"}</span>
        <button className="btn btn-quiet btn-sm" onClick={() => setCfg(true)}><Icon name="pencil" size={15} />Día y preguntas</button>
      </div>
      {!cur ? (
        <section className="panel"><Empty icon="note" title="Aún no envía check-ins" text={`${u.name.split(" ")[0]} recibe un aviso el día del check-in. Aquí verás su peso, fotos y respuestas, lado a lado con el anterior.`} /></section>
      ) : (
        <div className="split">
          <section className="panel panel-pad stack">
            <div className="row spread wrap gap-sm">
              <h2 className="section-title">{date(cur.date)}{prev ? <span className="muted" style={{ fontWeight: 600 }}> vs {date(prev.date)}</span> : null}</h2>
              <Pill tone={cur.reviewedAt ? "ok" : "warn"}>{cur.reviewedAt ? "Revisado" : "Por revisar"}</Pill>
            </div>
            {(cur.photos?.length > 0 || prev?.photos?.length > 0) && (
              <div className="ci-photos">
                {[prev, cur].filter(Boolean).map((x) => {
                  const ph = photoOf(x.photos?.[0]);
                  return <figure key={x.id}>{ph ? <img src={ph.src} alt={`Foto ${ph.pose} del ${date(x.date)}`} /> : <div className="ci-nophoto">Sin foto</div>}<figcaption>{date(x.date)}</figcaption></figure>;
                })}
              </div>
            )}
            <table className="ci-table">
              <thead><tr><th>Dato</th><th>Antes</th><th>Ahora</th><th>Cambio</th></tr></thead>
              <tbody>
                {ROWS.map(([k, l, unit, better]) => {
                  const a = prev?.[k], b = cur[k];
                  if (a == null && b == null) return null;
                  const d = a != null && b != null ? +(b - a).toFixed(1) : null;
                  const tone = d == null || d === 0 || better === 0 ? "" : (d > 0) === (better > 0) ? "ok-ink" : "warn-ink";
                  return <tr key={k}><td>{l}</td><td className="muted num">{a ?? "—"}{a != null && unit ? ` ${unit}` : ""}</td><td className="strong num">{b ?? "—"}{b != null && unit ? ` ${unit}` : ""}</td><td className={`num strong ${tone}`}>{d == null ? "" : d === 0 ? "=" : `${d > 0 ? "+" : ""}${d}`}</td></tr>;
                })}
              </tbody>
            </table>
            {cur.answers?.map((x, k) => <div key={k} className="ci-answer"><span className="tiny muted">{x.q}</span><p>“{x.a}”</p></div>)}
            <Review c={c} ci={cur} key={cur.id} />
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Historial</h2></div>
            <div className="list">
              {list.map((x) => (
                <button key={x.id} className="list-row" aria-pressed={x.id === sel} onClick={() => setSel(x.id)} style={{ background: x.id === sel ? "var(--surface-2)" : undefined }}>
                  <span className="grow"><span className="strong" style={{ display: "block" }}>{date(x.date)}</span><span className="tiny muted">{x.weight ? `${x.weight} kg · ` : ""}energía {x.energy} · estrés {x.stress}</span></span>
                  {!x.reviewedAt && <span className="dot-warn" aria-label="Por revisar" />}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {cfg && <CheckinConfig c={c} onClose={() => setCfg(false)} />}
    </>
  );
}
function Review({ c, ci }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  if (ci.reviewedAt) return ci.reply ? <div className="note-box small"><Icon name="chat" size={15} /><span><strong>Tu respuesta:</strong> {ci.reply}</span></div> : <span className="small muted">Revisado el {date(ci.reviewedAt)}.</span>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <label className="small strong" htmlFor={`rv-${ci.id}`}>Respuesta (le llega como mensaje)</label>
      <textarea id={`rv-${ci.id}`} className="input" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ej. Buen progreso: bajaste 0,6 kg. Esta semana subimos el cardio." />
      <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); await run(reviewCheckin(c.userId, ci.id, reply.trim()), reply.trim() ? "Respuesta enviada" : "Marcado como revisado"); setBusy(false); }}>
        {reply.trim() ? "Responder y marcar revisado" : "Marcar revisado"}
      </button>
    </div>
  );
}
function CheckinConfig({ c, onClose }) {
  const cur = checkinCfgOf(c);
  const [day, setDay] = useState(cur.day);
  const [qs, setQs] = useState(cur.questions);
  return (
    <Modal title="Check-in semanal" onClose={onClose} footer={<button className="btn btn-primary" onClick={async () => { const r = await run(saveCheckinCfg(c.userId, { day, questions: qs.map((q) => q.trim()).filter(Boolean) }), "Guardado"); if (!r?.error) onClose(); }}>Guardar</button>}>
      <span className="small muted">Día en que se le pide (recibe un aviso a las 6 p. m.)</span>
      <div className="day-pick">{DAYS.map((d, i) => <button key={i} aria-pressed={day === i} onClick={() => setDay(i)}>{d}</button>)}</div>
      <span className="small muted">Tus preguntas (además de peso, fotos, energía, sueño, estrés y hambre)</span>
      {qs.map((q, i) => (
        <div key={i} className="row gap-sm">
          <input className="input grow" value={q} aria-label={`Pregunta ${i + 1}`} onChange={(e) => setQs(qs.map((x, k) => (k === i ? e.target.value : x)))} />
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setQs(qs.filter((_, k) => k !== i))} aria-label={`Quitar pregunta ${i + 1}`}><Icon name="trash" size={16} /></button>
        </div>
      ))}
      {qs.length < 6 && <button className="btn btn-quiet btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setQs([...qs, ""])}><Icon name="plus" size={15} />Agregar pregunta</button>}
    </Modal>
  );
}

/* ---------- hábitos ---------- */
export function HabitsTab({ clientId }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const [list, setList] = useState(habitsOf(c));
  const dirty = JSON.stringify(list) !== JSON.stringify(habitsOf(c));
  const days = Array.from({ length: 14 }, (_, i) => todayKey(addDays(new Date(), -13 + i)));
  const set = (i, k, v) => setList(list.map((h, j) => (j === i ? { ...h, [k]: v } : h)));
  return (
    <>
      <section className="panel">
        <div className="panel-head"><h2>Últimos 14 días</h2><span className="small muted">{habitCompliance(c, 14) ?? 0}% cumplido</span></div>
        <div className="habit-table-wrap">
          <table className="habit-table">
            <thead><tr><th>Hábito</th>{days.map((d) => <th key={d} title={d}>{DAYS[new Date(`${d}T12:00`).getDay()]}</th>)}</tr></thead>
            <tbody>
              {habitsOf(c).map((h) => (
                <tr key={h.id}><td className="strong">{h.name}</td>{days.map((d) => { const v = c.habitLog?.[d]?.[h.id]; const ok = habitDone(h, v); return <td key={d}><span className={`hcell ${ok ? "ok" : v ? "part" : ""}`} title={v != null ? `${v} ${h.unit}` : "sin registro"} /></td>; })}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel panel-pad stack">
        <div className="row spread"><h2 className="section-title">Hábitos asignados</h2><button className="btn btn-quiet btn-sm" onClick={() => setList(DEFAULT_HABITS)}>Usar los básicos</button></div>
        {list.map((h, i) => (
          <div key={h.id} className="habit-edit">
            <input className="input" value={h.name} aria-label="Nombre" onChange={(e) => set(i, "name", e.target.value)} placeholder="Nombre" />
            <select className="input" value={h.kind} aria-label="Tipo" onChange={(e) => set(i, "kind", e.target.value)}><option value="count">Con meta</option><option value="check">Sí / no</option></select>
            {h.kind === "count" ? <>
              <input className="input" inputMode="decimal" value={h.target} aria-label="Meta" onChange={(e) => set(i, "target", +e.target.value || 0)} />
              <input className="input" value={h.unit} aria-label="Unidad" onChange={(e) => set(i, "unit", e.target.value)} placeholder="unidad" />
            </> : <span className="small muted" style={{ gridColumn: "span 2" }}>Lo marca al cumplirlo</span>}
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label={`Quitar ${h.name}`}><Icon name="trash" size={16} /></button>
          </div>
        ))}
        {list.length < 8 && <button className="btn btn-quiet btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setList([...list, { id: newUid(), name: "", target: 1, unit: "", kind: "check" }])}><Icon name="plus" size={15} />Agregar hábito</button>}
        {dirty && <button className="btn btn-primary" onClick={() => list.some((h) => !h.name.trim()) ? toast("Ponle nombre a cada hábito", "alert") : run(saveHabits(clientId, list.map((h) => ({ ...h, name: h.name.trim(), target: +h.target || 0 }))), "Hábitos guardados")}>Guardar hábitos</button>}
      </section>
    </>
  );
}

/* ---------- nutrición ---------- */
const EMPTY_PLAN = { kcal: 2200, protein: 150, carbs: 250, fat: 70, water: 8, meals: [], notes: "" };
export function NutritionTab({ clientId }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const [p, setP] = useState(c.nutrition || null);
  const dirty = JSON.stringify(p) !== JSON.stringify(c.nutrition || null);
  const set = (k, v) => setP({ ...p, [k]: v });
  const fromMacros = p ? Math.round(p.protein * 4 + p.carbs * 4 + p.fat * 9) : 0;
  const days = Array.from({ length: 7 }, (_, i) => todayKey(addDays(new Date(), -i)));
  if (!p) return <section className="panel"><Empty icon="target" title="Sin plan de nutrición" text="Define calorías, macros y las comidas del día. Tu asesorado las marca y puede registrar lo que come con foto." action={<button className="btn btn-primary" onClick={() => setP(EMPTY_PLAN)}>Crear plan</button>} /></section>;
  return (
    <>
      <section className="panel panel-pad stack">
        <h2 className="section-title">Metas diarias</h2>
        <div className="macro-edit">
          {[["kcal", "Calorías"], ["protein", "Proteína (g)"], ["carbs", "Carbohidratos (g)"], ["fat", "Grasas (g)"], ["water", "Agua (vasos)"]].map(([k, l]) => (
            <Field key={k} label={l} id={`nu-${k}`}><input id={`nu-${k}`} className="input num" inputMode="numeric" value={p[k]} onChange={(e) => /^\d{0,5}$/.test(e.target.value) && set(k, +e.target.value || 0)} /></Field>
          ))}
        </div>
        {Math.abs(fromMacros - p.kcal) > 150 && <span className="small warn-ink">Los macros suman {fromMacros} kcal ({fromMacros > p.kcal ? "más" : "menos"} que la meta). <button className="btn-text" onClick={() => set("kcal", fromMacros)}>Usar {fromMacros}</button></span>}
      </section>
      <section className="panel panel-pad stack">
        <h2 className="section-title">Comidas del día</h2>
        {p.meals.map((m, i) => (
          <div key={m.id} className="meal-edit">
            <input className="input" value={m.name} aria-label="Comida" placeholder="Desayuno" onChange={(e) => set("meals", p.meals.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input className="input" value={m.desc} aria-label="Qué come" placeholder="Avena, 3 huevos, plátano" onChange={(e) => set("meals", p.meals.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} />
            <input className="input num" inputMode="numeric" value={m.kcal || ""} aria-label="Calorías" placeholder="kcal" onChange={(e) => /^\d{0,4}$/.test(e.target.value) && set("meals", p.meals.map((x, j) => (j === i ? { ...x, kcal: +e.target.value || 0 } : x)))} />
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => set("meals", p.meals.filter((_, j) => j !== i))} aria-label={`Quitar ${m.name}`}><Icon name="trash" size={16} /></button>
          </div>
        ))}
        {p.meals.length < 10 && <button className="btn btn-quiet btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => set("meals", [...p.meals, { id: newUid(), name: ["Desayuno", "Almuerzo", "Merienda", "Cena"][p.meals.length] || "", desc: "", kcal: 0 }])}><Icon name="plus" size={15} />Agregar comida</button>}
        <Field label="Indicaciones" id="nu-notes"><textarea id="nu-notes" className="input" rows={2} value={p.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ej. Toma 2 L de agua antes de las 4 p. m." /></Field>
        <div className="row gap-sm wrap">
          {dirty && <button className="btn btn-primary" onClick={() => p.meals.some((m) => !m.name.trim()) ? toast("Ponle nombre a cada comida", "alert") : run(saveNutrition(clientId, p), "Plan de nutrición guardado")}>Guardar plan</button>}
          {c.nutrition && <button className="btn btn-quiet" onClick={() => run(saveNutrition(clientId, null), "Plan quitado").then(() => setP(null))}>Quitar plan</button>}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Lo que registró</h2><span className="small muted">últimos 7 días</span></div>
        <div className="list">
          {days.map((d) => {
            const day = c.foodLog?.[d];
            const meals = (c.nutrition?.meals || []).filter((m) => day?.meals?.[m.id]).length;
            const kcal = (c.nutrition?.meals || []).filter((m) => day?.meals?.[m.id]).reduce((t, m) => t + (+m.kcal || 0), 0) + (day?.entries || []).reduce((t, e) => t + (+e.kcal || 0), 0);
            return (
              <div key={d} className="list-row" style={{ alignItems: "flex-start" }}>
                <span className="strong" style={{ width: 84, flexShrink: 0 }}>{date(`${d}T12:00`, { weekday: "short", day: "numeric" })}</span>
                <span className="grow small">
                  <span className="muted">{meals}/{c.nutrition?.meals?.length || 0} comidas · {day?.water || 0} vasos · {kcal} kcal</span>
                  {(day?.entries || []).length > 0 && <span className="food-strip">{day.entries.map((e) => e.photoUrl ? <img key={e.id} src={e.photoUrl} alt={e.name} title={e.name} /> : <span key={e.id} className="tag">{e.name}</span>)}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

/* ---------- programa por fases ---------- */
export function ProgramTab({ clientId }) {
  const db = useDB();
  const { me } = useApp();
  const c = clientById(db, clientId);
  const templates = db.templates.filter((t) => t.coachId === me.id);
  const [phases, setPhases] = useState(c.program?.phases || []);
  const [start, setStart] = useState(() => (c.program?.startedAt || new Date().toISOString()).slice(0, 10));
  const info = phaseInfo(c);
  const dirty = JSON.stringify(phases) !== JSON.stringify(c.program?.phases || []) || start !== (c.program?.startedAt || "").slice(0, 10);
  const sources = useMemo(() => [
    ...(c.routine ? [{ id: "__actual", name: `Rutina actual: ${c.routine.name || "sin nombre"}`, routine: c.routine }] : []),
    ...templates.map((t) => ({ id: t.id, name: `Plantilla: ${t.name}`, routine: t })),
  ], [c.routine, templates]);
  const add = () => {
    const s = sources[0];
    if (!s) return toast("Primero crea una rutina o una plantilla", "alert");
    setPhases([...phases, { id: newUid(), name: ["Adaptación", "Hipertrofia", "Fuerza", "Descarga"][phases.length] || `Fase ${phases.length + 1}`, weeks: 4, routine: stripIds(s.routine), source: s.id }]);
  };
  const set = (i, k, v) => setPhases(phases.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  let t = new Date(`${start}T08:00:00`);
  return (
    <section className="panel panel-pad stack">
      <div className="row spread wrap gap-sm">
        <div><h2 className="section-title">Programa por fases</h2><p className="small muted">Cada fase usa su propia rutina. Al terminar sus semanas, la siguiente pasa a ser la rutina actual sola.</p></div>
        {info && <Pill tone="info">Fase {info.index + 1} de {info.total} · semana {info.week} de {info.weeks}</Pill>}
      </div>
      <Field label="Empieza el" id="pg-start"><input id="pg-start" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} style={{ maxWidth: 220 }} /></Field>
      {phases.length === 0 && <div className="muted small">Agrega la primera fase. Ej.: 4 semanas de hipertrofia y 4 de fuerza.</div>}
      <div className="phase-list">
        {phases.map((p, i) => {
          const from = t; t = addDays(t, 7 * (+p.weeks || 1));
          return (
            <div key={p.id} className={`phase ${info?.index === i ? "on" : ""}`}>
              <div className="row spread"><span className="kicker">Fase {i + 1} · {date(from, { day: "numeric", month: "short" })} – {date(addDays(t, -1), { day: "numeric", month: "short" })}</span>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setPhases(phases.filter((_, j) => j !== i))} aria-label={`Quitar fase ${i + 1}`}><Icon name="trash" size={16} /></button></div>
              <div className="phase-fields">
                <input className="input" value={p.name} aria-label="Nombre de la fase" onChange={(e) => set(i, "name", e.target.value)} />
                <select className="input" value={p.weeks} aria-label="Semanas" onChange={(e) => set(i, "weeks", +e.target.value)}>{Array.from({ length: 12 }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "semana" : "semanas"}</option>)}</select>
                <select className="input" value={p.source || ""} aria-label="Rutina" onChange={(e) => { const s = sources.find((x) => x.id === e.target.value); if (s) setPhases(phases.map((x, j) => (j === i ? { ...x, routine: stripIds(s.routine), source: s.id } : x))); }}>
                  {!p.source && <option value="">{p.routine?.name || "Rutina guardada"}</option>}
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <span className="tiny muted">{p.routine?.days?.length || 0} días · {(p.routine?.days || []).map((d) => d.name).join(", ")}</span>
            </div>
          );
        })}
      </div>
      <div className="row gap-sm wrap">
        {phases.length < 8 && <button className="btn btn-quiet" onClick={add}><Icon name="plus" size={16} />Agregar fase</button>}
        {dirty && phases.length > 0 && <button className="btn btn-primary" onClick={() => run(saveProgram(clientId, { phases: phases.map(({ source, ...p }) => p), startedAt: new Date(`${start}T08:00:00`).toISOString() }), "Programa guardado: la fase en curso es su rutina actual")}>Guardar programa</button>}
        {c.program && <button className="btn btn-quiet" onClick={() => run(saveProgram(clientId, null), "Programa quitado (su rutina actual se queda)").then(() => setPhases([]))}>Quitar programa</button>}
      </div>
    </section>
  );
}
const stripIds = (r) => ({ name: r.name || "", goal: r.goal || "", frequency: r.frequency || 3, notes: r.notes || "", days: (r.days || []).map((d) => ({ ...d, id: newUid(), exercises: d.exercises.map((e) => ({ ...e, uid: newUid() })) })) });

/* ---------- automatizaciones y cobro en línea ---------- */
const RULES = [
  { kind: "welcome", title: "Bienvenida", when: "Al crear un asesorado", desc: "Le escribe por ti con este mensaje.", text: true },
  { kind: "checkin", title: "Pedir el check-in semanal", when: "El día de su check-in, desde la hora indicada", desc: "Aviso al celular si no lo envió en los últimos 5 días.", hour: true },
  { kind: "inactive", title: "Avisarme si deja de entrenar", when: "Tras varios días sin entrenar", desc: "Te llega un aviso y aparece en «Necesitan atención».", days: true },
  { kind: "pr", title: "Felicitar récords", when: "Cuando hace un récord nuevo", desc: "Le escribe por ti con este mensaje y el récord.", text: true },
  { kind: "phase", title: "Cambiar de fase", when: "Al cumplirse las semanas de una fase", desc: "La siguiente fase pasa a ser su rutina y les avisa a los dos." },
];
const DEFAULTS = { welcome: { on: true, text: "¡Bienvenido/a! Ya tienes acceso. Completa tu cuestionario de inicio para armar tu programa." }, checkin: { on: true, day: 0, hour: 18 }, inactive: { on: true, days: 4 }, pr: { on: true, text: "¡Nuevo récord! Así se progresa, sigue así." }, phase: { on: true } };
export function AutomationsPage() {
  const { me } = useApp();
  const db = useDB();
  const self = userById(db, me.id);
  const saved = Object.fromEntries((self?.automations || []).map((r) => [r.kind, r]));
  const [rules, setRules] = useState(() => Object.fromEntries(RULES.map((r) => [r.kind, { ...DEFAULTS[r.kind], ...(saved[r.kind] || {}), kind: r.kind }])));
  const set = (k, patch) => setRules({ ...rules, [k]: { ...rules[k], ...patch } });
  const b = self?.billing || {};
  const [bill, setBill] = useState({ payLink: b.payLink || "", payLabel: b.payLabel || "", instructions: b.instructions || "", plans: b.plans || [] });
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-head"><div><h1>Automatizaciones</h1><p className="muted">Reglas «cuando pase X, hacer Y» que trabajan por ti.</p></div></div>
      <section className="panel">
        <div className="list">
          {RULES.map((r) => {
            const v = rules[r.kind];
            return (
              <div key={r.kind} className="list-row rule-row">
                <div className="grow stack" style={{ gap: 6 }}>
                  <span className="rule-when">{r.when}</span>
                  <strong>{r.title}</strong>
                  <span className="small muted">{r.desc}</span>
                  {v.on && r.text && <textarea className="input" rows={2} value={v.text || ""} aria-label={`Mensaje de ${r.title}`} onChange={(e) => set(r.kind, { text: e.target.value })} />}
                  {v.on && r.hour && <label className="small row gap-sm">Desde las <select className="input" style={{ width: 110 }} value={v.hour ?? 18} onChange={(e) => set(r.kind, { hour: +e.target.value })}>{Array.from({ length: 16 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{h}:00</option>)}</select></label>}
                  {v.on && r.days && <label className="small row gap-sm">Después de <select className="input" style={{ width: 110 }} value={v.days ?? 4} onChange={(e) => set(r.kind, { days: +e.target.value })}>{[2, 3, 4, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} días</option>)}</select></label>}
                </div>
                <label className="toggle" aria-label={r.title}><input type="checkbox" checked={!!v.on} onChange={(e) => set(r.kind, { on: e.target.checked })} /></label>
              </div>
            );
          })}
        </div>
        <div className="panel-pad"><button className="btn btn-primary" onClick={() => run(saveAutomations(Object.values(rules).map(({ kind, on, text, day, hour, days }) => ({ kind, on, ...(text != null ? { text } : {}), ...(day != null ? { day } : {}), ...(hour != null ? { hour } : {}), ...(days != null ? { days } : {}) }))), "Automatizaciones guardadas")}>Guardar reglas</button></div>
      </section>

      <section className="panel panel-pad stack">
        <div><h2 className="section-title">Cobro en línea</h2><p className="small muted">Pega tu enlace de pago (PayPhone, PayPal, Kushki, DeUna u otro). Tus asesorados verán «Pagar en línea» en cada cobro y podrán avisarte con su comprobante.</p></div>
        <div className="grid-2">
          <Field label="Enlace de pago" id="bl-link" hint="Debe empezar con https://"><input id="bl-link" className="input" value={bill.payLink} onChange={(e) => setBill({ ...bill, payLink: e.target.value.trim() })} placeholder="https://..." /></Field>
          <Field label="Nombre del medio" id="bl-label"><input id="bl-label" className="input" value={bill.payLabel} onChange={(e) => setBill({ ...bill, payLabel: e.target.value })} placeholder="PayPhone" /></Field>
        </div>
        <Field label="Indicaciones para transferencia (opcional)" id="bl-ins"><textarea id="bl-ins" className="input" rows={3} value={bill.instructions} onChange={(e) => setBill({ ...bill, instructions: e.target.value })} placeholder="Banco Pichincha · Ahorros 220... · a nombre de..." /></Field>
        <h3 className="section-title" style={{ fontSize: 16 }}>Tus planes</h3>
        {bill.plans.map((p, i) => (
          <div key={p.id} className="plan-edit">
            <input className="input" value={p.name} aria-label="Nombre del plan" placeholder="Online" onChange={(e) => setBill({ ...bill, plans: bill.plans.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <input className="input num" inputMode="decimal" value={p.price} aria-label="Precio" onChange={(e) => /^\d{0,5}([.,]\d{0,2})?$/.test(e.target.value) && setBill({ ...bill, plans: bill.plans.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(",", ".") } : x)) })} />
            <select className="input" value={p.period} aria-label="Periodo" onChange={(e) => setBill({ ...bill, plans: bill.plans.map((x, j) => (j === i ? { ...x, period: e.target.value } : x)) })}>{["mes", "trimestre", "semestre", "año", "única"].map((x) => <option key={x} value={x}>{x === "única" ? "pago único" : `por ${x}`}</option>)}</select>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setBill({ ...bill, plans: bill.plans.filter((_, j) => j !== i) })} aria-label={`Quitar ${p.name}`}><Icon name="trash" size={16} /></button>
          </div>
        ))}
        {bill.plans.length < 8 && <button className="btn btn-quiet btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setBill({ ...bill, plans: [...bill.plans, { id: newUid(), name: "", price: "", period: "mes" }] })}><Icon name="plus" size={15} />Agregar plan</button>}
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => bill.plans.some((p) => !p.name.trim()) ? toast("Ponle nombre a cada plan", "alert") : run(saveBilling({ ...bill, plans: bill.plans.map((p) => ({ ...p, name: p.name.trim(), price: +p.price || 0 })) }), "Cobro en línea guardado")}>Guardar cobro en línea</button>
        {bill.plans.length > 0 && <span className="tiny muted">Ejemplo: {bill.plans.map((p) => `${p.name || "Plan"} ${money(+p.price || 0)}${p.period === "única" ? "" : ` por ${p.period}`}`).join(" · ")}</span>}
      </section>
    </div>
  );
}
