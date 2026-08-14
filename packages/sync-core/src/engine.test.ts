import { describe, expect, it, vi } from 'vitest';
import { SyncEngine } from './engine';
import { createMockSyncProvider, createMockSyncServer, type MockSyncServer } from './mock';
import { recordKey } from './schemas';
import type {
  ApplyResult,
  OutboxChange,
  RemoteRow,
  SyncBackend,
  SyncEntity,
  SyncMeta,
  TaggedRow,
} from './types';

/**
 * Stands in for the user DB: an outbox, the live rows, and the cursor. Faithful
 * enough to exercise ordering, acks and rekeying without SQLite.
 */
class FakeBackend implements SyncBackend {
  readonly rows = new Map<string, RemoteRow>();
  private outbox: OutboxChange[] = [];
  private nextSeq = 1;
  cursor = '';
  snapshots = 0;

  constructor(readonly deviceId = 'dev-a') {}

  enqueue(entity: SyncEntity, row: RemoteRow): void {
    this.outbox.push({
      seq: this.nextSeq++,
      entity,
      key: recordKey(entity, row),
      op: row.deleted_at == null ? 'upsert' : 'delete',
      row,
    });
  }

  async drainOutbox(limit: number): Promise<OutboxChange[]> {
    return this.outbox.slice(0, limit).map((c) => ({ ...c, row: { ...c.row } }));
  }

  async markOutboxSynced(seqs: number[], _applied: { key: string; seq: number }[]): Promise<void> {
    const done = new Set(seqs);
    this.outbox = this.outbox.filter((c) => !done.has(c.seq));
  }

  async applyRemoteRows(rows: TaggedRow[]): Promise<ApplyResult> {
    const pending = new Set(this.outbox.map((c) => `${c.entity}:${c.key}`));
    let applied = 0;
    for (const r of rows) {
      const id = `${r.entity}:${recordKey(r.entity, r.row)}`;
      if (pending.has(id)) continue;
      this.rows.set(id, { ...r.row });
      applied += 1;
    }
    return { invalidatedKeys: applied > 0 ? [['user', 'collections']] : [], applied };
  }

  async replaceAllFromSnapshot(rows: TaggedRow[]): Promise<ApplyResult> {
    this.snapshots += 1;
    this.rows.clear();
    for (const r of rows) this.rows.set(`${r.entity}:${recordKey(r.entity, r.row)}`, { ...r.row });
    return { invalidatedKeys: [['user', 'collections']], applied: rows.length };
  }

  async rekeyLocal(entity: SyncEntity, fromKey: string, toKey: string): Promise<void> {
    for (const change of this.outbox) {
      if (change.entity === entity && change.key === fromKey) {
        change.row = { ...change.row, key: toKey };
        change.key = recordKey(entity, change.row);
      }
      if (entity === 'collection' && change.row.collection_key === fromKey) {
        change.row = { ...change.row, collection_key: toKey };
        change.key = recordKey(change.entity, change.row);
      }
    }
  }

  async getSyncMeta(): Promise<SyncMeta> {
    return { cursor: this.cursor, deviceId: this.deviceId, accountId: 'acct' };
  }

  async setCursor(cursor: string): Promise<void> {
    this.cursor = cursor;
  }

  async pendingCount(): Promise<number> {
    return this.outbox.length;
  }
}

function makeEngine(backend: FakeBackend, server?: MockSyncServer, pageSize = 100) {
  const provider = createMockSyncProvider({ server, pageSize });
  const engine = new SyncEngine({
    provider,
    backend,
    invalidate: () => {},
    random: () => 0.5,
  });
  return { engine, provider, server: provider.server };
}

const collection = (key: string, name: string, device = 'dev-a'): RemoteRow => ({
  key,
  name,
  created_at: 1,
  updated_at: 1,
  origin_device: device,
});

const member = (collectionKey: string, entityId: number, device = 'dev-a'): RemoteRow => ({
  collection_key: collectionKey,
  entity_type: 'mob',
  entity_id: entityId,
  added_at: 1,
  updated_at: 1,
  origin_device: device,
});

describe('SyncEngine push', () => {
  it('pushes a collection before its members', async () => {
    const backend = new FakeBackend();
    // Enqueued child-first to prove the engine, not the caller, orders the push.
    backend.enqueue('collection_member', member('c1', 100));
    backend.enqueue('collection', collection('c1', 'Bosses'));

    const { engine, server } = makeEngine(backend);
    await engine.syncNow();

    expect(server.rows('collection')).toHaveLength(1);
    expect(server.rows('collection_member')).toHaveLength(1);
    expect(await backend.pendingCount()).toBe(0);
  });

  it('converges when two devices add the same member', async () => {
    const server = createMockSyncServer();
    const a = new FakeBackend('dev-a');
    a.enqueue('collection', collection('c1', 'Bosses'));
    a.enqueue('collection_member', member('c1', 100, 'dev-a'));
    await makeEngine(a, server).engine.syncNow();

    const b = new FakeBackend('dev-b');
    b.enqueue('collection_member', member('c1', 100, 'dev-b'));
    await makeEngine(b, server).engine.syncNow();

    expect(server.rows('collection_member')).toHaveLength(1);
    expect(await b.pendingCount()).toBe(0);
  });

  it('converges when two devices write the same setting', async () => {
    const server = createMockSyncServer();
    const setting = (value: string, device: string): RemoteRow => ({
      key: 'home.layout',
      value,
      updated_at: 1,
      origin_device: device,
    });

    const a = new FakeBackend('dev-a');
    a.enqueue('user_setting', setting('{"a":1}', 'dev-a'));
    await makeEngine(a, server).engine.syncNow();

    const b = new FakeBackend('dev-b');
    b.enqueue('user_setting', setting('{"b":2}', 'dev-b'));
    await makeEngine(b, server).engine.syncNow();

    expect(server.rows('user_setting')).toHaveLength(1);
    expect(server.rows('user_setting')[0].value).toBe('{"b":2}');
  });

  it('merges a same-named collection onto the key the store already holds', async () => {
    const server = createMockSyncServer();
    const a = new FakeBackend('dev-a');
    a.enqueue('collection', collection('c-from-a', 'Favourites'));
    await makeEngine(a, server).engine.syncNow();

    const b = new FakeBackend('dev-b');
    b.enqueue('collection', collection('c-from-b', 'Favourites', 'dev-b'));
    b.enqueue('collection_member', member('c-from-b', 200, 'dev-b'));
    await makeEngine(b, server).engine.syncNow();

    expect(server.rows('collection')).toHaveLength(1);
    expect(server.rows('collection')[0].key).toBe('c-from-a');
    // The member re-parented onto the surviving collection rather than being
    // orphaned or pushed under the abandoned key.
    expect(server.rows('collection_member')).toHaveLength(1);
    expect(server.rows('collection_member')[0].collection_key).toBe('c-from-a');
    expect(await b.pendingCount()).toBe(0);
  });

  it('stops pushing when nothing lands, rather than spinning', async () => {
    const backend = new FakeBackend();
    backend.enqueue('collection', collection('c1', 'Bosses'));
    const { engine, provider } = makeEngine(backend);
    const upsert = vi.spyOn(provider, 'upsert').mockResolvedValue({
      applied: [],
      nameCollisions: [],
    });

    await engine.syncNow();

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(await backend.pendingCount()).toBe(1);
  });
});

describe('SyncEngine pull', () => {
  it('applies rows another device wrote', async () => {
    const server = createMockSyncServer();
    const a = new FakeBackend('dev-a');
    a.enqueue('collection', collection('c1', 'Bosses'));
    await makeEngine(a, server).engine.syncNow();

    const b = new FakeBackend('dev-b');
    await makeEngine(b, server).engine.syncNow();

    expect(b.rows.get('collection:c1')?.name).toBe('Bosses');
    expect(b.cursor).not.toBe('');
  });

  it('follows pagination to the end', async () => {
    const server = createMockSyncServer();
    const a = new FakeBackend('dev-a');
    for (const key of ['c1', 'c2', 'c3', 'c4', 'c5']) a.enqueue('collection', collection(key, key));
    await makeEngine(a, server).engine.syncNow();

    const b = new FakeBackend('dev-b');
    await makeEngine(b, server, 2).engine.syncNow();

    expect(b.rows.size).toBe(5);
  });

  it('pushes a queued local edit over the stored value before pulling', async () => {
    const server = createMockSyncServer();
    const a = new FakeBackend('dev-a');
    a.enqueue('collection', collection('c1', 'Remote name'));
    await makeEngine(a, server).engine.syncNow();

    const b = new FakeBackend('dev-b');
    b.enqueue('collection', collection('c1', 'Local name', 'dev-b'));
    await makeEngine(b, server).engine.syncNow();

    expect(server.rows('collection')).toHaveLength(1);
    expect(server.rows('collection')[0].name).toBe('Local name');
    expect(b.rows.get('collection:c1')?.name).toBe('Local name');
  });

  it('does not move the cursor backwards when a pull finds nothing new', async () => {
    const server = createMockSyncServer();
    const a = new FakeBackend('dev-a');
    a.enqueue('collection', collection('c1', 'Bosses'));
    const { engine } = makeEngine(a, server);
    await engine.syncNow();
    const afterFirst = a.cursor;

    await engine.syncNow();

    expect(a.cursor).toBe(afterFirst);
  });

  it('reconciles from a snapshot when the cursor predates tombstone retention', async () => {
    const server = createMockSyncServer();
    const a = new FakeBackend('dev-a');
    a.enqueue('collection', collection('c1', 'Bosses'));
    await makeEngine(a, server).engine.syncNow();

    const b = new FakeBackend('dev-b');
    b.cursor = '2000-01-01T00:00:00.000Z';
    await makeEngine(b, server).engine.syncNow();

    expect(b.snapshots).toBe(1);
    expect(b.rows.get('collection:c1')?.name).toBe('Bosses');
  });

  it('rebuilds local state on an explicit resync', async () => {
    const server = createMockSyncServer();
    const a = new FakeBackend('dev-a');
    a.enqueue('collection', collection('c1', 'Bosses'));
    await makeEngine(a, server).engine.syncNow();

    const b = new FakeBackend('dev-b');
    b.rows.set('collection:stale', { key: 'stale', name: 'Gone' });
    await makeEngine(b, server).engine.resync();

    expect(b.snapshots).toBe(1);
    expect(b.rows.has('collection:stale')).toBe(false);
    expect(b.rows.has('collection:c1')).toBe(true);
  });
});

describe('SyncEngine failure handling', () => {
  it('backs off and reports offline on a transient fault', async () => {
    const backend = new FakeBackend();
    const { engine, server } = makeEngine(backend);
    server.setFault('transient');

    await engine.syncNow();

    expect(engine.getStatus().state).toBe('offline');
    expect(engine.getStatus().errorKind).toBe('transient');
  });

  it('surfaces an auth error when the token cannot be refreshed', async () => {
    const backend = new FakeBackend();
    const provider = createMockSyncProvider();
    const engine = new SyncEngine({
      provider,
      backend,
      invalidate: () => {},
      getAccessToken: async () => null,
    });
    provider.server.setFault('auth');

    await engine.syncNow();
    await vi.waitFor(() => expect(engine.getStatus().errorKind).toBe('auth'));
    expect(engine.getStatus().state).toBe('error');
  });

  it('refuses to sync a client below the store minimum', async () => {
    const backend = new FakeBackend();
    const provider = createMockSyncProvider({ minClientRevision: 999 });
    const engine = new SyncEngine({ provider, backend, invalidate: () => {} });

    await engine.syncNow();

    expect(engine.getStatus().state).toBe('error');
    expect(engine.getStatus().errorKind).toBe('protocol');
  });

  it('reports the whole backlog, not just the batch in flight', async () => {
    const backend = new FakeBackend();
    for (let i = 0; i < 5; i++) backend.enqueue('collection', collection(`c${i}`, `C${i}`));
    const { engine, provider } = makeEngine(backend);
    vi.spyOn(provider, 'upsert').mockResolvedValue({ applied: [], nameCollisions: [] });

    await engine.syncNow();

    expect(engine.getStatus().pendingChanges).toBe(5);
  });
});

describe('SyncEngine doorbell', () => {
  it('ignores the echo of its own write', async () => {
    const server = createMockSyncServer();
    const backend = new FakeBackend('dev-a');
    const { engine } = makeEngine(backend, server);
    const runs = vi.spyOn(backend, 'drainOutbox');
    engine.start();
    await vi.waitFor(() => expect(runs).toHaveBeenCalled());

    runs.mockClear();
    server.poke('dev-a');
    expect(runs).not.toHaveBeenCalled();

    server.poke('dev-b');
    await vi.waitFor(() => expect(runs).toHaveBeenCalled());
    engine.stop();
  });
});
