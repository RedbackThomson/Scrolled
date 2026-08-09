/// <reference types="vite/client" />

declare module 'virtual:external-nav-graph' {
  import type { NavGraphSource } from '@scrolled/nav-graph';

  // Resolved by the `navigator:external-nav-graph` Vite plugin (vite.config.ts)
  // to the compiled graph JSON at VITE_NAV_GRAPH_PATH, or `null` when unset.
  const graph: NavGraphSource | null;
  export default graph;
}
