/* Técnicas de la rutina: superseries, intensidad (RIR / RPE) y tempo.
   - Superserie: un ejercicio con `linkNext` se hace seguido del siguiente, sin descanso entre ellos.
     El descanso llega al terminar la ronda (la serie del último ejercicio de la superserie).
   - effort: { type: "rir" | "rpe", value }   → «RIR 2» = dejar 2 repeticiones en reserva.
   - tempo: "3-1-1-0" → bajada · pausa abajo · subida · pausa arriba (en segundos). */

export const RIR_VALUES = [0, 1, 2, 3, 4, 5];
export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
export const TEMPO_RE = /^[0-9X]{1,2}(-[0-9X]{1,2}){2,3}$/i;

export const effortLabel = (e) => (e?.type === "rir" ? `RIR ${e.value}` : e?.type === "rpe" ? `RPE ${String(e.value).replace(".", ",")}` : "");
export const effortHelp = (e) => (e?.type === "rir"
  ? `Termina cada serie dejando ${e.value} ${+e.value === 1 ? "repetición" : "repeticiones"} en reserva.`
  : e?.type === "rpe" ? `Esfuerzo percibido ${String(e.value).replace(".", ",")} de 10.` : "");
export const tempoHelp = (t) => {
  if (!t) return "";
  const [a, b, c, d] = t.split("-");
  const s = (v) => (/x/i.test(v) ? "explosivo" : `${v} s`);
  return `Bajada ${s(a)} · pausa ${s(b)} · subida ${s(c)}${d != null ? ` · pausa arriba ${s(d)}` : ""}`;
};

/**
 * Superseries de una lista de ejercicios: devuelve por índice { letter, pos, size, start, end }
 * (solo para ejercicios que forman parte de una superserie de 2 o más).
 */
export function supersets(exercises) {
  const out = {};
  let letter = 0;
  for (let i = 0; i < exercises.length; i++) {
    if (!exercises[i].linkNext || i === exercises.length - 1) continue;
    let j = i;
    while (j < exercises.length - 1 && exercises[j].linkNext) j++;
    const L = String.fromCharCode(65 + (letter++ % 26));
    for (let k = i; k <= j; k++) out[k] = { letter: L, pos: k - i + 1, size: j - i + 1, start: i, end: j };
    i = j;
  }
  return out;
}

/** Bloques para dibujar: ejercicios sueltos o superseries agrupadas. */
export function blocksOf(exercises) {
  const ss = supersets(exercises), blocks = [];
  for (let i = 0; i < exercises.length; i++) {
    const g = ss[i];
    if (g && g.pos === 1) { blocks.push({ kind: "superset", letter: g.letter, items: Array.from({ length: g.size }, (_, k) => i + k) }); i = g.end; }
    else blocks.push({ kind: "single", items: [i] });
  }
  return blocks;
}

/**
 * Al marcar la serie `si` del ejercicio `ei`, ¿qué sigue?
 * Dentro de una superserie se pasa al siguiente ejercicio de la ronda sin descanso;
 * al cerrar la ronda corre el descanso y se vuelve al primero que tenga series pendientes.
 */
export function afterSet(exercises, ei, si) {
  const g = supersets(exercises.map((e) => e.target || e))[ei];
  if (!g) return { rest: true, next: null };
  const doneCount = (e) => e.sets.filter((x) => x.done).length;
  for (let k = ei + 1; k <= g.end; k++) {
    const e = exercises[k];
    if (doneCount(e) <= si && e.sets.some((x) => !x.done)) return { rest: false, next: k };
  }
  for (let k = g.start; k <= g.end; k++) if (exercises[k].sets.some((x) => !x.done)) return { rest: true, next: k };
  return { rest: true, next: null };
}
