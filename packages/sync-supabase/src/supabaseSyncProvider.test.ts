import { describe, expect, it, vi } from 'vitest';
import { SyncAuthError, SyncTransientError, type SyncChange } from '@scrolled/sync-core';
import {
  createSupabaseSyncProvider,
  type SyncRpcClient,
  type SupabaseSyncConfig,
} from './supabaseSyncProvider';

type RpcImpl = (
  fn: string,
  args?: Record<string, unknown>,
) => { data: unknown; error: { message: string; code?: string; status?: number } | null };

function fakeClient(impl: RpcImpl): { client: SyncRpcClient; calls: { fn: string; args?: Record<string, unknown> }[] } {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  const client: SyncRpcClient = {
    rpc(fn, args) {
      calls.push({ fn, args });
      return Promise.resolve(impl(fn, args));
    },
  };
  return { client, calls };
}

function providerWith(
  impl: RpcImpl,
  overrides: Partial<SupabaseSyncConfig> = {},
): { provider: ReturnType<typeof createSupabaseSyncProvider>; calls: { fn: string; args?: Record<string, unknown> }[] } {
  const { client, calls } = fakeClient(impl);
  const provider = createSupabaseSyncProvider({
    supabaseUrl: 'https://proj.supabase.co',
    supabaseKey: 'sb_publishable_test',
    getAccessToken: async () => 'token-123',
    client,
    ...overrides,
  });
  return { provider, calls };
}

const sampleChange: SyncChange = {
  entity: 'collection',
  uuid: 'u1',
  op: 'upsert',
  payload: { name: 'Bosses', updated_at: 5, origin_device: 'A' },
  baseRevision: 0,
  idempotency: 'idem-1',
};

describe('createSupabaseSyncProvider — push', () => {
  it('calls sync_push with the raw changes and returns the parsed result', async () => {
    const { provider, calls } = providerWith(() => ({
      data: {
        applied: [{ uuid: 'u1', revision: 1, serverSeq: 7 }],
        conflicts: [],
      },
      error: null,
    }));

    const result = await provider.push([sampleChange]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ fn: 'sync_push', args: { p_changes: [sampleChange] } });
    expect(result.applied).toEqual([{ uuid: 'u1', revision: 1, serverSeq: 7 }]);
    expect(result.conflicts).toEqual([]);
  });

  it('passes conflicts (with the server remote record) straight through', async () => {
    const { provider } = providerWith(() => ({
      data: {
        applied: [],
        conflicts: [
          {
            uuid: 'u1',
            remote: {
              entity: 'collection',
              uuid: 'u1',
              op: 'upsert',
              payload: { name: 'Server wins' },
              baseRevision: 0,
              idempotency: 'server:3',
              revision: 4,
            },
          },
        ],
      },
      error: null,
    }));

    const result = await provider.push([sampleChange]);
    expect(result.conflicts[0].remote.revision).toBe(4);
    expect(result.conflicts[0].remote.payload).toEqual({ name: 'Server wins' });
  });

  it('rejects a malformed RPC payload at the zod boundary', async () => {
    const { provider } = providerWith(() => ({
      data: { applied: [{ uuid: 'u1' }], conflicts: [] }, // missing revision/serverSeq
      error: null,
    }));
    await expect(provider.push([sampleChange])).rejects.toThrow();
  });
});

describe('createSupabaseSyncProvider — pull', () => {
  it('calls sync_pull with the cursor + page size and returns the parsed result', async () => {
    const { provider, calls } = providerWith(
      () => ({
        data: {
          changes: [
            {
              entity: 'user_setting',
              uuid: 'us1',
              op: 'upsert',
              payload: { key: 'accent', value: '"teal"' },
              baseRevision: 0,
              idempotency: 'server:1',
              revision: 1,
              serverSeq: 1,
            },
          ],
          nextCursor: 1,
          hasMore: false,
        },
        error: null,
      }),
      { pullPageSize: 250 },
    );

    const result = await provider.pull(0);

    expect(calls[0]).toEqual({ fn: 'sync_pull', args: { p_cursor: 0, p_limit: 250 } });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].serverSeq).toBe(1);
    expect(result.nextCursor).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it('accepts an empty page (cursor unchanged, nothing to apply)', async () => {
    const { provider } = providerWith(() => ({
      data: { changes: [], nextCursor: 42, hasMore: false },
      error: null,
    }));
    const result = await provider.pull(42);
    expect(result.changes).toEqual([]);
    expect(result.nextCursor).toBe(42);
  });
});

describe('createSupabaseSyncProvider — hello', () => {
  it('reads the protocol handshake from sync_hello', async () => {
    const { provider, calls } = providerWith(() => ({
      data: { protocolVersion: 1, minClientRevision: 1 },
      error: null,
    }));
    const handshake = await provider.hello();
    expect(calls[0].fn).toBe('sync_hello');
    expect(handshake).toEqual({ protocolVersion: 1, minClientRevision: 1 });
  });
});

describe('createSupabaseSyncProvider — auth + transport mapping', () => {
  it('throws SyncAuthError without a round trip when signed out', async () => {
    const { provider, calls } = providerWith(
      () => ({ data: null, error: null }),
      { getAccessToken: async () => null },
    );
    await expect(provider.push([sampleChange])).rejects.toBeInstanceOf(SyncAuthError);
    expect(calls).toHaveLength(0);
  });

  it('maps a 401 RPC error to SyncAuthError', async () => {
    const { provider } = providerWith(() => ({
      data: null,
      error: { message: 'JWT expired', code: 'PGRST301', status: 401 },
    }));
    await expect(provider.pull(0)).rejects.toBeInstanceOf(SyncAuthError);
  });

  it('maps a SQLSTATE 28000 (no auth.uid) error to SyncAuthError', async () => {
    const { provider } = providerWith(() => ({
      data: null,
      error: { message: 'sync_push requires authentication', code: '28000' },
    }));
    await expect(provider.push([sampleChange])).rejects.toBeInstanceOf(SyncAuthError);
  });

  it('maps a generic server error to SyncTransientError (engine backs off)', async () => {
    const { provider } = providerWith(() => ({
      data: null,
      error: { message: 'upstream timeout', code: '57014', status: 503 },
    }));
    await expect(provider.pull(0)).rejects.toBeInstanceOf(SyncTransientError);
  });
});

describe('createSupabaseSyncProvider — subscribe', () => {
  it('is a no-op doorbell until Phase 4 (returns an unsubscribe, never pokes)', () => {
    const { provider } = providerWith(() => ({ data: null, error: null }));
    const onPoke = vi.fn();
    const unsubscribe = provider.subscribe(onPoke);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    expect(onPoke).not.toHaveBeenCalled();
  });
});
