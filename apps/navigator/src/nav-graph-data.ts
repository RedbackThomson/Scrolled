import { DEFAULT_GRAPH_ID, getGraph, type NavGraphSource } from '@scrolled/nav-graph';
import externalGraph from 'virtual:external-nav-graph';

// `virtual:external-nav-graph` is a NavGraphSource-shaped object when
// VITE_NAV_GRAPH_PATH is set (see apps/navigator/vite.config.ts), or `null`
// otherwise. Contributors iterating on a graph dataset in another repo can point
// Navigator at their compiled nav-graph JSON without touching this file — and
// edits to it hot-reload the UI.
const fallback = getGraph(DEFAULT_GRAPH_ID);
if (!fallback) {
  throw new Error(`Built-in nav-graph registry has no entry for "${DEFAULT_GRAPH_ID}".`);
}

const source: NavGraphSource = externalGraph ?? fallback;

export default source;
