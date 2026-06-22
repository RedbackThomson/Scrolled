// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { Sqlite } from '../sqlite';
import { DbApi } from './index';

/**
 * Inline server-profile config (migration #33): a fixed dataset persists its
 * full profile config inline so it renders without the app bundling a matching
 * profile. The generic-mode selection no longer lives here — it moved to the
 * user DB (sync design) — so there's only the inline config to round-trip.
 */
describe('inline server profile persistence', () => {
  let db: DbApi;

  beforeEach(async () => {
    db = new DbApi(new Sqlite({ logTag: 'profile-test' }));
    await db.open();
  });

  it('has no inline config by default', async () => {
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
    expect(await db.getActiveServerProfile()).toEqual(profile);
  });

  it('overwrites a previously stored inline config', async () => {
    const first = { id: 'mapleroyals', rates: { exp: 4 } };
    const second = { id: 'classic', rates: { exp: 1 } };
    await db.setServerProfileConfig(first);
    await db.setServerProfileConfig(second);
    expect(await db.getActiveServerProfile()).toEqual(second);
  });
});
