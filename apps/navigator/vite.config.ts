/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const basePath = process.env.BASE_PATH ?? '/';

/**
 * Read a compiled nav-graph JSON from disk when VITE_NAV_GRAPH_PATH is set,
 * for local iteration on datasets authored in another repo. `null` in the
 * default build. Failing loudly beats silently falling back — a set-but-broken
 * path is almost always a typo or a missing `nav-graph:build`.
 */
function loadExternalGraph(externalPath: string | undefined): unknown {
  if (!externalPath) return null;
  const abs = path.isAbsolute(externalPath)
    ? externalPath
    : path.resolve(process.cwd(), externalPath);
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new Error(
      `[navigator] Could not load VITE_NAV_GRAPH_PATH=${externalPath}: ${(err as Error).message}. ` +
        'Point it at a compiled nav-graph JSON (or unset it to use the built-in default).',
    );
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const external = loadExternalGraph(env.VITE_NAV_GRAPH_PATH ?? process.env.VITE_NAV_GRAPH_PATH);

  return {
    base: basePath,
    define: {
      __EXTERNAL_NAV_GRAPH__: JSON.stringify(external),
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
