/* Gráficos SVG ligeros, dibujados a escala y con colores del tema. */

export function BarChart({ data, height = 170, format = (v) => v, label = "Gráfico de barras", highlightLast = true }) {
  const W = 360, H = height, top = 22, bottom = 22;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = W / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: "block" }}>
      <line x1="0" x2={W} y1={H - bottom + 0.5} y2={H - bottom + 0.5} stroke="var(--line-strong)" />
      {data.map((d, i) => {
        const h = (d.value / max) * (H - top - bottom);
        const x = i * bw + bw * 0.18, w = bw * 0.64;
        const hl = highlightLast && i === data.length - 1;
        return (
          <g key={i}>
            <rect x={x} y={H - bottom - h} width={w} height={Math.max(h, d.value ? 2 : 0)} rx="4"
              fill={hl ? "var(--blue)" : "color-mix(in srgb, var(--blue) 28%, transparent)"}>
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
            {d.value > 0 && (
              <text x={x + w / 2} y={H - bottom - h - 6} textAnchor="middle" fontSize="11" fill={hl ? "var(--ink)" : "var(--muted)"} fontFamily="var(--body)" fontWeight={hl ? 700 : 500}>
                {format(d.value)}
              </text>
            )}
            <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize="11" fill={hl ? "var(--ink)" : "var(--muted)"} fontFamily="var(--body)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ points, height = 170, format = (v) => v, label = "Gráfico de línea" }) {
  if (points.length < 2) return null;
  const W = 360, H = height, padL = 36, padR = 12, top = 16, bottom = 22;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
  const x = (i) => padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${H - bottom} L${x(0)},${H - bottom} Z`;
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const last = points.at(-1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: "block" }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--muted)" fontFamily="var(--body)">{format(t)}</text>
        </g>
      ))}
      <path d={area} fill="color-mix(in srgb, var(--blue) 14%, transparent)" />
      <path d={line} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3} fill={i === points.length - 1 ? "var(--blue)" : "var(--surface)"} stroke="var(--blue)" strokeWidth="2"><title>{`${p.label}: ${format(p.value)}`}</title></circle>)}
      <text x={x(points.length - 1) - 10} y={y(last.value) - 12} textAnchor="end" fontSize="12" fontWeight="700" fill="var(--ink)" fontFamily="var(--body)">{format(last.value)}</text>
      <text x={x(0)} y={H - 5} fontSize="10.5" fill="var(--muted)" fontFamily="var(--body)">{points[0].label}</text>
      <text x={x(points.length - 1)} y={H - 5} textAnchor="end" fontSize="10.5" fill="var(--muted)" fontFamily="var(--body)">{last.label}</text>
    </svg>
  );
}

/* ---------- Carga de la barra: discos por lado ---------- */
const PLATES = [
  { kg: 25, color: "#E0313F", h: 1 },
  { kg: 20, color: "#2459D6", h: 1 },
  { kg: 15, color: "#F2BE1A", h: 0.92 },
  { kg: 10, color: "#2BA35A", h: 0.84 },
  { kg: 5, color: "var(--plate-white)", h: 0.62 },
  { kg: 2.5, color: "#E0313F", h: 0.5 },
  { kg: 1.25, color: "#9AA3AF", h: 0.42 },
];
export function platesFor(total, bar = 20) {
  let side = (total - bar) / 2;
  if (!(side > 0)) return [];
  const out = [];
  for (const p of PLATES) {
    while (side >= p.kg - 1e-9) { out.push(p); side -= p.kg; }
  }
  return out;
}
export function PlateLoader({ weight }) {
  const plates = platesFor(+weight);
  if (!plates.length) return null;
  const H = 46, unit = 9;
  const width = 40 + plates.length * (unit + 2) + 16;
  return (
    <div className="row gap-sm tiny muted" aria-label={`Por lado: ${plates.map((p) => p.kg).join(" + ")} kg`}>
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
        <rect x="0" y={H / 2 - 3} width={width} height="6" rx="2" fill="#9AA3AF" />
        <rect x="30" y={H / 2 - 7} width="6" height="14" rx="1.5" fill="#7A8391" />
        {plates.map((p, i) => {
          const h = H * p.h;
          return <rect key={i} x={40 + i * (unit + 2)} y={(H - h) / 2} width={unit} height={h} rx="2" fill={p.color} stroke="rgba(0,0,0,.25)" strokeWidth=".6" />;
        })}
      </svg>
      <span>Por lado: {plates.map((p) => p.kg).join(" + ")} kg</span>
    </div>
  );
}
