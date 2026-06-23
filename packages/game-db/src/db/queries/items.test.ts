// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { Sqlite } from '../sqlite';
import { DbApi } from './index';
import type { ConsumableSpecRecord, ItemRecord } from '../types';

function makeItem(id: number, name: string, category = 'use'): ItemRecord {
  return {
    id,
    name,
    description: null,
    category,
    subcategory: null,
    iconPath: null,
    iconData: null,
    price: null,
    stackSize: null,
    requiredLevel: null,
    cash: false,
    tradeBlock: false,
    accountSharable: false,
    only: false,
    quest: false,
    timeLimited: false,
    expireOnLogout: false,
    pickupBlock: false,
    notSale: false,
    dropBlock: false,
    tradeAvailable: false,
    sourcePath: `Item.wz/${id}`,
    stringPath: '',
    stringCategory: null,
  };
}

function makeSpec(itemId: number, overrides: Partial<ConsumableSpecRecord>): ConsumableSpecRecord {
  const base = Object.fromEntries(
    Object.keys(EMPTY_SPEC).map((k) => [k, null]),
  ) as unknown as ConsumableSpecRecord;
  return { ...base, itemId, ...overrides };
}

// Field shape for the all-null base; values are irrelevant (overwritten with null).
const EMPTY_SPEC: Record<keyof ConsumableSpecRecord, null> = {
  itemId: null,
  hp: null, mp: null, hpR: null, mpR: null, mhp: null, mhpR: null, mmpR: null,
  mhpRRate: null, mmpRRate: null, time: null, pad: null, mad: null, pdd: null,
  mdd: null, acc: null, eva: null, speed: null, jump: null, luk: null,
  padRate: null, madRate: null, pddRate: null, mddRate: null, accRate: null,
  evaRate: null, speedRate: null, curse: null, darkness: null, poison: null,
  seal: null, weakness: null, thaw: null, barrier: null, respectPimmune: null,
  respectMimmune: null, respectFs: null, defenseAtt: null, defenseState: null,
  prob: null, itemupbyitem: null, mesoupbyitem: null, itemCode: null,
  itemRange: null, morph: null, ghost: null, moveTo: null, returnMapQr: null,
  ignoreContinent: null, randomMoveInFieldSet: null, npc: null, attackMobId: null,
  attackIndex: null, inc: null, incFatigue: null, exp: null, expinc: null,
  expBuff: null, maxLevelBuff: null, cp: null, eventPoint: null, eventRate: null,
  consumeOnPickup: null, onlyPickup: null, runOnPickup: null, repeatEffect: null,
  otherParty: null, party: null, mob: null, morphRandom: null, skillbook: null,
  summonMobs: null,
};

describe('listItems with consumable effect columns', () => {
  let db: DbApi;

  beforeEach(async () => {
    db = new DbApi(new Sqlite({ logTag: 'list-items-test' }));
    await db.open();
    await db.upsertItems([
      makeItem(2000000, 'Red Potion'),
      makeItem(2000001, 'Blue Potion'),
      makeItem(2002004, 'Warrior Potion'),
      makeItem(4000000, 'A Mushroom Cap', 'etc'), // non-consumable, no spec
    ]);
    await db.upsertConsumableSpecs([
      makeSpec(2000000, { hp: 50 }),
      makeSpec(2000001, { hp: 300, mp: 150 }),
      makeSpec(2002004, { pad: 5, time: 300000 }), // 300s buff
    ]);
  });

  it('LEFT JOINs effect columns; null for items without a spec', async () => {
    const { rows, total } = await db.listItems({ orderBy: 'id', dir: 'asc' });
    expect(total).toBe(4); // join must not inflate the count
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(2000000)!.recoveryHp).toBe(50);
    expect(byId.get(2002004)!.buffWeaponAttack).toBe(5);
    expect(byId.get(2002004)!.buffDurationSeconds).toBe(300); // ms ÷ 1000
    expect(byId.get(4000000)!.recoveryHp).toBeNull();
    expect(byId.get(4000000)!.buffDurationSeconds).toBeNull();
  });

  it('sorts by an effect column', async () => {
    const { rows } = await db.listItems({ orderBy: 'recoveryHp', dir: 'desc' });
    // 300, 50, then the null-HP rows last.
    expect(rows.slice(0, 2).map((r) => r.id)).toEqual([2000001, 2000000]);
  });

  it('range-filters by recovery HP', async () => {
    const { rows, total } = await db.listItems({
      filters: { recoveryHp: { kind: 'range', min: 100 } },
    });
    expect(total).toBe(1);
    expect(rows[0]!.id).toBe(2000001);
  });

  it('range-filters buff duration in seconds', async () => {
    const inRange = await db.listItems({
      filters: { buffDurationSeconds: { kind: 'range', min: 200, max: 400 } },
    });
    expect(inRange.rows.map((r) => r.id)).toEqual([2002004]);
    const outOfRange = await db.listItems({
      filters: { buffDurationSeconds: { kind: 'range', min: 9000 } },
    });
    expect(outOfRange.total).toBe(0);
  });
});

describe('getMobSummonedFrom (reverse summon lookup)', () => {
  let db: DbApi;

  beforeEach(async () => {
    db = new DbApi(new Sqlite({ logTag: 'summoned-from-test' }));
    await db.open();
    await db.upsertItems([
      makeItem(2100132, 'Balrog Summoning Sack'),
      makeItem(2109513, 'Summon Baby Balrog'),
      makeItem(2000000, 'Red Potion'),
    ]);
    await db.upsertConsumableSpecs([
      makeSpec(2100132, {
        summonMobs: [
          { mobId: 8830000, prob: 100 },
          { mobId: 8830100, prob: 100 },
        ],
      }),
      makeSpec(2109513, {
        summonMobs: [
          { mobId: 8830100, prob: 100 },
          { mobId: 8830100, prob: 100 },
          { mobId: 8830100, prob: 100 },
        ],
      }),
      makeSpec(2000000, { hp: 50 }),
    ]);
  });

  it('lists items that summon a mob, with spawn counts', async () => {
    const rows = await db.getMobSummonedFrom(8830100);
    expect(rows.map((r) => r.itemId)).toEqual([2100132, 2109513]); // ordered by name
    expect(rows.find((r) => r.itemId === 2109513)!.spawnCount).toBe(3);
    expect(rows.find((r) => r.itemId === 2100132)!.spawnCount).toBe(1);
  });

  it('returns empty for a mob nothing summons', async () => {
    expect(await db.getMobSummonedFrom(9999999)).toEqual([]);
  });
});
