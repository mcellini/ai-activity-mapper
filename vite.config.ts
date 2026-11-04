import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// base "./" permette il deploy su GitHub Pages in qualsiasi sottocartella
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
