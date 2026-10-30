import { useState } from "react";
import Icon from "../../ui/Icon";
import { Avatar, BrandMark, CopyButton, Field, toast, run } from "../../ui/kit";
import { ImageDrop, TagInput } from "../../ui/inputs";
import { useApp } from "../../context";
import { clientsOf, updateBrand, updateProfile, useDB, userById } from "../../store/db";
import { avatarImage, logoImage } from "../../lib/image";
import { BRAND_COLORS } from "../../lib/brand";
import { apiBase, isNative } from "../../store/api";
import { NotificationsPanel, SecurityPanel } from "../shared/Account";
import SignupSettings from "./SignupSettings";

/** Enlace público de acceso con la marca del entrenador. */
export function brandUrl(slug) {
  const pub = (import.meta.env.VITE_PUBLIC_URL || "").replace(/\/+$/, "");
  if (pub) return `${pub}/#${slug}`;
  if (isNative()) return `${apiBase()}/#${slug}`;
  try { return `${window.location.origin}${window.location.pathname}#${slug}`; } catch { return `#${slug}`; }
}

export default function CoachProfile() {
  const db = useDB();
  const { me, go } = useApp();
  const u = userById(db, me.id);
  const clients = clientsOf(db, me.id).length;
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Perfil y marca</h1><p>Lo que ven tus asesorados: tu foto, tu presentación y tu marca en la pantalla de acceso y dentro de la app.</p></div>
      </div>
      <div className="split">
        <div className="stack-lg">
          <ProfileForm u={u} />
          <BrandForm u={u} />
          <SignupSettings u={u} />
          <NotificationsPanel />
          <SecurityPanel />
        </div>
        <div className="stack-lg sticky-col">
          <section className="panel">
            <div className="panel-body row" style={{ gap: 14 }}>
              <span className="ico-badge"><Icon name="layers" size={18} /></span>
              <div className="grow"><div className="strong">Tu página de presentación</div><div className="small muted">Una web con tus planes, reseñas y botón a WhatsApp.</div></div>
              <button className="btn btn-primary btn-sm" onClick={() => go("pagina")}>Editar</button>
            </div>
          </section>
          <LoginPreview u={u} />
          <PublicCard u={u} clients={clients} />
        </div>
      </div>
    </div>
  );
}

function ProfileForm({ u }) {
  const init = { name: u.name, headline: u.headline || "", years: u.years ?? "", city: u.city || "", phone: u.phone || "", instagram: u.instagram || "", bio: u.bio || "",
    specialties: u.specialties || [], certifications: u.certifications || [], services: u.services || [] };
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(init);

  async function photo(files) {
    setBusy(true);
    try { run(updateProfile(u.id, { photo: await avatarImage(files[0]) }), "Foto de perfil actualizada", "user"); }
    catch (e) { toast(e.message, "alert"); }
    setBusy(false);
  }
  function save() {
    if (!f.name.trim()) return toast("Escribe tu nombre", "alert");
    run(updateProfile(u.id, { ...f, name: f.name.trim(), years: f.years === "" ? null : Math.max(0, Math.min(60, +f.years)) }), "Perfil guardado");
  }

  return (
    <section className="panel">
      <div className="panel-head"><h2>Tu perfil</h2></div>
      <div className="panel-body stack">
        <div className="row wrap" style={{ gap: 16 }}>
          <div className="upload-avatar"><Avatar name={u.name} id={u.id} size="lg" /></div>
          <div className="stack gap-sm">
            <div className="row wrap gap-sm">
              <ImageDrop compact onFiles={photo} label={u.photo ? "Cambiar foto" : "Subir foto"} />
              {u.photo && <button className="btn btn-ghost btn-sm" onClick={() => { run(updateProfile(u.id, { photo: null }), "Foto quitada", "trash"); }}>Quitar</button>}
            </div>
            <span className="hint">{busy ? "Procesando…" : "Cuadrada, se recorta al centro. JPG o PNG."}</span>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Nombre" id="cp-name"><input id="cp-name" className="input" value={f.name} onChange={set("name")} /></Field>
          <Field label="Especialidad" id="cp-head"><input id="cp-head" className="input" value={f.headline} onChange={set("headline")} placeholder="Ej.: Fuerza e hipertrofia" /></Field>
          <Field label="Años de experiencia" id="cp-years"><input id="cp-years" className="input num" type="number" min="0" value={f.years} onChange={set("years")} /></Field>
          <Field label="Ciudad" id="cp-city"><input id="cp-city" className="input" value={f.city} onChange={set("city")} /></Field>
          <Field label="Teléfono" id="cp-phone"><input id="cp-phone" className="input" type="tel" value={f.phone} onChange={set("phone")} /></Field>
          <Field label="Instagram" id="cp-ig"><input id="cp-ig" className="input" value={f.instagram} onChange={set("instagram")} placeholder="@tu.usuario" /></Field>
          <div className="full"><Field label="Sobre mí" id="cp-bio" hint={`${f.bio.length}/400`}>
            <textarea id="cp-bio" className="textarea" rows={3} maxLength={400} value={f.bio} onChange={set("bio")} placeholder="Cuéntales a tus asesorados cómo trabajas" />
          </Field></div>
          <div className="full"><Field label="Especialidades" id="cp-spec" hint="Escribe y presiona Enter o coma"><TagInput id="cp-spec" value={f.specialties} onChange={(v) => setF({ ...f, specialties: v })} placeholder="Fuerza, Hipertrofia…" /></Field></div>
          <div className="full"><Field label="Certificaciones" id="cp-cert"><TagInput id="cp-cert" value={f.certifications} onChange={(v) => setF({ ...f, certifications: v })} placeholder="Ej.: NSCA-CPT" /></Field></div>
          <div className="full"><Field label="Qué incluye tu plan" id="cp-serv"><TagInput id="cp-serv" value={f.services} onChange={(v) => setF({ ...f, services: v })} placeholder="Ej.: Revisión semanal" /></Field></div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          {dirty && <button className="btn btn-ghost" onClick={() => setF(init)}>Descartar</button>}
          <button className="btn btn-primary" disabled={!dirty} onClick={save}>Guardar perfil</button>
        </div>
      </div>
    </section>
  );
}

function BrandForm({ u }) {
  const { signOut } = useApp();
  const b = u.brand || {};
  const init = { businessName: b.businessName || "", tagline: b.tagline || "", color: b.color || "", slug: b.slug || "" };
  const [f, setF] = useState(init);
  const [error, setError] = useState("");
  const cleanSlug = (v) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]+/g, "-").slice(0, 40);
  const set = (k) => (e) => { setF({ ...f, [k]: k === "slug" ? cleanSlug(e.target.value) : e.target.value }); setError(""); };
  const dirty = JSON.stringify(f) !== JSON.stringify(init);

  async function logo(files) {
    try { run(updateBrand(u.id, { logo: await logoImage(files[0]) }), "Logo actualizado", "sparkle"); }
    catch (e) { toast(e.message, "alert"); }
  }
  async function save() {
    const r = await updateBrand(u.id, { ...f, businessName: f.businessName.trim(), tagline: f.tagline.trim() });
    if (r.error) return setError(r.error);
    toast("Marca guardada. Tus asesorados ya la ven");
  }

  return (
    <section className="panel">
      <div className="panel-head"><h2>Tu marca</h2><span className="small muted">Solo afecta a tu cuenta y a tus asesorados</span></div>
      <div className="panel-body stack">
        <div className="row wrap" style={{ gap: 16 }}>
          <BrandMark brand={{ coach: u, name: f.businessName, logo: b.logo, color: f.color }} size={72} />
          <div className="stack gap-sm">
            <div className="row wrap gap-sm">
              <ImageDrop compact onFiles={logo} label={b.logo ? "Cambiar logo" : "Subir logo"} />
              {b.logo && <button className="btn btn-ghost btn-sm" onClick={() => { run(updateBrand(u.id, { logo: null }), "Logo quitado", "trash"); }}>Quitar</button>}
            </div>
            <span className="hint">PNG con fondo transparente o SVG. Se muestra cuadrado.</span>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Nombre comercial" id="br-name"><input id="br-name" className="input" value={f.businessName} onChange={set("businessName")} placeholder="Ej.: Méndez Strength" maxLength={40} /></Field>
          <Field label="Frase de bienvenida" id="br-tag"><input id="br-tag" className="input" value={f.tagline} onChange={set("tagline")} placeholder="Ej.: Entrena con método" maxLength={70} /></Field>
          <div className="full field">
            <span className="label">Color de marca</span>
            <div className="swatches" role="group" aria-label="Color de marca">
              <button type="button" className="swatch" aria-pressed={!f.color} onClick={() => setF({ ...f, color: "" })} title="Azul del sistema" aria-label="Azul del sistema"
                style={{ background: "#007AFF", color: "#007AFF" }}>{!f.color && <Icon name="check" size={16} stroke={3} />}</button>
              {BRAND_COLORS.map((c) => (
                <button key={c.id} type="button" className="swatch" aria-pressed={f.color === c.hex} onClick={() => setF({ ...f, color: c.hex })} title={c.label} aria-label={c.label}
                  style={{ background: c.hex, color: c.hex }}>{f.color === c.hex && <Icon name="check" size={16} stroke={3} />}</button>
              ))}
            </div>
          </div>
          <div className="full"><Field label="Tu enlace de acceso" id="br-slug" hint="Tus asesorados entran desde aquí y ven tu logo. Solo letras, números y guiones.">
            <div className="row gap-sm">
              <span className="muted strong">#</span>
              <input id="br-slug" className="input" value={f.slug} onChange={set("slug")} autoCapitalize="none" spellCheck={false} />
            </div>
          </Field></div>
        </div>
        {error && <div className="error-box" role="alert"><Icon name="alert" size={18} />{error}</div>}
        <div className="row wrap" style={{ justifyContent: "space-between" }}>
          <div className="row wrap gap-sm">
            <CopyButton text={brandUrl(init.slug)} small label="Copiar enlace" />
            <button className="btn btn-quiet btn-sm" disabled={dirty} onClick={signOut} title={dirty ? "Guarda los cambios primero" : undefined}><Icon name="eye" size={15} />Ver mi acceso</button>
          </div>
          <div className="row gap-sm">
            {dirty && <button className="btn btn-ghost" onClick={() => { setF(init); setError(""); }}>Descartar</button>}
            <button className="btn btn-primary" disabled={!dirty} onClick={save}>Guardar marca</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoginPreview({ u }) {
  const b = u.brand || {};
  const color = b.color || "#007AFF";
  return (
    <section className="panel">
      <div className="panel-head"><h2>Así se ve tu acceso</h2></div>
      <div className="panel-body">
        <div className="preview-frame">
          <BrandMark brand={{ coach: u, name: b.businessName, logo: b.logo, color: b.color }} size={64} />
          <div className="section-title" style={{ fontSize: 24 }}>{b.businessName || u.name}</div>
          {b.tagline && <p className="small muted">{b.tagline}</p>}
          <span className="coach-chip"><Avatar name={u.name} id={u.id} size="sm" />con {u.name}</span>
          <div style={{ width: "100%", marginTop: 6, background: color, color: "#fff", borderRadius: 12, padding: "11px 0", fontWeight: 600 }} aria-hidden="true">Iniciar sesión</div>
        </div>
        <p className="tiny muted" style={{ marginTop: 10, overflowWrap: "anywhere" }}>{brandUrl(b.slug)}</p>
      </div>
    </section>
  );
}

function PublicCard({ u, clients }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>Lo que ven tus asesorados</h2></div>
      <div className="panel-body stack">
        <div className="row">
          <Avatar name={u.name} id={u.id} />
          <div className="grow">
            <div className="strong">{u.name}</div>
            <div className="small muted">{[u.headline, u.years ? `${u.years} años de experiencia` : "", u.city].filter(Boolean).join(" · ") || "Completa tu especialidad"}</div>
          </div>
        </div>
        {u.bio ? <p className="small ink2">{u.bio}</p> : <p className="small muted">Agrega una presentación en “Sobre mí”.</p>}
        {u.specialties?.length > 0 && <div className="row wrap gap-xs">{u.specialties.map((t) => <span key={t} className="pill info">{t}</span>)}</div>}
        {u.services?.length > 0 && (
          <ul className="small ink2" style={{ margin: 0, paddingLeft: 18 }}>{u.services.map((t) => <li key={t}>{t}</li>)}</ul>
        )}
        <span className="tiny muted">{clients} {clients === 1 ? "asesorado" : "asesorados"} con tu marca</span>
      </div>
    </section>
  );
}
