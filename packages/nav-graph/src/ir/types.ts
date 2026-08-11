// The Navigator graph IR. Authored as TypeScript so contributors get types,
// autocomplete, and compile errors instead of writing JSON or a query language.
// The shapes here are the schema the rest of the package operates on; the
// runtime mirror lives next door in `schema.ts` (Zod).

/** Author-assigned stable id for an area/hub node. kebab-case. NOT a game map id. */
export type NodeId = string & { readonly __brand: 'NodeId' };

/** Author-invented region cluster id used for grouping (future semantic zoom). */
export type GroupId = string & { readonly __brand: 'GroupId' };

export const TRAVEL_METHODS = [
  'walk',
  'transport',
  'portal',
  'npc',
  'item',
  'skill',
  'scroll',
  'other',
] as const;
export type TravelMethod = (typeof TRAVEL_METHODS)[number];

// The `item` and `quest` requirements gate on an opaque game entity id, which
// means nothing to a reader on its own. `name` is an optional human-readable
// label the UI prefers over the raw id (e.g. "Lighthouse Pass" instead of
// "item #2000001"). `meso` and `level` carry self-describing scalars, so they
// need no name.
export type Requirement =
  | { kind: 'meso'; amount: number }
  | { kind: 'item'; itemId: number; consumed: boolean; quantity?: number; name?: string }
  | { kind: 'quest'; questId: number; name?: string }
  | { kind: 'level'; min: number };

export interface AreaNode {
  id: NodeId;
  name: string;
  group?: GroupId;
  /**
   * The town a "return to nearest town" scroll sends you to from this node.
   * Every node is a town, so this defaults to the node itself (a scroll there
   * is a no-op). Set it when the game routes the scroll elsewhere — e.g. a
   * dungeon whose scroll drops you at its continent's hub town. Must reference
   * a declared node. Enables an optional `scroll` edge used only when the
   * traveller has declared they carry return scrolls (see findPath).
   */
  nearestTown?: NodeId;
}

export interface EntityRefs {
  itemId?: number;
  questId?: number;
  npcId?: number;
}

export interface TravelEdge {
  from: NodeId;
  to: NodeId;
  /** Default false (directed from→to). The compiler expands `true` into a pair. */
  bidirectional?: boolean;
  method: TravelMethod;
  /** Free-text description shown in directions, e.g. "Talk to the sailor". */
  via?: string;
  refs?: EntityRefs;
  requirements?: Requirement[];
  /**
   * Estimated travel time for this edge, in seconds. Valid only on the timed
   * methods — `walk` and `transport` (boats/trains/carpets); every other method
   * is an instant transition and the schema rejects `seconds` on it. Pathfinding
   * minimizes the summed time of a route (Dijkstra). Omit when unknown — untimed
   * timed-edges fall back to their method default, so a graph with no times set
   * still routes sensibly. A `transport` edge's time is waived entirely when the
   * route is found with fast travel enabled (see `findPath`).
   */
  seconds?: number;
  notes?: string;
  /**
   * Hide this edge from the default map to reduce clutter. Purely a rendering
   * hint — pathfinding ignores it, so a `minor` edge is still routable and is
   * drawn (highlighted) whenever it lies on the computed route. Use it for
   * noisy or rarely-taken connections that would otherwise crowd the graph.
   */
  minor?: boolean;
}

export interface GroupDef {
  id: GroupId;
  name: string;
}

export interface NavGraphSource {
  profileId: string;
  nodes: AreaNode[];
  edges: TravelEdge[];
  groups?: GroupDef[];
}

/** Helper for narrowing string literals to the branded id types. */
export const asNodeId = (s: string): NodeId => s as NodeId;
export const asGroupId = (s: string): GroupId => s as GroupId;
