// The authoring DSL. Compiles to NavGraphSource and nothing more — the DSL
// adds nothing to the shipped artifact and is interchangeable with hand-written
// IR. See docs/navigator_implementation.md §4.1 for the design rationale.
//
// Style: nodes are declared as handles, edges as verb methods on those handles
// (walk / portalTo / npcTo / itemTo / skillTo). Forward and cross-region
// references go through g.ref('id'). All references are resolved at build()
// time, where duplicates and unresolved refs become precise errors.

import type {
  AreaNode,
  EntityRefs,
  GroupDef,
  GroupId,
  NavGraphSource,
  NodeId,
  Requirement,
  TravelEdge,
  TravelMethod,
} from '../ir/types';
import { asGroupId, asNodeId } from '../ir/types';

export interface EdgeOpts {
  /** Free-text description shown in directions. */
  via?: string;
  /** Single requirement — sugar for require:[r]. */
  cost?: Requirement;
  /** Multiple requirements. Merged with `cost` if both are provided. */
  require?: Requirement[];
  /** Optional deep-link hooks for entities that exist in the game. */
  ref?: EntityRefs;
  /**
   * Override the verb's default directionality.
   * - walk / portalTo default bidirectional → set false for one-way.
   * - npcTo / itemTo / skillTo default directed → set true for paired transit.
   */
  both?: boolean;
  notes?: string;
}

/**
 * Options for a timed edge. Only `walk` and `transport` (boats/trains/carpets)
 * take time, so `seconds` lives here and not on the base `EdgeOpts` — portal /
 * npc / item / skill transitions are instant and the type system rejects a
 * `seconds` on them.
 */
export interface TimedEdgeOpts extends EdgeOpts {
  /**
   * Estimated travel time, in seconds. On a `transport` edge this is the ride
   * time when the traveller has no fast-travel ticket; with fast travel the ride
   * is instant (see `findPath`). Drives weighted routing.
   */
  seconds?: number;
}

export interface NodeHandle {
  readonly id: NodeId;
  walk(other: NodeHandle, opts?: TimedEdgeOpts): void;
  /**
   * A boarded conveyance — boat, train, magic carpet. Bidirectional by default
   * (vehicles round-trip). Takes `seconds` unless the route is found with fast
   * travel, which makes every transport hop instant.
   */
  transportTo(other: NodeHandle, opts?: TimedEdgeOpts): void;
  portalTo(other: NodeHandle, opts?: EdgeOpts): void;
  npcTo(other: NodeHandle, opts?: EdgeOpts): void;
  itemTo(other: NodeHandle, opts?: EdgeOpts): void;
  skillTo(other: NodeHandle, opts?: EdgeOpts): void;
  /** Escape hatch when none of the named verbs fit. `seconds` applies only if method is 'walk' or 'transport'. */
  edgeTo(other: NodeHandle, method: TravelMethod, opts?: TimedEdgeOpts): void;
}

export interface RegionScope {
  node(id: string, name: string, opts?: { group?: string }): NodeHandle;
  region(id: string, name: string, fn: (r: RegionScope) => void): void;
}

export interface GraphBuilder extends RegionScope {
  /** Resolve a NodeHandle by id. Works for forward refs and cross-region refs. */
  ref(id: string): NodeHandle;
  group(id: string, name: string): void;
}

interface NodeDecl {
  readonly node: AreaNode;
  /** index into the declaration list — used to report duplicates precisely. */
  readonly declarationIndex: number;
}

interface EdgeBuildOpts extends TimedEdgeOpts {
  method: TravelMethod;
  defaultBidirectional: boolean;
}

const VERB_DEFAULTS: Record<
  'walk' | 'transportTo' | 'portalTo' | 'npcTo' | 'itemTo' | 'skillTo',
  { method: TravelMethod; defaultBidirectional: boolean }
> = {
  walk: { method: 'walk', defaultBidirectional: true },
  transportTo: { method: 'transport', defaultBidirectional: true },
  portalTo: { method: 'portal', defaultBidirectional: true },
  npcTo: { method: 'npc', defaultBidirectional: false },
  itemTo: { method: 'item', defaultBidirectional: false },
  skillTo: { method: 'skill', defaultBidirectional: false },
};

class Builder implements GraphBuilder {
  private readonly profileId: string;
  private readonly nodeDecls: NodeDecl[] = [];
  private readonly edges: TravelEdge[] = [];
  private readonly groups: Map<GroupId, GroupDef> = new Map();
  private readonly handles: Map<string, NodeHandle> = new Map();
  private readonly groupStack: GroupId[] = [];

  constructor(profileId: string) {
    this.profileId = profileId;
  }

  group(id: string, name: string): void {
    const gid = asGroupId(id);
    if (this.groups.has(gid)) {
      throw new Error(`Duplicate group id: ${id}`);
    }
    this.groups.set(gid, { id: gid, name });
  }

  node(id: string, name: string, opts?: { group?: string }): NodeHandle {
    const nodeId = asNodeId(id);
    const group = opts?.group
      ? asGroupId(opts.group)
      : (this.groupStack[this.groupStack.length - 1] ?? undefined);
    const decl: NodeDecl = {
      node: { id: nodeId, name, ...(group ? { group } : {}) },
      declarationIndex: this.nodeDecls.length,
    };
    this.nodeDecls.push(decl);
    const handle = this.makeHandle(nodeId);
    // Last-writer-wins on the handle map — duplicates are caught at build().
    this.handles.set(id, handle);
    return handle;
  }

  region(id: string, name: string, fn: (r: RegionScope) => void): void {
    const gid = asGroupId(id);
    if (!this.groups.has(gid)) {
      this.groups.set(gid, { id: gid, name });
    }
    this.groupStack.push(gid);
    try {
      fn(this);
    } finally {
      this.groupStack.pop();
    }
  }

  ref(id: string): NodeHandle {
    const existing = this.handles.get(id);
    if (existing) return existing;
    // Lazy handle — its target need not be declared yet. Validated at build().
    const handle = this.makeHandle(asNodeId(id));
    this.handles.set(id, handle);
    return handle;
  }

  build(): NavGraphSource {
    this.validateNodes();
    this.validateGroupRefs();
    this.validateEdgeEndpoints();
    const groups = [...this.groups.values()];
    return {
      profileId: this.profileId,
      nodes: this.nodeDecls.map((d) => d.node),
      edges: this.edges,
      ...(groups.length > 0 ? { groups } : {}),
    };
  }

  private makeHandle(id: NodeId): NodeHandle {
    const verbs = Object.entries(VERB_DEFAULTS) as [
      keyof typeof VERB_DEFAULTS,
      (typeof VERB_DEFAULTS)[keyof typeof VERB_DEFAULTS],
    ][];
    const handle: NodeHandle = {
      id,
      edgeTo: (other, method, opts) =>
        this.pushEdge(id, other.id, { ...opts, method, defaultBidirectional: false }),
      // The named verbs are populated below — keeps the type explicit while
      // avoiding six near-identical method bodies.
      walk: () => undefined,
      transportTo: () => undefined,
      portalTo: () => undefined,
      npcTo: () => undefined,
      itemTo: () => undefined,
      skillTo: () => undefined,
    };
    for (const [verb, { method, defaultBidirectional }] of verbs) {
      handle[verb] = (other: NodeHandle, opts?: TimedEdgeOpts) =>
        this.pushEdge(id, other.id, { ...opts, method, defaultBidirectional });
    }
    return handle;
  }

  private pushEdge(from: NodeId, to: NodeId, opts: EdgeBuildOpts): void {
    const { method, defaultBidirectional, both, cost, require, ref, via, seconds, notes } = opts;
    const requirements = mergeRequirements(cost, require);
    const bidirectional = both ?? defaultBidirectional;
    const edge: TravelEdge = {
      from,
      to,
      method,
      ...(bidirectional ? { bidirectional: true } : {}),
      ...(via !== undefined ? { via } : {}),
      ...(ref ? { refs: ref } : {}),
      ...(requirements ? { requirements } : {}),
      ...(seconds !== undefined ? { seconds } : {}),
      ...(notes !== undefined ? { notes } : {}),
    };
    this.edges.push(edge);
  }

  private validateNodes(): void {
    // Pre-merge duplicate-id pass: count *declarations*, not the (last-write-wins)
    // handle map, so silent overrides surface as a precise error. See §8.
    const counts = new Map<NodeId, number[]>();
    for (const decl of this.nodeDecls) {
      const list = counts.get(decl.node.id);
      if (list) list.push(decl.declarationIndex);
      else counts.set(decl.node.id, [decl.declarationIndex]);
    }
    const dupes = [...counts.entries()].filter(([, indices]) => indices.length > 1);
    if (dupes.length > 0) {
      const detail = dupes
        .map(([id, indices]) => `${id} (declarations #${indices.join(', #')})`)
        .join('; ');
      throw new Error(`Duplicate node id(s): ${detail}`);
    }
  }

  private validateGroupRefs(): void {
    for (const decl of this.nodeDecls) {
      const group = decl.node.group;
      if (group && !this.groups.has(group)) {
        throw new Error(
          `Node "${decl.node.id}" references unknown group "${group}". ` +
            `Declare it with g.region("${group}", ...) or g.group("${group}", ...).`,
        );
      }
    }
  }

  private validateEdgeEndpoints(): void {
    const declared = new Set(this.nodeDecls.map((d) => d.node.id));
    const unresolved: string[] = [];
    for (const edge of this.edges) {
      if (!declared.has(edge.from)) unresolved.push(`from:${edge.from}`);
      if (!declared.has(edge.to)) unresolved.push(`to:${edge.to}`);
    }
    if (unresolved.length > 0) {
      const unique = [...new Set(unresolved)];
      throw new Error(
        `Edge endpoint(s) reference undeclared nodes: ${unique.join(', ')}. ` +
          `Either declare the node with g.node(...) or remove the edge.`,
      );
    }
  }
}

function mergeRequirements(
  cost: Requirement | undefined,
  require: Requirement[] | undefined,
): Requirement[] | undefined {
  if (!cost && !require) return undefined;
  const merged: Requirement[] = [];
  if (cost) merged.push(cost);
  if (require) merged.push(...require);
  return merged.length > 0 ? merged : undefined;
}

export function defineGraph(
  opts: { profileId: string },
  fn: (g: GraphBuilder) => void,
): NavGraphSource {
  const builder = new Builder(opts.profileId);
  fn(builder);
  return builder.build();
}
