// Public surface for @scrolled/nav-graph.
//
// The package is grouped into four leaf modules — `ir`, `dsl`, `compile`,
// `path` (plus `json` for portability) — and this barrel re-exports the bits
// app code consumes. Importing from the deep paths is fine too; e.g. tests
// pull `defineGraph` from `@scrolled/nav-graph/dsl` directly.

// IR types & schema
export type {
  AreaNode,
  EntityRefs,
  GroupDef,
  GroupId,
  NavGraphSource,
  NodeId,
  Requirement,
  TravelEdge,
  TravelMethod,
} from './ir/types';
export { TRAVEL_METHODS, asGroupId, asNodeId } from './ir/types';
export { navGraphSourceSchema } from './ir/schema';

// Authoring DSL
export { defineGraph } from './dsl/builder';
export type {
  EdgeOpts,
  GraphBuilder,
  NodeHandle,
  NodeOpts,
  RegionScope,
  TimedEdgeOpts,
} from './dsl/builder';
export { item, level, meso, quest } from './dsl/requirements';

// Compiler
export { compileGraph } from './compile/compileGraph';
export type { NavGraph } from './compile/compileGraph';

// Pathfinding
export {
  DEFAULT_TRANSPORT_SECONDS,
  DEFAULT_WALK_SECONDS,
  edgeSeconds,
  findPath,
} from './path/findPath';
export { eligibilityFilter } from './path/eligibility';
export type {
  EdgeCostOptions,
  FindPathOptions,
  PathResult,
  UserCapability,
} from './path/index';

// Portability
export { toJSON } from './json/toJSON';
export type { NavGraphJSON } from './json/toJSON';

// Authored graphs registry (per-profile NavGraphSources). See src/graphs/README.md.
export {
  DEFAULT_GRAPH_ID,
  GRAPHS,
  getGraph,
  listGraphIds,
} from './graphs/index';
