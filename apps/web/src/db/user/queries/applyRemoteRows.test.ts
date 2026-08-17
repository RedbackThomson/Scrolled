// @vitest-environment node
//
// The apply path in isolation: what happens to a local row when a backend row
// arrives, without an engine in the way.

import { beforeEach, describe, expect, it } from 'vitest';
import { Sqlite, type Row } from '@scrolled/game-db/db/sqlite';
import type { RemoteRow, SyncEntity, TaggedRow } from '@scrolled/sync-core';
import { USER_MIGRATIONS } from '../migrations';
import { addMember, createCollection } from './collections';
import { createGroup } from './collectionGroups';
import { setUserSetting } from './userSettings';
import {
  applyRemoteRows,
  drainOutbox,
  getSyncMeta,
  markOutboxSynced,
  pendingCount,
  rekeyLocal,
  replaceAllFromSnapshot,
} from './sync';

let db: Sqlite;
let seq = 0;

beforeEach(async () => {
  db = new Sqlite({ logTag: 'apply-test', migrations: USER_MIGRATIONS });
  await db.open();
  seq = 0;
});

function tagged(entity: SyncEntity, row: RemoteRow, at = ++seq): TaggedRow {
  return {
    entity,
    row: { origin_device: 'dev-b', updated_at: at, deleted_at: null, ...row },
    seq: at,
    serverTime: new Date(1_800_000_000_000 + at).toISOString(),
  };
}

const remoteCollection = (key: string, name: string): RemoteRow => ({
  key,
  name,
  created_at: 1,
  pinned: false,
  pinned_position: null,
  grouping: 'group',
  subgrouping: 'type',
  sort_key: 'manual',
  sort_dir: 'asc',
});

const remoteMember = (collectionKey: string, entityId: number): RemoteRow => ({
  collection_key: collectionKey,
  entity_type: 'mob',
  entity_id: entityId,
  group_key: null,
  note: null,
  quantity: null,
  done: false,
  added_at: 1,
  position: 0,
});

const count = (table: string) => db.selectValue<number>(`SELECT COUNT(*) FROM ${table}`) ?? 0;

describe('applyRemoteRows', () => {
  it('inserts a collection and its member', () => {
    const result = applyRemoteRows(db, [
      tagged('collection', remoteCollection('c1', 'Bosses')),
      tagged('collection_member', remoteMember('c1', 100)),
    ]);

    expect(result.applied).toBe(2);
    expect(count('collection_members')).toBe(1);
    expect(result.invalidatedKeys).toContainEqual(['user', 'collections']);
  });

  it('applies a member listed before its collection', () => {
    // Ordering by entity happens inside apply, so wire order must not matter.
    applyRemoteRows(db, [
      tagged('collection_member', remoteMember('c1', 100)),
      tagged('collection', remoteCollection('c1', 'Bosses')),
    ]);

    expect(count('collection_members')).toBe(1);
  });

  it('leaves a member ungrouped when its group has not arrived', () => {
    applyRemoteRows(db, [
      tagged('collection', remoteCollection('c1', 'Bosses')),
      tagged('collection_member', { ...remoteMember('c1', 100), group_key: 'g1' }),
    ]);

    expect(db.selectValue('SELECT group_id FROM collection_members')).toBeNull();

    applyRemoteRows(db, [
      tagged('collection_group', {
        key: 'g1',
        collection_key: 'c1',
        name: 'Tier 1',
        position: 0,
        created_at: 1,
      }),
      tagged('collection_member', { ...remoteMember('c1', 100), group_key: 'g1' }),
    ]);

    expect(db.selectValue('SELECT group_id FROM collection_members')).not.toBeNull();
  });

  it('ignores a row it already holds at the same seq', () => {
    const row = tagged('collection', remoteCollection('c1', 'Bosses'));
    applyRemoteRows(db, [row]);

    const again = applyRemoteRows(db, [{ ...row, row: { ...row.row, name: 'Stale' } }]);

    expect(again.applied).toBe(0);
    expect(db.selectValue('SELECT name FROM collections WHERE uuid = ?', ['c1'])).toBe('Bosses');
  });

  it('skips a record with a queued local edit, so the push wins', () => {
    const local = createCollection(db, { name: 'Mine' });
    const key = db.selectValue<string>('SELECT uuid FROM collections WHERE id = ?', [local.id])!;

    const result = applyRemoteRows(db, [tagged('collection', remoteCollection(key, 'Theirs'))]);

    expect(result.applied).toBe(0);
    expect(db.selectValue('SELECT name FROM collections WHERE uuid = ?', [key])).toBe('Mine');
  });

  it('deletes a row the backend tombstoned', () => {
    applyRemoteRows(db, [tagged('collection', remoteCollection('c1', 'Bosses'))]);

    applyRemoteRows(db, [
      tagged('collection', {
        ...remoteCollection('c1', 'Bosses'),
        deleted_at: '2026-01-01T00:00:00.000Z',
      }),
    ]);

    expect(db.selectValue('SELECT 1 FROM collections WHERE uuid = ?', ['c1'])).toBeNull();
  });

  it('ignores a backend row that carries no key', () => {
    const result = applyRemoteRows(db, [tagged('collection', remoteCollection('', 'Keyless'))]);

    expect(result.applied).toBe(0);
    expect(db.selectValue("SELECT 1 FROM collections WHERE uuid = ''")).toBeNull();
  });

  it('translates backend booleans into the local integer columns', () => {
    applyRemoteRows(db, [
      tagged('collection', { ...remoteCollection('c1', 'Bosses'), pinned: true }),
      tagged('collection_member', { ...remoteMember('c1', 100), done: true }),
    ]);

    expect(db.selectValue('SELECT pinned FROM collections WHERE uuid = ?', ['c1'])).toBe(1);
    expect(db.selectValue('SELECT done FROM collection_members')).toBe(1);
  });
});

describe('replaceAllFromSnapshot', () => {
  it('discards divergent local state and any queued push', () => {
    const stale = createCollection(db, { name: 'Stale' });
    addMember(db, stale.id, 'mob', 999);
    expect(pendingCount(db)).toBeGreaterThan(0);

    replaceAllFromSnapshot(db, [
      tagged('collection', remoteCollection('c1', 'Canonical')),
      tagged('collection_member', remoteMember('c1', 100)),
    ]);

    expect(db.selectObjects<Row>('SELECT name FROM collections').map((r) => r.name)).toEqual([
      'Canonical',
    ]);
    expect(count('collection_members')).toBe(1);
    expect(pendingCount(db)).toBe(0);
  });
});

describe('rekeyLocal', () => {
  it('repoints a collection and its children at the backend key', () => {
    const c = createCollection(db, { name: 'Bosses' });
    createGroup(db, c.id, 'Tier 1');
    addMember(db, c.id, 'mob', 100);
    const from = db.selectValue<string>('SELECT uuid FROM collections WHERE id = ?', [c.id])!;

    rekeyLocal(db, 'collection', from, 'canonical-key');

    expect(db.selectValue('SELECT uuid FROM collections WHERE id = ?', [c.id])).toBe(
      'canonical-key',
    );
    // Children reference the collection by integer id locally, so they follow
    // automatically; the queued push now carries the canonical key.
    const queued = drainOutbox(db, 100);
    expect(queued.find((q) => q.entity === 'collection')?.key).toBe('canonical-key');
    expect(queued.find((q) => q.entity === 'collection_member')?.row.collection_key).toBe(
      'canonical-key',
    );
    expect(queued.find((q) => q.entity === 'collection_group')?.row.collection_key).toBe(
      'canonical-key',
    );
  });

  it('leaves both rows alone when the backend key is already present locally', () => {
    const keep = createCollection(db, { name: 'Keep' });
    const other = createCollection(db, { name: 'Other' });
    const keepKey = db.selectValue<string>('SELECT uuid FROM collections WHERE id = ?', [keep.id])!;
    const otherKey = db.selectValue<string>('SELECT uuid FROM collections WHERE id = ?', [
      other.id,
    ])!;

    rekeyLocal(db, 'collection', otherKey, keepKey);

    expect(count('collections')).toBe(3); // both, plus the seeded Favourites
    expect(db.selectValue('SELECT uuid FROM collections WHERE id = ?', [other.id])).toBe(otherKey);
  });
});

describe('markOutboxSynced', () => {
  it('clears a naturally-keyed record whose stored uuid differs', () => {
    setUserSetting(db, 'home.layout', '{"a":1}');
    // A second write under a different uuid, as a rekey or a backfill leaves it.
    db.exec("UPDATE user_settings SET uuid = 'later-uuid' WHERE key = 'home.layout'");
    setUserSetting(db, 'home.layout', '{"b":2}');
    expect(pendingCount(db)).toBe(2);

    const [change] = drainOutbox(db, 100).filter((c) => c.entity === 'user_setting');
    const removed = markOutboxSynced(db, [change.seq], [{ key: change.key, seq: 1 }]);

    // Deleting by the stored uuid would leave the earlier entry queued, and the
    // engine would send the same record again on every pass.
    expect(removed).toBe(2);
    expect(pendingCount(db)).toBe(0);
  });

  it('reports nothing removed when the acked entry is already gone', () => {
    expect(markOutboxSynced(db, [9999], [])).toBe(0);
  });
});

describe('drainOutbox', () => {
  it('collapses repeated edits of one record into a single change', () => {
    const c = createCollection(db, { name: 'Bosses' });
    for (let i = 0; i < 5; i++) addMember(db, c.id, 'mob', 100 + i);
    const before = pendingCount(db);

    // Re-adding an existing member queues another entry for the same record.
    for (let i = 0; i < 5; i++) addMember(db, c.id, 'mob', 100);

    expect(pendingCount(db)).toBeGreaterThan(before);
    expect(drainOutbox(db, 100).filter((c2) => c2.entity === 'collection_member')).toHaveLength(5);
  });

  it('starts with an empty cursor and a device id', () => {
    const meta = getSyncMeta(db);
    expect(meta.cursor).toBe('');
    expect(meta.deviceId).toMatch(/^[0-9a-f]{32}$/);
    expect(meta.accountId).toBeNull();
  });
});
