/* Protección contra sobrecarga.
   - Nivel de carga según el retraso del bucle de eventos y las tareas en espera.
   - El servidor le dice a cada app cada cuánto actualizar (X-Poll-Interval): con mucha
     gente conectada las apps consultan menos y nadie se queda colgado.
   - Las tareas pesadas (armar el estado) pasan por una fila con cupo: nunca se arman
     cientos a la vez, y si la fila está llena se responde «intenta en unos segundos». */
import { HttpError } from "./util.js";
import { eventLoopLag, inFlight } from "./metrics.js";

export function gate(limit, maxQueue = 300, waitMs = 20e3) {
  let active = 0;
  const waiting = [];
  const release = () => {
    active--;
    while (waiting.length && active < limit) {
      const w = waiting.shift();
      if (w.dead) continue;
      clearTimeout(w.timer);
      active++;
      w.resolve();
    }
  };
  return {
    async run(fn) {
      if (active >= limit) {
        if (waiting.length >= maxQueue) throw new HttpError(503, "El servidor está muy ocupado. Intenta en unos segundos.", { code: "busy" });
        await new Promise((resolve, reject) => {
          const w = { resolve, dead: false };
          w.timer = setTimeout(() => { w.dead = true; reject(new HttpError(503, "El servidor está muy ocupado. Intenta en unos segundos.", { code: "busy" })); }, waitMs);
          waiting.push(w);
        });
      } else active++;
      try { return await fn(); } finally { release(); }
    },
    info: () => ({ active, waiting: waiting.filter((w) => !w.dead).length, limit }),
  };
}

/** Fila para armar estados (lo más pesado). */
export const stateGate = gate(Math.max(2, +process.env.STATE_BUILDS || 6), 400);

/** 0 = normal · 1 = ocupado · 2 = saturado */
export function loadLevel() {
  const lag = eventLoopLag();
  const q = stateGate.info().waiting;
  const inflight = inFlight();
  if (lag > 500 || q > 100 || inflight > 400) return 2;
  if (lag > 150 || q > 20 || inflight > 150) return 1;
  return 0;
}
/** Segundos sugeridos entre actualizaciones según la carga. */
export const pollSeconds = () => [20, 45, 90][loadLevel()];
