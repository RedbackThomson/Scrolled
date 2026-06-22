// @vitest-environment node
//
// Phase 2 of the sync system: the worker-side engine surface, exercised against
// a real in-memory user DB. drainOutbox must project local-only columns off the
// wire; applyRemoteChanges must apply a server-ordered batch, run the conflict
// handler against pending edits, and soft-tombstone remote deletes. The final
// block drives the real `SyncEngine` (sync-core) with this DB as its backend and
// the in-memory mock provider, converging two "devices" through one server.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sqlite, type Row } from '@scrolled/game-db/db/sqlite';
import {
  SyncEngine,
  createMockSyncServer,
  createMockSyncProvider,
  type MockSyncServer,
  type SyncBackend,
} from '@scrolled/sync-core';
import { USER_MIGRATIONS } from '../migrations';
import { createCollection, deleteCollection, addMember } from './collections';
import { setUserSetting } from './userSettings';
import { trackRecentEntity } from './recents';
import {
  applyRemoteChanges,
  drainOutbox,
  getSyncMeta,
  markOutboxSynced,
} from './sync';

async function newDb(): Promise<Sqlite> {
  const db = new Sqlite({ logTag: 'apply-test', migrations: USER_MIGRATIONS });
  await db.open();
  return db;
}

function backendFor(db: Sqlite): SyncBackend {
  return {
    drainOutbox: (limit) => Promise.resolve(drainOutbox(db, limit)),
    markOutboxSynced: (seqs, assigned) => {
      markOutboxSynced(db, seqs, assigned);
      return Promise.resolve();
    },
    applyRemoteChanges: (batch) => Promise.resolve(applyRemoteChanges(db, batch)),
    getSyncMeta: () => Promise.resolve(getSyncMeta(db)),
  };
}

function engineFor(db: Sqlite, server: MockSyncServer) {
  const invalidated: string[][] = [];
  const engine = new SyncEngine({
    provider: createMockSyncProvider({ server }),
    backend: backendFor(db),
    invalidate: (keys) => invalidated.push(...keys),
    now: () => 1_700_000_000_000,
  });
  return { engine, invalidated };
}

describe('drainOutbox — wire projection', () => {
  let db: Sqlite;
  beforeEach(async () => {
    db = await newDb();
    db.exec('DELETE FROM sync_outbox');
  });

  it('projects the local-only recents.name out of the wire payload', () => {
    trackRecentEntity(db, 'item', 1302000, 'Red Whip');
    const drained = drainOutbox(db, 100).filter((c) => c.entity === 'recent');
    expect(drained).toHaveLength(1);
    const payload = drained[0].payload as Record<string, unknown>;
    expect(payload.name).toBeUndefined();
    expect(payload.ref).toBe('item:1302000');
    expect(payload.viewed_at).toBeDefined();
  });

  it('replaces a member.collection_id with the parent collection uuid', () => {
    const c = createCollection(db, { name: 'Bosses' });
    const collectionUuid = db.selectValue<string>('SELECT uuid FROM collections WHERE id = ?', [c.id]);
    addMember(db, c.id, 'mob', 8800000);
    const member = drainOutbox(db, 100).find((x) => x.entity === 'collection_member');
    const payload = member!.payload as Record<string, unknown>;
    expect(payload.collection_id).toBeUndefined();
    expect(payload.collection_uuid).toBe(collectionUuid);
  });
});

describe('applyRemoteChanges — direct', () => {
  let db: Sqlite;
  beforeEach(async () => {
    db = await newDb();
    db.exec('DELETE FROM sync_outbox');
  });

  it('inserts a remote collection and advances the cursor atomically', () => {
    const result = applyRemoteChanges(db, [
      {
        entity: 'collection',
        uuid: 'remote-uuid-1',
        op: 'upsert',
        payload: {
          name: 'From Device B',
          description: null,
          color: null,
          icon: null,
          created_at: 5,
          updated_at: 5,
          pinned: 0,
          pinned_position: null,
          grouping: 'group',
          subgrouping: 'type',
          sort_key: 'manual',
          sort_dir: 'asc',
          uuid: 'remote-uuid-1',
          revision: 1,
          origin_device: 'B',
        },
        baseRevision: 0,
        idempotency: 'k1',
        revision: 1,
        serverSeq: 7,
      },
    ]);
    expect(result.invalidatedKeys).toContainEqual(['user', 'collections']);
    expect(result.serverSeq).toBe(7);
    expect(getSyncMeta(db).serverSeq).toBe(7);
    const row = db.selectObject<Row>(
      'SELECT name, revision FROM collections WHERE uuid = ?',
      ['remote-uuid-1'],
    );
    expect(row).toMatchObject({ name: 'From Device B', revision: 1 });
  });

  it('soft-tombstones a row on a remote delete (deleted_at set, not hard-deleted)', () => {
    const c = createCollection(db, { name: 'Doomed' });
    const uuid = db.selectValue<string>('SELECT uuid FROM collections WHERE id = ?', [c.id])!;
    db.exec('DELETE FROM sync_outbox'); // pretend it already synced

    applyRemoteChanges(db, [
      {
        entity: 'collection',
        uuid,
        op: 'delete',
        payload: { uuid, revision: 2, origin_device: 'B', deleted_at: 999 },
        baseRevision: 1,
        idempotency: 'k-del',
        revision: 2,
        serverSeq: 3,
      },
    ]);

    const row = db.selectObject<Row>(
      'SELECT deleted_at, revision FROM collections WHERE uuid = ?',
      [uuid],
    );
    expect(row).not.toBeNull();
    expect(row!.deleted_at).toBe(999);
    expect(row!.revision).toBe(2);
  });

  it('is idempotent: re-applying a change at the same revision is a no-op', () => {
    const change = {
      entity: 'user_setting' as const,
      uuid: 'us-1',
      op: 'upsert' as const,
      payload: { key: 'accent', value: '"teal"', updated_at: 1, uuid: 'us-1', revision: 1, origin_device: 'B' },
      baseRevision: 0,
      idempotency: 'k',
      revision: 1,
      serverSeq: 1,
    };
    applyRemoteChanges(db, [change]);
    applyRemoteChanges(db, [change]);
    const count = db.selectValue<number>("SELECT COUNT(*) FROM user_settings WHERE key = 'accent'");
    expect(count).toBe(1);
  });
});

describe('SyncEngine — end-to-end over the real SQL backend', () => {
  let clock = 1_000;
  beforeEach(() => {
    clock = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('converges a collection and a setting from device A to device B', async () => {
    const server = createMockSyncServer();
    const dbA = await newDb();
    const dbB = await newDb();
    const a = engineFor(dbA, server);
    const b = engineFor(dbB, server);

    createCollection(dbA, { name: 'Cross-device Bosses' });
    setUserSetting(dbA, 'accent', JSON.stringify('teal'));

    await a.engine.syncNow();
    await b.engine.syncNow();

    const bName = dbB.selectValue<string>(
      "SELECT name FROM collections WHERE name = 'Cross-device Bosses'",
    );
    expect(bName).toBe('Cross-device Bosses');
    expect(dbB.selectValue<string>("SELECT value FROM user_settings WHERE key = 'accent'")).toBe(
      JSON.stringify('teal'),
    );
    expect(b.invalidated).toContainEqual(['user', 'collections']);
    expect(b.invalidated).toContainEqual(['user', 'settings']);
  });

  it('propagates a delete as a tombstone to the other device', async () => {
    const server = createMockSyncServer();
    const dbA = await newDb();
    const dbB = await newDb();
    const a = engineFor(dbA, server);
    const b = engineFor(dbB, server);

    const c = createCollection(dbA, { name: 'Temp' });
    await a.engine.syncNow();
    await b.engine.syncNow();
    const uuid = dbB.selectValue<string>("SELECT uuid FROM collections WHERE name = 'Temp'")!;
    expect(uuid).toBeTruthy();

    deleteCollection(dbA, c.id);
    await a.engine.syncNow();
    await b.engine.syncNow();

    const deletedAt = dbB.selectValue<number>('SELECT deleted_at FROM collections WHERE uuid = ?', [uuid]);
    expect(deletedAt).not.toBeNull();
  });

  it('resolves a 409 by server-ordered LWW — newer wins, both converge', async () => {
    const server = createMockSyncServer();
    const dbA = await newDb();
    const dbB = await newDb();
    const a = engineFor(dbA, server);
    const b = engineFor(dbB, server);

    // Shared baseline.
    clock = 10;
    setUserSetting(dbA, 'k', JSON.stringify('base'));
    await a.engine.syncNow();
    await b.engine.syncNow();

    // Concurrent edits from the same base revision; A is newer.
    clock = 300;
    setUserSetting(dbA, 'k', JSON.stringify('AAA'));
    clock = 200;
    setUserSetting(dbB, 'k', JSON.stringify('BBB'));

    await a.engine.syncNow(); // lands first → server revision 2
    await b.engine.syncNow(); // 409 → B's older edit loses, adopts A's value
    await a.engine.syncNow();

    expect(dbA.selectValue<string>("SELECT value FROM user_settings WHERE key = 'k'")).toBe(
      JSON.stringify('AAA'),
    );
    expect(dbB.selectValue<string>("SELECT value FROM user_settings WHERE key = 'k'")).toBe(
      JSON.stringify('AAA'),
    );
    expect(dbB.selectValue<number>('SELECT COUNT(*) FROM sync_outbox')).toBe(0);
  });

  it('resolves a 409 by server-ordered LWW — local newer re-pushes and wins', async () => {
    const server = createMockSyncServer();
    const dbA = await newDb();
    const dbB = await newDb();
    const a = engineFor(dbA, server);
    const b = engineFor(dbB, server);

    clock = 10;
    setUserSetting(dbA, 'k', JSON.stringify('base'));
    await a.engine.syncNow();
    await b.engine.syncNow();

    clock = 300;
    setUserSetting(dbA, 'k', JSON.stringify('AAA'));
    clock = 400;
    setUserSetting(dbB, 'k', JSON.stringify('BBB')); // B is newer

    await a.engine.syncNow();
    await b.engine.syncNow(); // 409 → B wins, re-pushes onto A's revision
    await a.engine.syncNow(); // A pulls B's winning value

    expect(dbA.selectValue<string>("SELECT value FROM user_settings WHERE key = 'k'")).toBe(
      JSON.stringify('BBB'),
    );
    expect(dbB.selectValue<string>("SELECT value FROM user_settings WHERE key = 'k'")).toBe(
      JSON.stringify('BBB'),
    );
  });
});
