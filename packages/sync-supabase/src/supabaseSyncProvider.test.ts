import { describe, expect, it, vi } from 'vitest';
import { SyncAuthError, SyncTransientError, type RemoteRow } from '@scrolled/sync-core';
import {
  createSupabaseSyncProvider,
  UniqueViolation,
  type SyncRealtimeChannel,
  type SyncRealtimeClient,
  type SyncRestClient,
} from './supabaseSyncProvider';

function makeRest(overrides: Partial<SyncRestClient> = {}): SyncRestClient {
  return {
    upsert: async (_t, rows) => rows.map((r, i) => ({ ...r, seq: i + 1 })),
    selectSince: async () => [],
    selectOne: async () => null,
    deleteTombstones: async () => {},
    protocol: async () => ({ protocol_version: 3, min_client_revision: 3 }),
    ...overrides,
  };
}

function makeProvider(rest: SyncRestClient, pageSize = 500, token: string | null = 'jwt') {
  return createSupabaseSyncProvider({
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'key',
    getAccessToken: async () => token,
    rest,
    pageSize,
  });
}

const collection = (key: string, name: string): RemoteRow => ({ key, name });

describe('upsert', () => {
  it('conflicts on the entity key columns', async () => {
    const upsert = vi.fn(async (_t: string, rows: RemoteRow[]) => rows.map((r) => ({ ...r, seq: 7 })));
    const provider = makeProvider(makeRest({ upsert }));

    await provider.upsert('collection_member', [
      { collection_key: 'c1', entity_type: 'mob', entity_id: 100 },
    ]);

    expect(upsert).toHaveBeenCalledWith(
      'sync_collection_members',
      expect.any(Array),
      'collection_key,entity_type,entity_id',
    );
  });

  it('reports the seq the backend stamped', async () => {
    const provider = makeProvider(
      makeRest({ upsert: async (_t, rows) => rows.map((r) => ({ ...r, seq: 42 })) }),
    );

    const result = await provider.upsert('collection', [collection('c1', 'Bosses')]);

    expect(result.applied).toEqual([{ key: 'c1', seq: 42 }]);
    expect(result.nameCollisions).toEqual([]);
  });

  it('isolates the colliding row when a batch is rejected', async () => {
    const upsert = vi.fn(async (_t: string, rows: RemoteRow[]) => {
      if (rows.some((r) => r.name === 'Taken')) throw new UniqueViolation('name_uniq');
      return rows.map((r) => ({ ...r, seq: 1 }));
    });
    const provider = makeProvider(makeRest({ upsert }));

    const result = await provider.upsert('collection', [
      collection('c1', 'Fine'),
      collection('c2', 'Taken'),
      collection('c3', 'Also fine'),
    ]);

    expect(result.applied.map((a) => a.key)).toEqual(['c1', 'c3']);
    expect(result.nameCollisions).toHaveLength(1);
    expect(result.nameCollisions[0].key).toBe('c2');
    expect(result.nameCollisions[0].row.name).toBe('Taken');
  });

  it('does not retry row-by-row when the failure is not a collision', async () => {
    const upsert = vi.fn(async () => {
      throw new SyncTransientError('down');
    });
    const provider = makeProvider(makeRest({ upsert }));

    await expect(
      provider.upsert('collection', [collection('c1', 'A'), collection('c2', 'B')]),
    ).rejects.toThrow(SyncTransientError);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('skips the round trip when signed out', async () => {
    const upsert = vi.fn();
    const provider = makeProvider(makeRest({ upsert }), 500, null);

    await expect(provider.upsert('collection', [collection('c1', 'A')])).rejects.toThrow(
      SyncAuthError,
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('fetchSince', () => {
  it('merges every table into one timestamp-ordered page', async () => {
    const provider = makeProvider(
      makeRest({
        selectSince: async (table) => {
          if (table === 'sync_collections') {
            return [{ key: 'c1', seq: 1, server_time: '2026-01-01T00:00:02.000Z' }];
          }
          if (table === 'sync_recents') {
            return [{ kind: 'entity', ref: 'mob/1', seq: 2, server_time: '2026-01-01T00:00:01.000Z' }];
          }
          return [];
        },
      }),
    );

    const page = await provider.fetchSince(null);

    expect(page.rows.map((r) => r.entity)).toEqual(['recent', 'collection']);
    expect(page.cursor).toBe('2026-01-01T00:00:02.000Z');
    expect(page.complete).toBe(true);
  });

  it('reports incomplete when a table filled its page', async () => {
    const provider = makeProvider(
      makeRest({
        selectSince: async (table) =>
          table === 'sync_collections'
            ? [
                { key: 'c1', seq: 1, server_time: '2026-01-01T00:00:01.000Z' },
                { key: 'c2', seq: 2, server_time: '2026-01-01T00:00:02.000Z' },
              ]
            : [],
      }),
      2,
    );

    expect((await provider.fetchSince(null)).complete).toBe(false);
  });

  it('truncates a merged page and stops the cursor at the cut', async () => {
    const provider = makeProvider(
      makeRest({
        selectSince: async (table) =>
          table === 'sync_collections'
            ? [{ key: 'c1', seq: 1, server_time: '2026-01-01T00:00:01.000Z' }]
            : table === 'sync_recents'
              ? [{ kind: 'entity', ref: 'm/1', seq: 2, server_time: '2026-01-01T00:00:09.000Z' }]
              : [],
      }),
      1,
    );

    const page = await provider.fetchSince(null);

    expect(page.rows).toHaveLength(1);
    expect(page.cursor).toBe('2026-01-01T00:00:01.000Z');
    expect(page.complete).toBe(false);
  });

  it('holds the cursor still when nothing is new', async () => {
    const provider = makeProvider(makeRest());
    const page = await provider.fetchSince('2026-01-01T00:00:00.000Z');
    expect(page.cursor).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('fetchAll', () => {
  it('pages past the row limit', async () => {
    const selectSince = vi.fn(async (table: string, _c, limit: number, offset: number) => {
      if (table !== 'sync_collections') return [];
      if (offset >= 3) return [];
      return Array.from({ length: Math.min(limit, 3 - offset) }, (_, i) => ({
        key: `c${offset + i}`,
        seq: offset + i,
        server_time: '2026-01-01T00:00:00.000Z',
      }));
    });
    const provider = makeProvider(makeRest({ selectSince }), 2);

    const rows = await provider.fetchAll();

    expect(rows).toHaveLength(3);
    expect(selectSince).toHaveBeenCalledWith('sync_collections', null, 2, 0);
    expect(selectSince).toHaveBeenCalledWith('sync_collections', null, 2, 2);
  });
});

describe('gcTombstones', () => {
  it('sweeps every table', async () => {
    const deleteTombstones = vi.fn(async () => {});
    const provider = makeProvider(makeRest({ deleteTombstones }));

    await provider.gcTombstones('2026-01-01T00:00:00.000Z');

    expect(deleteTombstones).toHaveBeenCalledTimes(6);
  });
});

describe('subscribe', () => {
  it('passes the writing device through so the engine can skip its own echo', async () => {
    // { "sub": "acct-1" }
    const token = `x.${btoa(JSON.stringify({ sub: 'acct-1' }))}.y`;
    let handler: ((m: { payload?: { device?: string } }) => void) | null = null;
    const channel: SyncRealtimeChannel = {
      on: (_t, _f, cb) => {
        handler = cb;
        return channel;
      },
      subscribe: () => channel,
    };
    const realtime: SyncRealtimeClient = {
      setAuth: () => {},
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    };

    const provider = createSupabaseSyncProvider({
      supabaseUrl: 'https://example.supabase.co',
      supabaseKey: 'key',
      getAccessToken: async () => token,
      rest: makeRest(),
      realtime,
    });

    const seen: string[] = [];
    const unsubscribe = provider.subscribe((device) => seen.push(device));
    await vi.waitFor(() => expect(handler).not.toBeNull());

    handler!({ payload: { device: 'dev-b' } });
    expect(seen).toEqual(['dev-b']);
    expect(realtime.channel).toHaveBeenCalledWith('sync:acct-1', { config: { private: true } });

    unsubscribe();
    expect(realtime.removeChannel).toHaveBeenCalled();
  });

  it('falls back to the periodic tick when there is no realtime client', () => {
    const provider = makeProvider(makeRest());
    expect(() => provider.subscribe(() => {})()).not.toThrow();
  });
});

describe('hello', () => {
  it('reads the advertised protocol', async () => {
    const provider = makeProvider(
      makeRest({ protocol: async () => ({ protocol_version: 3, min_client_revision: 2 }) }),
    );

    expect(await provider.hello()).toEqual({ protocolVersion: 3, minClientRevision: 2 });
  });
});
