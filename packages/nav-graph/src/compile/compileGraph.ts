// Compile an authored NavGraphSource into a frozen runtime NavGraph.
//
// Responsibilities:
//   1. Re-validate the source with Zod (defensive — the DSL already validates
//      structurally, but compileGraph also accepts hand-written or JSON sources).
//   2. Re-run the structural checks (duplicate node ids, group refs, edge
//      endpoints) so a hand-written source gets the same precise errors as the
//      DSL emits.
//   3. Expand bidirectional edges into a directed adjacency list.
//   4. Freeze nodes/groups/adjacency into immutable maps.

import type {
  AreaNode,
  GroupDef,
  GroupId,
  NavGraphSource,
  NodeId,
  TravelEdge,
} from '../ir/types';
import { navGraphSourceSchema } from '../ir/schema';

export interface NavGraph {
  readonly source: NavGraphSource;
  readonly nodes: ReadonlyMap<NodeId, AreaNode>;
  readonly groups: ReadonlyMap<GroupId, GroupDef>;
  /**
   * For each node id, the directed edges that *leave* it. Bidirectional
   * source edges produce two adjacency entries (one per direction); the
   * `bidirectional` flag on the entry is preserved so the UI can render the
   * edge once.
   */
  readonly adjacency: ReadonlyMap<NodeId, readonly TravelEdge[]>;
}

export function compileGraph(source: NavGraphSource): NavGraph {
  const parsed = navGraphSourceSchema.parse(source);

  validateNodes(parsed.nodes);
  validateGroups(parsed);
  validateEdgeEndpoints(parsed);

  const nodes = new Map<NodeId, AreaNode>(parsed.nodes.map((n) => [n.id, n]));
  const groups = new Map<GroupId, GroupDef>(
    (parsed.groups ?? []).map((g) => [g.id, g]),
  );
  const adjacency = buildAdjacency(parsed.nodes, parsed.edges);

  return Object.freeze({ source: parsed, nodes, groups, adjacency });
}

function validateNodes(nodes: AreaNode[]): void {
  const counts = new Map<NodeId, number[]>();
  nodes.forEach((node, index) => {
    const list = counts.get(node.id);
    if (list) list.push(index);
    else counts.set(node.id, [index]);
  });
  const dupes = [...counts.entries()].filter(([, indices]) => indices.length > 1);
  if (dupes.length > 0) {
    const detail = dupes
      .map(([id, indices]) => `${id} (positions #${indices.join(', #')})`)
      .join('; ');
    throw new Error(`Duplicate node id(s) in NavGraphSource: ${detail}`);
  }
}

function validateGroups(source: NavGraphSource): void {
  const declared = new Set((source.groups ?? []).map((g) => g.id));
  const dupes = new Set<GroupId>();
  const seen = new Set<GroupId>();
  for (const g of source.groups ?? []) {
    if (seen.has(g.id)) dupes.add(g.id);
    seen.add(g.id);
  }
  if (dupes.size > 0) {
    throw new Error(`Duplicate group id(s): ${[...dupes].join(', ')}`);
  }
  for (const node of source.nodes) {
    if (node.group && !declared.has(node.group)) {
      throw new Error(
        `Node "${node.id}" references unknown group "${node.group}".`,
      );
    }
  }
}

function validateEdgeEndpoints(source: NavGraphSource): void {
  const known = new Set(source.nodes.map((n) => n.id));
  const missing = new Set<string>();
  for (const edge of source.edges) {
    if (!known.has(edge.from)) missing.add(`from:${edge.from}`);
    if (!known.has(edge.to)) missing.add(`to:${edge.to}`);
    if (edge.from === edge.to) {
      throw new Error(
        `Self-loop on "${edge.from}" (method=${edge.method}). ` +
          `Navigator edges must connect distinct nodes.`,
      );
    }
  }
  if (missing.size > 0) {
    throw new Error(
      `Edge endpoint(s) reference undeclared nodes: ${[...missing].join(', ')}.`,
    );
  }
}

function buildAdjacency(
  nodes: AreaNode[],
  edges: TravelEdge[],
): ReadonlyMap<NodeId, readonly TravelEdge[]> {
  const adj = new Map<NodeId, TravelEdge[]>();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    adj.get(edge.from)!.push(edge);
    if (edge.bidirectional) {
      // Re-orient the same edge object for the reverse direction. Keeping the
      // `bidirectional: true` flag intact lets the renderer collapse the pair
      // back into a single visual line; pathfinding traverses each direction
      // as its own step.
      adj.get(edge.to)!.push({ ...edge, from: edge.to, to: edge.from });
    }
  }
  for (const [id, list] of adj) adj.set(id, Object.freeze(list) as TravelEdge[]);
  return adj;
}
