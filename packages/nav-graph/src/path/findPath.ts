// Weighted pathfinding: least-time Dijkstra over the compiled adjacency.
//
// Only `walk` edges cost time: every other method (portal, npc, item, skill)
// is a teleport-like transition, treated as instant. A walk edge costs its
// declared `seconds`, or `DEFAULT_WALK_SECONDS` when untimed — so a graph with
// no walk times set still routes sensibly (favouring teleports, then hops).
//
// When an eligibility predicate is supplied:
//   1. Run Dijkstra with the predicate pruning candidate edges.
//   2. If the destination is reachable that way, return `status: 'found'`.
//   3. Otherwise run Dijkstra again *without* the filter. If a path exists,
//      return `status: 'unreachable-when-filtered'` with the unfiltered path as
//      `fallback` and the step indices the filter blocked. This is FR7 — the
//      app never has to surface a blank "no path" state when the graph itself
//      is connected.
//   4. If the unfiltered search also fails, return `status: 'unreachable'`.

import type { NavGraph } from '../compile/compileGraph';
import type { NodeId, TravelEdge } from '../ir/types';

/** Assumed travel time, in seconds, for a walk edge that declares no `seconds`. */
export const DEFAULT_WALK_SECONDS = 60;

/**
 * Travel time an edge contributes to a route. Only walking takes time;
 * portal / npc / item / skill transitions teleport the player instantly.
 */
export function edgeSeconds(edge: TravelEdge): number {
  if (edge.method !== 'walk') return 0;
  return edge.seconds ?? DEFAULT_WALK_SECONDS;
}

export interface PathResult {
  status: 'found' | 'unreachable' | 'unreachable-when-filtered';
  steps: TravelEdge[];
  /** Total estimated travel time of `steps`, in seconds. 0 when `steps` empty. */
  totalSeconds: number;
  fallback?: {
    steps: TravelEdge[];
    totalSeconds: number;
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

  if (from === to) return { status: 'found', steps: [], totalSeconds: 0 };

  const filtered = opts.eligible ? dijkstra(graph, from, to, opts.eligible) : null;
  if (filtered) {
    return { status: 'found', steps: filtered.steps, totalSeconds: filtered.totalSeconds };
  }

  const unfiltered = dijkstra(graph, from, to);
  if (!unfiltered) return { status: 'unreachable', steps: [], totalSeconds: 0 };

  if (!opts.eligible) {
    return { status: 'found', steps: unfiltered.steps, totalSeconds: unfiltered.totalSeconds };
  }

  const blocked: number[] = [];
  unfiltered.steps.forEach((edge, i) => {
    if (!opts.eligible!(edge)) blocked.push(i);
  });
  return {
    status: 'unreachable-when-filtered',
    steps: [],
    totalSeconds: 0,
    fallback: { steps: unfiltered.steps, totalSeconds: unfiltered.totalSeconds, blocked },
  };
}

function assertNodeKnown(graph: NavGraph, id: NodeId, label: 'from' | 'to'): void {
  if (!graph.nodes.has(id)) {
    throw new Error(`findPath ${label} references undeclared node "${id}".`);
  }
}

interface RoutedPath {
  steps: TravelEdge[];
  totalSeconds: number;
}

function dijkstra(
  graph: NavGraph,
  from: NodeId,
  to: NodeId,
  eligible?: (edge: TravelEdge) => boolean,
): RoutedPath | null {
  const dist = new Map<NodeId, number>([[from, 0]]);
  const cameFrom = new Map<NodeId, TravelEdge>();
  const settled = new Set<NodeId>();
  const frontier = new MinHeap();
  frontier.push(from, 0);

  while (!frontier.isEmpty()) {
    const node = frontier.pop()!;
    if (settled.has(node)) continue; // stale heap entry — already finalized
    if (node === to) return { steps: reconstruct(cameFrom, from, to), totalSeconds: dist.get(to)! };
    settled.add(node);

    const base = dist.get(node)!;
    for (const edge of graph.adjacency.get(node) ?? []) {
      if (eligible && !eligible(edge)) continue;
      if (settled.has(edge.to)) continue;
      const next = base + edgeSeconds(edge);
      if (next < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, next);
        cameFrom.set(edge.to, edge);
        frontier.push(edge.to, next);
      }
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
      // Defensive: Dijkstra only stores cameFrom for reachable nodes, so this
      // branch is unreachable in practice — but typing the lookup demands it.
      throw new Error(`Path reconstruction broke at "${cursor}".`);
    }
    steps.push(edge);
    cursor = edge.from;
  }
  return steps.reverse();
}

// Binary min-heap keyed by tentative distance. Uses lazy deletion — a node can
// appear more than once and settled entries are skipped on pop.
class MinHeap {
  private readonly nodes: NodeId[] = [];
  private readonly keys: number[] = [];

  isEmpty(): boolean {
    return this.nodes.length === 0;
  }

  push(node: NodeId, key: number): void {
    this.nodes.push(node);
    this.keys.push(key);
    this.bubbleUp(this.nodes.length - 1);
  }

  pop(): NodeId | undefined {
    if (this.nodes.length === 0) return undefined;
    const top = this.nodes[0];
    const lastNode = this.nodes.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.keys[0] = lastKey;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.nodes.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.keys[left] < this.keys[smallest]) smallest = left;
      if (right < n && this.keys[right] < this.keys[smallest]) smallest = right;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    [this.nodes[a], this.nodes[b]] = [this.nodes[b], this.nodes[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}
