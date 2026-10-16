import { useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, BrandMark, Field, toast } from "../../ui/kit";
import { ImageDrop } from "../../ui/inputs";
import { useApp } from "../../context";
import { brandOf, clientById, updateProfile, useDB, userById } from "../../store/db";
import { avatarImage } from "../../lib/image";
import { shortDate } from "../../lib/format";

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
        <ProfileForm u={u} c={c} coachName={coach.name.split(" ")[0]} />
        <CoachCard coach={coach} brand={brand} />
      </div>
    </div>
  );
}

function ProfileForm({ u, c, coachName }) {
  const init = { name: u.name, phone: c.phone || "", birthYear: u.birthYear ?? "", bio: u.bio || "", injuries: u.injuries || "" };
  const [f, setF] = useState(init);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  const year = new Date().getFullYear();

  async function photo(files) {
    try { updateProfile(u.id, { photo: await avatarImage(files[0]) }); toast("Foto de perfil actualizada", "user"); }
    catch (e) { toast(e.message, "alert"); }
  }
  function save() {
    if (!f.name.trim()) return toast("Escribe tu nombre", "alert");
    const by = f.birthYear === "" ? null : +f.birthYear;
    if (by && (by < 1920 || by > year - 10)) return toast("Revisa el año de nacimiento", "alert");
    updateProfile(u.id, { ...f, name: f.name.trim(), birthYear: by });
    toast("Perfil guardado");
  }

  return (
    <section className="panel">
      <div className="panel-head"><h2>Tus datos</h2></div>
      <div className="panel-body stack">
        <div className="row wrap" style={{ gap: 16 }}>
          <Avatar name={u.name} id={u.id} size="lg" />
          <div className="row wrap gap-sm">
            <ImageDrop compact onFiles={photo} label={u.photo ? "Cambiar foto" : "Subir foto"} />
            {u.photo && <button className="btn btn-ghost btn-sm" onClick={() => { updateProfile(u.id, { photo: null }); toast("Foto quitada", "trash"); }}>Quitar</button>}
          </div>
        </div>
        <div className="form-grid">
          <div className="full"><Field label="Nombre" id="pp-name"><input id="pp-name" className="input" value={f.name} onChange={set("name")} /></Field></div>
          <Field label="Teléfono" id="pp-phone"><input id="pp-phone" className="input" type="tel" value={f.phone} onChange={set("phone")} /></Field>
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
