// User-declared state → an eligibility predicate over edges.
//
// MVP semantics:
//   - meso: "can you afford a single use" (not cumulative budget across a trip).
//     Cumulative meso cost is a future weighted-cost-model concern.
//   - item(consumed:true): requires `quantity` (or 1) held; not deducted across
//     steps either, for the same reason.
//   - quest: must appear in questsCompleted.
//   - level: user.level must be ≥ min.
//
// Any missing field on UserCapability is treated as "not declared" → the
// corresponding requirement passes by default. With nothing declared, every
// edge is eligible — this matches FR6 ("no state declared → all edges eligible").

import type { Requirement, TravelEdge } from '../ir/types';

export interface UserCapability {
  level?: number;
  mesos?: number;
  questsCompleted?: ReadonlySet<number>;
  /** itemId → quantity held. */
  itemsHeld?: ReadonlyMap<number, number>;
}

export function eligibilityFilter(
  state: UserCapability,
): (edge: TravelEdge) => boolean {
  return (edge) => {
    if (!edge.requirements || edge.requirements.length === 0) return true;
    return edge.requirements.every((req) => satisfies(req, state));
  };
}

function satisfies(req: Requirement, state: UserCapability): boolean {
  switch (req.kind) {
    case 'meso':
      return state.mesos === undefined || state.mesos >= req.amount;
    case 'level':
      return state.level === undefined || state.level >= req.min;
    case 'quest':
      return (
        state.questsCompleted === undefined ||
        state.questsCompleted.has(req.questId)
      );
    case 'item': {
      if (state.itemsHeld === undefined) return true;
      const held = state.itemsHeld.get(req.itemId) ?? 0;
      const needed = req.quantity ?? 1;
      return held >= needed;
    }
  }
}
