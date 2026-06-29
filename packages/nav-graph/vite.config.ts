import path from 'node:path';
import { defineConfig } from 'vite';

// Source-only package. Vite config exists so Vitest resolves the internal
// `@/*` alias and so the export CLI runs through vite-node.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
