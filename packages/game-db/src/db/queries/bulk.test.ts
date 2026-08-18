// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { Sqlite } from '../sqlite';
import { DbApi } from './index';
import type { ItemRecord, QuestRecord } from '../types';

function makeItem(id: number, name: string): ItemRecord {
  return {
    id,
    name,
    description: null,
    category: 'etc',
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

function makeQuest(id: number, name: string, overrides: Partial<QuestRecord> = {}): QuestRecord {
  return {
    id,
    name,
    parent: null,
    description: null,
    startNpcId: null,
    endNpcId: null,
    requiredLevel: null,
    requiredJob: null,
    repeatWait: null,
    rewardExp: null,
    rewardMeso: null,
    rewardFame: null,
    sourcePath: `Quest.wz/${id}`,
    ...overrides,
  };
}

describe('plural reads', () => {
  let db: DbApi;

  beforeEach(async () => {
    db = new DbApi(new Sqlite({ logTag: 'bulk-reads-test' }));
    await db.open();
    await db.upsertItems([
      makeItem(4000000, 'Slime Bubble'),
      makeItem(4000001, 'Orange Mushroom Cap'),
      makeItem(4000002, 'Blue Mushroom Cap'),
    ]);
    await db.upsertQuests([
      makeQuest(1000, 'First Steps'),
      makeQuest(1001, 'Second Steps'),
      makeQuest(1002, 'Third Steps'),
    ]);
    await db.replaceQuestRelations({
      requirements: [
        { questId: 1000, kind: 'item', targetId: 4000000, amount: 5 },
        { questId: 1001, kind: 'item', targetId: 4000001, amount: 10 },
        { questId: 1001, kind: 'mob', targetId: 100100, amount: 20 },
      ],
      rewards: [
        { questId: 1000, kind: 'exp', idx: 0, targetId: null, amount: 100, prop: null, job: null, gender: null, period: null },
        { questId: 1001, kind: 'item', idx: 0, targetId: 4000002, amount: 1, prop: null, job: null, gender: null, period: null },
      ],
    });
  });

  it('getItems returns many and omits missing ids', async () => {
    const rows = await db.getItems([4000000, 4000002, 9999999]);
    expect(rows.map((r) => r.id).sort()).toEqual([4000000, 4000002]);
    expect(await db.getItems([])).toEqual([]);
  });

  it('getQuestsMany returns many and omits missing ids', async () => {
    const rows = await db.getQuestsMany([1000, 1002, 9999999]);
    expect(rows.map((r) => r.id).sort()).toEqual([1000, 1002]);
  });

  it('getQuestRequirementsMany returns a flat array keyed by questId', async () => {
    const rows = await db.getQuestRequirementsMany([1000, 1001]);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.questId === 1000 || r.questId === 1001)).toBe(true);
    const forQ1 = rows.filter((r) => r.questId === 1001);
    expect(forQ1).toHaveLength(2);
    // Item requirements are joined to the target's display name.
    expect(rows.find((r) => r.targetId === 4000001)!.targetName).toBe('Orange Mushroom Cap');
  });

  it('getQuestRewardsMany returns a flat array keyed by questId', async () => {
    const rows = await db.getQuestRewardsMany([1000, 1001]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.questId === 1001)!.targetName).toBe('Blue Mushroom Cap');
  });

  it('the singular queries still return the same shape (delegation)', async () => {
    expect(await db.getQuestRequirements(1001)).toEqual(
      await db.getQuestRequirementsMany([1001]),
    );
    expect(await db.getQuestRewards(1001)).toEqual(await db.getQuestRewardsMany([1001]));
  });
});

describe('getQuestChainsMany', () => {
  let db: DbApi;

  beforeEach(async () => {
    db = new DbApi(new Sqlite({ logTag: 'bulk-chains-test' }));
    await db.open();
    // Two independent chains: (10 → 11) and (20 → 21), built from questPre edges.
    await db.upsertQuests([
      makeQuest(10, 'A start'),
      makeQuest(11, 'A finish'),
      makeQuest(20, 'B start'),
      makeQuest(21, 'B finish'),
    ]);
    await db.replaceQuestRelations({
      requirements: [
        { questId: 11, kind: 'questPre', targetId: 10, amount: null },
        { questId: 21, kind: 'questPre', targetId: 20, amount: null },
      ],
      rewards: [],
    });
    await db.computeAndStoreQuestChains();
  });

  it('hydrates several chains and dedups/omits missing ids', async () => {
    const chainA = await db.getChainForQuest(10);
    const chainB = await db.getChainForQuest(20);
    expect(chainA).not.toBeNull();
    expect(chainB).not.toBeNull();

    const details = await db.getQuestChainsMany([
      chainA!.id,
      chainB!.id,
      chainA!.id, // duplicate — should collapse
      999999, // missing — should be omitted
    ]);
    expect(details).toHaveLength(2);
    const ids = details.map((d) => d.chain.id).sort();
    expect(ids).toEqual([chainA!.id, chainB!.id].sort());
    expect(details[0]!.members.length).toBeGreaterThanOrEqual(2);
  });
});
