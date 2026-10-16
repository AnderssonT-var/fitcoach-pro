/* Marca de cada entrenador: color, logo y enlace propio de acceso. */

export const BRAND_COLORS = [
  { id: "azul", label: "Azul", hex: "#0071E3" },
  { id: "indigo", label: "Índigo", hex: "#5856D6" },
  { id: "morado", label: "Morado", hex: "#9B3FD1" },
  { id: "rosa", label: "Rosa", hex: "#D6245E" },
  { id: "rojo", label: "Rojo", hex: "#D93025" },
  { id: "naranja", label: "Naranja", hex: "#E8590C" },
  { id: "verde", label: "Verde", hex: "#1E9E50" },
  { id: "turquesa", label: "Turquesa", hex: "#0E8A9C" },
  { id: "grafito", label: "Grafito", hex: "#3A3A3C" },
];
export const DEFAULT_BRAND_COLOR = "#007AFF";

export const svgData = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** "Méndez Strength" → "mendez-strength" (sirve como enlace #mendez-strength). */
export function slugify(s = "") {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/** Pinta la app con el color de marca (o el azul de sistema si no hay marca). */
export function applyBrandColor(hex) {
  const root = document.documentElement;
  if (!hex) {
    ["--blue", "--blue-ink", "--blue-soft"].forEach((v) => root.style.removeProperty(v));
    return;
  }
  root.style.setProperty("--blue", hex);
  root.style.setProperty("--blue-ink", `color-mix(in srgb, ${hex} 82%, var(--ink))`);
  root.style.setProperty("--blue-soft", `color-mix(in srgb, ${hex} 14%, transparent)`);
}
