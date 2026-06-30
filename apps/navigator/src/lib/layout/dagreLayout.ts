import dagre from '@dagrejs/dagre';
import type { NavGraph, NodeId } from '@scrolled/nav-graph';

export interface NodePosition {
  x: number;
  y: number;
}

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
}

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 64;
const NODE_SEP = 36;
const RANK_SEP = 96;

// Dagre returns each node's centre; React Flow's `position` is the top-left
// corner, so callers subtract half the rendered width/height. Multigraph mode
// lets the starter slice keep its two harbour↔lighthouse edges (walk + item)
// distinct under one (source, target) pair.
export function dagreLayout(
  graph: NavGraph,
  { nodeWidth = DEFAULT_NODE_WIDTH, nodeHeight = DEFAULT_NODE_HEIGHT }: LayoutOptions = {},
): Map<NodeId, NodePosition> {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: NODE_SEP, ranksep: RANK_SEP });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes.values()) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }
  graph.source.edges.forEach((edge, index) => {
    g.setEdge(edge.from, edge.to, {}, `e${index}`);
  });

  dagre.layout(g);

  const positions = new Map<NodeId, NodePosition>();
  for (const id of graph.nodes.keys()) {
    const n = g.node(id);
    positions.set(id, { x: n.x - nodeWidth / 2, y: n.y - nodeHeight / 2 });
  }
  return positions;
}
