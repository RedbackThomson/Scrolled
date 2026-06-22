import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine } from './engine';
import { resolveConflict } from './conflict';
import { createMockSyncServer, createMockSyncProvider } from './mock';
import type {
  ApplyResult,
  AssignedRevision,
  MockSyncServer,
  OutboxChange,
  ServerChange,
  SyncBackend,
  SyncEntity,
  SyncOp,
} from './index';

// --- a minimal in-memory SyncBackend, one per "device" --------------------
//
// Models the worker's outbox + live store + cursor closely enough to exercise
// engine orchestration and cross-device convergence. The real SQLite-backed
// version is tested against the engine in apps/web. Records are keyed by uuid
// (globally unique), so flat entities (collection/user_setting/recent) suffice.

const ROOTS: Record<SyncEntity, string[]> = {
  collection: ['user', 'collections'],
  collection_member: ['user', 'collections'],
  collection_group: ['user', 'collections'],
  pinned_search: ['user', 'pinned'],
  user_setting: ['user', 'settings'],
  recent: ['recents'],
};

interface LiveRow {
  entity: SyncEntity;
  uuid: string;
  payload: Record<string, unknown>;
  revision: number;
}

function makeBackend(deviceId: string) {
  const live = new Map<string, LiveRow>();
  const outbox: OutboxChange[] = [];
  let oseq = 0;
  let cursor = 0;
  let failMarkOnce = false;

  function localWrite(
    entity: SyncEntity,
    uuid: string,
    op: SyncOp,
    fields: Record<string, unknown> = {},
  ): void {
    const base = live.get(uuid)?.revision ?? 0;
    const revision = base + 1;
    const payload = { uuid, revision, origin_device: deviceId, ...fields };
    if (op === 'delete') live.delete(uuid);
    else live.set(uuid, { entity, uuid, payload, revision });
    oseq += 1;
    outbox.push({ seq: oseq, entity, uuid, op, payload, baseRevision: base, idempotency: `${deviceId}-${oseq}` });
  }

  function applyRemote(change: ServerChange): void {
    if (change.op === 'delete') {
      live.delete(change.uuid);
    } else {
      live.set(change.uuid, {
        entity: change.entity,
        uuid: change.uuid,
        payload: change.payload as Record<string, unknown>,
        revision: change.revision,
      });
    }
  }

  const backend: SyncBackend = {
    drainOutbox: (limit) => Promise.resolve(outbox.slice(0, limit)),
    markOutboxSynced: (seqs: number[], assigned: AssignedRevision[]) => {
      if (failMarkOnce) {
        failMarkOnce = false;
        return Promise.reject(new Error('simulated lost ack'));
      }
      for (const s of seqs) {
        const i = outbox.findIndex((o) => o.seq === s);
        if (i >= 0) outbox.splice(i, 1);
      }
      for (const a of assigned) {
        const row = live.get(a.uuid);
        if (row) row.revision = a.revision;
      }
      return Promise.resolve();
    },
    applyRemoteChanges: (batch: ServerChange[]): Promise<ApplyResult> => {
      const keys = new Set<string>();
      for (const change of batch) {
        const pending = outbox.filter((o) => o.uuid === change.uuid);
        if (pending.length > 0) {
          const winner = resolveConflict({
            entity: change.entity,
            local: pending[pending.length - 1],
            remote: change,
          });
          if (winner === 'remote') {
            applyRemote(change);
            for (let i = outbox.length - 1; i >= 0; i--) {
              if (outbox[i].uuid === change.uuid) outbox.splice(i, 1);
            }
          } else {
            for (const o of pending) o.baseRevision = change.revision;
          }
        } else {
          const existing = live.get(change.uuid);
          if (!existing || change.revision > existing.revision) applyRemote(change);
        }
        cursor = Math.max(cursor, change.serverSeq);
        keys.add(JSON.stringify(ROOTS[change.entity]));
      }
      return Promise.resolve({
        invalidatedKeys: [...keys].map((k) => JSON.parse(k) as string[]),
        serverSeq: cursor,
      });
    },
    getSyncMeta: () =>
      Promise.resolve({ serverSeq: cursor, deviceId, accountId: 'acct-1' }),
  };

  return {
    backend,
    localWrite,
    get: (uuid: string) => live.get(uuid),
    has: (uuid: string) => live.has(uuid),
    outboxSize: () => outbox.length,
    failMarkOnce: () => {
      failMarkOnce = true;
    },
  };
}

function makeEngine(backend: SyncBackend, server: MockSyncServer) {
  const invalidated: string[][] = [];
  const engine = new SyncEngine({
    provider: createMockSyncProvider({ server }),
    backend,
    invalidate: (keys) => invalidated.push(...keys),
    now: () => 1_700_000_000_000,
    random: () => 0.5,
  });
  return { engine, invalidated };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SyncEngine — push/pull cycle', () => {
  it('pushes a local change, clears the outbox, and reports synced', async () => {
    const server = createMockSyncServer();
    const dev = makeBackend('A');
    const { engine } = makeEngine(dev.backend, server);
    dev.localWrite('collection', 'x', 'upsert', { name: 'Bosses', updated_at: 1 });

    await engine.syncNow();

    expect(server.size()).toBe(1);
    expect(dev.outboxSize()).toBe(0);
    expect(engine.getStatus()).toMatchObject({
      state: 'synced',
      pendingChanges: 0,
      lastSyncedAt: 1_700_000_000_000,
      error: null,
    });
  });

  it('converges a record from one device to another and invalidates its key', async () => {
    const server = createMockSyncServer();
    const a = makeBackend('A');
    const b = makeBackend('B');
    const ea = makeEngine(a.backend, server);
    const eb = makeEngine(b.backend, server);

    a.localWrite('user_setting', 'accent', 'upsert', { value: '"teal"', updated_at: 10 });
    await ea.engine.syncNow();
    await eb.engine.syncNow();

    expect(b.get('accent')?.payload.value).toBe('"teal"');
    expect(eb.invalidated).toContainEqual(['user', 'settings']);
  });
});

describe('SyncEngine — 409 reconciliation (LWW)', () => {
  async function setupConcurrentEdit(localUpdatedAt: number) {
    const server = createMockSyncServer();
    const a = makeBackend('A');
    const b = makeBackend('B');
    const ea = makeEngine(a.backend, server);
    const eb = makeEngine(b.backend, server);

    // Shared baseline at revision 1 on both devices.
    a.localWrite('user_setting', 'k', 'upsert', { value: '1', updated_at: 1, origin_device: 'A' });
    await ea.engine.syncNow();
    await eb.engine.syncNow();

    // Both edit offline from revision 1.
    a.localWrite('user_setting', 'k', 'upsert', { value: 'A', updated_at: 300, origin_device: 'A' });
    b.localWrite('user_setting', 'k', 'upsert', { value: 'B', updated_at: localUpdatedAt, origin_device: 'B' });

    await ea.engine.syncNow(); // A lands first → server revision 2
    await eb.engine.syncNow(); // B hits 409, reconciles, maybe re-pushes
    await ea.engine.syncNow(); // A pulls any B re-push
    return { a, b, ea, eb, server };
  }

  it('drops the local edit when remote wins, converging both to the remote value', async () => {
    const { a, b } = await setupConcurrentEdit(200); // B older than A's 300
    expect(b.get('k')?.payload.value).toBe('A');
    expect(a.get('k')?.payload.value).toBe('A');
    expect(b.outboxSize()).toBe(0);
  });

  it('re-pushes the local edit when it wins, converging both to the local value', async () => {
    const { a, b } = await setupConcurrentEdit(400); // B newer than A's 300
    expect(b.get('k')?.payload.value).toBe('B');
    expect(a.get('k')?.payload.value).toBe('B');
    expect(b.outboxSize()).toBe(0);
  });
});

describe('SyncEngine — tombstone convergence', () => {
  it('replicates a delete to a device that still has the row', async () => {
    const server = createMockSyncServer();
    const a = makeBackend('A');
    const b = makeBackend('B');
    const ea = makeEngine(a.backend, server);
    const eb = makeEngine(b.backend, server);

    a.localWrite('collection', 'doomed', 'upsert', { name: 'Temp', updated_at: 1 });
    await ea.engine.syncNow();
    await eb.engine.syncNow();
    expect(b.has('doomed')).toBe(true);

    a.localWrite('collection', 'doomed', 'delete', { updated_at: 1, deleted_at: 500 });
    await ea.engine.syncNow();
    await eb.engine.syncNow();

    expect(b.has('doomed')).toBe(false);
  });
});

describe('SyncEngine — idempotent retry after a lost ack', () => {
  it('re-pushes the same idempotency keys without double-applying server-side', async () => {
    const server = createMockSyncServer();
    const dev = makeBackend('A');
    const { engine } = makeEngine(dev.backend, server);
    dev.localWrite('collection', 'x', 'upsert', { name: 'Once', updated_at: 1 });

    dev.failMarkOnce(); // server applies, but the ack is lost
    await engine.syncNow();
    expect(engine.getStatus().state).toBe('offline');
    expect(dev.outboxSize()).toBe(1); // still pending
    expect(server.size()).toBe(1);

    await engine.syncNow(); // retry: server dedups, ack lands
    expect(dev.outboxSize()).toBe(0);
    expect(server.size()).toBe(1);
    expect(server.readPull(0, 100).changes[0].revision).toBe(1); // not bumped twice
  });
});

describe('SyncEngine — failure handling', () => {
  it('reports offline on a transient fault and recovers on retry', async () => {
    const server = createMockSyncServer();
    const dev = makeBackend('A');
    const { engine } = makeEngine(dev.backend, server);
    dev.localWrite('collection', 'x', 'upsert', { name: 'X', updated_at: 1 });

    server.setFault('transient');
    await engine.syncNow();
    expect(engine.getStatus().state).toBe('offline');
    expect(engine.getStatus().error).toMatch(/network/);

    await engine.syncNow();
    expect(engine.getStatus().state).toBe('synced');
  });

  it('surfaces a non-retryable protocol error', async () => {
    const server = createMockSyncServer();
    const dev = makeBackend('A');
    const { engine } = makeEngine(dev.backend, server);
    dev.localWrite('collection', 'x', 'upsert', { name: 'X', updated_at: 1 });

    server.setFault('protocol');
    await engine.syncNow();
    expect(engine.getStatus().state).toBe('error');
  });

  it('debounces fast-lane mutations and collapses them into one cycle', async () => {
    vi.useFakeTimers();
    const server = createMockSyncServer();
    const dev = makeBackend('A');
    const { engine } = makeEngine(dev.backend, server);

    engine.start();
    await vi.advanceTimersByTimeAsync(0); // let the start() cycle settle

    dev.localWrite('collection', 'x', 'upsert', { name: 'X', updated_at: 1 });
    engine.notifyLocalChange(['collection']);
    engine.notifyLocalChange(['collection']);
    expect(server.size()).toBe(0); // nothing pushed yet (debounced)

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.size()).toBe(1);
    engine.stop();
  });
});
