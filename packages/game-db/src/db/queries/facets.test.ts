// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { Sqlite } from '../sqlite';
import { DbApi } from './index';
import type { EquipRecord, FacetSource } from '../types';
import {
  EQUIP_FILTER,
  ITEM_FILTER,
  MAP_FILTER,
  MOB_FILTER,
  NPC_FILTER,
  QUEST_CHAIN_FILTER,
  QUEST_FILTER,
  SKILL_FILTER,
  type FilterSpec,
} from './shared/filters';

const FILTERS: Record<FacetSource, Record<string, FilterSpec>> = {
  item: ITEM_FILTER,
  equip: EQUIP_FILTER,
  weapon: EQUIP_FILTER,
  mob: MOB_FILTER,
  npc: NPC_FILTER,
  map: MAP_FILTER,
  quest: QUEST_FILTER,
  questChain: QUEST_CHAIN_FILTER,
  skill: SKILL_FILTER,
};

function makeEquip(
  id: number,
  requiredLevel: number | null,
  equipType: string | null,
  attack: number | null = null,
): EquipRecord {
  return {
    id,
    name: `Equip ${id}`,
    sourcePath: `Character.wz/${id}`,
    stringPath: '',
    requiredLevel,
    equipType,
    attack,
  } as EquipRecord;
}

describe('facet queries', () => {
  let db: DbApi;

  beforeEach(async () => {
    db = new DbApi(new Sqlite({ logTag: 'facets-test' }));
    await db.open();
    await db.upsertEquips([
      makeEquip(1, 10, 'claw', 5),
      makeEquip(2, 12, 'claw', 8),
      makeEquip(3, 30, 'claw', 15),
      makeEquip(4, 31, 'dagger', 20),
      makeEquip(5, 69, 'dagger', 40),
      makeEquip(6, null, 'dagger'),
      makeEquip(7, 50, null), // armour: outside the weapon source
    ]);
  });

  it('counts each filter set within the source', async () => {
    const counts = await db.countMatchingMany('weapon', [
      {},
      { equipType: { kind: 'enum', values: ['claw'] } },
      { requiredLevel: { kind: 'range', min: 30 } },
    ]);
    expect(counts).toEqual([6, 3, 3]);
    expect(await db.countMatchingMany('equip', [{}])).toEqual([1]);
  });

  it('lists the ids a filter set matches', async () => {
    expect(await db.matchingIds('weapon', { requiredLevel: { kind: 'range', min: 30 } })).toEqual([
      3, 4, 5,
    ]);
    expect(await db.matchingIds('equip', {})).toEqual([7]);
  });

  it('lists the first matching names', async () => {
    expect(
      await db.matchingNames('weapon', { equipType: { kind: 'enum', values: ['claw'] } }, 2),
    ).toEqual([
      { id: 1, name: 'Equip 1' },
      { id: 2, name: 'Equip 2' },
    ]);
  });

  it('bins a number column from its minimum, skipping nulls', async () => {
    const h = await db.columnHistogram('weapon', 'requiredLevel', 6, {});
    expect(h).toEqual({ min: 10, max: 69, binWidth: 10, bins: [2, 0, 2, 0, 0, 1] });
  });

  it('applies the other filters to the histogram', async () => {
    const h = await db.columnHistogram('weapon', 'requiredLevel', 6, {
      equipType: { kind: 'enum', values: ['claw'] },
    });
    expect(h?.min).toBe(10);
    expect(h?.max).toBe(30);
    expect(h?.bins.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('keeps the page-wide range with empty bars when the other filters leave no values', async () => {
    const h = await db.columnHistogram('weapon', 'attack', 4, {
      requiredLevel: { kind: 'range', min: 500 },
    });
    expect(h).toMatchObject({ min: 5, max: 40, bins: [0, 0, 0, 0] });
  });

  it('returns null for unknown, non-numeric or empty columns', async () => {
    expect(await db.columnHistogram('weapon', 'name', 14, {})).toBeNull();
    expect(await db.columnHistogram('weapon', 'nope', 14, {})).toBeNull();
    expect(await db.columnHistogram('weapon', 'incSpeed', 14, {})).toBeNull();
  });

  it('queries every number column of every source', async () => {
    for (const [source, specs] of Object.entries(FILTERS) as [FacetSource, typeof ITEM_FILTER][]) {
      for (const [columnId, spec] of Object.entries(specs)) {
        if (spec.type !== 'number') continue;
        await db.columnHistogram(source, columnId, 14, {});
      }
    }
  });
});
