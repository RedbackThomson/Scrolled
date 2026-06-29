// Registry of authored graphs, keyed by `profileId`. The CLI looks them up
// here; the future Navigator app will resolve the active profile and pull the
// matching source the same way.

import type { NavGraphSource } from '../ir/types';
import { starterGraph } from './starter/index';

export const GRAPHS: Readonly<Record<string, NavGraphSource>> = Object.freeze({
  [starterGraph.profileId]: starterGraph,
});

export const DEFAULT_GRAPH_ID = starterGraph.profileId;

export function getGraph(profileId: string): NavGraphSource | undefined {
  return GRAPHS[profileId];
}

export function listGraphIds(): string[] {
  return Object.keys(GRAPHS);
}
