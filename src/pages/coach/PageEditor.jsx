/* Mi página: el entrenador arma su página de presentación (vytra.fit/<enlace>).
   Todo es editable: portada, botones, redes y secciones (texto, tarjetas, planes, reseñas, galería…).
   La vista previa la arma el mismo servidor que publica la página: lo que ves es lo que sale. */
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../ui/Icon";
import { Confirm, CopyButton, toast } from "../../ui/kit";
import { ImageDrop } from "../../ui/inputs";
import { useApp } from "../../context";
import { api, apiBase } from "../../store/api";
import { compressImage } from "../../lib/image";
import { BRAND_COLORS } from "../../lib/brand";

const ICON_OK = new Set(["user", "chart", "wallet", "chat", "community", "link", "sparkle", "play", "send", "heart", "layers", "note", "camera", "pencil", "target", "trophy"]);
const ICON_MAP = { image: "camera", edit: "pencil", grid: "layers", star: "heart", info: "note" };
const ico = (n) => (ICON_OK.has(n) ? n : ICON_MAP[n] || "layers");
const newId = () => Math.random().toString(36).slice(2, 10);
const imgUrl = (id) => (id ? `${apiBase()}/p/img/${id}` : "");

export function pageUrl(slug) {
  const pub = (import.meta.env.VITE_PUBLIC_URL || "").replace(/\/+$/, "");
  const base = pub || apiBase() || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/${slug}`;
}

export default function PageEditor() {
  const { go } = useApp();
  const [meta, setMeta] = useState(null); // { schema, slug, preview }
  const [page, setPage] = useState(null);
  const [saved, setSaved] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState("hero");
  const [adding, setAdding] = useState(false);
  const [device, setDevice] = useState(() => (window.innerWidth < 1100 ? "phone" : "desktop"));
  const [showPreview, setShowPreview] = useState(false); // en celular la vista previa va en una pestaña

  useEffect(() => {
    let live = true;
    api("GET", "/api/coach/page").then((r) => {
      if (!live) return;
      if (r.error) return setErr(r.offline ? "Necesitas conexión a internet para editar tu página." : r.error);
      setMeta({ schema: r.schema, slug: r.slug, preview: r.preview });
      setPage(r.page);
      setSaved(JSON.stringify(r.page));
    });
    return () => { live = false; };
  }, []);

  const dirty = page && JSON.stringify(page) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const on = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, [dirty]);

  async function save(patch) {
    const next = { ...page, ...(patch || {}) };
    setBusy(true);
    const r = await api("PUT", "/api/coach/page", next);
    setBusy(false);
    if (r.error) return toast(r.offline ? "Sin conexión: guarda cuando vuelva el internet." : r.error, "alert");
    setPage(r.page); setSaved(JSON.stringify(r.page));
    toast(patch?.published === true ? "¡Tu página está publicada!" : patch?.published === false ? "Tu página ya no es pública" : "Página guardada");
  }

  if (err) return <div className="page"><div className="page-head"><div><h1>Mi página</h1></div></div><div className="panel"><div className="panel-body"><p className="ink2">{err}</p></div></div></div>;
  if (!page) return <div className="page"><div className="page-head"><div><h1>Mi página</h1><p>Cargando…</p></div></div></div>;

  const { schema, slug } = meta;
  const url = pageUrl(slug);
  const viewUrl = page.published && !dirty ? url : `${url}?preview=${meta.preview}`;
  const set = (k, v) => setPage((p) => ({ ...p, [k]: v }));
  const setSections = (fn) => setPage((p) => ({ ...p, sections: fn(p.sections) }));

  function addSection(type) {
    const def = schema.sections[type];
    const s = { id: newId(), type, visible: true, bg: "default", items: def.item ? [] : undefined };
    if (def.item) s.items = [{ id: newId() }];
    setSections((list) => [...list, s]);
    setOpen(`s:${s.id}`);
    setAdding(false);
    setTimeout(() => document.getElementById(`pe-s-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  return (
    <div className="page page-editor">
      <div className="page-head">
        <div><h1>Mi página</h1><p>Tu página de presentación: compártela en tus redes y que te escriban por WhatsApp o entren a su cuenta.</p></div>
      </div>

      <section className="panel pe-bar">
        <div className="pe-status">
          <span className={`pe-dot ${page.published ? "on" : ""}`} />
          <div className="grow">
            <div className="strong">{page.published ? "Publicada" : "Sin publicar"}{dirty && <span className="pe-unsaved"> · cambios sin guardar</span>}</div>
            <div className="pe-url small">{url.replace(/^https?:\/\//, "")}</div>
          </div>
        </div>
        <div className="pe-actions">
          <CopyButton text={url} label="Copiar enlace" small />
          <a className="btn btn-quiet btn-sm" style={{ textDecoration: "none" }} href={viewUrl} target="_blank" rel="noopener"><Icon name="eye" size={15} />{page.published && !dirty ? "Ver" : "Vista previa"}</a>
          {page.published
            ? <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => save({ published: false })}>Despublicar</button>
            : <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => save({ published: true })}><Icon name="send" size={15} />Publicar</button>}
          <button className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={() => save()}><Icon name="check" size={15} />{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </section>

      <div className="seg pe-mobile-tabs" role="tablist">
        <button aria-pressed={!showPreview} onClick={() => setShowPreview(false)}>Editar</button>
        <button aria-pressed={showPreview} onClick={() => setShowPreview(true)}>Vista previa</button>
      </div>

      <div className={`pe-grid ${showPreview ? "show-preview" : ""}`}>
        <div className="stack pe-edit">
          {schema.groups.map((g) => (
            <Fold key={g.k} id={g.k} open={open === g.k} onToggle={() => setOpen(open === g.k ? "" : g.k)} icon={ico(g.icon)} title={g.label}>
              <Fields fields={g.fields} value={page[g.k] || {}} onChange={(v) => set(g.k, v)} />
              {g.k === "contact" && <p className="hint">El botón «Iniciar sesión» lleva a tu acceso personalizado: {url.replace(/^https?:\/\//, "").replace(`/${slug}`, `/#${slug}`)}</p>}
            </Fold>
          ))}

          <div className="pe-sec-title"><h2>Secciones</h2><span className="small muted">Se muestran en este orden debajo de la portada</span></div>
          {page.sections.length === 0 && <p className="hint">Aún no tienes secciones. Agrega la primera.</p>}
          {page.sections.map((s, i) => {
            const def = schema.sections[s.type];
            if (!def) return null;
            const key = `s:${s.id}`;
            const upd = (v) => setSections((l) => l.map((x) => (x.id === s.id ? { ...x, ...v } : x)));
            const move = (d) => setSections((l) => { const a = [...l]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
            return (
              <Fold key={s.id} domId={`pe-s-${s.id}`} open={open === key} onToggle={() => setOpen(open === key ? "" : key)} icon={ico(def.icon)}
                title={s.title || def.label} sub={s.title ? def.label : def.hint} dim={!s.visible}
                tools={<>
                  <IconBtn icon="up" label="Subir" disabled={i === 0} onClick={() => move(-1)} />
                  <IconBtn icon="down" label="Bajar" disabled={i === page.sections.length - 1} onClick={() => move(1)} />
                  <IconBtn icon={s.visible ? "eye" : "lock"} label={s.visible ? "Ocultar" : "Mostrar"} onClick={() => upd({ visible: !s.visible })} />
                  <IconBtn icon="copy" label="Duplicar" onClick={() => setSections((l) => { const a = [...l]; a.splice(i + 1, 0, { ...structuredClone(s), id: newId(), items: s.items?.map((it) => ({ ...it, id: newId() })) }); return a; })} />
                  <DeleteBtn what={s.title || def.label} onConfirm={() => setSections((l) => l.filter((x) => x.id !== s.id))} />
                </>}>
                <Fields fields={def.fields} value={s} onChange={(v) => upd(v)} />
                {def.item && <Items def={def.item} items={s.items || []} onChange={(items) => upd({ items })} />}
              </Fold>
            );
          })}

          {adding ? (
            <section className="panel">
              <div className="panel-head"><h2>Agregar sección</h2><button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancelar</button></div>
              <div className="panel-body pe-types">
                {Object.entries(schema.sections).map(([type, d]) => (
                  <button key={type} className="pe-type" onClick={() => addSection(type)}>
                    <span className="ico-badge"><Icon name={ico(d.icon)} size={18} /></span>
                    <span><b>{d.label}</b><small>{d.hint}</small></span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <button className="btn btn-quiet pe-add" onClick={() => setAdding(true)} disabled={page.sections.length >= schema.limits.sections}><Icon name="plus" size={16} />Agregar sección</button>
          )}

          <p className="hint">¿Tu enlace o tu logo? Se cambian en <button className="link-btn" onClick={() => go("perfil")}>Perfil y marca</button>.</p>
        </div>

        <div className="pe-preview-col">
          <Preview page={page} device={device} setDevice={setDevice} />
        </div>
      </div>

      {dirty && (
        <div className="pe-savebar">
          <span>Tienes cambios sin guardar</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(JSON.parse(saved))}>Descartar</button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => save()}>{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      )}
    </div>
  );
}

function Fold({ id, domId, open, onToggle, icon, title, sub, tools, dim, children }) {
  return (
    <section className={`panel pe-fold ${open ? "open" : ""} ${dim ? "dim" : ""}`} id={domId || `pe-g-${id}`}>
      <div className="pe-fold-head">
        <button className="pe-fold-btn" onClick={onToggle} aria-expanded={open}>
          <span className="ico-badge"><Icon name={icon} size={17} /></span>
          <span className="grow"><b>{title}</b>{sub && <small>{sub}</small>}</span>
          <Icon name={open ? "up" : "down"} size={16} />
        </button>
        {tools && <div className="pe-tools">{tools}</div>}
      </div>
      {open && <div className="panel-body stack">{children}</div>}
    </section>
  );
}

function IconBtn({ icon, label, onClick, disabled }) {
  return <button className="btn btn-ghost btn-icon btn-sm" title={label} aria-label={label} disabled={disabled} onClick={onClick}><Icon name={icon} size={16} /></button>;
}
function DeleteBtn({ what, onConfirm }) {
  const [ask, setAsk] = useState(false);
  return (<>
    <IconBtn icon="trash" label="Eliminar" onClick={() => setAsk(true)} />
    {ask && <Confirm title="¿Eliminar?" text={`Se quita «${what}» de tu página (se aplica al guardar).`} confirmLabel="Eliminar" onConfirm={onConfirm} onClose={() => setAsk(false)} />}
  </>);
}

function Items({ def, items, onChange }) {
  const [open, setOpen] = useState(items.length === 1 ? items[0]?.id : "");
  const upd = (id, v) => onChange(items.map((x) => (x.id === id ? { ...x, ...v } : x)));
  return (
    <div className="pe-items">
      {items.map((it, i) => (
        <div key={it.id} className={`pe-item ${open === it.id ? "open" : ""}`}>
          <div className="pe-item-head">
            <button className="pe-fold-btn" onClick={() => setOpen(open === it.id ? "" : it.id)}>
              {it.image ? <img src={imgUrl(it.image)} alt="" className="pe-thumb" /> : <span className="pe-num">{i + 1}</span>}
              <span className="grow"><b>{it.title || it.value || `${def.label} ${i + 1}`}</b></span>
              <Icon name={open === it.id ? "up" : "down"} size={15} />
            </button>
            <div className="pe-tools">
              <IconBtn icon="up" label="Subir" disabled={i === 0} onClick={() => { const a = [...items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }} />
              <IconBtn icon="down" label="Bajar" disabled={i === items.length - 1} onClick={() => { const a = [...items]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; onChange(a); }} />
              <IconBtn icon="trash" label="Quitar" onClick={() => onChange(items.filter((x) => x.id !== it.id))} />
            </div>
          </div>
          {open === it.id && <div className="pe-item-body"><Fields fields={def.fields} value={it} onChange={(v) => upd(it.id, v)} /></div>}
        </div>
      ))}
      {items.length < def.max
        ? <button className="btn btn-quiet btn-sm" onClick={() => { const it = { id: newId() }; onChange([...items, it]); setOpen(it.id); }}><Icon name="plus" size={15} />Agregar {def.label.toLowerCase()}</button>
        : <span className="hint">Máximo {def.max}.</span>}
    </div>
  );
}

function Fields({ fields, value, onChange }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  return (
    <div className="form-grid">
      {fields.map((f) => <FieldInput key={f.k} f={f} v={value[f.k]} onChange={set(f.k)} />)}
    </div>
  );
}

function FieldInput({ f, v, onChange }) {
  const id = useMemo(() => `pf-${f.k}-${newId()}`, [f.k]);
  const wide = ["textarea", "image", "color", "range"].includes(f.type) || (f.type === "select" && f.options.length > 3);
  const label = <label htmlFor={id}>{f.label}</label>;
  const hint = f.hint && <span className="hint">{f.hint}{f.max && f.type === "textarea" ? ` · ${String(v || "").length}/${f.max}` : ""}</span>;
  let input;
  switch (f.type) {
    case "textarea":
      input = <textarea id={id} className="textarea" rows={f.max > 1000 ? 6 : 3} maxLength={f.max} value={v || ""} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />; break;
    case "toggle":
      return <div className="field pe-toggle"><label className="toggle"><input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} /><span>{f.label}</span></label></div>;
    case "select":
      input = f.options.length <= 3
        ? <div className="seg" role="group" aria-label={f.label}>{f.options.map((o) => <button key={o.v} type="button" aria-pressed={(v ?? f.options[0].v) === o.v} onClick={() => onChange(o.v)}>{o.l}</button>)}</div>
        : <select id={id} className="input" value={v ?? f.options[0].v} onChange={(e) => onChange(e.target.value)}>{f.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>;
      break;
    case "range":
      input = <div className="row gap-sm"><input id={id} type="range" min={f.min} max={f.max} step={f.step || 1} value={v ?? f.min} onChange={(e) => onChange(+e.target.value)} className="grow" /><span className="num small" style={{ width: 44, textAlign: "right" }}>{v ?? f.min}{f.unit || ""}</span></div>; break;
    case "stars":
      input = <div className="pe-stars" role="radiogroup" aria-label={f.label}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} estrellas`} aria-pressed={(v || 5) >= n} onClick={() => onChange(n)}>★</button>)}</div>; break;
    case "color":
      input = (
        <div className="swatches" role="group" aria-label={f.label}>
          <button type="button" className="swatch pe-swatch-brand" aria-pressed={!v} onClick={() => onChange("")} title="Color de mi marca">{!v && <Icon name="check" size={16} stroke={3} />}</button>
          {BRAND_COLORS.map((c) => (
            <button key={c.id} type="button" className="swatch" aria-pressed={v === c.hex} onClick={() => onChange(c.hex)} title={c.label} style={{ background: c.hex, color: c.hex }}>{v === c.hex && <Icon name="check" size={16} stroke={3} />}</button>
          ))}
          <label className="swatch pe-swatch-custom" title="Otro color"><input type="color" value={v || "#007aff"} onChange={(e) => onChange(e.target.value)} /></label>
        </div>
      ); break;
    case "image":
      input = <ImageField f={f} v={v} onChange={onChange} />; break;
    default:
      input = <input id={id} className="input" type={f.type === "tel" ? "tel" : f.type === "url" ? "url" : "text"} inputMode={f.type === "tel" ? "tel" : undefined}
        maxLength={f.max} value={v || ""} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  return <div className={`field ${wide ? "full" : ""}`}>{label}{input}{hint}</div>;
}

function ImageField({ f, v, onChange }) {
  const [busy, setBusy] = useState(false);
  async function up(files) {
    setBusy(true);
    try {
      const data = await compressImage(files[0], { max: f.wide ? 1800 : f.square ? 400 : 1200, square: !!f.square, quality: 0.8 });
      const r = await api("POST", "/api/coach/page/image", { data }, { timeout: 60e3 });
      if (r.error) throw new Error(r.offline ? "Necesitas conexión para subir fotos." : r.error);
      onChange(r.id);
    } catch (e) { toast(e.message, "alert"); }
    setBusy(false);
  }
  return (
    <div className="pe-image">
      {v ? <img src={imgUrl(v)} alt="" className={f.wide ? "wide" : f.square ? "sq" : ""} /> : <div className={`pe-image-empty ${f.wide ? "wide" : f.square ? "sq" : ""}`}><Icon name="camera" size={22} /></div>}
      <div className="row wrap gap-sm">
        <ImageDrop compact onFiles={up} label={busy ? "Subiendo…" : v ? "Cambiar" : "Subir imagen"} />
        {v && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>Quitar</button>}
      </div>
    </div>
  );
}

function Preview({ page, device, setDevice }) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const json = JSON.stringify(page);
  // El diseño de computadora se ve completo (1280 px) achicado al ancho disponible
  const box = useRef(null);
  const [w, setW] = useState(400);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const vw = device === "desktop" ? 1280 : 390;
  const scale = Math.min(1, w / vw);
  const H = 720;
  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await api("POST", "/api/coach/page/preview", JSON.parse(json));
      if (n !== seq.current) return;
      setLoading(false);
      if (!r.error) setHtml(r.html);
    }, html ? 650 : 0);
    return () => clearTimeout(t);
  }, [json]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="panel pe-preview">
      <div className="panel-head">
        <h2>Vista previa {loading && <span className="small muted">· actualizando…</span>}</h2>
        <div className="seg seg-sm">
          <button aria-pressed={device === "phone"} onClick={() => setDevice("phone")}>Celular</button>
          <button aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>Computadora</button>
        </div>
      </div>
      <div className={`pe-frame ${device}`} ref={box}>
        {html
          ? <iframe title="Vista previa de tu página" srcDoc={html} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              style={{ width: vw, height: H / scale, transform: `scale(${scale})`, transformOrigin: "0 0", margin: scale < 1 ? 0 : "0 auto" }} />
          : <div className="pe-frame-empty">Cargando vista previa…</div>}
      </div>
    </section>
  );
}
