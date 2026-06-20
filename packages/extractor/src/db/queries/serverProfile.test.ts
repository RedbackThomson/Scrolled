// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { Sqlite } from '../sqlite';
import { DbApi } from './index';

/**
 * Migration #33 + meta roundtrip: a fixed dataset persists its full profile
 * config inline; selecting a bundled profile by id clears it.
 */
describe('inline server profile persistence', () => {
  let db: DbApi;

  beforeEach(async () => {
    db = new DbApi(new Sqlite({ logTag: 'profile-test' }));
    await db.open();
  });

  it('defaults to the baseline id and no inline config', async () => {
    expect(await db.getServerProfile()).toBe('vanilla-v83');
    expect(await db.getActiveServerProfile()).toBeNull();
  });

  it('stores and reads back a full inline profile config', async () => {
    const profile = {
      id: 'mapleroyals',
      name: 'MapleRoyals',
      rates: { exp: 4 },
      systems: { equipStatCalculation: 'mapleroyals-v1' },
    };
    await db.setServerProfileConfig(profile);
    expect(await db.getServerProfile()).toBe('mapleroyals');
    expect(await db.getActiveServerProfile()).toEqual(profile);
  });

  it('clears the inline config when a bundled profile is selected by id', async () => {
    await db.setServerProfileConfig({ id: 'mapleroyals', rates: { exp: 4 } });
    await db.setServerProfile('vanilla-v83');
    expect(await db.getServerProfile()).toBe('vanilla-v83');
    expect(await db.getActiveServerProfile()).toBeNull();
  });
});
