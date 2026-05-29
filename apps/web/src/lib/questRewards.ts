// Reward grouping + character-preference filtering.
//
// The DB stores reward rows flat — one per WZ `item/<idx>` entry plus the
// scalar exp/meso/sp/fame rows and the singleton buff/skill rows. The UI
// wants three logical buckets:
//
//   - guaranteed items: item rows with `prop` null/0
//   - random pools:     item rows with `prop > 0`, grouped by contiguous
//                       runs of the same set of `(job, gender)` filters
//                       in WZ child-index order
//   - scalar rewards:   exp / meso / sp / fame / buff / skill
//
// Random-pool detection is just "prop is set". The pool's combined weight
// drives the rendered percentages; weights inside a pool already sum to
// whatever the WZ author wanted (often but not always 100).
//
// Filtering by character preference happens at the *item* level. A scalar
// reward isn't class- or gender-locked, so it always passes. An item is
// kept when:
//   - job  is null/0           (no restriction), OR the user's class bit is set
//   - gender is null/2         (no restriction), OR matches the user's gender
// If filtering removes every item from a random pool, the pool itself
// disappears too — the user would never see any of those rewards.

import { EQUIP_CLASS_BIT, type EquipClass } from '@/domain/equipJobs';
import type { Gender } from '@/stores/characterPreferences';
import type { QuestRewardWithName } from '@/db';

export interface CharacterFilter {
  job: EquipClass | null;
  gender: Gender | null;
}

export interface GuaranteedItemReward {
  kind: 'guaranteed-item';
  reward: QuestRewardWithName;
}

export interface RandomPoolReward {
  kind: 'random-pool';
  /** The pool's id within the quest — the smallest idx of any member. */
  id: number;
  rewards: QuestRewardWithName[];
  /** Sum of every member's `prop`, used to compute display percentages. */
  totalWeight: number;
}

export type GroupedItemReward = GuaranteedItemReward | RandomPoolReward;

/**
 * Split an ordered list of `item` reward rows into guaranteed singletons
 * and contiguous random-prop pools. Caller is expected to have already
 * filtered out non-item kinds.
 *
 * "Contiguous" matters: WZ authors sometimes lay out [random A, guaranteed
 * potion, random B] in one item node, and those two random groups are
 * separate pools — collapsing them into one would invent a wrong weight.
 */
export function groupItemRewards(items: QuestRewardWithName[]): GroupedItemReward[] {
  const sorted = [...items].sort((a, b) => a.idx - b.idx);
  const groups: GroupedItemReward[] = [];
  let pool: QuestRewardWithName[] = [];

  const flushPool = () => {
    if (pool.length === 0) return;
    const totalWeight = pool.reduce((sum, r) => sum + (r.prop ?? 0), 0);
    groups.push({ kind: 'random-pool', id: pool[0].idx, rewards: pool, totalWeight });
    pool = [];
  };

  for (const r of sorted) {
    if (r.prop !== null && r.prop > 0) {
      pool.push(r);
    } else {
      flushPool();
      groups.push({ kind: 'guaranteed-item', reward: r });
    }
  }
  flushPool();
  return groups;
}

/**
 * True when the user's class/gender preferences (if set) permit this item
 * reward. Non-item kinds should not be passed here — see comment at top.
 */
export function rewardMatchesCharacter(
  reward: QuestRewardWithName,
  filter: CharacterFilter,
): boolean {
  if (filter.job !== null) {
    const requiredBitfield = reward.job ?? 0;
    if (requiredBitfield !== 0) {
      const userBit = EQUIP_CLASS_BIT[filter.job];
      // Beginner has bit 0; only matches "no restriction", which the
      // outer guard already accepts. With a bitfield set, Beginner is out.
      if (userBit === 0 || (requiredBitfield & userBit) === 0) return false;
    }
  }
  if (filter.gender !== null) {
    const g = reward.gender;
    // gender values: 0 male, 1 female, 2 any, null absent. 2/null pass.
    if (g === 0 || g === 1) {
      const userCode = filter.gender === 'male' ? 0 : 1;
      if (g !== userCode) return false;
    }
  }
  return true;
}

/**
 * Apply {@link rewardMatchesCharacter} to every item row in a grouped
 * structure, dropping pools that emptied entirely. Guaranteed items that
 * don't match are simply removed.
 */
export function filterGroupedRewards(
  groups: GroupedItemReward[],
  filter: CharacterFilter,
): GroupedItemReward[] {
  if (filter.job === null && filter.gender === null) return groups;
  const out: GroupedItemReward[] = [];
  for (const g of groups) {
    if (g.kind === 'guaranteed-item') {
      if (rewardMatchesCharacter(g.reward, filter)) out.push(g);
      continue;
    }
    const kept = g.rewards.filter((r) => rewardMatchesCharacter(r, filter));
    if (kept.length === 0) continue;
    // Recompute the pool's weight from the survivors so the rendered
    // percentages reflect what the user actually sees, not phantom entries
    // the server would never roll for them.
    const totalWeight = kept.reduce((sum, r) => sum + (r.prop ?? 0), 0);
    out.push({ kind: 'random-pool', id: g.id, rewards: kept, totalWeight });
  }
  return out;
}
