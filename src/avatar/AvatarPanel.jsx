/* Personaje 3D en la web: crece con el progreso de cada músculo y el asesorado lo personaliza.
   Three.js se carga aparte, solo cuando se abre esta sección. */
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { toast } from "../ui/kit";
import { clientById, exerciseById, saveAvatar, useDB, userById, workoutsOf } from "../store/db";
import { computeProgress, normalizeStyle, SKINS, HAIR_COLORS, CLOTH_COLORS, HAIR_STYLES, OUTFITS } from "./progress";

const isDark = () => {
  const t = document.documentElement.getAttribute("data-theme");
  return t ? t === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
};


export function useAvatarData(clientId) {
  const db = useDB();
  const c = clientById(db, clientId);
  const u = userById(db, clientId);
  const workouts = workoutsOf(db, clientId);
  const progress = useMemo(() => computeProgress({ bests: c?.bests || {}, workouts, muscleOf: (id) => exerciseById(db, id).muscle }),
    [c?.bests, workouts, db.exercises]); // eslint-disable-line react-hooks/exhaustive-deps
  const style = normalizeStyle(c?.avatar, u?.body === "f" ? "f" : "m");
  return { c, u, progress, style };
}

export default function AvatarPanel({ clientId, editable = false }) {
  const { progress, style } = useAvatarData(clientId);
  const [draft, setDraft] = useState(null);
  const shown = draft || style;
  const host = useRef(null), card = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    import("./card.js").then(({ mountAvatarCard }) => {
      if (!alive || !host.current) return;
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#5856d6";
      try {
        card.current = mountAvatarCard(host.current, { dark: isDark(), accent });
        card.current.update(shown, progress);
      } catch { setFailed(true); }
    }).catch(() => setFailed(true));
    return () => { alive = false; card.current?.dispose(); card.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { card.current?.update(shown, progress); }, [JSON.stringify(shown), progress]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return null; // equipos sin 3D: no se muestra
  return (
    <section className="avatar-panel">
      <div className="panel-head" style={{ padding: "0 4px 10px" }}>
        <h2>{editable ? "Tu personaje" : "Su personaje"}</h2>
        {editable && <button className="btn btn-quiet btn-sm" onClick={() => setDraft(style)}><Icon name="sparkle" size={15} />Personalizar</button>}
      </div>
      <div ref={host} />
      {draft && editable && <Customize draft={draft} setDraft={setDraft} onClose={() => setDraft(null)} />}
    </section>
  );
}

function Swatches({ colors, value, onChange, label }) {
  return (
    <div className="swatches" role="group" aria-label={label}>
      {colors.map((c) => (
        <button key={c} type="button" className="swatch" aria-pressed={value === c} title={c} onClick={() => onChange(c)} style={{ background: c, color: c }}>
          {value === c && <Icon name="check" size={15} stroke={3} />}
        </button>
      ))}
    </div>
  );
}

function Seg({ options, value, onChange, label }) {
  return (
    <div className="seg wrap" role="group" aria-label={label}>
      {options.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

function Customize({ draft, setDraft, onClose }) {
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setDraft((d) => normalizeStyle({ ...d, [k]: v }));
  async function save() {
    setBusy(true);
    const r = await saveAvatar(draft);
    setBusy(false);
    if (r.error) return toast(r.error, "alert");
    toast("¡Personaje guardado!", "sparkle");
    onClose();
  }
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><h2>Personaliza tu personaje</h2></div>
      <div className="panel-body stack">
        <p className="small muted">Los cambios se ven al instante arriba. El tamaño de cada músculo no se elige: lo ganas entrenando y subiendo peso.</p>
        <div className="field"><label htmlFor="av-name">Nombre</label><input id="av-name" className="input" maxLength={24} value={draft.name} placeholder="Ej.: Titán" onChange={(e) => set("name", e.target.value)} /></div>
        <div className="field"><label>Cuerpo</label><Seg label="Cuerpo" options={[["m", "Masculino"], ["f", "Femenino"]]} value={draft.body} onChange={(v) => set("body", v)} /></div>
        <div className="field"><label>Tono de piel</label><Swatches label="Tono de piel" colors={SKINS} value={draft.skin} onChange={(v) => set("skin", v)} /></div>
        <div className="field"><label>Peinado</label><Seg label="Peinado" options={HAIR_STYLES[draft.body]} value={draft.hair} onChange={(v) => set("hair", v)} /></div>
        <div className="field"><label>Color de pelo</label><Swatches label="Color de pelo" colors={HAIR_COLORS} value={draft.hairColor} onChange={(v) => set("hairColor", v)} /></div>
        <div className="field"><label>Ropa</label><Seg label="Ropa" options={OUTFITS[draft.body]} value={draft.outfit} onChange={(v) => set("outfit", v)} /></div>
        {draft.outfit !== "none" && <div className="field"><label>Color de la parte de arriba</label><Swatches label="Color de arriba" colors={CLOTH_COLORS} value={draft.top} onChange={(v) => set("top", v)} /></div>}
        <div className="field"><label>Color del short</label><Swatches label="Color del short" colors={CLOTH_COLORS} value={draft.bottom} onChange={(v) => set("bottom", v)} /></div>
        <div className="field"><label>Color de zapatillas</label><Swatches label="Color de zapatillas" colors={CLOTH_COLORS} value={draft.shoes} onChange={(v) => set("shoes", v)} /></div>
        <div className="row gap-sm" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}
