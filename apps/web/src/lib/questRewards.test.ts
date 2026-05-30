import { describe, expect, it } from 'vitest';
import type { QuestRewardWithName } from '@/db';
import {
  filterGroupedRewards,
  groupItemRewards,
  rewardMatchesCharacter,
} from './questRewards';

function item(
  idx: number,
  targetId: number,
  overrides: Partial<QuestRewardWithName> = {},
): QuestRewardWithName {
  return {
    questId: 1,
    kind: 'item',
    idx,
    targetId,
    amount: 1,
    prop: null,
    job: null,
    gender: null,
    period: null,
    targetName: `Item ${targetId}`,
    targetEntity: 'item',
    ...overrides,
  };
}

describe('groupItemRewards', () => {
  it('treats prop-less rows as guaranteed singletons', () => {
    const groups = groupItemRewards([item(0, 100), item(1, 101)]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.kind === 'guaranteed-item')).toBe(true);
  });

  it('coalesces contiguous prop rows into one pool with the correct total', () => {
    const groups = groupItemRewards([
      item(0, 100, { prop: 20 }),
      item(1, 101, { prop: 80 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: 'random-pool', id: 0, totalWeight: 100 });
  });

  it('splits non-contiguous prop runs into separate pools', () => {
    const groups = groupItemRewards([
      item(0, 100, { prop: 10 }),
      item(1, 101, { prop: 90 }),
      item(2, 200), // guaranteed in the middle
      item(3, 300, { prop: 50 }),
      item(4, 301, { prop: 50 }),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ kind: 'random-pool', totalWeight: 100 });
    expect(groups[1]).toMatchObject({ kind: 'guaranteed-item' });
    expect(groups[2]).toMatchObject({ kind: 'random-pool', totalWeight: 100 });
  });
});

describe('rewardMatchesCharacter', () => {
  it('returns true when no filter is set', () => {
    expect(
      rewardMatchesCharacter(item(0, 100, { job: 2 }), {
        job: null,
        gender: null,
      }),
    ).toBe(true);
  });

  it('respects job bitfield restrictions (Beginner=1, Pirate=32 reward scheme)', () => {
    // job bitfield 2 = Warrior only in the reward encoding (shifted left of
    // the equip 1=Warrior). See parseRewardJob in domain/equipJobs.ts.
    const reward = item(0, 100, { job: 2 });
    expect(rewardMatchesCharacter(reward, { job: 'Warrior', gender: null })).toBe(true);
    expect(rewardMatchesCharacter(reward, { job: 'Magician', gender: null })).toBe(false);
  });

  it('treats job=0 / null as no restriction', () => {
    const a = item(0, 100, { job: 0 });
    const b = item(1, 101, { job: null });
    expect(rewardMatchesCharacter(a, { job: 'Thief', gender: null })).toBe(true);
    expect(rewardMatchesCharacter(b, { job: 'Pirate', gender: null })).toBe(true);
  });

  it('matches Beginner only when bit 1 is set; bit 32 is Pirate in this scheme', () => {
    const beginnerOnly = item(0, 100, { job: 1 });
    expect(rewardMatchesCharacter(beginnerOnly, { job: 'Beginner', gender: null })).toBe(true);
    expect(rewardMatchesCharacter(beginnerOnly, { job: 'Warrior', gender: null })).toBe(false);

    // 32 is Pirate (King Pirate accessory, etc.), not Beginner.
    const pirateOnly = item(1, 200, { job: 32 });
    expect(rewardMatchesCharacter(pirateOnly, { job: 'Pirate', gender: null })).toBe(true);
    expect(rewardMatchesCharacter(pirateOnly, { job: 'Beginner', gender: null })).toBe(false);
  });

  it('matches a multi-class reward for every class whose bit is set', () => {
    // 2|4|8|16|32 = Warrior+Magician+Bowman+Thief+Pirate (everyone but Beginner).
    const reward = item(0, 100, { job: 2 | 4 | 8 | 16 | 32 });
    expect(rewardMatchesCharacter(reward, { job: 'Warrior', gender: null })).toBe(true);
    expect(rewardMatchesCharacter(reward, { job: 'Pirate', gender: null })).toBe(true);
    expect(rewardMatchesCharacter(reward, { job: 'Beginner', gender: null })).toBe(false);
  });

  it('respects gender restrictions, treating 2 / null as any', () => {
    expect(
      rewardMatchesCharacter(item(0, 100, { gender: 0 }), {
        job: null,
        gender: 'female',
      }),
    ).toBe(false);
    expect(
      rewardMatchesCharacter(item(0, 100, { gender: 1 }), {
        job: null,
        gender: 'female',
      }),
    ).toBe(true);
    expect(
      rewardMatchesCharacter(item(0, 100, { gender: 2 }), {
        job: null,
        gender: 'male',
      }),
    ).toBe(true);
  });
});

describe('filterGroupedRewards', () => {
  it('returns groups unchanged when filter is empty', () => {
    const groups = groupItemRewards([item(0, 100, { prop: 100 })]);
    expect(filterGroupedRewards(groups, { job: null, gender: null })).toEqual(groups);
  });

  it('drops a pool entirely when no member matches the filter', () => {
    // job 2 = Warrior in the reward scheme.
    const groups = groupItemRewards([
      item(0, 100, { prop: 50, job: 2 }),
      item(1, 101, { prop: 50, job: 2 }),
    ]);
    expect(filterGroupedRewards(groups, { job: 'Magician', gender: null })).toEqual([]);
  });

  it('recomputes pool weights after filtering survivors', () => {
    const groups = groupItemRewards([
      item(0, 100, { prop: 25, job: 2 }), // Warrior only
      item(1, 101, { prop: 75, job: 4 }), // Magician only
    ]);
    const filtered = filterGroupedRewards(groups, { job: 'Warrior', gender: null });
    expect(filtered).toHaveLength(1);
    const pool = filtered[0];
    if (pool.kind !== 'random-pool') throw new Error('expected pool');
    expect(pool.rewards).toHaveLength(1);
    expect(pool.totalWeight).toBe(25);
  });

  it('removes guaranteed items that fail the filter', () => {
    const groups = groupItemRewards([
      item(0, 100, { job: 2 }), // Warrior only
      item(1, 101), // any
    ]);
    const filtered = filterGroupedRewards(groups, { job: 'Bowman', gender: null });
    expect(filtered).toHaveLength(1);
    if (filtered[0].kind !== 'guaranteed-item') throw new Error('expected guaranteed');
    expect(filtered[0].reward.targetId).toBe(101);
  });
});
