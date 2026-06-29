// The Navigator graph IR. Authored as TypeScript so contributors get types,
// autocomplete, and compile errors instead of writing JSON or a query language.
// The shapes here are the schema the rest of the package operates on; the
// runtime mirror lives next door in `schema.ts` (Zod).

/** Author-assigned stable id for an area/hub node. kebab-case. NOT a game map id. */
export type NodeId = string & { readonly __brand: 'NodeId' };

/** Author-invented region cluster id used for grouping (future semantic zoom). */
export type GroupId = string & { readonly __brand: 'GroupId' };

export const TRAVEL_METHODS = ['walk', 'portal', 'npc', 'item', 'skill', 'other'] as const;
export type TravelMethod = (typeof TRAVEL_METHODS)[number];

export type Requirement =
  | { kind: 'meso'; amount: number }
  | { kind: 'item'; itemId: number; consumed: boolean; quantity?: number }
  | { kind: 'quest'; questId: number }
  | { kind: 'level'; min: number };

export interface AreaNode {
  id: NodeId;
  name: string;
  group?: GroupId;
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
  /** Reserved for the future weighted-cost model; BFS ignores it. */
  weight?: number;
  notes?: string;
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
