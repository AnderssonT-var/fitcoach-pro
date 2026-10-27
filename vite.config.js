import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/* Service worker: al compilar se le escribe la lista de archivos de la app para guardarlos
   todos al instalar (la app abre sin internet, también instalada desde Safari en iPhone). */
function precache() {
  let outDir;
  return {
    name: "vytrafit-precache",
    apply: "build",
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    closeBundle() {
      const files = [];
      const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(path.relative(outDir, p).split(path.sep).join("/")); } };
      walk(outDir);
      const list = files.filter((f) => !f.startsWith("ejercicios/") && f !== "sw.js" && !f.endsWith(".map") && !f.endsWith(".txt"))
        .map((f) => (f === "index.html" ? "./" : `./${f}`)).sort();
      const hash = crypto.createHash("sha1");
      for (const f of files.filter((x) => !x.startsWith("ejercicios/") && x !== "sw.js")) hash.update(f).update(String(fs.statSync(path.join(outDir, f)).size));
      const swPath = path.join(outDir, "sw.js");
      const sw = fs.readFileSync(swPath, "utf8")
        .replace("self.__BUILD__ = \"dev\";", `self.__BUILD__ = ${JSON.stringify(`${pkg.version}-${hash.digest("hex").slice(0, 10)}`)};`)
        .replace("self.__PRECACHE__ = [];", `self.__PRECACHE__ = ${JSON.stringify(list)};`);
      fs.writeFileSync(swPath, sw);
    },
  };
}

// base relativa: el mismo build sirve para el servidor web y para la app Android (Capacitor)
export default defineConfig({
  base: "./",
  plugins: [react(), precache()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    // En desarrollo, la API corre aparte (npm run dev:server)
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: false } },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // React y el catálogo de ejercicios cambian poco: van aparte para que el navegador los reutilice entre versiones
        manualChunks: (id) => {
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react";
          if (id.includes("/src/store/exercises.js")) return "ejercicios";
        },
      },
    },
  },
});
