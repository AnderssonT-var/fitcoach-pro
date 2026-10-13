import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa: el build funciona en la raíz o dentro de una subcarpeta (p. ej. GitHub Pages /demos/fitcoach/)
export default defineConfig({
  base: './',
  plugins: [react()],
})
