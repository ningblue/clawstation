import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, "src", "renderer"),
  base: "./",
  css: {
    devSourcemap: true,
  },
  build: {
    outDir: path.join(__dirname, "dist", "renderer"),
    emptyOutDir: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: path.join(__dirname, "src", "renderer", "index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.join(__dirname, "src", "renderer"),
    },
  },
});
