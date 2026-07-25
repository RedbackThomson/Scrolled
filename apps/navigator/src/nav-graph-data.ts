import { DEFAULT_GRAPH_ID, getGraph, type NavGraphSource } from '@scrolled/nav-graph';

// Vite `define`s this at build time to a NavGraphSource-shaped object when
// VITE_NAV_GRAPH_PATH is set (see apps/navigator/vite.config.ts), and to `null`
// otherwise. Contributors iterating on a graph dataset in another repo can
// point Navigator at their compiled nav-graph JSON without touching this file.
declare const __EXTERNAL_NAV_GRAPH__: NavGraphSource | null;

const fallback = getGraph(DEFAULT_GRAPH_ID);
if (!fallback) {
  throw new Error(`Built-in nav-graph registry has no entry for "${DEFAULT_GRAPH_ID}".`);
}

const source: NavGraphSource = __EXTERNAL_NAV_GRAPH__ ?? fallback;

export default source;
