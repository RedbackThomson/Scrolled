// The sync adapter against the real backend: real Postgres enforcing the real
// migrations, real PostgREST, real Realtime. This is where a query PostgREST
// would reject, or a constraint that does not behave as the client assumes,
// actually fails.
//
// Skipped when the local stack is not running, so `pnpm test` stays green
// without Docker. Start it with `nix develop -c supabase start`.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseSyncProvider } from '@scrolled/sync-supabase';
import type { RemoteRow, SyncProvider } from '@scrolled/sync-core';
import { PRIMARY, SECONDARY, accessTokenFor, seedAccount, wipeAccount } from './accounts.ts';
import { isRunning, readLocalSupabase, type LocalSupabase } from './localSupabase.ts';

const describeLocal = isRunning() ? describe : describe.skip;

let config: LocalSupabase;
let provider: SyncProvider;
let accountId: string;

function providerFor(token: string, pageSize = 500): SyncProvider {
  return createSupabaseSyncProvider({
    supabaseUrl: config.apiUrl,
    supabaseKey: config.publishableKey,
    getAccessToken: async () => token,
    pageSize,
  });
}

const collection = (key: string, name: string, device = 'dev-a'): RemoteRow => ({
  key,
  name,
  description: null,
  color: null,
  icon: null,
  pinned: false,
  pinned_position: null,
  grouping: 'group',
  subgrouping: 'type',
  sort_key: 'manual',
  sort_dir: 'asc',
  created_at: 1,
  updated_at: 1,
  origin_device: device,
  deleted_at: null,
});

const member = (collectionKey: string, entityId: number, device = 'dev-a'): RemoteRow => ({
  collection_key: collectionKey,
  entity_type: 'mob',
  entity_id: entityId,
  group_key: null,
  note: null,
  quantity: null,
  done: false,
  position: 0,
  added_at: 1,
  updated_at: 1,
  origin_device: device,
  deleted_at: null,
});

describeLocal('sync adapter against local Supabase', () => {
  beforeAll(async () => {
    config = readLocalSupabase();
    await seedAccount(PRIMARY, config);
    const session = await accessTokenFor(PRIMARY, config);
    accountId = session.accountId;
    provider = providerFor(session.token);
  }, 30_000);

  beforeEach(async () => {
    await wipeAccount(accountId, config);
  });

  it('advertises the relational protocol', async () => {
    expect(await provider.hello()).toEqual({ protocolVersion: 3, minClientRevision: 3 });
  });

  it('stores a row and returns the seq Postgres stamped', async () => {
    const result = await provider.upsert('collection', [collection('c1', 'Bosses')]);

    expect(result.nameCollisions).toEqual([]);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]).toMatchObject({ key: 'c1' });
    expect(result.applied[0].seq).toBeGreaterThan(0);
  });

  it('collapses the same member written by two devices', async () => {
    await provider.upsert('collection', [collection('c1', 'Bosses')]);
    await provider.upsert('collection_member', [member('c1', 100, 'dev-a')]);
    await provider.upsert('collection_member', [member('c1', 100, 'dev-b')]);

    const rows = (await provider.fetchAll()).filter((r) => r.entity === 'collection_member');
    expect(rows).toHaveLength(1);
    expect(rows[0].row.origin_device).toBe('dev-b');
  });

  it('reports a unique-name rejection as a collision, not a failure', async () => {
    await provider.upsert('collection', [collection('c1', 'Favourites')]);

    const result = await provider.upsert('collection', [
      collection('c2', 'Fresh'),
      collection('c3', 'Favourites'),
    ]);

    expect(result.applied.map((a) => a.key)).toEqual(['c2']);
    expect(result.nameCollisions.map((c) => c.key)).toEqual(['c3']);
  });

  it('finds the key already holding a name, which is how a merge resolves', async () => {
    await provider.upsert('collection', [collection('c1', 'Favourites')]);

    expect((await provider.findByUnique('collection', { name: 'Favourites' }))?.key).toBe('c1');
    expect(await provider.findByUnique('collection', { name: 'Absent' })).toBeNull();
  });

  it('frees a name once its row is tombstoned', async () => {
    await provider.upsert('collection', [collection('c1', 'Bosses')]);
    await provider.upsert('collection', [
      { ...collection('c1', 'Bosses'), deleted_at: new Date().toISOString() },
    ]);

    const result = await provider.upsert('collection', [collection('c2', 'Bosses')]);
    expect(result.nameCollisions).toEqual([]);
  });

  it('pages rows in timestamp order without repeating or skipping', async () => {
    await provider.upsert('collection', [
      collection('c1', 'A'),
      collection('c2', 'B'),
      collection('c3', 'C'),
    ]);
    const paged = providerFor((await accessTokenFor(PRIMARY, config)).token, 2);

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 10; guard++) {
      const page = await paged.fetchSince(cursor);
      seen.push(...page.rows.map((r) => String(r.row.key)));
      cursor = page.cursor;
      if (page.complete) break;
    }

    expect([...new Set(seen)].sort()).toEqual(['c1', 'c2', 'c3']);
  });

  it('reaps tombstones past the cutoff and leaves live rows', async () => {
    await provider.upsert('collection', [collection('c1', 'Live')]);
    await provider.upsert('collection', [
      { ...collection('c2', 'Gone'), deleted_at: '2020-01-01T00:00:00.000Z' },
    ]);

    await provider.gcTombstones('2025-01-01T00:00:00.000Z');

    const keys = (await provider.fetchAll())
      .filter((r) => r.entity === 'collection')
      .map((r) => r.row.key);
    expect(keys).toEqual(['c1']);
  });

  it('keeps one account out of another account rows', async () => {
    const other = await seedAccount(SECONDARY, config);
    const otherProvider = providerFor((await accessTokenFor(SECONDARY, config)).token);
    await wipeAccount(other.id, config);

    await provider.upsert('collection', [collection('c1', 'Mine')]);

    expect(await otherProvider.fetchAll()).toEqual([]);
    expect(await otherProvider.findByUnique('collection', { name: 'Mine' })).toBeNull();
  });

  it('rejects a member whose collection the backend has never seen', async () => {
    await expect(provider.upsert('collection_member', [member('missing', 1)])).rejects.toThrow();
  });

  it('rings the realtime doorbell with the writing device', async () => {
    const seen: string[] = [];
    const unsubscribe = provider.subscribe((device) => seen.push(device));
    // Give the channel time to join before the write that should poke it.
    await new Promise((r) => setTimeout(r, 2000));

    await provider.upsert('collection', [collection('c1', 'Poke me', 'dev-poke')]);

    await vi.waitFor(() => expect(seen).toContain('dev-poke'), { timeout: 8000 });
    unsubscribe();
  }, 20_000);
});
