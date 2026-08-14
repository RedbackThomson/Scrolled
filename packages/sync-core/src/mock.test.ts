import { describe, expect, it } from 'vitest';
import { createMockSyncServer, MockForeignKeyError } from './mock';
import type { RemoteRow } from './types';

const collection = (key: string, name: string): RemoteRow => ({
  key,
  name,
  created_at: 1,
  updated_at: 1,
  origin_device: 'dev-a',
});

const member = (collectionKey: string, entityId: number): RemoteRow => ({
  collection_key: collectionKey,
  entity_type: 'mob',
  entity_id: entityId,
  added_at: 1,
  updated_at: 1,
  origin_device: 'dev-a',
});

describe('mock sync server', () => {
  it('collapses repeat writes of one record onto a single row', () => {
    const server = createMockSyncServer();
    server.applyUpsert('collection', [collection('c1', 'Bosses')]);
    server.applyUpsert('collection', [{ ...collection('c1', 'Bosses'), name: 'Renamed' }]);

    expect(server.rows('collection')).toHaveLength(1);
    expect(server.rows('collection')[0].name).toBe('Renamed');
  });

  it('collapses the same member added by two devices', () => {
    const server = createMockSyncServer();
    server.applyUpsert('collection', [collection('c1', 'Bosses')]);

    server.applyUpsert('collection_member', [{ ...member('c1', 100), origin_device: 'dev-a' }]);
    server.applyUpsert('collection_member', [{ ...member('c1', 100), origin_device: 'dev-b' }]);

    expect(server.rows('collection_member')).toHaveLength(1);
  });

  it('reports a name collision instead of storing a duplicate', () => {
    const server = createMockSyncServer();
    server.applyUpsert('collection', [collection('c1', 'Favourites')]);

    const result = server.applyUpsert('collection', [collection('c2', 'Favourites')]);

    expect(result.applied).toHaveLength(0);
    expect(result.nameCollisions).toHaveLength(1);
    expect(result.nameCollisions[0].key).toBe('c2');
    expect(server.rows('collection')).toHaveLength(1);
  });

  it('scopes group name uniqueness to the collection', () => {
    const server = createMockSyncServer();
    server.applyUpsert('collection', [collection('c1', 'A'), collection('c2', 'B')]);

    const group = (key: string, collectionKey: string): RemoteRow => ({
      key,
      collection_key: collectionKey,
      name: 'Tier 1',
      position: 0,
      created_at: 1,
      updated_at: 1,
      origin_device: 'dev-a',
    });

    expect(server.applyUpsert('collection_group', [group('g1', 'c1')]).applied).toHaveLength(1);
    expect(server.applyUpsert('collection_group', [group('g2', 'c2')]).applied).toHaveLength(1);
    expect(server.applyUpsert('collection_group', [group('g3', 'c1')]).nameCollisions).toHaveLength(
      1,
    );
  });

  it('lets a tombstoned name be reused', () => {
    const server = createMockSyncServer();
    server.applyUpsert('collection', [collection('c1', 'Bosses')]);
    server.applyUpsert('collection', [
      { ...collection('c1', 'Bosses'), deleted_at: new Date().toISOString() },
    ]);

    expect(server.applyUpsert('collection', [collection('c2', 'Bosses')]).applied).toHaveLength(1);
  });

  it('rejects a child whose collection is absent', () => {
    const server = createMockSyncServer();
    expect(() => server.applyUpsert('collection_member', [member('missing', 100)])).toThrow(
      MockForeignKeyError,
    );
  });

  it('pages rows after the cursor without repeating them', () => {
    const server = createMockSyncServer();
    server.applyUpsert('collection', [
      collection('c1', 'A'),
      collection('c2', 'B'),
      collection('c3', 'C'),
    ]);

    const first = server.readSince(null, 2);
    expect(first.rows).toHaveLength(2);
    expect(first.complete).toBe(false);

    const second = server.readSince(first.cursor, 2);
    expect(second.rows).toHaveLength(1);
    expect(second.complete).toBe(true);
    expect(server.readSince(second.cursor, 2).rows).toHaveLength(0);
  });

  it('finds the live row holding a name', () => {
    const server = createMockSyncServer();
    server.applyUpsert('collection', [collection('c1', 'Favourites')]);

    expect(server.findByUnique('collection', { name: 'Favourites' })?.key).toBe('c1');
    expect(server.findByUnique('collection', { name: 'Nope' })).toBeNull();
  });

  it('reaps only tombstones older than the cutoff', () => {
    const server = createMockSyncServer();
    server.applyUpsert('collection', [
      { ...collection('c1', 'Old'), deleted_at: '2020-01-01T00:00:00.000Z' },
      { ...collection('c2', 'New'), deleted_at: '2030-01-01T00:00:00.000Z' },
      collection('c3', 'Live'),
    ]);

    server.gcTombstones('2025-01-01T00:00:00.000Z');

    expect(server.rows('collection').map((r) => r.key).sort()).toEqual(['c2', 'c3']);
  });

  it('names the writing device in the poke so a client can skip its own echo', () => {
    const server = createMockSyncServer();
    const seen: string[] = [];
    server.subscribe((device) => seen.push(device));

    server.applyUpsert('collection', [{ ...collection('c1', 'A'), origin_device: 'dev-b' }]);

    expect(seen).toEqual(['dev-b']);
  });
});
