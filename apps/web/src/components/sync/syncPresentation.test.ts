import { describe, expect, it } from 'vitest';
import { INITIAL_SYNC_STATUS, type SyncStatus } from '@scrolled/sync-core';
import { presentSyncStatus, formatLastSynced } from './syncPresentation';

function status(patch: Partial<SyncStatus>): SyncStatus {
  return { ...INITIAL_SYNC_STATUS, ...patch };
}

describe('presentSyncStatus', () => {
  it('spins only while a cycle is in flight', () => {
    expect(presentSyncStatus(status({ state: 'syncing' })).spin).toBe(true);
    expect(presentSyncStatus(status({ state: 'synced' })).spin).toBe(false);
  });

  it('maps the healthy states to their tones', () => {
    expect(presentSyncStatus(status({ state: 'synced' }))).toMatchObject({
      label: 'Synced',
      tone: 'emerald',
    });
    expect(presentSyncStatus(status({ state: 'offline' }))).toMatchObject({
      label: 'Offline',
      tone: 'amber',
    });
  });

  it('distinguishes auth vs protocol errors so the UI can offer the right step', () => {
    const auth = presentSyncStatus(status({ state: 'error', errorKind: 'auth' }));
    expect(auth.label).toBe('Sign in again');
    expect(auth.detail).toMatch(/session expired/i);

    const protocol = presentSyncStatus(status({ state: 'error', errorKind: 'protocol' }));
    expect(protocol.label).toBe('Update needed');
    expect(protocol.detail).toMatch(/refresh/i);
  });

  it('falls back to the raw message for an uncategorized error', () => {
    const p = presentSyncStatus(status({ state: 'error', errorKind: null, error: 'boom' }));
    expect(p.label).toBe('Sync error');
    expect(p.detail).toBe('boom');
  });

  it('never references a trademarked name in any copy', () => {
    const banned = /maplestory|maple|nexon|royals|legends/i;
    const states: SyncStatus[] = [
      status({ state: 'idle' }),
      status({ state: 'syncing' }),
      status({ state: 'synced' }),
      status({ state: 'offline' }),
      status({ state: 'error', errorKind: 'auth' }),
      status({ state: 'error', errorKind: 'protocol' }),
      status({ state: 'error', errorKind: null, error: 'x' }),
    ];
    for (const s of states) {
      const p = presentSyncStatus(s);
      expect(`${p.label} ${p.detail}`).not.toMatch(banned);
    }
  });
});

describe('formatLastSynced', () => {
  const now = 1_000_000_000;
  it('reports never for a missing timestamp', () => {
    expect(formatLastSynced(null, now)).toBe('never');
  });
  it('rounds into just now / minutes / hours / days', () => {
    expect(formatLastSynced(now - 5_000, now)).toBe('just now');
    expect(formatLastSynced(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatLastSynced(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(formatLastSynced(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
});
