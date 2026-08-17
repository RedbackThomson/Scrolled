// @vitest-environment node
//
// Two devices sharing one account, driven through the real SyncEngine against
// the in-memory backend. These cover the convergence cases that only appear
// across devices: duplicate adds, independently-created records with the same
// name, and children arriving before their parents.

import { beforeEach, describe, expect, it } from 'vitest';
import { Sqlite, type Row } from '@scrolled/game-db/db/sqlite';
import {
  SyncEngine,
  createMockSyncProvider,
  createMockSyncServer,
  type MockSyncServer,
  type SyncBackend,
} from '@scrolled/sync-core';
import { SEEDED_FAVOURITES_UUID, USER_MIGRATIONS } from '../migrations';
import { addMember, createCollection, deleteCollection } from './collections';
import { createGroup } from './collectionGroups';
import { setUserSetting } from './userSettings';
import { clearRecents, trackRecentEntity } from './recents';
import {
  applyRemoteRows,
  bootstrapSyncAccount,
  drainOutbox,
  getSyncMeta,
  markOutboxSynced,
  pendingCount,
  rekeyLocal,
  replaceAllFromSnapshot,
  setCursor,
} from './sync';

const ACCOUNT_A = 'account-aaaa';
const ACCOUNT_B = 'account-bbbb';

async function newDb(tag: string): Promise<Sqlite> {
  const db = new Sqlite({ logTag: tag, migrations: USER_MIGRATIONS });
  await db.open();
  return db;
}

function backendFor(db: Sqlite): SyncBackend {
  return {
    drainOutbox: (limit) => Promise.resolve(drainOutbox(db, limit)),
    markOutboxSynced: (seqs, applied) => {
      markOutboxSynced(db, seqs, applied);
      return Promise.resolve();
    },
    applyRemoteRows: (rows) => Promise.resolve(applyRemoteRows(db, rows)),
    replaceAllFromSnapshot: (rows) => Promise.resolve(replaceAllFromSnapshot(db, rows)),
    rekeyLocal: (entity, from, to) => {
      rekeyLocal(db, entity, from, to);
      return Promise.resolve();
    },
    getSyncMeta: () => Promise.resolve(getSyncMeta(db)),
    setCursor: (cursor) => {
      setCursor(db, cursor);
      return Promise.resolve();
    },
    pendingCount: () => Promise.resolve(pendingCount(db)),
  };
}

function engineFor(db: Sqlite, server: MockSyncServer): SyncEngine {
  return new SyncEngine({
    provider: createMockSyncProvider({ server }),
    backend: backendFor(db),
    invalidate: () => {},
  });
}

/** A device that has signed in and pushed whatever it already held. */
async function device(tag: string, server: MockSyncServer, account = ACCOUNT_A) {
  const db = await newDb(tag);
  bootstrapSyncAccount(db, account);
  const engine = engineFor(db, server);
  return { db, engine };
}

const names = (db: Sqlite, table: string): string[] =>
  db
    .selectObjects<Row>(`SELECT name FROM ${table} ORDER BY name`)
    .map((r) => String(r.name));

describe('bootstrapSyncAccount', () => {
  let db: Sqlite;
  beforeEach(async () => {
    db = await newDb('bootstrap');
  });

  it('queues existing local rows when an anonymous DB joins an account', () => {
    createCollection(db, { name: 'Bosses' });

    expect(bootstrapSyncAccount(db, ACCOUNT_A)).toBe('adopted');
    expect(getSyncMeta(db).accountId).toBe(ACCOUNT_A);
    // The seeded Favourites and Bosses, one entry each.
    expect(drainOutbox(db, 100).filter((c) => c.entity === 'collection')).toHaveLength(2);
  });

  it('queues parents before children', () => {
    const c = createCollection(db, { name: 'Bosses' });
    createGroup(db, c.id, 'Tier 1');
    addMember(db, c.id, 'mob', 100);

    bootstrapSyncAccount(db, ACCOUNT_A);

    const order = drainOutbox(db, 100).map((x) => x.entity);
    expect(order.indexOf('collection')).toBeLessThan(order.indexOf('collection_group'));
    expect(order.indexOf('collection_group')).toBeLessThan(order.indexOf('collection_member'));
  });

  it('is a no-op when the account is unchanged', () => {
    bootstrapSyncAccount(db, ACCOUNT_A);
    expect(bootstrapSyncAccount(db, ACCOUNT_A)).toBe('resumed');
  });

  it('discards local data when a different account signs in', () => {
    createCollection(db, { name: 'Bosses' });
    bootstrapSyncAccount(db, ACCOUNT_A);

    expect(bootstrapSyncAccount(db, ACCOUNT_B)).toBe('reset');
    expect(db.selectValue<number>('SELECT COUNT(*) FROM collections')).toBe(0);
    expect(pendingCount(db)).toBe(0);
    expect(getSyncMeta(db).cursor).toBe('');
  });
});

describe('two devices', () => {
  let server: MockSyncServer;
  beforeEach(() => {
    server = createMockSyncServer();
  });

  it('keeps one member when both add the same entity', async () => {
    const a = await device('dev-a', server);
    const c = createCollection(a.db, { name: 'Bosses' });
    addMember(a.db, c.id, 'mob', 100);
    await a.engine.syncNow();

    const b = await device('dev-b', server);
    await b.engine.syncNow();
    const bCollection = b.db.selectValue<number>(
      "SELECT id FROM collections WHERE name = 'Bosses'",
    )!;
    addMember(b.db, bCollection, 'mob', 100);
    await b.engine.syncNow();

    expect(server.rows('collection_member')).toHaveLength(1);
    await a.engine.syncNow();
    expect(a.db.selectValue<number>('SELECT COUNT(*) FROM collection_members')).toBe(1);
  });

  it('merges collections both devices created with the same name', async () => {
    const a = await device('dev-a', server);
    createCollection(a.db, { name: 'Bosses' });
    await a.engine.syncNow();

    // b creates its own "Bosses" offline, under a different key.
    const bDb = await newDb('dev-b');
    const bColl = createCollection(bDb, { name: 'Bosses' });
    addMember(bDb, bColl.id, 'mob', 200);
    bootstrapSyncAccount(bDb, ACCOUNT_A);
    await engineFor(bDb, server).syncNow();

    expect(server.rows('collection').filter((r) => r.name === 'Bosses')).toHaveLength(1);
    expect(server.rows('collection_member')).toHaveLength(1);
    expect(server.rows('collection_member')[0].entity_id).toBe(200);
    expect(names(bDb, 'collections')).not.toContain('Bosses (2)');

    // a picks the member up against its own copy of the collection.
    await a.engine.syncNow();
    expect(a.db.selectValue<number>('SELECT COUNT(*) FROM collection_members')).toBe(1);
  });

  it('shares the seeded Favourites rather than duplicating it', async () => {
    const a = await device('dev-a', server);
    await a.engine.syncNow();
    const b = await device('dev-b', server);
    await b.engine.syncNow();

    const favourites = server.rows('collection').filter((r) => r.name === 'Favourites');
    expect(favourites).toHaveLength(1);
    expect(favourites[0].key).toBe(SEEDED_FAVOURITES_UUID);
  });

  it('keeps one row when both write the same setting', async () => {
    const a = await device('dev-a', server);
    setUserSetting(a.db, 'home.layout', '{"a":1}');
    await a.engine.syncNow();

    const b = await device('dev-b', server);
    setUserSetting(b.db, 'home.layout', '{"b":2}');
    await b.engine.syncNow();

    expect(server.rows('user_setting')).toHaveLength(1);
    await a.engine.syncNow();
    expect(a.db.selectValue<string>("SELECT value FROM user_settings WHERE key = 'home.layout'")).toBe(
      '{"b":2}',
    );
  });

  it('does not resurrect a recent one device pruned', async () => {
    const a = await device('dev-a', server);
    trackRecentEntity(a.db, 'mob', 100, 'Slime');
    await a.engine.syncNow();

    const b = await device('dev-b', server);
    await b.engine.syncNow();
    expect(b.db.selectValue<number>('SELECT COUNT(*) FROM recents')).toBe(1);

    clearRecents(a.db, 'entity');
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(b.db.selectValue<number>('SELECT COUNT(*) FROM recents')).toBe(0);
  });

  it('propagates a delete to the other device', async () => {
    const a = await device('dev-a', server);
    const c = createCollection(a.db, { name: 'Temporary' });
    addMember(a.db, c.id, 'mob', 100);
    await a.engine.syncNow();

    const b = await device('dev-b', server);
    await b.engine.syncNow();
    expect(names(b.db, 'collections')).toContain('Temporary');

    deleteCollection(a.db, c.id);
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(names(b.db, 'collections')).not.toContain('Temporary');
    expect(b.db.selectValue<number>('SELECT COUNT(*) FROM collection_members')).toBe(0);
  });

  it('gives keyless rows an identity rather than collapsing them together', async () => {
    const bDb = await newDb('dev-b');
    const bosses = createCollection(bDb, { name: 'Bosses' });
    addMember(bDb, bosses.id, 'mob', 200);
    createCollection(bDb, { name: 'Scrolls' });
    // Rows that reached the table without going through the mutation chokepoint.
    bDb.exec("UPDATE collections SET uuid = '' WHERE name IN ('Bosses', 'Scrolls')");

    bootstrapSyncAccount(bDb, ACCOUNT_A);
    await engineFor(bDb, server).syncNow();

    // Coalescing is by key, so sharing one would have sent a single collection
    // and dropped the rest.
    expect(server.rows('collection').map((r) => r.name).sort()).toEqual([
      'Bosses',
      'Favourites',
      'Scrolls',
    ]);
    expect(server.rows('collection').every((r) => String(r.key).length > 0)).toBe(true);
    expect(server.rows('collection_member')).toHaveLength(1);
    expect(pendingCount(bDb)).toBe(0);
  });

  it('carries groups and their members to a fresh device', async () => {
    const a = await device('dev-a', server);
    const c = createCollection(a.db, { name: 'Bosses' });
    const g = createGroup(a.db, c.id, 'Tier 1');
    addMember(a.db, c.id, 'mob', 100, { groupId: g.id });
    // Renaming after the member was added puts the parent later in the log.
    createGroup(a.db, c.id, 'Tier 2');
    await a.engine.syncNow();

    const b = await device('dev-b', server);
    await b.engine.syncNow();

    expect(names(b.db, 'collection_groups')).toEqual(['Tier 1', 'Tier 2']);
    const member = b.db.selectObject<Row>('SELECT group_id FROM collection_members')!;
    expect(member.group_id).not.toBeNull();
  });
});
