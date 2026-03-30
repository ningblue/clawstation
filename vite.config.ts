import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    devSourcemap: true,
    minify: false,
  },
  build: {
    cssMinify: false,
  },
})
