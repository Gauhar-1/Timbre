import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// The web app is a pure Phoenix client. In dev it runs on :5173 and proxies
// /api/* + /healthz to the Phoenix API on :4010, so the browser only ever
// talks to one origin and no CORS is involved.
export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  // Vitest configuration for automated UI tests
  // @ts-expect-error vitest config extension
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  server: {
    port: 5173,
    // Allow importing ASSIGNMENT.md from the repo root (one level above web/).
    fs: { allow: ['.', '..'] },
    proxy: {
      '/api': { target: 'http://localhost:4010', changeOrigin: true },
      '/healthz': { target: 'http://localhost:4010', changeOrigin: true },
      '/socket': { target: 'http://localhost:4010', ws: true },
    },
  },
})
