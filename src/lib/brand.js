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

/** Pinta la app con el color de marca (o el azul de VYTRAFIT si no hay marca).
    En modo oscuro se usa una versión más clara si el color es muy oscuro (igual que la app Android). */
export function applyBrandColor(hex) {
  const root = document.documentElement;
  ["--blue", "--blue-ink", "--blue-soft"].forEach((v) => root.style.removeProperty(v)); // versiones anteriores
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) {
    root.style.removeProperty("--brand"); root.style.removeProperty("--brand-dk"); root.style.removeProperty("--on-brand-dk");
    return;
  }
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let hue = 0, sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  const grey = sat < 0.15;
  const dark = l < 0.5 ? `hsl(${Math.round(hue)} ${Math.round(Math.min(1, sat * 1.05) * 100)}% ${grey ? 82 : 62}%)` : `#${h}`;
  // Sobre un gris claro el texto va oscuro para que se lea
  if (grey && l < 0.5) root.style.setProperty("--on-brand-dk", "#0D1220"); else root.style.removeProperty("--on-brand-dk");
  const light = l > 0.55 ? `hsl(${Math.round(hue)} ${Math.round(sat * 100)}% 45%)` : `#${h}`;
  root.style.setProperty("--brand", light);
  root.style.setProperty("--brand-dk", dark);
}
