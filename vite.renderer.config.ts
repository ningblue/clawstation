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
      onwarn(warning, warn) {
        // 忽略 highlight.js 的警告
        if (warning.code === 'UNRESOLVED_IMPORT') {
          return;
        }
        if (warning.code === 'MODULE_NOT_FOUND') {
          return;
        }
        warn(warning);
      }
    },
  },
  resolve: {
    alias: {
      "@": path.join(__dirname, "src", "renderer"),
    },
  },
});
