// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../registry';
import { NotFoundError, ValidationError } from '../errors';
import type { ToolContext } from '../types';
import { itemsGet } from './items';
import { questsRequirements, questsBundle } from './quests';
import { collectionsBulkAdd } from './collections';

function registryWith(...tools: Parameters<ToolRegistry['register']>[0][]): ToolRegistry {
  const r = new ToolRegistry();
  for (const t of tools) r.register(t);
  return r;
}

function ctxWith(over: {
  db?: Partial<ToolContext['db']>;
  userDb?: Partial<ToolContext['userDb']>;
}): ToolContext {
  return {
    db: (over.db ?? {}) as ToolContext['db'],
    userDb: (over.userDb ?? {}) as ToolContext['userDb'],
    services: {},
  };
}

const ITEMS = [
  { id: 4000000, name: 'Slime Bubble', quest: false, tradeBlock: true, price: 1 },
  { id: 4000001, name: 'Orange Cap', quest: true, tradeBlock: false, price: 2 },
];

describe('items.get', () => {
  const db = {
    getItems: async (ids: readonly number[]) => ITEMS.filter((i) => ids.includes(i.id)),
    getItem: async (id: number) => ITEMS.find((i) => i.id === id) ?? null,
  };

  it('returns an array for ids, omitting missing', async () => {
    const r = registryWith(itemsGet);
    const out = (await r.execute(
      'items.get',
      { ids: [4000000, 4000001, 9999999] },
      ctxWith({ db: db as unknown as ToolContext['db'] }),
    )) as unknown[];
    expect(out).toHaveLength(2);
  });

  it('projects to requested fields plus id', async () => {
    const r = registryWith(itemsGet);
    const out = (await r.execute(
      'items.get',
      { ids: [4000000], fields: ['quest', 'tradeBlock'] },
      ctxWith({ db: db as unknown as ToolContext['db'] }),
    )) as Record<string, unknown>[];
    expect(out[0]).toEqual({ id: 4000000, quest: false, tradeBlock: true });
  });

  it('returns a single record object for id (not an array)', async () => {
    const r = registryWith(itemsGet);
    const out = (await r.execute(
      'items.get',
      { id: 4000001 },
      ctxWith({ db: db as unknown as ToolContext['db'] }),
    )) as Record<string, unknown>;
    expect(out.name).toBe('Orange Cap');
  });

  it('throws NotFoundError for a missing single id', async () => {
    const r = registryWith(itemsGet);
    await expect(
      r.execute('items.get', { id: 5 }, ctxWith({ db: db as unknown as ToolContext['db'] })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects input with neither id nor ids', async () => {
    const r = registryWith(itemsGet);
    await expect(
      r.execute('items.get', {}, ctxWith({ db: db as unknown as ToolContext['db'] })),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('quests.listRequirements / quests.bundle', () => {
  const requirements = [
    { questId: 10, kind: 'item', targetId: 4000000, amount: 5, targetName: 'Slime Bubble', targetLevel: null },
    { questId: 11, kind: 'mob', targetId: 100, amount: 2, targetName: 'Snail', targetLevel: null },
  ];
  const rewards = [
    { questId: 10, kind: 'exp', idx: 0, targetId: null, amount: 100, prop: null, job: null, gender: null, period: null, targetName: null, targetEntity: null },
  ];
  const db = {
    getQuestRequirementsMany: async (ids: readonly number[]) =>
      requirements.filter((r) => ids.includes(r.questId)),
    getQuestRewardsMany: async (ids: readonly number[]) =>
      rewards.filter((r) => ids.includes(r.questId)),
    getQuestsMany: async (ids: readonly number[]) =>
      [10, 11].filter((id) => ids.includes(id)).map((id) => ({ id, name: `Quest ${id}` })),
  };

  it('listRequirements returns a flat array spanning multiple quests', async () => {
    const r = registryWith(questsRequirements);
    const out = (await r.execute(
      'quests.listRequirements',
      { ids: [10, 11] },
      ctxWith({ db: db as unknown as ToolContext['db'] }),
    )) as { questId: number }[];
    expect(out.map((x) => x.questId).sort()).toEqual([10, 11]);
  });

  it('bundle joins requirements and rewards by questId', async () => {
    const r = registryWith(questsBundle);
    const out = (await r.execute(
      'quests.bundle',
      { ids: [10, 11] },
      ctxWith({ db: db as unknown as ToolContext['db'] }),
    )) as { quest: { id: number }; requirements: unknown[]; rewards: unknown[] }[];
    const byId = new Map(out.map((b) => [b.quest.id, b]));
    expect(byId.get(10)!.requirements).toHaveLength(1);
    expect(byId.get(10)!.rewards).toHaveLength(1);
    expect(byId.get(11)!.requirements).toHaveLength(1);
    expect(byId.get(11)!.rewards).toHaveLength(0);
  });
});

describe('collections.bulkAdd groupName', () => {
  it('resolves groupName via ensureGroup and passes its id to bulkAddMembers', async () => {
    let seenGroupId: number | null | undefined;
    const userDb = {
      ensureGroup: async (_collectionId: number, name: string) => ({
        id: 42,
        collectionId: 1,
        name,
        position: 0,
        createdAt: 0,
        updatedAt: 0,
      }),
      bulkAddMembers: async (_c: number, _refs: unknown, groupId: number | null) => {
        seenGroupId = groupId;
        return { added: 1, skipped: 0 };
      },
    };
    const r = registryWith(collectionsBulkAdd);
    await r.execute(
      'collections.bulkAdd',
      {
        collectionId: 1,
        refs: [{ entityType: 'mob', entityId: 100, quantity: 25 }],
        groupName: 'Mobs to kill',
      },
      ctxWith({ userDb: userDb as unknown as ToolContext['userDb'] }),
    );
    expect(seenGroupId).toBe(42);
  });

  it('rejects passing both groupId and groupName', async () => {
    const r = registryWith(collectionsBulkAdd);
    await expect(
      r.execute(
        'collections.bulkAdd',
        {
          collectionId: 1,
          refs: [{ entityType: 'mob', entityId: 100 }],
          groupId: 1,
          groupName: 'x',
        },
        ctxWith({}),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
