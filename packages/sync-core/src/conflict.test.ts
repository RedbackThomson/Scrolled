import { describe, expect, it } from 'vitest';
import { resolveConflict } from './conflict';
import type { SyncChange, SyncEntity, SyncOp } from './types';

function change(
  entity: SyncEntity,
  op: SyncOp,
  payload: Record<string, unknown>,
  revision = 1,
): SyncChange & { revision: number } {
  return {
    entity,
    uuid: 'u',
    op,
    payload,
    baseRevision: revision - 1,
    idempotency: 'k',
    revision,
  };
}

describe('resolveConflict — default LWW', () => {
  it('keeps the later updated_at', () => {
    const local = change('user_setting', 'upsert', { updated_at: 200, origin_device: 'a' });
    const remote = change('user_setting', 'upsert', { updated_at: 100, origin_device: 'b' });
    expect(resolveConflict({ entity: 'user_setting', local, remote })).toBe('local');
    expect(
      resolveConflict({
        entity: 'user_setting',
        local: { ...local, payload: { updated_at: 50, origin_device: 'a' } },
        remote,
      }),
    ).toBe('remote');
  });

  it('breaks an exact tie deterministically by origin_device, server winning a full tie', () => {
    const hi = change('user_setting', 'upsert', { updated_at: 100, origin_device: 'zzz' });
    const lo = change('user_setting', 'upsert', { updated_at: 100, origin_device: 'aaa' });
    // local has the higher device id → local wins
    expect(resolveConflict({ entity: 'user_setting', local: hi, remote: lo })).toBe('local');
    // identical everything → remote (server is source of truth)
    expect(resolveConflict({ entity: 'user_setting', local: lo, remote: { ...lo } })).toBe('remote');
  });

  it('lets a delete compete at its deleted_at timestamp', () => {
    const del = change('pinned_search', 'delete', {
      updated_at: 10,
      deleted_at: 500,
      origin_device: 'a',
    });
    const edit = change('pinned_search', 'upsert', { updated_at: 300, origin_device: 'b' });
    expect(resolveConflict({ entity: 'pinned_search', local: del, remote: edit })).toBe('local');
  });
});

describe('resolveConflict — per-entity overrides', () => {
  it('collection delete wins over a concurrent edit regardless of timestamps', () => {
    const del = change('collection', 'delete', {
      updated_at: 1,
      deleted_at: 1,
      origin_device: 'a',
    });
    const edit = change('collection', 'upsert', { updated_at: 9999, origin_device: 'b' });
    expect(resolveConflict({ entity: 'collection', local: del, remote: edit })).toBe('local');
    expect(resolveConflict({ entity: 'collection', local: edit, remote: del })).toBe('remote');
  });

  it('collection edit-vs-edit still falls through to LWW', () => {
    const newer = change('collection', 'upsert', { updated_at: 200, origin_device: 'a' });
    const older = change('collection', 'upsert', { updated_at: 100, origin_device: 'b' });
    expect(resolveConflict({ entity: 'collection', local: newer, remote: older })).toBe('local');
  });

  it('recents take the most-recently-viewed timestamp, even an upsert over a prune', () => {
    const view = change('recent', 'upsert', { updated_at: 5, viewed_at: 900, origin_device: 'a' });
    const prune = change('recent', 'delete', {
      updated_at: 5,
      viewed_at: 100,
      deleted_at: 800,
      origin_device: 'b',
    });
    expect(resolveConflict({ entity: 'recent', local: view, remote: prune })).toBe('local');
    expect(resolveConflict({ entity: 'recent', local: prune, remote: view })).toBe('remote');
  });
});

describe('resolveConflict — malformed payloads do not throw', () => {
  it('treats a non-object payload as zeroed meta', () => {
    const local = change('user_setting', 'upsert', {} as Record<string, unknown>);
    const remote = { ...change('user_setting', 'upsert', {}), payload: 'not-an-object' };
    expect(() => resolveConflict({ entity: 'user_setting', local, remote })).not.toThrow();
  });
});
