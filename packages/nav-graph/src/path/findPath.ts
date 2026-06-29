// MVP pathfinding: fewest-hops BFS over the compiled adjacency.
//
// When an eligibility predicate is supplied:
//   1. Run BFS with the predicate pruning candidate edges.
//   2. If the destination is reachable that way, return `status: 'found'`.
//   3. Otherwise run BFS again *without* the filter. If a path exists, return
//      `status: 'unreachable-when-filtered'` with the unfiltered path as
//      `fallback` and the step indices the filter blocked. This is FR7 — the
//      app never has to surface a blank "no path" state when the graph itself
//      is connected.
//   4. If the unfiltered BFS also fails, return `status: 'unreachable'`.

import type { NavGraph } from '../compile/compileGraph';
import type { NodeId, TravelEdge } from '../ir/types';

export interface PathResult {
  status: 'found' | 'unreachable' | 'unreachable-when-filtered';
  steps: TravelEdge[];
  fallback?: {
    steps: TravelEdge[];
    /** Indices into `fallback.steps` whose eligibility predicate failed. */
    blocked: number[];
  };
}

export interface FindPathOptions {
  eligible?: (edge: TravelEdge) => boolean;
}

export function findPath(
  graph: NavGraph,
  from: NodeId,
  to: NodeId,
  opts: FindPathOptions = {},
): PathResult {
  assertNodeKnown(graph, from, 'from');
  assertNodeKnown(graph, to, 'to');

  if (from === to) return { status: 'found', steps: [] };

  const filtered = opts.eligible ? bfs(graph, from, to, opts.eligible) : null;
  if (filtered) return { status: 'found', steps: filtered };

  const unfiltered = bfs(graph, from, to);
  if (!unfiltered) return { status: 'unreachable', steps: [] };

  if (!opts.eligible) {
    return { status: 'found', steps: unfiltered };
  }

  const blocked: number[] = [];
  unfiltered.forEach((edge, i) => {
    if (!opts.eligible!(edge)) blocked.push(i);
  });
  return {
    status: 'unreachable-when-filtered',
    steps: [],
    fallback: { steps: unfiltered, blocked },
  };
}

function assertNodeKnown(graph: NavGraph, id: NodeId, label: 'from' | 'to'): void {
  if (!graph.nodes.has(id)) {
    throw new Error(`findPath ${label} references undeclared node "${id}".`);
  }
}

function bfs(
  graph: NavGraph,
  from: NodeId,
  to: NodeId,
  eligible?: (edge: TravelEdge) => boolean,
): TravelEdge[] | null {
  const cameFrom = new Map<NodeId, TravelEdge>();
  const visited = new Set<NodeId>([from]);
  const queue: NodeId[] = [from];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node === to) return reconstruct(cameFrom, from, to);

    const out = graph.adjacency.get(node) ?? [];
    for (const edge of out) {
      if (eligible && !eligible(edge)) continue;
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      cameFrom.set(edge.to, edge);
      queue.push(edge.to);
    }
  }
  return null;
}

function reconstruct(
  cameFrom: Map<NodeId, TravelEdge>,
  from: NodeId,
  to: NodeId,
): TravelEdge[] {
  const steps: TravelEdge[] = [];
  let cursor: NodeId = to;
  while (cursor !== from) {
    const edge = cameFrom.get(cursor);
    if (!edge) {
      // Defensive: BFS only stores cameFrom for reachable nodes, so this
      // branch is unreachable in practice — but typing the lookup demands it.
      throw new Error(`Path reconstruction broke at "${cursor}".`);
    }
    steps.push(edge);
    cursor = edge.from;
  }
  return steps.reverse();
}
