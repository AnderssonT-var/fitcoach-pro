import { useEffect, useMemo, useState } from "react";
import Icon from "../../ui/Icon";
import { Confirm, Empty, Field, Modal, toast, run } from "../../ui/kit";
import { ImageDrop } from "../../ui/inputs";
import { LineChart } from "../../ui/charts";
import { useApp } from "../../context";
import {
  addMeasurement, addNote, addPhotos, clientById, deleteMeasurement, deleteNote, deletePhoto, updateNote, useDB, userById,
} from "../../store/db";
import { ago, date, kg, shortDate } from "../../lib/format";
import { progressImage } from "../../lib/image";

/* ============================================================
   Medidas corporales
   ============================================================ */
export const METRICS = [
  { k: "weight", label: "Peso", unit: "kg", lowerIsBetter: true },
  { k: "fat", label: "% grasa", unit: "%", lowerIsBetter: true },
  { k: "waist", label: "Cintura", unit: "cm", lowerIsBetter: true },
  { k: "hip", label: "Cadera", unit: "cm" },
  { k: "chest", label: "Pecho", unit: "cm" },
  { k: "arm", label: "Brazo", unit: "cm" },
  { k: "thigh", label: "Muslo", unit: "cm" },
];
const fmt = (v, unit) => (v == null ? "—" : `${kg(v)}${unit === "%" ? " %" : ` ${unit}`}`);

export function Measurements({ clientId, canEdit }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const first = userById(db, clientId).name.split(" ")[0];
  const rows = c.measurements || [];
  const [metric, setMetric] = useState("waist");
  const [add, setAdd] = useState(false);
  const [del, setDel] = useState(null);
  const m = METRICS.find((x) => x.k === metric);
  const series = rows.filter((r) => r[metric] != null);
  const delta = series.length > 1 ? series.at(-1)[metric] - series[0][metric] : null;
  const good = delta != null && (m.lowerIsBetter ? delta < 0 : delta > 0);

  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>Medidas corporales</h2><div className="small muted">{rows.length ? `${rows.length} registros · último ${shortDate(rows.at(-1).date)}` : "Sin registros"}</div></div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}><Icon name="plus" size={15} />Registrar medidas</button>}
      </div>
      {rows.length === 0 ? (
        <Empty icon="scale" title="Aún no hay medidas" text={canEdit ? `Registra peso, % de grasa y perímetros de ${first} para ver su evolución.` : "Tu entrenador registrará aquí tus medidas."} />
      ) : (
        <>
          <div className="panel-body stack">
            <div className="chips" role="group" aria-label="Medida a graficar">
              {METRICS.map((x) => <button key={x.k} className="chip" aria-pressed={metric === x.k} onClick={() => setMetric(x.k)}>{x.label}</button>)}
            </div>
            {series.length > 1 ? (
              <>
                <div className="row wrap gap-sm small">
                  <span className="display num" style={{ fontSize: 24 }}>{fmt(series.at(-1)[metric], m.unit)}</span>
                  <span className={good ? "strong" : "muted"} style={good ? { color: "var(--green-ink)" } : null}>
                    {delta > 0 ? "+" : ""}{kg(delta)} {m.unit} desde {shortDate(series[0].date)}
                  </span>
                </div>
                <div style={{ maxWidth: 620 }}><LineChart points={series.map((r) => ({ label: shortDate(r.date), value: r[metric] }))} format={(v) => kg(Math.round(v * 10) / 10)} label={`Evolución de ${m.label}`} /></div>
              </>
            ) : <p className="small muted">Con dos registros de {m.label.toLowerCase()} o más se dibuja la evolución.</p>}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Fecha</th>{METRICS.map((x) => <th key={x.k}>{x.label}</th>)}{canEdit && <th aria-label="Acciones" />}</tr></thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.id}>
                    <td><div className="strong">{shortDate(r.date)}</div>{r.note && <div className="tiny muted" style={{ whiteSpace: "normal", maxWidth: 200 }}>{r.note}</div>}</td>
                    {METRICS.map((x) => <td key={x.k}>{r[x.k] != null ? kg(r[x.k]) : <span className="muted">—</span>}</td>)}
                    {canEdit && <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDel(r)} aria-label={`Eliminar medidas del ${shortDate(r.date)}`}><Icon name="trash" size={15} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ padding: "8px 20px 14px" }}>Peso en kg, perímetros en cm.</p>
        </>
      )}
      {add && <MeasureModal clientId={clientId} last={rows.at(-1)} onClose={() => setAdd(false)} />}
      {del && <Confirm title="Eliminar registro" confirmLabel="Eliminar" onClose={() => setDel(null)} onConfirm={() => { run(deleteMeasurement(clientId, del.id), "Registro eliminado", "trash"); }}
        text={`Se eliminan las medidas del ${date(del.date)}.`} />}
    </section>
  );
}

function MeasureModal({ clientId, last, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ date: today, note: "", ...Object.fromEntries(METRICS.map((m) => [m.k, ""])) });
  const any = METRICS.some((m) => f[m.k] !== "");
  return (
    <Modal title="Registrar medidas" onClose={onClose} footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!any} onClick={() => { run(addMeasurement(clientId, f), "Medidas registradas", "scale"); onClose(); }}>Guardar</button>
    </>}>
      <Field label="Fecha" id="ms-date"><input id="ms-date" className="input num" type="date" max={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {METRICS.map((m) => (
          <Field key={m.k} label={`${m.label} (${m.unit})`} id={`ms-${m.k}`} hint={last?.[m.k] != null ? `Antes: ${kg(last[m.k])}` : undefined}>
            <input id={`ms-${m.k}`} className="input num" type="number" inputMode="decimal" step="0.1" min="0" value={f[m.k]} onChange={(e) => setF({ ...f, [m.k]: e.target.value })} />
          </Field>
        ))}
      </div>
      <Field label="Nota (opcional)" id="ms-note"><input id="ms-note" className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ej.: medido en ayunas" /></Field>
      <p className="hint">Llena solo las medidas que tomaste. El peso también se suma a la gráfica de peso corporal.</p>
    </Modal>
  );
}

/* ============================================================
   Fotos de progreso
   ============================================================ */
const POSES = ["Frente", "Perfil", "Espalda", "Otra"];

export function Photos({ clientId, canUpload, canDelete }) {
  const db = useDB();
  const { me } = useApp();
  const c = clientById(db, clientId);
  const photos = c.photos || [];
  const [upload, setUpload] = useState(false);
  const [view, setView] = useState(null);
  const [compare, setCompare] = useState(false);
  const allowed = !!c.photoConsent;
  const first = (userById(db, clientId)?.name || "").split(" ")[0];
  canUpload = canUpload && allowed;
  const groups = useMemo(() => {
    const g = {};
    photos.forEach((p) => { const k = p.date.slice(0, 10); (g[k] ||= []).push(p); });
    return Object.entries(g).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [photos]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>Fotos de progreso</h2><div className="small muted">{photos.length ? `${photos.length} fotos · ${groups.length} ${groups.length === 1 ? "fecha" : "fechas"}` : "Sin fotos"}</div></div>
        <div className="row gap-sm">
          {photos.length > 1 && <button className="btn btn-quiet btn-sm" onClick={() => setCompare(true)}>Comparar</button>}
          {canUpload && <button className="btn btn-primary btn-sm" onClick={() => setUpload(true)}><Icon name="plus" size={15} />Subir fotos</button>}
        </div>
      </div>
      <div className="panel-body stack">
        {!allowed && (
          <div className="note-box small"><Icon name="lock" size={16} /><span>
            {me.role === "client"
              ? <>Las fotos de tu cuerpo son información sensible. Para guardarlas activa el permiso en <strong>Mi perfil → Privacidad</strong>; puedes retirarlo cuando quieras.</>
              : <>{first} no ha dado permiso para guardar fotos de su cuerpo. Puede activarlo desde «Mi perfil» en su app.</>}
          </span></div>
        )}
        {photos.length === 0 ? (
          <Empty icon="eye" title="Todavía no hay fotos" text={canUpload ? "Sube fotos de frente, perfil y espalda para comparar el antes y el después." : "Aquí aparecerán tus fotos de progreso."}
            action={canUpload && <button className="btn btn-primary" onClick={() => setUpload(true)}>Subir fotos</button>} />
        ) : groups.map(([day, list]) => (
          <div key={day} className="stack gap-sm">
            <div className="small strong">{date(list[0].date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
            <div className="photo-grid">
              {list.map((p) => (
                <button key={p.id} className="photo-tile" onClick={() => setView(p)} aria-label={`Ver foto ${p.pose} del ${shortDate(p.date)}`}>
                  <img src={p.src} alt="" loading="lazy" />
                  <span className="cap">{p.pose}{p.by === clientId && me.id !== clientId ? " · subida por el cliente" : ""}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {upload && <UploadModal clientId={clientId} onClose={() => setUpload(false)} />}
      {view && <Lightbox photos={photos} start={view} canDelete={canDelete} clientId={clientId} onClose={() => setView(null)} />}
      {compare && <CompareModal photos={photos} onClose={() => setCompare(false)} />}
    </section>
  );
}

function UploadModal({ clientId, onClose }) {
  const { me } = useApp();
  const today = new Date().toISOString().slice(0, 10);
  const [items, setItems] = useState([]);
  const [day, setDay] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFiles(files) {
    setBusy(true);
    const out = [];
    for (const [i, f] of files.slice(0, 6).entries()) {
      try { out.push({ src: await progressImage(f), pose: POSES[(items.length + i) % 3] }); }
      catch (e) { toast(e.message, "alert"); }
    }
    if (files.length > 6) toast("Se tomaron las primeras 6 fotos", "alert");
    setItems((x) => [...x, ...out].slice(0, 6));
    setBusy(false);
  }
  function save() {
    run(addPhotos(clientId, items.map((p) => ({ ...p, date: day, note })), me.id), items.length === 1 ? "Foto guardada" : `${items.length} fotos guardadas`, "check");
    onClose();
  }
  return (
    <Modal title="Subir fotos de progreso" onClose={onClose} wide footer={<>
      <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!items.length || busy} onClick={save}>{busy ? "Procesando…" : `Guardar ${items.length || ""} ${items.length === 1 ? "foto" : "fotos"}`}</button>
    </>}>
      <ImageDrop multiple onFiles={onFiles} label="Elegir fotos" hint="Hasta 6 a la vez. Se reducen para que carguen rápido." />
      {items.length > 0 && (
        <div className="photo-grid">
          {items.map((p, i) => (
            <div key={i} className="stack gap-sm">
              <div className="photo-tile" style={{ cursor: "default" }}><img src={p.src} alt={`Foto ${i + 1}`} /></div>
              <div className="row gap-xs">
                <label className="sr-only" htmlFor={`pose-${i}`}>Postura de la foto {i + 1}</label>
                <select id={`pose-${i}`} className="select" value={p.pose} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, pose: e.target.value } : x)))}>
                  {POSES.map((o) => <option key={o}>{o}</option>)}
                </select>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Quitar foto ${i + 1}`}><Icon name="x" size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="form-grid">
        <Field label="Fecha de las fotos" id="ph-date"><input id="ph-date" className="input num" type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        <Field label="Nota (opcional)" id="ph-note"><input id="ph-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: semana 6, en ayunas" /></Field>
      </div>
      <p className="hint">Las fotos solo las ven el entrenador y su asesorado.</p>
    </Modal>
  );
}

function Lightbox({ photos, start, canDelete, clientId, onClose }) {
  const [i, setI] = useState(Math.max(0, photos.findIndex((p) => p.id === start.id)));
  const [ask, setAsk] = useState(false);
  const p = photos[i];
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(photos.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [photos.length, onClose]);
  if (!p) return null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Foto de progreso" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <img src={p.src} alt={`${p.pose}, ${shortDate(p.date)}`} />
      <div className="row wrap" style={{ justifyContent: "center" }}>
        <button className="btn btn-quiet btn-icon" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Foto anterior"><Icon name="left" /></button>
        <span className="small" style={{ minWidth: 160, textAlign: "center" }}>{p.pose} · {date(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
        <button className="btn btn-quiet btn-icon" disabled={i === photos.length - 1} onClick={() => setI(i + 1)} aria-label="Foto siguiente"><Icon name="right" /></button>
        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => setAsk(true)}><Icon name="trash" size={15} />Eliminar</button>}
        <button className="btn btn-quiet btn-sm" onClick={onClose}>Cerrar</button>
      </div>
      {ask && <Confirm title="Eliminar foto" confirmLabel="Eliminar" onClose={() => setAsk(false)}
        onConfirm={() => { run(deletePhoto(clientId, p.id), "Foto eliminada", "trash"); if (photos.length <= 1) onClose(); else setI(Math.max(0, i - 1)); }}
        text="La foto se elimina para el entrenador y el asesorado." />}
    </div>
  );
}

function CompareModal({ photos, onClose }) {
  const chrono = [...photos].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = chrono.at(-1);
  const earliestSamePose = chrono.find((p) => p.pose === latest.pose && p.id !== latest.id) || chrono[0];
  const [a, setA] = useState(earliestSamePose.id);
  const [b, setB] = useState(latest.id);
  const A = photos.find((p) => p.id === a), B = photos.find((p) => p.id === b);
  const days = Math.round(Math.abs(new Date(B.date) - new Date(A.date)) / 86400000);
  const opt = (p) => <option key={p.id} value={p.id}>{shortDate(p.date)} · {p.pose}</option>;
  return (
    <Modal title="Antes y después" onClose={onClose} wide>
      <div className="compare">
        <figure>
          <label className="sr-only" htmlFor="cmp-a">Foto de antes</label>
          <select id="cmp-a" className="select" value={a} onChange={(e) => setA(e.target.value)}>{chrono.map(opt)}</select>
          <img src={A.src} alt={`Antes: ${A.pose}, ${shortDate(A.date)}`} />
        </figure>
        <figure>
          <label className="sr-only" htmlFor="cmp-b">Foto de después</label>
          <select id="cmp-b" className="select" value={b} onChange={(e) => setB(e.target.value)}>{chrono.map(opt)}</select>
          <img src={B.src} alt={`Después: ${B.pose}, ${shortDate(B.date)}`} />
        </figure>
      </div>
      <p className="small muted" style={{ textAlign: "center" }}>{days === 0 ? "Mismo día" : `${days} ${days === 1 ? "día" : "días"} entre las dos fotos`}</p>
    </Modal>
  );
}

/* ============================================================
   Notas privadas del entrenador
   ============================================================ */
export const NOTE_CATS = ["General", "Técnica", "Lesión", "Nutrición", "Pagos"];
const CAT_TONE = { General: "", Técnica: "info", Lesión: "bad", Nutrición: "ok", Pagos: "warn" };

export function Notes({ clientId }) {
  const db = useDB();
  const c = clientById(db, clientId);
  const first = userById(db, clientId).name.split(" ")[0];
  const [text, setText] = useState("");
  const [cat, setCat] = useState("General");
  const [filter, setFilter] = useState("Todas");
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const notes = [...(c.notes || [])].sort((a, b) => (b.pinned - a.pinned) || (new Date(b.at) - new Date(a.at)));
  const shown = notes.filter((n) => filter === "Todas" || n.category === filter);

  function save() {
    if (!text.trim()) return;
    run(addNote(clientId, { text, category: cat }));
    setText(""); toast("Nota guardada", "note");
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>Notas privadas</h2><div className="small muted row gap-xs"><Icon name="lock" size={13} />Solo tú las ves. {first} no tiene acceso.</div></div>
      </div>
      <div className="panel-body stack">
        <label className="sr-only" htmlFor="note-text">Nueva nota</label>
        <textarea id="note-text" className="textarea" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ej.: ${first} siente molestia en el hombro al hacer press militar`} />
        <div className="row spread wrap gap-sm">
          <div className="chips" role="group" aria-label="Categoría">
            {NOTE_CATS.map((x) => <button key={x} className="chip" aria-pressed={cat === x} onClick={() => setCat(x)}>{x}</button>)}
          </div>
          <button className="btn btn-primary" disabled={!text.trim()} onClick={save}>Guardar nota</button>
        </div>
      </div>
      {notes.length > 0 && (
        <div className="panel-body" style={{ paddingTop: 0 }}>
          <div className="tabs" role="tablist" aria-label="Filtrar notas">
            {["Todas", ...NOTE_CATS].map((x) => <button key={x} role="tab" className="tab" aria-selected={filter === x} onClick={() => setFilter(x)}>{x}</button>)}
          </div>
        </div>
      )}
      <div>
        {shown.length === 0 && <div className="panel-body muted small">{notes.length ? "No hay notas en esta categoría." : "Anota lesiones, ajustes de técnica o lo que hablaron en la última sesión."}</div>}
        {shown.map((n) => (
          <article key={n.id} className={`note-item ${n.pinned ? "pinned" : ""}`}>
            <div className="row gap-sm">
              <span className={`pill ${CAT_TONE[n.category] || ""}`}>{n.category}</span>
              {n.pinned && <span className="tiny strong" style={{ color: "var(--yellow-ink)" }}>Fijada</span>}
              <span className="tiny muted grow">{ago(n.at)}</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => run(updateNote(clientId, n.id, { pinned: !n.pinned }))} aria-pressed={n.pinned} aria-label={n.pinned ? "Desfijar nota" : "Fijar nota"} title={n.pinned ? "Desfijar" : "Fijar arriba"}><Icon name="target" size={16} /></button>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit({ id: n.id, text: n.text, category: n.category })} aria-label="Editar nota"><Icon name="pencil" size={15} /></button>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDel(n)} aria-label="Eliminar nota"><Icon name="trash" size={15} /></button>
            </div>
            {edit?.id === n.id ? (
              <div className="stack gap-sm">
                <label className="sr-only" htmlFor={`ed-${n.id}`}>Editar nota</label>
                <textarea id={`ed-${n.id}`} className="textarea" rows={3} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} />
                <div className="row spread wrap gap-sm">
                  <div className="chips">{NOTE_CATS.map((x) => <button key={x} className="chip" aria-pressed={edit.category === x} onClick={() => setEdit({ ...edit, category: x })}>{x}</button>)}</div>
                  <div className="row gap-sm">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" disabled={!edit.text.trim()} onClick={() => { run(updateNote(clientId, n.id, { text: edit.text.trim(), category: edit.category }), "Nota actualizada"); setEdit(null); }}>Guardar</button>
                  </div>
                </div>
              </div>
            ) : <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.text}</p>}
          </article>
        ))}
      </div>
      {del && <Confirm title="Eliminar nota" confirmLabel="Eliminar" onClose={() => setDel(null)} onConfirm={() => { run(deleteNote(clientId, del.id), "Nota eliminada", "trash"); }} text="La nota se elimina definitivamente." />}
    </section>
  );
}
