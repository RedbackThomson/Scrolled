// Two-pass dagre layout for the collapsed/expanded map.
//
// Expanded regions are React Flow parent nodes; their areas are children
// positioned relative to the parent. dagre has no first-class notion of that,
// so we run it twice:
//   1. Child pass — lay out each expanded region's areas on their own, which
//      also tells us how big the container has to be.
//   2. Top-level pass — lay out region nodes, ungrouped areas, and the sized
//      containers together, routing cross-container edges to their container so
//      connected regions rank near each other.
//
// Returned positions follow React Flow's model: child nodes get a position
// relative to their container; everything top-level gets an absolute position.

import dagre from '@dagrejs/dagre';
import type { DisplayEdge, DisplayNode } from '@/lib/graph/collapseView';

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeSize {
  width: number;
  height: number;
}

export interface NestedLayoutOptions {
  areaWidth?: number;
  areaHeight?: number;
  regionWidth?: number;
  regionHeight?: number;
}

export interface NestedLayoutResult {
  positions: Map<string, NodePosition>;
  sizes: Map<string, NodeSize>;
}

const DEFAULTS = { areaWidth: 180, areaHeight: 64, regionWidth: 200, regionHeight: 72 };
const NODE_SEP = 36;
const RANK_SEP = 96;
// Room inside an expanded container: a header band for the region name and a
// uniform pad around the child layout.
const CONTAINER_PAD = 16;
const CONTAINER_HEADER = 30;

export function nestedLayout(
  nodes: DisplayNode[],
  edges: DisplayEdge[],
  options: NestedLayoutOptions = {},
): NestedLayoutResult {
  const opts = { ...DEFAULTS, ...options };
  const positions = new Map<string, NodePosition>();
  const sizes = new Map<string, NodeSize>();

  const childToParent = new Map<string, string>();
  for (const n of nodes) {
    if (n.parentId) childToParent.set(n.id, n.parentId);
  }

  // ---- Pass 1: children of each expanded container ----
  const childrenByContainer = new Map<string, DisplayNode[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const list = childrenByContainer.get(n.parentId) ?? [];
      list.push(n);
      childrenByContainer.set(n.parentId, list);
    }
  }

  const containerSize = new Map<string, NodeSize>();
  for (const [containerId, children] of childrenByContainer) {
    const internal = edges.filter(
      (e) => childToParent.get(e.source) === containerId && childToParent.get(e.target) === containerId,
    );
    const laid = layoutChildren(children, internal, opts.areaWidth, opts.areaHeight);
    for (const [id, pos] of laid.positions) {
      positions.set(id, pos);
      sizes.set(id, { width: opts.areaWidth, height: opts.areaHeight });
    }
    containerSize.set(containerId, laid.container);
    sizes.set(containerId, laid.container);
  }

  // ---- Pass 2: top-level nodes ----
  const topLevel = nodes.filter((n) => !n.parentId);
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: NODE_SEP, ranksep: RANK_SEP });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of topLevel) {
    const size =
      n.kind === 'region-container'
        ? (containerSize.get(n.id) ?? { width: opts.regionWidth, height: opts.regionHeight })
        : n.kind === 'region-collapsed'
          ? { width: opts.regionWidth, height: opts.regionHeight }
          : { width: opts.areaWidth, height: opts.areaHeight };
    if (n.kind !== 'region-container') sizes.set(n.id, size);
    g.setNode(n.id, { width: size.width, height: size.height });
  }

  const rep = (id: string): string => childToParent.get(id) ?? id;
  edges.forEach((e, index) => {
    const s = rep(e.source);
    const t = rep(e.target);
    if (s === t) return; // internal to one container — handled in pass 1
    g.setEdge(s, t, {}, `e${index}`);
  });

  dagre.layout(g);
  for (const n of topLevel) {
    const dn = g.node(n.id);
    const size = sizes.get(n.id) ?? { width: opts.areaWidth, height: opts.areaHeight };
    positions.set(n.id, { x: dn.x - size.width / 2, y: dn.y - size.height / 2 });
  }

  return { positions, sizes };
}

interface ChildLayout {
  positions: Map<string, NodePosition>;
  container: NodeSize;
}

function layoutChildren(
  children: DisplayNode[],
  internal: DisplayEdge[],
  areaWidth: number,
  areaHeight: number,
): ChildLayout {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: NODE_SEP, ranksep: RANK_SEP });
  g.setDefaultEdgeLabel(() => ({}));

  for (const c of children) g.setNode(c.id, { width: areaWidth, height: areaHeight });
  internal.forEach((e, index) => g.setEdge(e.source, e.target, {}, `e${index}`));
  dagre.layout(g);

  // Collect raw top-left corners, then shift so the layout sits at
  // (CONTAINER_PAD, CONTAINER_PAD + CONTAINER_HEADER) inside the container.
  const raw = new Map<string, NodePosition>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of children) {
    const dn = g.node(c.id);
    const x = dn.x - areaWidth / 2;
    const y = dn.y - areaHeight / 2;
    raw.set(c.id, { x, y });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + areaWidth);
    maxY = Math.max(maxY, y + areaHeight);
  }

  const positions = new Map<string, NodePosition>();
  for (const [id, pos] of raw) {
    positions.set(id, {
      x: pos.x - minX + CONTAINER_PAD,
      y: pos.y - minY + CONTAINER_PAD + CONTAINER_HEADER,
    });
  }
  const container: NodeSize = {
    width: maxX - minX + CONTAINER_PAD * 2,
    height: maxY - minY + CONTAINER_PAD * 2 + CONTAINER_HEADER,
  };
  return { positions, container };
}
