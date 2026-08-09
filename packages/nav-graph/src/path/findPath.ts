// Weighted pathfinding: least-time Dijkstra over the compiled adjacency.
//
// Two methods cost time — `walk` and `transport` (boats/trains/carpets). Each
// costs its declared `seconds`, or its method default when untimed, so a graph
// with no times set still routes sensibly. Every other method (portal, npc,
// item, skill) is a teleport-like transition, treated as instant.
//
// `transport` time is *conditional*: with fast travel enabled (the player holds
// a fast-travel ticket), every transport hop is instant, so routes prefer boats
// over long walks; without it, transports cost their ride time and the router
// may route around them.
//
// `scroll` edges (return-to-nearest-town) are *availability*-conditional: they
// are traversable only when `nearestTownScroll` is set (the player carries
// return scrolls). They are instant like other teleports when enabled.
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
 * Assumed ride time, in seconds, for a transport edge that declares no
 * `seconds`. Longer than a walk hop: boarding a boat/train means waiting for it.
 */
export const DEFAULT_TRANSPORT_SECONDS = 300;

/** Cost inputs that depend on the traveller, not the edge. */
export interface EdgeCostOptions {
  /** When true, `transport` hops are instant (the player has a fast-travel ticket). */
  fastTravel?: boolean;
}

/**
 * Travel time an edge contributes to a route. `walk` always costs time;
 * `transport` costs its ride time unless `fastTravel` waives it; portal / npc /
 * item / skill transitions teleport the player instantly.
 */
export function edgeSeconds(edge: TravelEdge, opts: EdgeCostOptions = {}): number {
  switch (edge.method) {
    case 'walk':
      return edge.seconds ?? DEFAULT_WALK_SECONDS;
    case 'transport':
      return opts.fastTravel ? 0 : (edge.seconds ?? DEFAULT_TRANSPORT_SECONDS);
    default:
      return 0;
  }
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
  /**
   * When true, `transport` hops (boats/trains/carpets) are treated as instant —
   * the traveller holds a fast-travel ticket. Affects route *cost*, never
   * *reachability*: transports are always traversable either way.
   */
  fastTravel?: boolean;
  /**
   * When true, `scroll` edges (return to nearest town) are traversable — the
   * traveller carries return scrolls. When false (default) they are skipped
   * entirely, so a route never assumes a scroll the player doesn't have.
   */
  nearestTownScroll?: boolean;
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

  const cost: EdgeCostOptions = { fastTravel: opts.fastTravel };
  const allowScroll = opts.nearestTownScroll ?? false;
  const filtered = opts.eligible
    ? dijkstra(graph, from, to, cost, allowScroll, opts.eligible)
    : null;
  if (filtered) {
    return { status: 'found', steps: filtered.steps, totalSeconds: filtered.totalSeconds };
  }

  const unfiltered = dijkstra(graph, from, to, cost, allowScroll);
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
  cost: EdgeCostOptions,
  allowScroll: boolean,
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
      if (edge.method === 'scroll' && !allowScroll) continue;
      if (eligible && !eligible(edge)) continue;
      if (settled.has(edge.to)) continue;
      const next = base + edgeSeconds(edge, cost);
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
