/* Animaciones y miniaturas de la biblioteca de ejercicios (© Gym visual, con licencia).
   Viven en DATA_DIR/media/ejercicios/{a,t}/<id>.webp, fuera del código, para que cada
   despliegue no tenga que volver a subirlas (son ~50 MB).
   Para instalarlas o actualizarlas se suben a public_html/media-import/ejercicios/{a,t}/
   (después de desplegar): el servidor las mueve aquí en menos de 2 minutos. */
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { config, ROOT } from "./config.js";

export const MEDIA_DIR = path.join(config.dataDir, "media", "ejercicios");

function importFrom(dir) {
  let n = 0;
  for (const sub of ["a", "t"]) {
    const from = path.join(dir, sub);
    if (!fs.existsSync(from)) continue;
    const to = path.join(MEDIA_DIR, sub);
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) {
      if (!/^\d+\.webp$/.test(f)) continue;
      fs.copyFileSync(path.join(from, f), path.join(to, f));
      fs.unlinkSync(path.join(from, f));
      n++;
    }
  }
  return n;
}

/** Mueve los medios recién subidos (si hay) a su carpeta definitiva; revisa cada 2 minutos
    (el despliegue vacía public_html, así que se suben después de desplegar). */
export function importMedia() {
  scan(true);
  setInterval(() => scan(false), 120e3).unref();
}
function scan(report) {
  const dirs = [
    process.env.MEDIA_IMPORT_DIR,
    path.resolve(ROOT, "../../../public_html/media-import/ejercicios"),
    path.resolve(ROOT, "../../public_html/media-import/ejercicios"),
  ].filter(Boolean);
  for (const dir of new Set(dirs)) {
    try {
      if (!fs.existsSync(dir)) continue;
      const n = importFrom(dir);
      if (n) { console.log(`[medios] ${n} archivos importados desde ${dir}`); report = true; }
    } catch (e) {
      console.error("[medios] no se pudieron importar:", e.message);
    }
  }
  if (!report) return;
  try {
    const count = (s) => (fs.existsSync(path.join(MEDIA_DIR, s)) ? fs.readdirSync(path.join(MEDIA_DIR, s)).length : 0);
    console.log(`[medios] animaciones: ${count("a")} · miniaturas: ${count("t")}`);
  } catch { /* nada */ }
}

export function mountMedia(app) {
  app.use("/media/ejercicios", express.static(MEDIA_DIR, { maxAge: "30d", immutable: true, index: false }), (_req, res) => res.status(404).end());
}
