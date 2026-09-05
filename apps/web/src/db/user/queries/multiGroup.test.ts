// @vitest-environment node
//
// The multi-group member model: an entity can live in more than one group of a
// collection, at most once per group, and moving between groups changes its
// natural key on the wire.

import { describe, it, expect, beforeEach } from 'vitest';
import { Sqlite } from '@scrolled/game-db/db/sqlite';
import { USER_MIGRATIONS } from '../migrations';
import {
  addMember,
  createCollection,
  listMembers,
  listMembershipsFor,
  removeEntity,
  removeMember,
} from './collections';
import { createGroup, deleteGroup, moveMember } from './collectionGroups';
import { drainOutbox } from './sync';

function newDb(): Sqlite {
  return new Sqlite({ logTag: 'multi-group-test', migrations: USER_MIGRATIONS });
}

let db: Sqlite;
let collectionId: number;

beforeEach(async () => {
  db = newDb();
  await db.open();
  collectionId = createCollection(db, { name: 'Bossing' }).id;
});

describe('placements', () => {
  it('lets one entity live in several groups at once', () => {
    const daily = createGroup(db, collectionId, 'Daily').id;
    const weekly = createGroup(db, collectionId, 'Weekly').id;

    addMember(db, collectionId, 'mob', 100); // ungrouped
    addMember(db, collectionId, 'mob', 100, { groupId: daily });
    addMember(db, collectionId, 'mob', 100, { groupId: weekly });

    const groups = listMembers(db, collectionId)
      .filter((m) => m.entityId === 100)
      .map((m) => m.groupId)
      .sort();
    expect(groups).toEqual([null, daily, weekly].sort());
  });

  it('keeps a group placement idempotent', () => {
    const daily = createGroup(db, collectionId, 'Daily').id;
    addMember(db, collectionId, 'mob', 100, { groupId: daily, quantity: 3 });
    addMember(db, collectionId, 'mob', 100, { groupId: daily, quantity: 9 });

    const rows = listMembers(db, collectionId).filter((m) => m.entityId === 100);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(9);
  });

  it('removes one placement without touching the others', () => {
    const daily = createGroup(db, collectionId, 'Daily').id;
    addMember(db, collectionId, 'mob', 100); // ungrouped
    addMember(db, collectionId, 'mob', 100, { groupId: daily });

    removeMember(db, collectionId, 'mob', 100, daily);

    const rows = listMembers(db, collectionId).filter((m) => m.entityId === 100);
    expect(rows.map((m) => m.groupId)).toEqual([null]);
  });

  it('removeEntity clears every placement', () => {
    const daily = createGroup(db, collectionId, 'Daily').id;
    addMember(db, collectionId, 'mob', 100);
    addMember(db, collectionId, 'mob', 100, { groupId: daily });

    removeEntity(db, collectionId, 'mob', 100);

    expect(listMembers(db, collectionId).filter((m) => m.entityId === 100)).toHaveLength(0);
  });

  it('reports one membership badge per placement, with its group', () => {
    const daily = createGroup(db, collectionId, 'Daily').id;
    addMember(db, collectionId, 'mob', 100);
    addMember(db, collectionId, 'mob', 100, { groupId: daily });

    const badges = listMembershipsFor(db, 'mob', 100);
    expect(badges).toHaveLength(2);
    expect(badges.map((b) => b.groupName).sort()).toEqual([null, 'Daily'].sort());
  });
});

describe('moveMember', () => {
  it('moves a placement across groups and rekeys it on the wire', () => {
    const daily = createGroup(db, collectionId, 'Daily').id;
    const weekly = createGroup(db, collectionId, 'Weekly').id;
    addMember(db, collectionId, 'mob', 100, { groupId: daily });
    clearOutbox(db);

    moveMember(db, collectionId, 'mob', 100, daily, weekly, 0);

    const rows = listMembers(db, collectionId).filter((m) => m.entityId === 100);
    expect(rows.map((m) => m.groupId)).toEqual([weekly]);

    // The group is part of the key, so the old grouped record is tombstoned and
    // the new one upserted.
    const ops = drainOutbox(db, 100)
      .filter((c) => c.entity === 'collection_member')
      .map((c) => c.op)
      .sort();
    expect(ops).toEqual(['delete', 'upsert']);
  });

  it('is a no-op when the target group already holds the entity', () => {
    const daily = createGroup(db, collectionId, 'Daily').id;
    const weekly = createGroup(db, collectionId, 'Weekly').id;
    addMember(db, collectionId, 'mob', 100, { groupId: daily });
    addMember(db, collectionId, 'mob', 100, { groupId: weekly });

    moveMember(db, collectionId, 'mob', 100, daily, weekly, 0);

    const rows = listMembers(db, collectionId).filter((m) => m.entityId === 100);
    expect(rows.map((m) => m.groupId).sort()).toEqual([daily, weekly].sort());
  });
});

describe('deleteGroup', () => {
  it('reparents members to the ungrouped bucket', () => {
    const daily = createGroup(db, collectionId, 'Daily').id;
    addMember(db, collectionId, 'mob', 100, { groupId: daily });

    deleteGroup(db, daily);

    const rows = listMembers(db, collectionId).filter((m) => m.entityId === 100);
    expect(rows.map((m) => m.groupId)).toEqual([null]);
  });

  it('merges instead of colliding when the entity is already ungrouped', () => {
    const daily = createGroup(db, collectionId, 'Daily').id;
    addMember(db, collectionId, 'mob', 100); // ungrouped
    addMember(db, collectionId, 'mob', 100, { groupId: daily });

    deleteGroup(db, daily);

    const rows = listMembers(db, collectionId).filter((m) => m.entityId === 100);
    expect(rows).toHaveLength(1);
    expect(rows[0].groupId).toBeNull();
  });
});

function clearOutbox(database: Sqlite): void {
  database.exec('DELETE FROM sync_outbox');
}
