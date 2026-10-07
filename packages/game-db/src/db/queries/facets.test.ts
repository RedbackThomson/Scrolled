// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { Sqlite } from '../sqlite';
import { DbApi } from './index';
import type { EquipRecord } from '../types';

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

  it('returns null for unknown, non-numeric or empty columns', async () => {
    expect(await db.columnHistogram('weapon', 'name', 14, {})).toBeNull();
    expect(await db.columnHistogram('weapon', 'nope', 14, {})).toBeNull();
    expect(
      await db.columnHistogram('weapon', 'requiredLevel', 14, {
        requiredLevel: { kind: 'range', min: 500 },
      }),
    ).toBeNull();
  });
});
