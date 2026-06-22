// @vitest-environment node
//
// The bootstrap / "claim local data" flow (docs/sync_design.md §11). On first
// sign-in `sync_cursor.account_id` decides what happens to the local DB: adopt
// anonymous data into the account, reset on an account switch, or resume. The
// final block drives the real SyncEngine through adoption end-to-end against the
// in-memory mock server.

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
import { createCollection, addMember } from './collections';
import { createGroup } from './collectionGroups';
import { setUserSetting } from './userSettings';
import {
  applyRemoteChanges,
  bootstrapSyncAccount,
  drainOutbox,
  getSyncMeta,
  markOutboxSynced,
} from './sync';

async function newDb(): Promise<Sqlite> {
  const db = new Sqlite({ logTag: 'bootstrap-test', migrations: USER_MIGRATIONS });
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

const ACCOUNT_A = 'account-aaaa';
const ACCOUNT_B = 'account-bbbb';

describe('bootstrapSyncAccount — local reconciliation', () => {
  let db: Sqlite;
  beforeEach(async () => {
    db = await newDb();
  });

  it('adopts anonymous local data: sets account_id and enqueues live rows fresh', () => {
    // Anonymous-era work, with its accumulated outbox history. (The DB also
    // carries the seeded "Favourites" collection, which adoption claims too.)
    const c = createCollection(db, { name: 'Bosses' });
    createGroup(db, c.id, 'Tier 1');
    addMember(db, c.id, 'mob', 8800000);
    setUserSetting(db, 'accent', JSON.stringify('teal'));
    expect(getSyncMeta(db).accountId).toBeNull();
    const historyDepth = db.selectValue<number>('SELECT COUNT(*) FROM sync_outbox') ?? 0;
    expect(historyDepth).toBeGreaterThan(0);

    const action = bootstrapSyncAccount(db, ACCOUNT_A);

    expect(action).toBe('adopted');
    expect(getSyncMeta(db).accountId).toBe(ACCOUNT_A);

    // The accumulated history collapsed to exactly one fresh insert per live
    // row, all upserts at base_revision 0.
    const drained = drainOutbox(db, 100);
    expect(drained.every((d) => d.op === 'upsert')).toBe(true);
    expect(drained.every((d) => d.baseRevision === 0)).toBe(true);
    const byEntity = (entity: string) => drained.filter((d) => d.entity === entity).length;
    expect(byEntity('collection')).toBe(2); // Bosses + seeded Favourites
    expect(byEntity('collection_group')).toBe(1);
    expect(byEntity('collection_member')).toBe(1);
    expect(byEntity('user_setting')).toBe(1);
    // Parents are enqueued before children.
    const order = drained.map((d) => d.entity);
    expect(order.lastIndexOf('collection')).toBeLessThan(order.indexOf('collection_group'));
    expect(order.indexOf('collection_group')).toBeLessThan(order.indexOf('collection_member'));
  });

  it('does not enqueue tombstoned rows on adoption', () => {
    const c = createCollection(db, { name: 'Doomed' });
    const uuid = db.selectValue<string>('SELECT uuid FROM collections WHERE id = ?', [c.id])!;
    db.exec('UPDATE collections SET deleted_at = ? WHERE id = ?', [123, c.id]);
    bootstrapSyncAccount(db, ACCOUNT_A);
    const drained = drainOutbox(db, 100);
    // The tombstoned collection is skipped (the seeded Favourites still adopts).
    expect(drained.find((x) => x.uuid === uuid)).toBeUndefined();
    expect(drained.some((x) => x.entity === 'collection')).toBe(true);
  });

  it('resumes (no-op) when bootstrapping the same account again', () => {
    createCollection(db, { name: 'X' });
    bootstrapSyncAccount(db, ACCOUNT_A);
    db.exec('DELETE FROM sync_outbox'); // pretend the adoption push completed

    const action = bootstrapSyncAccount(db, ACCOUNT_A);
    expect(action).toBe('resumed');
    expect(db.selectValue<number>('SELECT COUNT(*) FROM sync_outbox')).toBe(0);
  });

  it('resets on an account switch: wipes local data, outbox, and cursor', () => {
    createCollection(db, { name: 'Account A data' });
    setUserSetting(db, 'accent', JSON.stringify('rose'));
    bootstrapSyncAccount(db, ACCOUNT_A);
    db.exec('UPDATE sync_cursor SET server_seq = 50 WHERE id = 1');

    const action = bootstrapSyncAccount(db, ACCOUNT_B);

    expect(action).toBe('reset');
    expect(getSyncMeta(db)).toMatchObject({ accountId: ACCOUNT_B, serverSeq: 0 });
    expect(db.selectValue<number>('SELECT COUNT(*) FROM collections')).toBe(0);
    expect(db.selectValue<number>('SELECT COUNT(*) FROM user_settings')).toBe(0);
    expect(db.selectValue<number>('SELECT COUNT(*) FROM sync_outbox')).toBe(0);
    // The device id survives a reset.
    expect(getSyncMeta(db).deviceId).toBeTruthy();
  });

  it('keeps the device id stable across adoption', () => {
    const before = getSyncMeta(db).deviceId;
    createCollection(db, { name: 'X' });
    bootstrapSyncAccount(db, ACCOUNT_A);
    expect(getSyncMeta(db).deviceId).toBe(before);
  });
});

describe('bootstrap end-to-end — adopt then converge on a fresh device', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockImplementation(() => 5_000);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adopts device A anonymous data to the server, then a fresh device B pulls it', async () => {
    const server = createMockSyncServer();
    const dbA = await newDb();
    const dbB = await newDb();

    // Drop the seeded "Favourites" on both devices: each seeds it with a
    // different uuid but the same (UNIQUE) name, so converging them is a
    // separate same-name-collision concern (tracked elsewhere). This test
    // isolates the Phase 3 mechanism — adopt + pull convergence.
    dbA.exec("DELETE FROM collections WHERE name = 'Favourites'");
    dbB.exec("DELETE FROM collections WHERE name = 'Favourites'");

    // Device A: anonymous work, then sign in (adopt) and sync.
    createCollection(dbA, { name: 'Adopted Bosses' });
    setUserSetting(dbA, 'accent', JSON.stringify('teal'));
    expect(bootstrapSyncAccount(dbA, ACCOUNT_A)).toBe('adopted');

    const a = engineFor(dbA, server);
    await a.engine.syncNow();
    expect(server.size()).toBe(2); // Adopted Bosses + accent setting

    // Device B: fresh install, signs into the same account → adopt (nothing
    // local) then pull A's records from 0.
    expect(bootstrapSyncAccount(dbB, ACCOUNT_A)).toBe('adopted');
    const b = engineFor(dbB, server);
    await b.engine.syncNow();

    expect(dbB.selectValue<string>("SELECT name FROM collections WHERE name = 'Adopted Bosses'")).toBe(
      'Adopted Bosses',
    );
    expect(dbB.selectValue<string>("SELECT value FROM user_settings WHERE key = 'accent'")).toBe(
      JSON.stringify('teal'),
    );
    expect(b.invalidated).toContainEqual(['user', 'collections']);
    // The adopted rows now carry server-assigned revisions on A.
    const aRev = dbA.selectObject<Row>("SELECT revision FROM collections WHERE name = 'Adopted Bosses'");
    expect(aRev?.revision).toBe(1);
  });
});
