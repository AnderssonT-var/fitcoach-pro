/* Mapa muscular (vista frontal y posterior) dibujado para la app.
   Resalta en color fuerte los músculos principales y en suave los secundarios. */

const MUSCLE_ES = {
  chest: "Pecho", shoulders: "Hombros", biceps: "Bíceps", triceps: "Tríceps", forearms: "Antebrazos",
  abdominals: "Abdomen", quadriceps: "Cuádriceps", hamstrings: "Isquiotibiales", glutes: "Glúteos",
  calves: "Pantorrillas", lats: "Dorsales", "middle back": "Espalda media", "lower back": "Espalda baja",
  traps: "Trapecios", adductors: "Aductores", abductors: "Abductores", neck: "Cuello",
};
export const muscleName = (m) => MUSCLE_ES[m] || m;

/* Silueta compartida por ambas vistas */
function Body() {
  return (
    <g fill="var(--mm-body)">
      <circle cx="50" cy="15" r="10" />
      <rect x="45" y="23" width="10" height="9" rx="3" />
      <path d="M29 37 Q50 29 71 37 L73 62 Q71 84 66 104 L64 114 Q50 121 36 114 L34 104 Q29 84 27 62 Z" />
      <rect x="18" y="40" width="11" height="40" rx="5.5" transform="rotate(10 23.5 40)" />
      <rect x="71" y="40" width="11" height="40" rx="5.5" transform="rotate(-10 76.5 40)" />
      <rect x="13" y="78" width="10" height="36" rx="5" transform="rotate(8 18 78)" />
      <rect x="77" y="78" width="10" height="36" rx="5" transform="rotate(-8 82 78)" />
      <circle cx="13" cy="118" r="4.5" /><circle cx="87" cy="118" r="4.5" />
      <rect x="35" y="108" width="14.5" height="54" rx="7" />
      <rect x="50.5" y="108" width="14.5" height="54" rx="7" />
      <rect x="36.5" y="158" width="11" height="42" rx="5.5" />
      <rect x="52.5" y="158" width="11" height="42" rx="5.5" />
      <ellipse cx="41" cy="203" rx="6" ry="3" /><ellipse cx="59" cy="203" rx="6" ry="3" />
    </g>
  );
}

const FRONT = {
  neck: [["ellipse", { cx: 50, cy: 29, rx: 4, ry: 3.5 }]],
  traps: [["path", { d: "M38 36 Q44 32 46 30 L46 36 Z" }], ["path", { d: "M62 36 Q56 32 54 30 L54 36 Z" }]],
  shoulders: [["ellipse", { cx: 29, cy: 44, rx: 7, ry: 7.5 }], ["ellipse", { cx: 71, cy: 44, rx: 7, ry: 7.5 }]],
  chest: [["path", { d: "M37 41 Q46 39 49 42 L49 55 Q42 59 35 55 Q33 47 37 41 Z" }], ["path", { d: "M63 41 Q54 39 51 42 L51 55 Q58 59 65 55 Q67 47 63 41 Z" }]],
  biceps: [["ellipse", { cx: 22.5, cy: 62, rx: 4.3, ry: 11, transform: "rotate(10 22.5 62)" }], ["ellipse", { cx: 77.5, cy: 62, rx: 4.3, ry: 11, transform: "rotate(-10 77.5 62)" }]],
  forearms: [["ellipse", { cx: 16, cy: 95, rx: 4, ry: 12, transform: "rotate(8 16 95)" }], ["ellipse", { cx: 84, cy: 95, rx: 4, ry: 12, transform: "rotate(-8 84 95)" }]],
  abdominals: [["rect", { x: 44, y: 60, width: 12, height: 40, rx: 4 }], ["ellipse", { cx: 38.5, cy: 80, rx: 3.5, ry: 11 }], ["ellipse", { cx: 61.5, cy: 80, rx: 3.5, ry: 11 }]],
  abductors: [["ellipse", { cx: 36.5, cy: 116, rx: 2.6, ry: 8 }], ["ellipse", { cx: 63.5, cy: 116, rx: 2.6, ry: 8 }]],
  adductors: [["ellipse", { cx: 47, cy: 124, rx: 2.4, ry: 12 }], ["ellipse", { cx: 53, cy: 124, rx: 2.4, ry: 12 }]],
  quadriceps: [["ellipse", { cx: 41.5, cy: 134, rx: 6, ry: 21 }], ["ellipse", { cx: 58.5, cy: 134, rx: 6, ry: 21 }]],
  calves: [["ellipse", { cx: 40.5, cy: 174, rx: 3.6, ry: 13 }], ["ellipse", { cx: 59.5, cy: 174, rx: 3.6, ry: 13 }]],
};
const BACK = {
  neck: [["ellipse", { cx: 50, cy: 29, rx: 4, ry: 3.5 }]],
  traps: [["path", { d: "M50 27 L62 38 L50 58 L38 38 Z" }]],
  shoulders: [["ellipse", { cx: 29, cy: 44, rx: 7, ry: 7.5 }], ["ellipse", { cx: 71, cy: 44, rx: 7, ry: 7.5 }]],
  triceps: [["ellipse", { cx: 22.5, cy: 62, rx: 4.3, ry: 11, transform: "rotate(10 22.5 62)" }], ["ellipse", { cx: 77.5, cy: 62, rx: 4.3, ry: 11, transform: "rotate(-10 77.5 62)" }]],
  forearms: [["ellipse", { cx: 16, cy: 95, rx: 4, ry: 12, transform: "rotate(8 16 95)" }], ["ellipse", { cx: 84, cy: 95, rx: 4, ry: 12, transform: "rotate(-8 84 95)" }]],
  lats: [["path", { d: "M33 46 Q40 50 45 62 L44 82 Q37 78 34 70 Q31 58 33 46 Z" }], ["path", { d: "M67 46 Q60 50 55 62 L56 82 Q63 78 66 70 Q69 58 67 46 Z" }]],
  "middle back": [["path", { d: "M44 44 L56 44 L56 66 Q50 70 44 66 Z" }]],
  "lower back": [["rect", { x: 44, y: 78, width: 12, height: 22, rx: 5 }]],
  glutes: [["ellipse", { cx: 42.5, cy: 111, rx: 7.5, ry: 8.5 }], ["ellipse", { cx: 57.5, cy: 111, rx: 7.5, ry: 8.5 }]],
  abductors: [["ellipse", { cx: 35.5, cy: 108, rx: 2.6, ry: 7 }], ["ellipse", { cx: 64.5, cy: 108, rx: 2.6, ry: 7 }]],
  adductors: [["ellipse", { cx: 48, cy: 128, rx: 2, ry: 10 }], ["ellipse", { cx: 52, cy: 128, rx: 2, ry: 10 }]],
  hamstrings: [["ellipse", { cx: 41.5, cy: 138, rx: 5.8, ry: 18 }], ["ellipse", { cx: 58.5, cy: 138, rx: 5.8, ry: 18 }]],
  calves: [["ellipse", { cx: 41.5, cy: 172, rx: 5, ry: 13 }], ["ellipse", { cx: 58.5, cy: 172, rx: 5, ry: 13 }]],
};

function View({ map, primary, secondary, label, dx }) {
  return (
    <g transform={`translate(${dx} 0)`}>
      <Body />
      {Object.entries(map).map(([m, shapes]) => {
        const fill = primary.includes(m) ? "var(--mm-primary)" : secondary.includes(m) ? "var(--mm-secondary)" : "var(--mm-muscle)";
        return shapes.map(([Tag, props], i) => <Tag key={`${m}${i}`} {...props} fill={fill}><title>{muscleName(m)}</title></Tag>);
      })}
      <text x="50" y="218" textAnchor="middle" fontSize="8" fill="var(--muted)" fontFamily="var(--body)">{label}</text>
    </g>
  );
}

export default function MuscleMap({ primary = [], secondary = [], size = 200 }) {
  const names = [...primary.map(muscleName)];
  return (
    <svg className="muscle-map" viewBox="0 0 210 222" width={size} height={size * 222 / 210} role="img"
      aria-label={`Músculos principales: ${names.join(", ") || "sin datos"}${secondary.length ? `. Secundarios: ${secondary.map(muscleName).join(", ")}` : ""}`}>
      <View map={FRONT} primary={primary} secondary={secondary} label="Frente" dx={0} />
      <View map={BACK} primary={primary} secondary={secondary} label="Espalda" dx={110} />
    </svg>
  );
}
