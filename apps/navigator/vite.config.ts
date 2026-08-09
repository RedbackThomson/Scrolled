/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const basePath = process.env.BASE_PATH ?? '/';

const VIRTUAL_ID = 'virtual:external-nav-graph';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Serve a compiled nav-graph JSON authored in another repo (set via
 * VITE_NAV_GRAPH_PATH) as the module `virtual:external-nav-graph`, or `null`
 * for the default build.
 *
 * The JSON is *inlined* into the module (so production builds stay
 * self-contained), but `addWatchFile` + `handleHotUpdate` also make the dev
 * server watch the file and full-reload the UI whenever a `nav-graph:build`
 * rewrites it — so graph edits show up immediately without restarting Vite.
 * Failing loudly on a set-but-missing path beats a silent fallback (usually a
 * typo or a missing build).
 */
function externalNavGraph(externalPath: string | undefined): Plugin {
  let abs: string | null = null;
  if (externalPath) {
    abs = path.isAbsolute(externalPath)
      ? externalPath
      : path.resolve(process.cwd(), externalPath);
    if (!existsSync(abs)) {
      throw new Error(
        `[navigator] VITE_NAV_GRAPH_PATH=${externalPath} does not exist (${abs}). ` +
          'Point it at a compiled nav-graph JSON (run `nav-graph:build`), or unset it to use the built-in default.',
      );
    }
  }

  return {
    name: 'navigator:external-nav-graph',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      if (!abs) return 'export default null;';
      this.addWatchFile(abs);
      // The file is valid JSON, hence a valid JS expression — inline it.
      return `export default ${readFileSync(abs, 'utf8')};`;
    },
    handleHotUpdate(ctx) {
      if (!abs || ctx.file !== abs) return;
      const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) ctx.server.moduleGraph.invalidateModule(mod);
      ctx.server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const externalPath = env.VITE_NAV_GRAPH_PATH ?? process.env.VITE_NAV_GRAPH_PATH;

  return {
    base: basePath,
    plugins: [externalNavGraph(externalPath), react()],
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
