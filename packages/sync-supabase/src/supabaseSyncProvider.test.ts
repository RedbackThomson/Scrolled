import { describe, expect, it, vi } from 'vitest';
import { SyncAuthError, SyncTransientError, type SyncChange } from '@scrolled/sync-core';
import {
  createSupabaseSyncProvider,
  type SyncRealtimeChannel,
  type SyncRealtimeClient,
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

// -- Phase 4: the Broadcast doorbell -----------------------------------------

/** A JWT-shaped token whose payload carries `sub` — the only claim subscribe
 *  reads (RLS enforces the rest server-side). */
function makeJwt(sub: string): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub })}.sig`;
}

interface FakeRealtimeState {
  authToken: string | null;
  topic: string | null;
  private: boolean | null;
  pokeCb: (() => void) | null;
  subscribed: boolean;
  removed: number;
}

function fakeRealtime(): { client: SyncRealtimeClient; state: FakeRealtimeState } {
  const state: FakeRealtimeState = {
    authToken: null,
    topic: null,
    private: null,
    pokeCb: null,
    subscribed: false,
    removed: 0,
  };
  const channel: SyncRealtimeChannel = {
    on(_type, filter, cb) {
      if (filter.event === 'poke') state.pokeCb = cb;
      return channel;
    },
    subscribe() {
      state.subscribed = true;
      return channel;
    },
  };
  const client: SyncRealtimeClient = {
    setAuth(token) {
      state.authToken = token;
    },
    channel(topic, opts) {
      state.topic = topic;
      state.private = opts.config.private;
      return channel;
    },
    removeChannel(ch) {
      if (ch === channel) state.removed += 1;
    },
  };
  return { client, state };
}

/** Flush the microtask queue so subscribe's async channel setup runs. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('createSupabaseSyncProvider — subscribe (Broadcast doorbell)', () => {
  it('opens the private per-account channel and pokes on each Broadcast message', async () => {
    const { client: realtime, state } = fakeRealtime();
    const token = makeJwt('acct-77');
    const { provider } = providerWith(() => ({ data: null, error: null }), {
      realtime,
      getAccessToken: async () => token,
    });

    const onPoke = vi.fn();
    const unsubscribe = provider.subscribe(onPoke);
    await flush();

    expect(state.authToken).toBe(token); // JWT handed to Realtime for RLS
    expect(state.topic).toBe('sync:acct-77'); // topic derived from the sub claim
    expect(state.private).toBe(true);
    expect(state.subscribed).toBe(true);

    state.pokeCb?.();
    state.pokeCb?.();
    expect(onPoke).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(state.removed).toBe(1);
  });

  it('tears down cleanly when unsubscribed before the channel finishes opening', async () => {
    const { client: realtime, state } = fakeRealtime();
    const { provider } = providerWith(() => ({ data: null, error: null }), {
      realtime,
      getAccessToken: async () => makeJwt('acct-1'),
    });

    const onPoke = vi.fn();
    const unsubscribe = provider.subscribe(onPoke);
    unsubscribe(); // cancel before the async setup runs
    await flush();

    expect(state.subscribed).toBe(false);
    expect(onPoke).not.toHaveBeenCalled();
  });

  it('degrades to the safety tick when the token has no sub claim', async () => {
    const { client: realtime, state } = fakeRealtime();
    const { provider } = providerWith(() => ({ data: null, error: null }), {
      realtime,
      getAccessToken: async () => 'not-a-jwt',
    });

    provider.subscribe(vi.fn());
    await flush();
    expect(state.subscribed).toBe(false);
  });

  it('is an inert no-op when no realtime transport is available', async () => {
    // Only the RPC seam injected → no doorbell; liveness falls back to polling.
    const { provider } = providerWith(() => ({ data: null, error: null }));
    const onPoke = vi.fn();
    const unsubscribe = provider.subscribe(onPoke);
    await flush();
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    expect(onPoke).not.toHaveBeenCalled();
  });
});
