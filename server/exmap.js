/* Biblioteca de ejercicios v2 (1.324 ejercicios, ids 10000+): la v1 (ids 1–217) se reemplazó.
   exmap.json dice a qué ejercicio nuevo pasa cada uno viejo; se usa una vez en la migración
   y también al recibir datos de una app vieja o guardados sin conexión. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAP = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "exmap.json"), "utf8"));

/** Id nuevo de un ejercicio de la biblioteca vieja; cualquier otro id queda igual. */
export const mapEx = (id) => {
  const n = +id;
  return Number.isInteger(n) && n > 0 && n < 10000 && MAP[n] ? MAP[n] : id;
};

/** Recorre un objeto y cambia todos los `exId` (y las claves de `bests`) a la biblioteca nueva. */
export function remapDeep(v) {
  if (Array.isArray(v)) return v.map(remapDeep);
  if (!v || typeof v !== "object") return v;
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === "exId" && x != null) out[k] = typeof x === "string" ? String(mapEx(x)) : mapEx(x);
    else if (k === "bests" && x && typeof x === "object" && !Array.isArray(x)) {
      const b = {};
      for (const [id, rec] of Object.entries(x)) {
        const nid = String(mapEx(id));
        const cur = b[nid];
        // dos ejercicios viejos pueden ir al mismo nuevo: se queda el mejor
        b[nid] = !cur || (rec?.w ?? 0) > (cur?.w ?? 0) ? rec : cur;
      }
      out[k] = b;
    } else out[k] = remapDeep(x);
  }
  return out;
}
