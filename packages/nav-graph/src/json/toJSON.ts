// Portability: serialize a compiled NavGraph back to its plain authored source.
// The JSON contract IS NavGraphSource — no extra runtime fields leak out, so
// the artifact can be re-loaded by a non-TS target and round-tripped through
// `navGraphSourceSchema.parse(...) → compileGraph(...)` without information loss.

import type { NavGraph } from '../compile/compileGraph';
import type { NavGraphSource } from '../ir/types';

export type NavGraphJSON = NavGraphSource;

export function toJSON(graph: NavGraph): NavGraphJSON {
  // `graph.source` was produced by Zod's parser, so it's already a clean object
  // tree. Re-emitting it without mutation keeps the round-trip contract honest.
  return graph.source;
}
