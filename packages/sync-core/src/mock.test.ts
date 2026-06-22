import { describe, expect, it } from 'vitest';
import { createMockSyncProvider, createMockSyncServer } from './mock';
import { PROTOCOL_VERSION } from './schemas';
import type { SyncChange } from './types';

let counter = 0;
function change(uuid: string, baseRevision: number, payload: Record<string, unknown> = {}): SyncChange {
  counter += 1;
  return {
    entity: 'user_setting',
    uuid,
    op: 'upsert',
    payload: { uuid, ...payload },
    baseRevision,
    idempotency: `idem-${counter}`,
  };
}

describe('mock server — push semantics', () => {
  it('assigns monotonic revisions and server seqs to accepted writes', () => {
    const server = createMockSyncServer();
    const r1 = server.applyPush([change('a', 0), change('b', 0)]);
    expect(r1.conflicts).toHaveLength(0);
    expect(r1.applied.map((a) => a.revision)).toEqual([1, 1]);
    expect(r1.applied.map((a) => a.serverSeq)).toEqual([1, 2]);

    const r2 = server.applyPush([change('a', 1)]);
    expect(r2.applied[0]).toMatchObject({ uuid: 'a', revision: 2, serverSeq: 3 });
  });

  it('rejects a stale baseRevision with a 409 carrying the current record', () => {
    const server = createMockSyncServer();
    server.applyPush([change('a', 0, { v: 1 })]); // now at revision 1
    const stale = server.applyPush([change('a', 0, { v: 2 })]); // still thinks base 0
    expect(stale.applied).toHaveLength(0);
    expect(stale.conflicts).toHaveLength(1);
    expect(stale.conflicts[0]).toMatchObject({ uuid: 'a', remote: { revision: 1 } });
  });

  it('dedups an at-least-once retry via the idempotency ledger', () => {
    const server = createMockSyncServer();
    const batch = [change('a', 0)];
    const first = server.applyPush(batch);
    const retry = server.applyPush(batch); // identical idempotency key
    expect(retry.applied).toEqual(first.applied); // replayed, not re-applied
    expect(retry.conflicts).toHaveLength(0);
    expect(server.size()).toBe(1);
    // revision was not double-bumped
    const pulled = server.readPull(0, 100);
    expect(pulled.changes[0].revision).toBe(1);
  });

  it('processes sequential edits to one record within a single batch', () => {
    const server = createMockSyncServer();
    const r = server.applyPush([change('a', 0), change('a', 1)]);
    expect(r.conflicts).toHaveLength(0);
    expect(r.applied.map((a) => a.revision)).toEqual([1, 2]);
  });
});

describe('mock server — pull semantics', () => {
  it('returns only records after the cursor, ordered, paginated', () => {
    const server = createMockSyncServer();
    server.applyPush([change('a', 0), change('b', 0), change('c', 0)]);
    const page1 = server.readPull(0, 2);
    expect(page1.changes.map((c) => c.uuid)).toEqual(['a', 'b']);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBe(2);

    const page2 = server.readPull(page1.nextCursor, 2);
    expect(page2.changes.map((c) => c.uuid)).toEqual(['c']);
    expect(page2.hasMore).toBe(false);
  });

  it('re-surfaces a record only when it changes (bumped seq)', () => {
    const server = createMockSyncServer();
    server.applyPush([change('a', 0), change('b', 0)]);
    const afterB = server.readPull(2, 100);
    expect(afterB.changes).toHaveLength(0);
    server.applyPush([change('a', 1)]); // a now at seq 3
    const delta = server.readPull(2, 100);
    expect(delta.changes.map((c) => c.uuid)).toEqual(['a']);
  });

  it('carries delete tombstones through pull', () => {
    const server = createMockSyncServer();
    server.applyPush([change('a', 0)]);
    server.applyPush([{ ...change('a', 1), op: 'delete', payload: { uuid: 'a', deleted_at: 9 } }]);
    const delta = server.readPull(1, 100);
    expect(delta.changes[0]).toMatchObject({ uuid: 'a', op: 'delete', revision: 2 });
  });
});

describe('mock provider — wrapper', () => {
  it('reports the protocol handshake and rings the doorbell on apply', async () => {
    const provider = createMockSyncProvider();
    await expect(provider.hello()).resolves.toEqual({
      protocolVersion: PROTOCOL_VERSION,
      minClientRevision: PROTOCOL_VERSION,
    });

    let poked = 0;
    provider.subscribe(() => {
      poked += 1;
    });
    await provider.push([change('a', 0)]);
    expect(poked).toBe(1);
  });

  it('injects a transient fault for the next call only', async () => {
    const provider = createMockSyncProvider();
    provider.server.setFault('transient');
    await expect(provider.push([change('a', 0)])).rejects.toThrow(/network/);
    await expect(provider.push([change('a', 0)])).resolves.toBeTruthy();
  });
});
