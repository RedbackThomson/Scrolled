// The semantic-zoom view-model. Turns the fully-compiled NavGraph plus the
// current view state (which regions are expanded, which nodes/edges are on the
// route) into the reduced set of nodes and edges the map should actually draw.
//
// Rules, in order:
//   - Regions collapse to a single node by default. Ungrouped nodes always
//     render individually.
//   - A region expands when the user opens it (all its areas) or when the route
//     passes through it (only the areas the route visits).
//   - `minor` edges are hidden unless they're on the route.
//   - Edges internal to a collapsed region are dropped; edges touching a hidden
//     area of an expanded region are dropped.
//   - Remaining edges are aggregated so at most one line is drawn between any
//     pair of displayed nodes (the "one line per region pair" collapse).
//
// Pure and React-free so the reduction is unit-testable on its own.

import type { GroupId, NavGraph, NodeId, TravelMethod } from '@scrolled/nav-graph';

export type DisplayNodeKind = 'area' | 'region-collapsed' | 'region-container';

export interface DisplayNode {
  /** Stable render id: the NodeId for areas, `region:<groupId>` for regions. */
  id: string;
  kind: DisplayNodeKind;
  label: string;
  /** Set for `area` nodes. */
  nodeId?: NodeId;
  /** Container render id for an area shown inside an expanded region. */
  parentId?: string;
  /** Whether this area lies on the active route. */
  onPath?: boolean;
  /** Set for region nodes. */
  groupId?: GroupId;
  /** Number of areas a collapsed region stands in for. */
  areaCount?: number;
  /** Whether an expanded region contains a route node (for accent styling). */
  containsPath?: boolean;
}

export interface DisplayEdge {
  id: string;
  source: string;
  target: string;
  bidirectional: boolean;
  onPath: boolean;
  /** How many authored edges this single line represents. */
  count: number;
  method: TravelMethod;
  /** The representative edge is a `minor` link (surfaced only because it's on the route). */
  minor: boolean;
}

export interface CollapseViewInput {
  graph: NavGraph;
  /** Regions the user has manually opened — shown with all their areas. */
  manualExpanded: ReadonlySet<GroupId>;
  /** Nodes on the active route. Their regions auto-expand (route areas only). */
  pathNodeIds: ReadonlySet<NodeId>;
  /** Keys (`${from}->${to}#${index}`) of authored edges on the route. */
  pathEdgeKeys: ReadonlySet<string>;
}

export interface CollapseView {
  nodes: DisplayNode[];
  edges: DisplayEdge[];
  /** Effective expanded set (manual ∪ route) — the canvas pins route regions open. */
  expandedGroups: Set<GroupId>;
}

const regionDisplayId = (group: GroupId): string => `region:${group}`;

export function collapseView({
  graph,
  manualExpanded,
  pathNodeIds,
  pathEdgeKeys,
}: CollapseViewInput): CollapseView {
  const routeGroups = groupsOf(graph, pathNodeIds);
  const expandedGroups = new Set<GroupId>([...manualExpanded, ...routeGroups]);

  const nodes: DisplayNode[] = [];
  // Where each real node ends up on screen: its own id, a region node's id, or
  // null when it's hidden (a non-route area inside a route-expanded region).
  const resolution = new Map<NodeId, string | null>();

  for (const node of graph.nodes.values()) {
    const group = node.group;
    if (!group) {
      nodes.push({ id: node.id, kind: 'area', label: node.name, nodeId: node.id });
      resolution.set(node.id, node.id);
      continue;
    }
    if (!expandedGroups.has(group)) {
      resolution.set(node.id, regionDisplayId(group));
      continue;
    }
    // Expanded: manual opens the whole region, route opens only its route areas.
    const shown = manualExpanded.has(group) || pathNodeIds.has(node.id);
    if (!shown) {
      resolution.set(node.id, null);
      continue;
    }
    nodes.push({
      id: node.id,
      kind: 'area',
      label: node.name,
      nodeId: node.id,
      parentId: regionDisplayId(group),
      onPath: pathNodeIds.has(node.id),
    });
    resolution.set(node.id, node.id);
  }

  const memberCounts = countMembers(graph);
  for (const group of graph.groups.values()) {
    const count = memberCounts.get(group.id) ?? 0;
    if (count === 0) continue;
    if (expandedGroups.has(group.id)) {
      nodes.push({
        id: regionDisplayId(group.id),
        kind: 'region-container',
        label: group.name,
        groupId: group.id,
        containsPath: routeGroups.has(group.id),
      });
    } else {
      nodes.push({
        id: regionDisplayId(group.id),
        kind: 'region-collapsed',
        label: group.name,
        groupId: group.id,
        areaCount: count,
      });
    }
  }

  const edges = aggregateEdges(graph, resolution, pathEdgeKeys);
  return { nodes, edges, expandedGroups };
}

function groupsOf(graph: NavGraph, nodeIds: ReadonlySet<NodeId>): Set<GroupId> {
  const groups = new Set<GroupId>();
  for (const id of nodeIds) {
    const group = graph.nodes.get(id)?.group;
    if (group) groups.add(group);
  }
  return groups;
}

function countMembers(graph: NavGraph): Map<GroupId, number> {
  const counts = new Map<GroupId, number>();
  for (const node of graph.nodes.values()) {
    if (node.group) counts.set(node.group, (counts.get(node.group) ?? 0) + 1);
  }
  return counts;
}

interface EdgeAcc {
  source: string;
  target: string;
  bidirectional: boolean;
  onPath: boolean;
  count: number;
  method: TravelMethod;
  minor: boolean;
}

function aggregateEdges(
  graph: NavGraph,
  resolution: Map<NodeId, string | null>,
  pathEdgeKeys: ReadonlySet<string>,
): DisplayEdge[] {
  const acc = new Map<string, EdgeAcc>();

  graph.source.edges.forEach((edge, index) => {
    const onPath = pathEdgeKeys.has(`${edge.from}->${edge.to}#${index}`);
    if (edge.minor && !onPath) return;

    const source = resolution.get(edge.from);
    const target = resolution.get(edge.to);
    if (source == null || target == null) return; // endpoint hidden
    if (source === target) return; // internal to one collapsed region

    // One entry per unordered pair — direction is refined below if a route edge
    // pins it.
    const [a, b] = source < target ? [source, target] : [target, source];
    const key = `${a}~${b}`;
    const existing = acc.get(key);
    if (!existing) {
      acc.set(key, {
        source,
        target,
        bidirectional: edge.bidirectional ?? false,
        onPath,
        count: 1,
        method: edge.method,
        minor: edge.minor ?? false,
      });
      return;
    }
    existing.count += 1;
    existing.bidirectional = existing.bidirectional || (edge.bidirectional ?? false);
    // A route edge wins the representative slot so the drawn line points the way
    // the route travels and picks up its method/minor styling.
    if (onPath && !existing.onPath) {
      existing.onPath = true;
      existing.source = source;
      existing.target = target;
      existing.method = edge.method;
      existing.minor = edge.minor ?? false;
    }
  });

  return [...acc.entries()].map(([id, e]) => ({ id, ...e }));
}
