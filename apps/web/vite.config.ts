/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // `@sqlite.org/sqlite-wasm` loads its WASM blob via
  // `new URL('./sqlite3.wasm', import.meta.url)`. If Vite pre-bundles the
  // package into `node_modules/.vite/deps/`, that URL resolves to a directory
  // where the WASM file does NOT sit — Vite's SPA fallback then serves
  // index.html for the request and the library fails with
  // "wasm validation error: at offset 4: failed to match magic number".
  // Excluding the package from pre-bundling makes Vite serve it from its real
  // node_modules location where the WASM is alongside the JS.
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    // Default to a generous timeout — WZ parsing of real files can take a while.
    testTimeout: 30_000,
  },
});
