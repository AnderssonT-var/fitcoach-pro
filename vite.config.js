import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa: el mismo build sirve para el servidor web y para la app Android (Capacitor)
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    // En desarrollo, la API corre aparte (npm run dev:server)
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: false } },
  },
  build: { chunkSizeWarningLimit: 1200 },
});
