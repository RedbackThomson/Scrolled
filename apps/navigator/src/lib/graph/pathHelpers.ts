// Shared helpers for turning a PathResult into the node/edge sets the map uses
// to highlight a route. Extracted so GraphCanvas and the collapse view-model
// agree on one definition of "on the path".

import type { NavGraph, NodeId, PathResult, TravelEdge } from '@scrolled/nav-graph';

/** The steps to treat as the active route — the found path, or the fallback. */
export function activeSteps(result: PathResult | null): readonly TravelEdge[] {
  if (!result) return [];
  if (result.status === 'found') return result.steps;
  if (result.status === 'unreachable-when-filtered') return result.fallback?.steps ?? [];
  return [];
}

/**
 * The keys of the authored source edges the route traverses, keyed
 * `${from}->${to}#${index}` against `graph.source.edges`. A step may traverse a
 * bidirectional source edge in either direction, so we match both orientations.
 */
export function pathEdgeKeys(graph: NavGraph, steps: readonly TravelEdge[]): Set<string> {
  const keys = new Set<string>();
  for (const step of steps) {
    for (let i = 0; i < graph.source.edges.length; i++) {
      const src = graph.source.edges[i];
      if (src.method !== step.method) continue;
      const sameDir = src.from === step.from && src.to === step.to;
      const reverseBi = src.bidirectional && src.from === step.to && src.to === step.from;
      if (sameDir || reverseBi) {
        keys.add(`${src.from}->${src.to}#${i}`);
        break;
      }
    }
  }
  return keys;
}

/** Every node id the route visits (both endpoints of every step). */
export function pathNodeIds(steps: readonly TravelEdge[]): Set<NodeId> {
  const ids = new Set<NodeId>();
  for (const step of steps) {
    ids.add(step.from);
    ids.add(step.to);
  }
  return ids;
}
