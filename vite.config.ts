import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // En desarrollo: base "/"
  // En producción (build para GitHub Pages): "/registro_horas/"
  base: mode === "production" ? "/registro_horas/" : "/",
}));
