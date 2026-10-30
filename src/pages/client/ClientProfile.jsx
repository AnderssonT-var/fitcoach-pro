import { useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, BrandMark, Field, toast, run } from "../../ui/kit";
import { ImageDrop } from "../../ui/inputs";
import { useApp } from "../../context";
import { brandOf, clientById, deleteMyReview, saveMyReview, updateProfile, useDB, userById } from "../../store/db";
import { avatarImage } from "../../lib/image";
import { shortDate } from "../../lib/format";
import { NotificationsPanel, PrivacyPanel, SecurityPanel } from "../shared/Account";

export default function ClientProfile() {
  const db = useDB();
  const { me } = useApp();
  const u = userById(db, me.id);
  const c = clientById(db, me.id);
  const coach = userById(db, c.coachId);
  const brand = brandOf(db, u);
  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="page-head"><div><h1>Mi perfil</h1><p>Tu foto y lo que tu entrenador necesita saber de ti.</p></div></div>
      <div className="split">
        <div className="stack-lg">
          <ProfileForm u={u} c={c} coachName={coach.name.split(" ")[0]} />
          <ReviewPanel review={db.reviews[0]} coachName={coach.name.split(" ")[0]} />
          <NotificationsPanel />
          <PrivacyPanel />
          <SecurityPanel />
        </div>
        <CoachCard coach={coach} brand={brand} />
      </div>
    </div>
  );
}

function ProfileForm({ u, c, coachName }) {
  const init = { name: u.name, phone: c.phone || "", birthYear: u.birthYear ?? "", bio: u.bio || "", injuries: u.injuries || "", body: u.body || "m" };
  const [f, setF] = useState(init);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  const year = new Date().getFullYear();

  async function photo(files) {
    try { run(updateProfile(u.id, { photo: await avatarImage(files[0]) }), "Foto de perfil actualizada", "user"); }
    catch (e) { toast(e.message, "alert"); }
  }
  function save() {
    if (!f.name.trim()) return toast("Escribe tu nombre", "alert");
    const by = f.birthYear === "" ? null : +f.birthYear;
    if (by && (by < 1920 || by > year - 10)) return toast("Revisa el año de nacimiento", "alert");
    run(updateProfile(u.id, { ...f, name: f.name.trim(), birthYear: by }), "Perfil guardado");
  }

  return (
    <section className="panel">
      <div className="panel-head"><h2>Tus datos</h2></div>
      <div className="panel-body stack">
        <div className="row wrap" style={{ gap: 16 }}>
          <Avatar name={u.name} id={u.id} size="lg" />
          <div className="row wrap gap-sm">
            <ImageDrop compact onFiles={photo} label={u.photo ? "Cambiar foto" : "Subir foto"} />
            {u.photo && <button className="btn btn-ghost btn-sm" onClick={() => { run(updateProfile(u.id, { photo: null }), "Foto quitada", "trash"); }}>Quitar</button>}
          </div>
        </div>
        <div className="form-grid">
          <div className="full"><Field label="Nombre" id="pp-name"><input id="pp-name" className="input" value={f.name} onChange={set("name")} /></Field></div>
          <Field label="Teléfono" id="pp-phone"><input id="pp-phone" className="input" type="tel" value={f.phone} onChange={set("phone")} /></Field>
          <div className="field">
            <span className="label">Silueta del mapa muscular</span>
            <div className="seg" role="group" aria-label="Silueta del mapa muscular">
              {[["m", "Hombre"], ["f", "Mujer"]].map(([k, l]) => <button key={k} type="button" aria-pressed={f.body === k} onClick={() => setF({ ...f, body: k })}>{l}</button>)}
            </div>
          </div>
          <Field label="Año de nacimiento" id="pp-by"><input id="pp-by" className="input num" type="number" min="1920" max={year - 10} value={f.birthYear} onChange={set("birthYear")} /></Field>
          <div className="full"><Field label="Sobre mí" id="pp-bio" hint="Tu objetivo, horarios, lo que te motiva.">
            <textarea id="pp-bio" className="textarea" rows={3} maxLength={300} value={f.bio} onChange={set("bio")} />
          </Field></div>
          <div className="full"><Field label="Lesiones o molestias" id="pp-inj" hint={`${coachName} lo tendrá en cuenta al armar tu rutina.`}>
            <textarea id="pp-inj" className="textarea" rows={2} maxLength={300} value={f.injuries} onChange={set("injuries")} placeholder="Ej.: me duele la rodilla al bajar escaleras" />
          </Field></div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          {dirty && <button className="btn btn-ghost" onClick={() => setF(init)}>Descartar</button>}
          <button className="btn btn-primary" disabled={!dirty} onClick={save}>Guardar</button>
        </div>
        <p className="tiny muted">Cliente desde {shortDate(c.joinedAt)} · {u.email}</p>
      </div>
    </section>
  );
}

function CoachCard({ coach, brand }) {
  const { go } = useApp();
  return (
    <section className="panel">
      <div className="panel-head">
        <div className="row gap-sm" style={{ minWidth: 0 }}>
          <BrandMark brand={brand} size={30} />
          <h2 className="ellipsis">{brand?.name || "Tu entrenador"}</h2>
        </div>
      </div>
      <div className="panel-body stack">
        <div className="row">
          <Avatar name={coach.name} id={coach.id} size="lg" />
          <div className="grow">
            <div className="section-title">{coach.name}</div>
            <div className="small muted">{[coach.headline, coach.years ? `${coach.years} años de experiencia` : "", coach.city].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        {coach.bio && <p className="ink2">{coach.bio}</p>}
        {coach.specialties?.length > 0 && <div className="row wrap gap-xs">{coach.specialties.map((t) => <span key={t} className="pill info">{t}</span>)}</div>}
        {coach.services?.length > 0 && (
          <div className="stack gap-xs">
            <span className="small strong">Tu plan incluye</span>
            {coach.services.map((t) => <span key={t} className="row gap-sm small ink2"><Icon name="check" size={15} stroke={2.4} />{t}</span>)}
          </div>
        )}
        {coach.certifications?.length > 0 && <p className="small muted">Certificaciones: {coach.certifications.join(", ")}</p>}
        <div className="row wrap gap-sm">
          <button className="btn btn-primary" onClick={() => go("mensajes")}><Icon name="chat" size={17} />Escribirle</button>
          {coach.instagram && <span className="small muted">{coach.instagram}</span>}
        </div>
      </div>
    </section>
  );
}

/** Reseña del asesorado: la aprueba su entrenador antes de salir en su página. */
function ReviewPanel({ review, coachName }) {
  const init = { rating: review?.rating || 5, text: review?.text || "", detail: review?.detail || "" };
  const [f, setF] = useState(init);
  const [editing, setEditing] = useState(!review);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  async function send() {
    if (f.text.trim().length < 10) return toast("Escribe al menos unas palabras sobre tu experiencia", "alert");
    setBusy(true);
    const r = await saveMyReview({ rating: f.rating, text: f.text.trim(), detail: f.detail.trim() });
    setBusy(false);
    if (r.error) return toast(r.error, "alert");
    setEditing(false);
    toast(`¡Gracias! ${coachName} la revisará antes de publicarla`, "heart");
  }
  async function remove() {
    if (!window.confirm("¿Borrar tu reseña? Si ya estaba publicada, se quita de la página.")) return;
    const r = await deleteMyReview();
    if (r.error) return toast(r.error, "alert");
    setF({ rating: 5, text: "", detail: "" }); setEditing(true);
    toast("Reseña borrada", "trash");
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Tu reseña</h2>
        {review && <span className={`pill ${review.status === "approved" ? "ok" : "warn"}`}>{review.status === "approved" ? "Publicada" : "Por aprobar"}</span>}
      </div>
      <div className="panel-body stack">
        {!editing && review ? (
          <>
            <div className="rv-stars static" aria-label={`${review.rating} de 5`}>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= review.rating ? "on" : ""}>★</span>)}</div>
            <p className="ink2" style={{ whiteSpace: "pre-wrap" }}>“{review.text}”</p>
            {review.detail && <span className="small strong" style={{ color: "var(--brand-dk, var(--blue-ink))" }}>{review.detail}</span>}
            <p className="small muted">{review.status === "approved" ? `Se ve en la página de ${coachName}. ¡Gracias por recomendarlo!` : `${coachName} la revisará antes de publicarla en su página.`}</p>
            <div className="row wrap gap-sm">
              <button className="btn btn-quiet btn-sm" onClick={() => setEditing(true)}><Icon name="pencil" size={15} />Editar</button>
              <button className="btn btn-ghost btn-sm" onClick={remove}>Borrar</button>
            </div>
          </>
        ) : (
          <>
            <p className="small muted">Cuéntale a otras personas cómo te va entrenando con {coachName}. Se publica en su página cuando la aprueba.</p>
            <div className="rv-stars" role="radiogroup" aria-label="Calificación">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} estrellas`} aria-pressed={f.rating >= n} onClick={() => setF({ ...f, rating: n })}>★</button>)}
            </div>
            <Field label="Tu experiencia" id="rv-text" hint={`${f.text.length}/700`}>
              <textarea id="rv-text" className="textarea" rows={4} maxLength={700} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Ej.: En 3 meses mejoré mi fuerza y me siento con más energía…" />
            </Field>
            <Field label="Tu resultado (opcional)" id="rv-detail">
              <input id="rv-detail" className="input" maxLength={70} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} placeholder="Ej.: -5 kg en 3 meses" />
            </Field>
            <p className="hint">Se muestra tu nombre y la inicial de tu apellido{review ? ". Si la editas, vuelve a revisión." : "."}</p>
            <div className="row wrap gap-sm" style={{ justifyContent: "flex-end" }}>
              {review && <button className="btn btn-ghost" onClick={() => { setF(init); setEditing(false); }}>Cancelar</button>}
              <button className="btn btn-primary" disabled={busy || (review && !dirty)} onClick={send}><Icon name="send" size={16} />{busy ? "Enviando…" : review ? "Enviar cambios" : "Enviar reseña"}</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
