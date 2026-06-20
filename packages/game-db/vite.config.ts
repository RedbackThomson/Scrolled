import path from 'node:path';
import { defineConfig } from 'vite';

// Source-only package. Vite config exists so Vitest resolves the sqlite-wasm
// asset the same way the app does, and so the internal `@/*` alias resolves.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
  },
});
