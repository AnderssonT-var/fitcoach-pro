/* VYTRAFIT — punto de entrada del servidor (npm start).
   Sin await de nivel superior: el lanzador de Node.js del hosting carga este archivo con require(). */
import { start } from "./server/index.js";

start().catch((e) => { console.error("[VYTRAFIT] no pudo arrancar:", e); process.exit(1); });
