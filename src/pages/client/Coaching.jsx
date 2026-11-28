/* Seguimiento del asesorado: rango con XP, hábitos, check-in semanal, cuestionario de inicio y nutrición. */
import { useState } from "react";
import Icon from "../../ui/Icon";
import { Empty, Field, Modal, run, toast } from "../../ui/kit";
import { ImageDrop } from "../../ui/inputs";
import { useApp } from "../../context";
import {
  addFoodEntry, clientById, deleteFoodEntry, logHabit, saveOnboarding, sendCheckin, setWater, toggleMeal, useDB, userById, workoutsOf,
} from "../../store/db";
import {
  checkinCfgOf, checkinDue, dayStreak, foodToday, habitStreak, habitsToday, lastCheckin, rankOf, todayKey, xpOf,
} from "../../lib/coaching";
import { progressImage } from "../../lib/image";
import { ago, date } from "../../lib/format";

/* ---------- rango, XP y racha ---------- */
export function RankCard({ c }) {
  const db = useDB();
  const ws = workoutsOf(db, c.userId);
  const r = rankOf(xpOf(c, ws));
  const streak = dayStreak(c, ws);
  return (
    <section className="panel rank-card">
      <span className={`rank-badge ${r.tier}`} aria-hidden="true"><Icon name="shield" size={24} /></span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ whiteSpace: "nowrap" }}><span className="kicker">Rango</span><strong className={`rank-name ${r.tier}`}>{r.name}</strong></div>
        <div className="progress" style={{ marginTop: 8 }} role="progressbar" aria-valuenow={Math.round(r.pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={r.next ? `Progreso hacia ${r.next}` : "Rango máximo"}>
          <i style={{ width: `${Math.round(r.pct * 100)}%` }} />
        </div>
        <div className="tiny muted num" style={{ marginTop: 5 }}>{r.next ? `${r.xp - r.from} / ${r.to - r.from} XP para ${r.next}` : `${r.xp} XP · rango máximo`}</div>
      </div>
      <div className="rank-streak">
        <strong className="num">{streak}</strong>
        <span>{streak === 1 ? "día racha" : "días racha"}</span>
      </div>
    </section>
  );
}

/* ---------- hábitos del día ---------- */
export function HabitsCard({ c }) {
  const today = todayKey();
  const { list, done, total } = habitsToday(c, today);
  const streak = habitStreak(c);
  const [edit, setEdit] = useState(null);
  const tap = (h) => (h.kind === "check" ? logHabit(today, h.id, h.done ? 0 : 1) : setEdit(h));
  return (
    <section className="panel panel-pad stack" style={{ gap: 12 }}>
      <div className="row spread">
        <h2 className="section-title">Hábitos de hoy</h2>
        <span className="small strong" style={{ color: done === total ? "var(--green-ink)" : "var(--ink-2)" }}>{done} de {total}{streak > 1 ? ` · ${streak} días seguidos` : ""}</span>
      </div>
      <div className="habit-grid">
        {list.map((h) => (
          <button key={h.id} className={`habit ${h.done ? "done" : ""}`} onClick={() => tap(h)} aria-pressed={h.done}
            aria-label={`${h.name}: ${h.kind === "check" ? (h.done ? "cumplido" : "pendiente") : `${h.value} de ${h.target} ${h.unit}`}`}>
            <span className="habit-box">{h.done && <Icon name="check" size={14} stroke={3.5} />}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="habit-name">{h.name}</span>
              <span className="habit-sub num">{h.kind === "check" ? (h.done ? "Cumplido" : "Toca al cumplirlo") : `${fmt(h.value)} / ${fmt(h.target)} ${h.unit}`}</span>
            </span>
          </button>
        ))}
      </div>
      {edit && <HabitValue habit={edit} value={list.find((x) => x.id === edit.id)?.value || 0} onClose={() => setEdit(null)} onSave={(v) => { logHabit(today, edit.id, v); setEdit(null); }} />}
    </section>
  );
}
const fmt = (n) => (+n >= 1000 ? (+n).toLocaleString("es-EC") : String(+n || 0));

function HabitValue({ habit, value, onClose, onSave }) {
  const [v, setV] = useState(String(value || ""));
  const step = habit.target >= 1000 ? 1000 : 1;
  return (
    <Modal title={habit.name} onClose={onClose} footer={<button className="btn btn-primary" onClick={() => onSave(+v || 0)}>Guardar</button>}>
      <Field label={`¿Cuánto llevas hoy? (meta: ${fmt(habit.target)} ${habit.unit})`} id="habit-v">
        <div className="row gap-sm">
          <button className="btn btn-quiet" onClick={() => setV(String(Math.max(0, (+v || 0) - step)))} aria-label="Menos">−</button>
          <input id="habit-v" className="input num" inputMode="decimal" value={v} onChange={(e) => /^\d{0,6}([.,]\d?)?$/.test(e.target.value) && setV(e.target.value.replace(",", "."))} style={{ textAlign: "center", fontSize: 22 }} />
          <button className="btn btn-quiet" onClick={() => setV(String((+v || 0) + step))} aria-label="Más">+</button>
        </div>
      </Field>
      <button className="btn btn-quiet btn-block" onClick={() => onSave(habit.target)}>Marcar meta cumplida</button>
    </Modal>
  );
}

/* ---------- aviso de check-in ---------- */
export function CheckinBanner({ c }) {
  const { go } = useApp();
  if (!checkinDue(c)) return null;
  return (
    <button className="panel banner-warn" onClick={() => go("checkin")}>
      <span className="ico-badge warn"><Icon name="note" size={18} /></span>
      <span className="grow" style={{ textAlign: "left" }}>
        <span className="strong" style={{ display: "block" }}>Check-in semanal pendiente</span>
        <span className="small muted">Peso, fotos y cómo te sentiste · 2 minutos · +50 XP</span>
      </span>
      <Icon name="right" size={18} />
    </button>
  );
}

/* ---------- cuestionario de inicio ---------- */
export function OnboardingPrompt({ c }) {
  const [open, setOpen] = useState(false);
  const [later, setLater] = useState(() => { try { return sessionStorage.getItem("vf-onb-later") === "1"; } catch { return false; } });
  if (c.onboarding || c.selfCoached || later) return null;
  return (
    <>
      <section className="panel panel-pad stack onb-card">
        <span className="kicker" style={{ color: "var(--blue-ink)" }}>Antes de empezar</span>
        <h2 className="section-title">Cuéntale a tu entrenador sobre ti</h2>
        <p className="small ink2">Tu objetivo, tus días disponibles, dónde entrenas y si tienes alguna molestia. Con eso arma tu programa.</p>
        <div className="row gap-sm wrap">
          <button className="btn btn-primary" onClick={() => setOpen(true)}>Responder (1 min)</button>
          <button className="btn btn-quiet" onClick={() => { setLater(true); try { sessionStorage.setItem("vf-onb-later", "1"); } catch { /* nada */ } }}>Luego</button>
        </div>
      </section>
      {open && <Onboarding c={c} onClose={() => setOpen(false)} />}
    </>
  );
}

const GOALS = [["Hipertrofia", "Ganar músculo"], ["Pérdida de grasa", "Definición"], ["Fuerza", "Más fuerza"], ["Salud general", "Moverme mejor"]];
const DAYS = ["D", "L", "M", "X", "J", "V", "S"];
export function Onboarding({ c, onClose }) {
  const o = c.onboarding || {};
  const [f, setF] = useState({
    goal: o.goal || c.goal || "Hipertrofia", experience: o.experience || "intermedio", days: o.days || [1, 3, 5], place: o.place || "gimnasio",
    injuries: o.injuries || "", notes: o.notes || "", weight: "", heightCm: c.heightCm ? String(c.heightCm) : "",
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    const r = await run(saveOnboarding({ ...f, weight: f.weight ? +f.weight : null, heightCm: f.heightCm ? +f.heightCm : null }), "¡Listo! Tu entrenador ya tiene tus respuestas");
    setBusy(false);
    if (!r?.error) onClose();
  }
  const steps = [
    <div key="g" className="stack">
      <span className="small muted">¿Qué quieres lograr?</span>
      <div className="choice-grid">
        {GOALS.map(([g, sub]) => (
          <button key={g} className={`choice ${f.goal === g ? "on" : ""}`} onClick={() => set("goal", g)} aria-pressed={f.goal === g}>
            <strong>{sub}</strong><span className="tiny muted">{g}</span>
          </button>
        ))}
      </div>
      <span className="small muted">Tu experiencia entrenando</span>
      <div className="seg" role="group" aria-label="Experiencia">
        {[["nuevo", "Recién empiezo"], ["intermedio", "Intermedio"], ["avanzado", "Avanzado"]].map(([k, l]) => <button key={k} aria-pressed={f.experience === k} onClick={() => set("experience", k)}>{l}</button>)}
      </div>
    </div>,
    <div key="d" className="stack">
      <span className="small muted">Días que puedes entrenar</span>
      <div className="day-pick" role="group" aria-label="Días">
        {DAYS.map((d, i) => <button key={i} aria-pressed={f.days.includes(i)} onClick={() => set("days", f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort())}>{d}</button>)}
      </div>
      <span className="small muted">¿Dónde entrenas?</span>
      <div className="chips">
        {[["gimnasio", "Gimnasio completo"], ["casa", "Casa con mancuernas"], ["peso-corporal", "Solo peso corporal"]].map(([k, l]) => <button key={k} className="chip" aria-pressed={f.place === k} onClick={() => set("place", k)}>{l}</button>)}
      </div>
      <div className="grid-2">
        <Field label="Peso (kg)" id="onb-w"><input id="onb-w" className="input" inputMode="decimal" value={f.weight} onChange={(e) => set("weight", e.target.value.replace(",", "."))} placeholder="Opcional" /></Field>
        <Field label="Estatura (cm)" id="onb-h"><input id="onb-h" className="input" inputMode="numeric" value={f.heightCm} onChange={(e) => set("heightCm", e.target.value)} placeholder="Opcional" /></Field>
      </div>
    </div>,
    <div key="i" className="stack">
      <Field label="Lesiones o molestias" id="onb-i" hint="Por ejemplo: molestia en el hombro derecho al hacer press."><textarea id="onb-i" className="input" rows={3} value={f.injuries} onChange={(e) => set("injuries", e.target.value)} /></Field>
      <Field label="Algo más que deba saber tu entrenador" id="onb-n"><textarea id="onb-n" className="input" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </div>,
  ];
  return (
    <Modal title="Cuestionario de inicio" onClose={onClose}
      footer={<>
        {step > 0 && <button className="btn btn-quiet" onClick={() => setStep(step - 1)}>Atrás</button>}
        {step < steps.length - 1 ? <button className="btn btn-primary" disabled={step === 1 && !f.days.length} onClick={() => setStep(step + 1)}>Continuar</button>
          : <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Enviando…" : "Enviar a mi entrenador"}</button>}
      </>}>
      <div className="steps" aria-label={`Paso ${step + 1} de ${steps.length}`}>{steps.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
      {steps[step]}
    </Modal>
  );
}

/* ---------- check-in semanal (página) ---------- */
const SCALES = [["energy", "Energía"], ["sleep", "Calidad de sueño"], ["stress", "Estrés"], ["hunger", "Hambre"]];
export function CheckinPage() {
  const db = useDB();
  const { me, go } = useApp();
  const c = clientById(db, me.id);
  const cfg = checkinCfgOf(c);
  const coach = userById(db, c.coachId);
  const last = lastCheckin(c);
  const [f, setF] = useState({ weight: "", waist: "", energy: 7, sleep: 7, stress: 5, hunger: 5, answers: cfg.questions.map(() => "") });
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function addPhotos(files) {
    const poses = ["Frente", "Perfil", "Espalda"];
    const list = [];
    for (const file of files.slice(0, 3 - photos.length)) list.push({ src: await progressImage(file), pose: poses[photos.length + list.length] || "Otra" });
    setPhotos([...photos, ...list]);
  }
  async function send() {
    if (photos.length && !me.photoConsent) return toast("Activa el permiso de fotos en «Mi perfil» para enviarlas.", "alert");
    setBusy(true);
    const r = await run(sendCheckin({
      weight: f.weight ? +f.weight : null, waist: f.waist ? +f.waist : null, energy: f.energy, sleep: f.sleep, stress: f.stress, hunger: f.hunger,
      answers: cfg.questions.map((q, i) => ({ q, a: f.answers[i] || "" })).filter((x) => x.a.trim()), photos,
    }), "Check-in enviado · +50 XP");
    setBusy(false);
    if (!r?.error) go("inicio");
  }
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div><span className="kicker">{last ? `Último: ${ago(last.date)}` : "El primero"}</span><h1>Check-in semanal</h1><p className="muted">{coach?.name.split(" ")[0]} lo revisa y te responde.</p></div>
      </div>
      <div className="grid-2">
        <section className="panel panel-pad"><Field label="Peso en ayunas (kg)" id="ci-w"><input id="ci-w" className="input big-input num" inputMode="decimal" value={f.weight} onChange={(e) => /^\d{0,3}([.,]\d?)?$/.test(e.target.value) && set("weight", e.target.value.replace(",", "."))} placeholder={last?.weight ? String(last.weight) : "—"} /></Field>
          {last?.weight && f.weight && <span className={`small strong ${+f.weight <= last.weight ? "ok-ink" : "warn-ink"}`}>{+f.weight - last.weight > 0 ? "+" : ""}{(+f.weight - last.weight).toFixed(1)} kg vs el anterior</span>}</section>
        <section className="panel panel-pad"><Field label="Cintura (cm)" id="ci-c"><input id="ci-c" className="input big-input num" inputMode="decimal" value={f.waist} onChange={(e) => /^\d{0,3}([.,]\d?)?$/.test(e.target.value) && set("waist", e.target.value.replace(",", "."))} placeholder={last?.waist ? String(last.waist) : "Opcional"} /></Field></section>
      </div>
      <section className="panel panel-pad stack">
        <div className="row spread"><h2 className="section-title">Fotos de progreso</h2><span className="tiny muted">Misma luz y hora · opcional</span></div>
        {photos.length > 0 && <div className="photo-row">{photos.map((p, i) => <figure key={i}><img src={p.src} alt={p.pose} /><figcaption>{p.pose}</figcaption><button className="btn btn-quiet btn-sm" onClick={() => setPhotos(photos.filter((_, k) => k !== i))}>Quitar</button></figure>)}</div>}
        {photos.length < 3 && <ImageDrop multiple onFiles={addPhotos} label="Agregar fotos (frente, perfil, espalda)" compact />}
      </section>
      <section className="panel panel-pad stack" style={{ gap: 16 }}>
        {SCALES.map(([k, l]) => (
          <div key={k}>
            <div className="row spread small strong"><span>{l}</span><span className={k === "stress" ? (f[k] >= 7 ? "warn-ink" : "ok-ink") : f[k] >= 7 ? "ok-ink" : "warn-ink"}>{f[k]}</span></div>
            <div className="scale" role="radiogroup" aria-label={l}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <button key={n} role="radio" aria-checked={f[k] === n} onClick={() => set(k, n)}>{n}</button>)}
            </div>
          </div>
        ))}
      </section>
      {cfg.questions.length > 0 && (
        <section className="panel panel-pad stack">
          {cfg.questions.map((q, i) => (
            <Field key={i} label={q} id={`ci-q${i}`}><textarea id={`ci-q${i}`} className="input" rows={2} value={f.answers[i]} onChange={(e) => set("answers", f.answers.map((a, k) => (k === i ? e.target.value : a)))} /></Field>
          ))}
        </section>
      )}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={send}>{busy ? "Enviando…" : "Enviar check-in · +50 XP"}</button>
      {(c.checkins || []).length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Tus check-ins</h2></div>
          <div className="list">
            {[...c.checkins].reverse().slice(0, 8).map((x) => (
              <div key={x.id} className="list-row" style={{ alignItems: "flex-start" }}>
                <div className="grow">
                  <div className="strong">{date(x.date)}{x.weight ? ` · ${x.weight} kg` : ""}</div>
                  <div className="tiny muted">Energía {x.energy} · Sueño {x.sleep} · Estrés {x.stress} · Hambre {x.hunger}</div>
                  {x.reply && <div className="note-box small" style={{ marginTop: 6 }}><Icon name="chat" size={14} /><span><strong>{coach?.name.split(" ")[0]}:</strong> {x.reply}</span></div>}
                </div>
                <span className={`pill ${x.reviewedAt ? "ok" : ""}`}>{x.reviewedAt ? "Revisado" : "Enviado"}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- nutrición (página) ---------- */
export function NutritionPage() {
  const db = useDB();
  const { me, go } = useApp();
  const c = clientById(db, me.id);
  const coach = userById(db, c.coachId);
  const today = todayKey();
  const f = foodToday(c, today);
  const [log, setLog] = useState(false);
  if (!f.plan) {
    return (
      <div className="page" style={{ maxWidth: 760 }}>
        <div className="page-head"><div><h1>Nutrición</h1></div></div>
        <section className="panel"><Empty icon="target" title="Aún no tienes plan de nutrición" text={`${coach?.name.split(" ")[0] || "Tu entrenador"} te lo asignará aquí. Mientras tanto puedes registrar lo que comes con una foto.`}
          action={<div className="row gap-sm wrap" style={{ justifyContent: "center" }}><button className="btn btn-primary" onClick={() => setLog(true)}><Icon name="camera" size={16} />Registrar comida</button><button className="btn btn-quiet" onClick={() => go("mensajes")}>Pedir mi plan</button></div>} /></section>
        <FoodEntries entries={f.entries} />
        {log && <FoodLog date={today} onClose={() => setLog(false)} />}
      </div>
    );
  }
  const p = f.plan;
  const left = Math.max(0, p.kcal - f.kcal);
  const pct = p.kcal ? Math.min(1, f.kcal / p.kcal) : 0;
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head"><div><span className="kicker">Plan de {coach?.name.split(" ")[0]}</span><h1>Nutrición</h1></div></div>
      <section className="panel panel-pad nutri-head">
        <div className="ring" style={{ "--p": pct }} role="img" aria-label={`${f.kcal} de ${p.kcal} kcal`}>
          <div><strong className="num">{left}</strong><span>kcal restantes</span></div>
        </div>
        <div className="stack grow" style={{ gap: 10 }}>
          <Macro label="Proteína" now={f.protein} goal={p.protein} unit="g" tone="green" />
          <Macro label="Carbohidratos" now={null} goal={p.carbs} unit="g" tone="teal" />
          <Macro label="Grasas" now={null} goal={p.fat} unit="g" tone="orange" />
          <span className="tiny muted">Meta diaria: {p.kcal} kcal · {f.kcal} consumidas</span>
        </div>
      </section>
      <button className="btn btn-primary btn-lg btn-block" onClick={() => setLog(true)}><Icon name="camera" size={18} />Registrar comida con foto</button>
      {f.meals.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Comidas del plan</h2></div>
          <div className="list">
            {f.meals.map((m) => (
              <button key={m.id} className="list-row" onClick={() => toggleMeal(today, m.id, !m.done)} aria-pressed={m.done} style={{ width: "100%", textAlign: "left" }}>
                <span className={`habit-box ${m.done ? "on" : ""}`}>{m.done && <Icon name="check" size={14} stroke={3.5} />}</span>
                <span className="grow"><span className="strong" style={{ display: "block" }}>{m.name}</span><span className="small muted">{m.desc}</span></span>
                {m.kcal > 0 && <span className="small muted num">{m.kcal} kcal</span>}
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="panel panel-pad row">
        <div className="grow"><div className="strong">Agua</div><div className="small muted">{f.water} de {p.water || 8} vasos</div></div>
        <div className="water" aria-hidden="true">{Array.from({ length: p.water || 8 }, (_, i) => <i key={i} className={i < f.water ? "on" : ""} />)}</div>
        <button className="btn btn-quiet btn-icon" onClick={() => setWater(today, Math.max(0, f.water - 1))} aria-label="Quitar un vaso">−</button>
        <button className="btn btn-quiet btn-icon" onClick={() => setWater(today, f.water + 1)} aria-label="Sumar un vaso">+</button>
      </section>
      {p.notes && <div className="note-box small"><Icon name="note" size={16} /><span><strong>{coach?.name.split(" ")[0]}:</strong> {p.notes}</span></div>}
      <FoodEntries entries={f.entries} />
      {log && <FoodLog date={today} onClose={() => setLog(false)} />}
    </div>
  );
}
function Macro({ label, now, goal, unit, tone }) {
  const pct = now != null && goal ? Math.min(100, Math.round((now / goal) * 100)) : null;
  return (
    <div>
      <div className="row spread small strong"><span>{label}</span><span className="muted num">{now != null ? `${now} / ` : ""}{goal} {unit}</span></div>
      <div className={`progress ${tone}`} style={{ marginTop: 5 }}><i style={{ width: `${pct ?? 100}%`, opacity: pct == null ? 0.35 : 1 }} /></div>
    </div>
  );
}
function FoodEntries({ entries }) {
  if (!entries.length) return null;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Registrado hoy</h2></div>
      <div className="list">
        {entries.map((e) => (
          <div key={e.id} className="list-row">
            {e.photoUrl ? <img src={e.photoUrl} alt="" className="food-thumb" /> : <span className="ico-badge"><Icon name="target" size={18} /></span>}
            <span className="grow"><span className="strong" style={{ display: "block" }}>{e.name}</span><span className="small muted">{[e.kcal ? `${e.kcal} kcal` : null, e.protein ? `${e.protein} g proteína` : null].filter(Boolean).join(" · ") || ago(e.at)}</span></span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => run(deleteFoodEntry(e.id), "Borrado", "trash")} aria-label={`Borrar ${e.name}`}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}
function FoodLog({ date: day, onClose }) {
  const [f, setF] = useState({ name: "", kcal: "", protein: "", photo: null });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await run(addFoodEntry({ date: day, name: f.name, kcal: f.kcal ? +f.kcal : null, protein: f.protein ? +f.protein : null, photo: f.photo }), "Comida registrada");
    setBusy(false);
    if (!r?.error) onClose();
  }
  return (
    <Modal title="Registrar comida" onClose={onClose} footer={<button className="btn btn-primary" disabled={busy || !f.name.trim()} onClick={save}>{busy ? "Guardando…" : "Guardar"}</button>}>
      {f.photo ? <img src={f.photo} alt="Foto de la comida" style={{ width: "100%", borderRadius: 14, maxHeight: 260, objectFit: "cover" }} />
        : <ImageDrop onFiles={async ([file]) => { const src = await progressImage(file); setF((x) => ({ ...x, photo: src })); }} label="Tomar o elegir foto" />}
      <Field label="¿Qué comiste?" id="fl-n"><input id="fl-n" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej. Arroz con pollo y ensalada" /></Field>
      <div className="grid-2">
        <Field label="Calorías (opcional)" id="fl-k"><input id="fl-k" className="input" inputMode="numeric" value={f.kcal} onChange={(e) => /^\d{0,4}$/.test(e.target.value) && setF({ ...f, kcal: e.target.value })} /></Field>
        <Field label="Proteína en g (opcional)" id="fl-p"><input id="fl-p" className="input" inputMode="numeric" value={f.protein} onChange={(e) => /^\d{0,3}$/.test(e.target.value) && setF({ ...f, protein: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
