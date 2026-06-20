import path from 'node:path';
import { defineConfig } from 'vite';

// Source-only package. Vite config exists so the build CLI can run under
// `vite-node` (resolving `import.meta.glob` for server profiles and the
// sqlite-wasm asset exactly as the test environment does) and so Vitest
// resolves the internal `@/*` alias.
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
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    // Default to a generous timeout — WZ parsing of real files can take a while.
    testTimeout: 30_000,
  },
});
