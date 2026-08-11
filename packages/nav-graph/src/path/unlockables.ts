// The "requirements you've unlocked" model.
//
// Two requirement kinds gate on an opaque game entity id — `item` and `quest`.
// Those are things a traveller either has unlocked or hasn't, so the navigator
// lets them declare which ones they hold and routes around the rest. `meso` and
// `level` are scalar thresholds rather than opaque ids, so they're never gated
// here and always pass.

import type { NavGraphSource, Requirement, TravelEdge } from '../ir/types';

export type UnlockableKind = 'item' | 'quest';

export type UnlockableRequirement = Extract<Requirement, { kind: UnlockableKind }>;

export function isUnlockable(req: Requirement): req is UnlockableRequirement {
  return req.kind === 'item' || req.kind === 'quest';
}

/** The opaque entity id a requirement gates on. */
export function requirementEntityId(req: UnlockableRequirement): number {
  return req.kind === 'item' ? req.itemId : req.questId;
}

/**
 * Stable `${kind}:${id}` key identifying a requirement's unlockable subject.
 * Two edges that require the same item (or quest) share a key, so one toggle
 * governs both.
 */
export function requirementKey(req: UnlockableRequirement): string {
  return `${req.kind}:${requirementEntityId(req)}`;
}

/** One distinct unlockable subject referenced somewhere in the graph. */
export interface UnlockableEntry {
  key: string;
  kind: UnlockableKind;
  id: number;
  /** Author-supplied display name, when any edge naming this subject provides one. */
  name?: string;
}

/**
 * Every distinct item/quest requirement referenced by the graph's edges, one
 * entry per `${kind}:${id}` in first-seen order. A named occurrence wins over
 * an anonymous one, so a subject named on any edge surfaces its name.
 */
export function collectUnlockables(source: NavGraphSource): UnlockableEntry[] {
  const byKey = new Map<string, UnlockableEntry>();
  for (const edge of source.edges) {
    for (const req of edge.requirements ?? []) {
      if (!isUnlockable(req)) continue;
      const key = requirementKey(req);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          key,
          kind: req.kind,
          id: requirementEntityId(req),
          ...(req.name ? { name: req.name } : {}),
        });
      } else if (!existing.name && req.name) {
        existing.name = req.name;
      }
    }
  }
  return [...byKey.values()];
}

/**
 * An eligibility predicate for `findPath` that blocks any edge requiring a
 * *locked* item or quest — a subject whose `${kind}:${id}` key is in `locked`.
 * Non-unlockable requirements (meso, level) never block. An empty set passes
 * every edge, matching "all requirements unlocked by default".
 */
export function lockedRequirementsFilter(
  locked: ReadonlySet<string>,
): (edge: TravelEdge) => boolean {
  if (locked.size === 0) return () => true;
  return (edge) =>
    (edge.requirements ?? []).every(
      (req) => !isUnlockable(req) || !locked.has(requirementKey(req)),
    );
}
