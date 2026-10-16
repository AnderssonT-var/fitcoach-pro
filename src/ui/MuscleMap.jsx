/* Mapa muscular anatómico (frente y espalda, silueta de hombre o mujer).
   Modos:
   - Ejercicio: `primary` / `secondary` resaltan músculos principales y secundarios.
   - Calor: `heat` = { músculo: nivel 1–4 } para el volumen entrenado.
   - Selección: `selected` + `onSelect` lo vuelven un selector táctil. */
import { useContext, useMemo, useState } from "react";
import { AppCtx } from "../context";
import { BODY } from "./bodyPaths";

const MUSCLE_ES = {
  chest: "Pecho", shoulders: "Hombros", biceps: "Bíceps", triceps: "Tríceps", forearms: "Antebrazos",
  abdominals: "Abdomen", quadriceps: "Cuádriceps", hamstrings: "Isquiotibiales", glutes: "Glúteos",
  calves: "Pantorrillas", lats: "Dorsales", "middle back": "Espalda media", "lower back": "Espalda baja",
  traps: "Trapecios", adductors: "Aductores", abductors: "Abductores", neck: "Cuello",
};
export const muscleName = (m) => MUSCLE_ES[m] || m;
export const MUSCLES = Object.keys(MUSCLE_ES);

/* Región del dibujo → músculo de la base de datos */
const REGION_MUSCLE = {
  chest: "chest", deltoids: "shoulders", biceps: "biceps", triceps: "triceps", forearm: "forearms",
  abs: "abdominals", obliques: "abdominals", lats: "lats", midback: "middle back", "lower-back": "lower back",
  trapezius: "traps", gluteal: "glutes", quadriceps: "quadriceps", hamstring: "hamstrings",
  adductors: "adductors", calves: "calves", neck: "neck",
};
/* Músculos sin región propia que se pintan sobre otra */
const ALSO = { gluteal: ["abductors"] };
const musclesOfRegion = (r) => [REGION_MUSCLE[r], ...(ALSO[r] || [])].filter(Boolean);

const BODY_KEY = "fcp.mm.body";
function readBody() { try { return localStorage.getItem(BODY_KEY); } catch { return null; } }
function writeBody(v) { try { localStorage.setItem(BODY_KEY, v); } catch { /* sin almacenamiento */ } }

export default function MuscleMap({
  primary = [], secondary = [], heat, selected, onSelect, describe,
  body, bodyToggle = false, height = 260, hint, className = "",
}) {
  const app = useContext(AppCtx);
  const [local, setLocal] = useState(null);
  const sex = local || body || readBody() || (app?.me?.body === "f" ? "f" : "m");
  const [hover, setHover] = useState(null);
  const sel = selected == null ? [] : Array.isArray(selected) ? selected : [selected];
  const interactive = !!onSelect;

  /* estado de cada músculo: clase de color */
  const tone = useMemo(() => {
    const t = {};
    if (heat) Object.entries(heat).forEach(([m, lv]) => { if (lv > 0) t[m] = `h${Math.min(4, lv)}`; });
    secondary.forEach((m) => { t[m] = "sec"; });
    primary.forEach((m) => { t[m] = "pri"; });
    if (!heat) sel.forEach((m) => { t[m] = "pri"; });
    return t;
  }, [heat, primary, secondary, sel.join("|")]);

  const rank = { pri: 6, sec: 1, h1: 2, h2: 3, h3: 4, h4: 5 };
  const regionTone = (r) => musclesOfRegion(r).map((m) => tone[m]).filter(Boolean).sort((a, b) => rank[b] - rank[a])[0] || "";
  const dim = sel.length > 0;

  const label = (m) => {
    const extra = describe?.(m);
    const role = primary.includes(m) ? "principal" : secondary.includes(m) ? "secundario" : "";
    return [muscleName(m), extra || role].filter(Boolean).join(" · ");
  };

  function figure(side) {
    const v = BODY[sex][side];
    const [, , w, h] = v.vb.split(" ").map(Number);
    return (
      <figure className="mm-fig" key={side}>
        <svg viewBox={v.vb} style={{ height, width: (height * w) / h }} aria-hidden={interactive ? undefined : "true"}>
          <path d={v.outline} className="mm-outline" />
          {v.base.map((d, i) => <path key={i} d={d} className="mm-base" />)}
          {Object.entries(v.regions).map(([r, ds]) => {
            const ms = musclesOfRegion(r);
            const main = ms[0];
            const t = regionTone(r);
            const on = main && (hover === main || (hover && ms.includes(hover)));
            const isSel = ms.some((m) => sel.includes(m));
            const cls = `mm-r ${t} ${main ? "mm-m" : "mm-neutral"} ${on ? "hover" : ""} ${isSel ? "sel" : ""} ${dim && !isSel ? "dim" : ""}`;
            if (!main) return <g key={r} className={cls}>{ds.map((x, i) => <path key={i} d={x} />)}</g>;
            const pick = () => onSelect?.(main);
            return (
              <g key={r} className={cls}
                onPointerEnter={(e) => e.pointerType === "mouse" && setHover(main)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setHover((h) => (h === main ? null : h))}
                onClick={() => { setHover(main); pick(); }}
                {...(interactive ? {
                  role: "button", tabIndex: 0, "aria-label": label(main), "aria-pressed": sel.includes(main),
                  onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } },
                  onFocus: () => setHover(main), onBlur: () => setHover(null),
                } : {})}>
                <title>{label(main)}</title>
                {ds.map((x, i) => <path key={i} d={x} />)}
              </g>
            );
          })}
        </svg>
        <figcaption>{side === "front" ? "Frente" : "Espalda"}</figcaption>
      </figure>
    );
  }

  const summary = primary.length || secondary.length
    ? `Músculos principales: ${primary.map(muscleName).join(", ") || "ninguno"}${secondary.length ? `. Secundarios: ${secondary.map(muscleName).join(", ")}` : ""}`
    : heat ? `Mapa de músculos trabajados: ${Object.entries(heat).filter(([, v]) => v > 0).map(([m]) => label(m)).join(", ") || "sin registros"}`
    : "Mapa muscular";

  return (
    <div className={`mm ${interactive ? "mm-interactive" : ""} ${className}`}>
      {bodyToggle && (
        <div className="seg seg-sm mm-toggle" role="group" aria-label="Silueta">
          {[["m", "Hombre"], ["f", "Mujer"]].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={sex === k} onClick={() => { setLocal(k); writeBody(k); }}>{l}</button>
          ))}
        </div>
      )}
      <div className="mm-figs" role={interactive ? "group" : "img"} aria-label={interactive ? "Elige un músculo" : summary}>
        {figure("front")}
        {figure("back")}
      </div>
      {(hint !== false) && (
        <div className="mm-caption" aria-live="polite">
          {hover || sel[0] ? <strong>{label(hover || sel[0])}</strong> : <span className="muted">{hint || (interactive ? "Toca un músculo" : "Toca o pasa el cursor sobre un músculo")}</span>}
        </div>
      )}
    </div>
  );
}

/** Leyenda de colores para el modo ejercicio. */
export function MuscleLegend({ primary = [], secondary = [] }) {
  return (
    <div className="mm-legend">
      {primary.length > 0 && <div><span className="mm-dot pri" /><span className="muted">Principales</span><strong>{primary.map(muscleName).join(", ")}</strong></div>}
      {secondary.length > 0 && <div><span className="mm-dot sec" /><span className="muted">Secundarios</span><span>{secondary.map(muscleName).join(", ")}</span></div>}
    </div>
  );
}
