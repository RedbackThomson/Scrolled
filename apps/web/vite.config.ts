/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Deploying to a GitHub Pages project site (`<user>.github.io/<repo>/`) means
// every asset URL must be prefixed with the repo path. `BASE_PATH` is set by
// the deploy workflow; local dev/builds default to `/`.
const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Mushroom Explorer',
        short_name: 'Mushroom Explorer',
        description: 'Browse items, mobs, NPCs, maps, and quests from your game data, fully on-device.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the full build output so the app works fully offline once
        // loaded. `wasm` is the critical addition over Workbox defaults —
        // sqlite-wasm is ~1MB and would otherwise miss the cache.
        globPatterns: ['**/*.{js,css,html,wasm,woff2,svg,png,ico,webp}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: `${basePath}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
