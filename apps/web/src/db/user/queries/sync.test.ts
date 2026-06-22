// @vitest-environment node
//
// Phase 1 of the sync system: every user-DB mutation must append exactly the
// right rows to `sync_outbox`, atomically with the data write, and nothing
// must leave the device. These tests drive the query functions directly
// against an in-memory user DB and inspect the outbox.

import { describe, it, expect, beforeEach } from 'vitest';
import { Sqlite, type Row } from '@scrolled/game-db/db/sqlite';
import { USER_MIGRATIONS } from '../migrations';
import {
  addMember,
  bulkAddMembers,
  createCollection,
  deleteCollection,
  removeMember,
  updateCollection,
  updateMember,
} from './collections';
import { createGroup, deleteGroup } from './collectionGroups';
import { createPinnedSearch, deletePinnedSearch } from './pinnedSearches';
import { setUserSetting, deleteUserSetting } from './userSettings';
import { trackRecentEntity, trackRecentQuery } from './recents';

function newDb(): Sqlite {
  return new Sqlite({ logTag: 'sync-test', migrations: USER_MIGRATIONS });
}

interface OutboxRow {
  seq: number;
  entity: string;
  uuid: string;
  op: 'upsert' | 'delete';
  payload: string;
  base_revision: number;
  idempotency: string;
}

function outbox(db: Sqlite): OutboxRow[] {
  return db.selectObjects<Row>('SELECT * FROM sync_outbox ORDER BY seq') as unknown as OutboxRow[];
}

function clearOutbox(db: Sqlite): void {
  db.exec('DELETE FROM sync_outbox');
}

describe('outbox accumulation (sync phase 1)', () => {
  let db: Sqlite;

  beforeEach(async () => {
    db = newDb();
    await db.open();
    // The seeded "Favourites" collection backfills one row; start each test
    // from a clean outbox.
    clearOutbox(db);
  });

  it('mints a stable device id and seeds the cursor', () => {
    const cursor = db.selectObject<Row>('SELECT * FROM sync_cursor WHERE id = 1');
    expect(cursor).not.toBeNull();
    expect(String(cursor!.device_id)).toMatch(/^[0-9a-f]{32}$/);
    expect(Number(cursor!.server_seq)).toBe(0);
    expect(cursor!.account_id).toBeNull();
  });

  it('backfilled the seeded collection with a uuid and revision', () => {
    const row = db.selectObject<Row>('SELECT uuid, revision FROM collections LIMIT 1');
    expect(String(row!.uuid)).toMatch(/^[0-9a-f]{32}$/);
    expect(Number(row!.revision)).toBe(1);
  });

  it('records an upsert when a collection is created', () => {
    const created = createCollection(db, { name: 'Bosses' });
    const rows = outbox(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].entity).toBe('collection');
    expect(rows[0].op).toBe('upsert');
    expect(rows[0].base_revision).toBe(0);

    const payload = JSON.parse(rows[0].payload) as Row;
    expect(payload.name).toBe('Bosses');
    expect(String(payload.uuid)).toBe(rows[0].uuid);
    expect(Number(payload.revision)).toBe(1);
    expect(String(payload.origin_device)).toMatch(/^[0-9a-f]{32}$/);
    expect(payload.deleted_at).toBeNull();

    // The live row carries the same identity.
    const live = db.selectObject<Row>('SELECT uuid, revision FROM collections WHERE id = ?', [
      created.id,
    ]);
    expect(String(live!.uuid)).toBe(rows[0].uuid);
  });

  it('bumps revision and reuses the uuid on update', () => {
    const created = createCollection(db, { name: 'Bosses' });
    clearOutbox(db);
    updateCollection(db, created.id, { description: 'end-game' });
    const rows = outbox(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].op).toBe('upsert');
    expect(rows[0].base_revision).toBe(1);
    const payload = JSON.parse(rows[0].payload) as Row;
    expect(Number(payload.revision)).toBe(2);
    expect(payload.description).toBe('end-game');
  });

  it('records a delete tombstone and tombstones the members on collection delete', () => {
    const c = createCollection(db, { name: 'Bosses' });
    addMember(db, c.id, 'mob', 100);
    addMember(db, c.id, 'mob', 200);
    clearOutbox(db);

    deleteCollection(db, c.id);
    const rows = outbox(db);
    // two member deletes + the collection delete
    expect(rows.filter((r) => r.entity === 'collection_member' && r.op === 'delete')).toHaveLength(2);
    expect(rows.filter((r) => r.entity === 'collection' && r.op === 'delete')).toHaveLength(1);
    // live row is gone
    expect(db.selectValue('SELECT COUNT(*) FROM collections WHERE id = ?', [c.id])).toBe(0);
  });

  it('records each added member and each removal', () => {
    const c = createCollection(db, { name: 'Farm' });
    clearOutbox(db);
    addMember(db, c.id, 'item', 1302000);
    updateMember(db, c.id, 'item', 1302000, { quantity: 5 });
    removeMember(db, c.id, 'item', 1302000);
    const rows = outbox(db);
    expect(rows.map((r) => `${r.entity}:${r.op}`)).toEqual([
      'collection_member:upsert',
      'collection_member:upsert',
      'collection_member:delete',
    ]);
  });

  it('records bulk member adds and a group lifecycle', () => {
    const c = createCollection(db, { name: 'Quests' });
    clearOutbox(db);
    const result = bulkAddMembers(db, c.id, [
      { entityType: 'mob', entityId: 1 },
      { entityType: 'mob', entityId: 2 },
      { entityType: 'mob', entityId: 3 },
    ]);
    expect(result.added).toBe(3);
    expect(outbox(db).filter((r) => r.entity === 'collection_member')).toHaveLength(3);

    clearOutbox(db);
    const g = createGroup(db, c.id, 'Pre-quest');
    expect(outbox(db)).toHaveLength(1);
    expect(outbox(db)[0].entity).toBe('collection_group');

    clearOutbox(db);
    deleteGroup(db, g.id);
    expect(outbox(db).some((r) => r.entity === 'collection_group' && r.op === 'delete')).toBe(true);
  });

  it('records pinned searches, user settings, and recents', () => {
    const p = createPinnedSearch(db, { name: 'High-level mobs', entity: 'mob', params: {} });
    expect(outbox(db).at(-1)?.entity).toBe('pinned_search');
    deletePinnedSearch(db, p.id);
    expect(outbox(db).at(-1)).toMatchObject({ entity: 'pinned_search', op: 'delete' });

    clearOutbox(db);
    setUserSetting(db, 'accent', JSON.stringify('teal'));
    expect(outbox(db).at(-1)).toMatchObject({ entity: 'user_setting', op: 'upsert' });
    deleteUserSetting(db, 'accent');
    expect(outbox(db).at(-1)).toMatchObject({ entity: 'user_setting', op: 'delete' });

    clearOutbox(db);
    trackRecentEntity(db, 'item', 1302000, 'Sword');
    trackRecentQuery(db, 'sword');
    const recents = outbox(db).filter((r) => r.entity === 'recent');
    expect(recents).toHaveLength(2);
    expect(recents.every((r) => r.op === 'upsert')).toBe(true);
  });

  it('coalesces a re-viewed entity onto one live row but records each view', () => {
    trackRecentEntity(db, 'item', 1302000, 'Sword', 1000);
    trackRecentEntity(db, 'item', 1302000, 'Sword', 2000);
    // one live row, latest timestamp wins
    expect(db.selectValue("SELECT COUNT(*) FROM recents WHERE kind = 'entity'")).toBe(1);
    expect(db.selectValue("SELECT viewed_at FROM recents WHERE kind = 'entity'")).toBe(2000);
    const recents = outbox(db).filter((r) => r.entity === 'recent' && r.op === 'upsert');
    expect(recents.length).toBeGreaterThanOrEqual(2);
  });

  it('prunes recents past the cap with delete tombstones', () => {
    for (let i = 0; i < 35; i++) trackRecentEntity(db, 'item', i, `Item ${i}`, 1000 + i);
    expect(db.selectValue("SELECT COUNT(*) FROM recents WHERE kind = 'entity'")).toBe(30);
    expect(outbox(db).some((r) => r.entity === 'recent' && r.op === 'delete')).toBe(true);
  });

  it('gives every outbox entry a distinct idempotency key', () => {
    createCollection(db, { name: 'A' });
    createCollection(db, { name: 'B' });
    const keys = outbox(db).map((r) => r.idempotency);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^[0-9a-f]{32}$/.test(k))).toBe(true);
  });
});
