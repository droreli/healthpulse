import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "src/frontend"),
  plugins: [react()],
  server: {
    allowedHosts: true
  },
  build: {
    outDir: path.resolve(__dirname, "dist/client"),
    emptyOutDir: true
  }
});
