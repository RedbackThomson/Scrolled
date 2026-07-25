/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Deploying to a GitHub Pages project site (`<user>.github.io/<repo>/`) means
// every asset URL must be prefixed with the repo path. `BASE_PATH` is set by
// the deploy workflow; local dev/builds default to `/`.
const basePath = process.env.BASE_PATH ?? '/';

// Absolute origin (optionally with a sub-path) of the canonical deployment,
// e.g. `https://scrolled.dev`. Drives the absolute URLs that social/SEO
// crawlers require (og:image, canonical). Self-hosters and forks that don't
// set it ship root-relative URLs — fine for the app, just no rich embeds.
const siteUrl = (process.env.VITE_SITE_URL ?? '').replace(/\/+$/, '');

/** Stable vendor splits — smaller route chunks and better long-term caching. */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return;
  if (id.includes('@dagrejs')) return 'vendor-dagre';
  if (id.includes('lucide-react')) return 'vendor-icons';
  if (id.includes('@tanstack')) return 'vendor-tanstack';
  if (id.includes('@radix-ui') || id.includes('cmdk')) return 'vendor-ui';
  if (
    id.includes('/react-dom/') ||
    id.includes('/react-router') ||
    id.includes('/react/') ||
    id.includes('/scheduler/')
  ) {
    return 'vendor-react';
  }
  return undefined;
}

export default defineConfig(({ mode }) => {
  // Mode-aware env (`.env`, `.env.local`, `.env.<mode>`, `.env.<mode>.local`,
  // plus any matching shell vars). Cloud identity (Supabase) is opt-in per
  // deployment; folding the mode into a build-time boolean lets Rollup
  // dead-code-eliminate the dynamic import of `@scrolled/identity-cloud` in
  // every other build, so the auth SDK is never emitted into a generic bundle.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const identityCloud = env.VITE_IDENTITY_MODE === 'cloud';
  // Same dead-code-elimination trick for the sync transport: folding the mode
  // into a build-time boolean lets Rollup drop the dynamic import of
  // `@scrolled/sync-supabase` in every build that doesn't opt in, so the
  // Supabase SDK is never emitted into a self-hosted or sync-off bundle.
  const syncSupabase = env.VITE_SYNC_MODE === 'supabase';

  return {
    base: basePath,
    define: {
      __IDENTITY_CLOUD__: JSON.stringify(identityCloud),
      __SYNC_SUPABASE__: JSON.stringify(syncSupabase),
    },
    plugins: [
      {
        name: 'inject-site-url',
        transformIndexHtml(html) {
          return html.replaceAll('__SITE_URL__', siteUrl);
        },
      },
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'Scrolled',
          short_name: 'Scrolled',
          description:
            'Browse items, mobs, NPCs, maps, and quests from your game data, fully on-device.',
          theme_color: '#18181b',
          background_color: '#18181b',
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
          // Hosted dataset artifacts (a fixed deployment copies them under
          // `datasets/`) are large and installed into OPFS at runtime — never
          // precache them. The `navigator/` subdir is a sibling app staged
          // into dist-fixed/ by co-deployments (see scrolled-mapleroyals's
          // publish.yml); the wiki's SW must not slurp its assets.
          globIgnores: ['**/datasets/**', '**/navigator/**'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: `${basePath}index.html`,
          // `/datasets/*` is a data-only subtree; `/navigator/*` is a sibling
          // SPA and must handle its own navigations even when the wiki's SW is
          // active on the same origin.
          navigateFallbackDenylist: [/^\/datasets\//, /^\/navigator\//],
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
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
      // Default to a generous timeout — WZ parsing of real files can take a while.
      testTimeout: 30_000,
    },
  };
});
