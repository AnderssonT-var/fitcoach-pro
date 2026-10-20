/* Drop sets: al terminar la serie se baja el peso y se sigue sin descanso. */
import { kg } from "../lib/format";

export const DROP_DEFAULT = { count: 2, pct: 20, on: "last" };
export const DROP_PCTS = [10, 15, 20, 25, 30, 40];

export const isDrop = (e) => e?.technique === "dropset" && e?.drops?.count > 0;

/** Texto corto para mostrar en la rutina. */
export function dropLabel(d) {
  if (!d) return "";
  const n = `${d.count} ${d.count === 1 ? "bajada" : "bajadas"}`;
  return `Drop set · ${n} de −${d.pct}% ${d.on === "all" ? "en cada serie" : "en la última serie"}`;
}

/** Peso sugerido para la bajada k (1, 2, …), redondeado a 0,5 kg. */
export function dropWeight(base, pct, k) {
  const v = +base * Math.pow(1 - pct / 100, k);
  return v > 0 ? Math.round(v * 2) / 2 : 0;
}

/** ¿Lleva bajadas esta serie? */
export const setHasDrops = (d, si, nSets) => !!d && (d.on === "all" || si === nSets - 1);

/** "40×10 → 32×6 → 25,5×4" */
export function setText(x) {
  const base = `${kg(x.weight)}×${x.reps}`;
  const drops = (x.drops || []).filter((d) => d.done && (+d.reps > 0 || +d.weight > 0));
  return drops.length ? `${base} → ${drops.map((d) => `${kg(d.weight)}×${d.reps}`).join(" → ")}` : base;
}
