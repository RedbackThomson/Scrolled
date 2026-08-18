// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { Sqlite } from '@scrolled/game-db/db/sqlite';
import { USER_MIGRATIONS } from '../migrations';
import { bulkAddMembers, createCollection, listMembers } from './collections';
import { createGroups, ensureGroup, listGroups } from './collectionGroups';

function newDb(): Sqlite {
  return new Sqlite({ logTag: 'bulk-add-test', migrations: USER_MIGRATIONS });
}

describe('bulkAddMembers metadata', () => {
  let db: Sqlite;
  let collectionId: number;

  beforeEach(async () => {
    db = newDb();
    await db.open();
    collectionId = createCollection(db, { name: 'Import Target' }).id;
  });

  it('writes per-ref quantity/note/done on insert', () => {
    const result = bulkAddMembers(db, collectionId, [
      { entityType: 'mob', entityId: 100, quantity: 25 },
      { entityType: 'item', entityId: 200, quantity: 16, note: 'gather', done: true },
      { entityType: 'quest', entityId: 300 },
    ]);
    expect(result).toEqual({ added: 3, skipped: 0 });

    const members = new Map(listMembers(db, collectionId).map((m) => [m.entityId, m]));
    expect(members.get(100)!.quantity).toBe(25);
    expect(members.get(200)!.quantity).toBe(16);
    expect(members.get(200)!.note).toBe('gather');
    expect(members.get(200)!.done).toBe(true);
    expect(members.get(300)!.quantity).toBeNull();
    expect(members.get(300)!.done).toBe(false);
  });

  it('skips existing members without touching their metadata', () => {
    bulkAddMembers(db, collectionId, [{ entityType: 'mob', entityId: 100, quantity: 25 }]);
    const result = bulkAddMembers(db, collectionId, [
      { entityType: 'mob', entityId: 100, quantity: 999 },
      { entityType: 'mob', entityId: 101, quantity: 5 },
    ]);
    expect(result).toEqual({ added: 1, skipped: 1 });

    const members = new Map(listMembers(db, collectionId).map((m) => [m.entityId, m]));
    expect(members.get(100)!.quantity).toBe(25); // unchanged
    expect(members.get(101)!.quantity).toBe(5);
  });

  it('lands members in the target group', () => {
    const group = ensureGroup(db, collectionId, 'Mobs to kill');
    bulkAddMembers(
      db,
      collectionId,
      [{ entityType: 'mob', entityId: 100, quantity: 25 }],
      group.id,
    );
    expect(listMembers(db, collectionId)[0]!.groupId).toBe(group.id);
  });
});

describe('createGroups / ensureGroup', () => {
  let db: Sqlite;
  let collectionId: number;

  beforeEach(async () => {
    db = newDb();
    await db.open();
    collectionId = createCollection(db, { name: 'Groups Target' }).id;
  });

  it('createGroups is idempotent — existing names return the existing group', () => {
    const first = createGroups(db, collectionId, ['Mobs', 'Items']);
    expect(first.map((g) => g.name)).toEqual(['Mobs', 'Items']);

    const second = createGroups(db, collectionId, ['Mobs', 'Quests']);
    expect(second.find((g) => g.name === 'Mobs')!.id).toBe(first[0]!.id);

    // Only three distinct groups exist, not four.
    expect(listGroups(db, collectionId).map((g) => g.name).sort()).toEqual([
      'Items',
      'Mobs',
      'Quests',
    ]);
  });

  it('ensureGroup returns the same id on repeat calls', () => {
    const a = ensureGroup(db, collectionId, 'Combined Total');
    const b = ensureGroup(db, collectionId, 'Combined Total');
    expect(b.id).toBe(a.id);
    expect(listGroups(db, collectionId)).toHaveLength(1);
  });
});
