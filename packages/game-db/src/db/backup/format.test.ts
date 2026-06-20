import { describe, expect, it } from 'vitest';
import { gunzipAsync, gzipAsync, unpackTar } from '@scrolled/dataset-core';
import { CURRENT_DATA_REVISION } from '../dataVersion';
import { looksLikeBackup, packBackup, readBackup } from './format';

const game = new Uint8Array([1, 2, 3, 4, 5]);
const user = new Uint8Array([9, 8, 7]);
const versions = {
  game: { schemaVersion: 17, dataRevision: CURRENT_DATA_REVISION },
  user: { schemaVersion: 2 },
};

describe('backup format', () => {
  it('packs both databases and reads them back intact', async () => {
    const archive = await packBackup({ game, user, versions });
    expect(looksLikeBackup(archive)).toBe(true);

    const contents = await readBackup(archive);
    // fflate's async gunzip returns the buffer from a worker realm, so compare
    // by value rather than relying on a same-realm Uint8Array prototype.
    expect(bytesEqual(contents.game, game)).toBe(true);
    expect(bytesEqual(contents.user, user)).toBe(true);
    expect(contents.manifest.databases.game?.dataRevision).toBe(CURRENT_DATA_REVISION);
    expect(contents.manifest.databases.user?.schemaVersion).toBe(2);
  });

  it('supports a single-database backup', async () => {
    const archive = await packBackup({ user, versions: { user: versions.user } });
    const contents = await readBackup(archive);
    expect(bytesEqual(contents.user, user)).toBe(true);
    expect(contents.game).toBeUndefined();
    expect(contents.manifest.databases.game).toBeUndefined();
  });

  it('orders the manifest first in the archive', async () => {
    const archive = await packBackup({ game, user, versions });
    const names = unpackTar(await gunzipAsync(archive)).map((e) => e.name);
    expect(names[0]).toBe('manifest.json');
  });

  it('refuses an empty backup', async () => {
    await expect(packBackup({ versions: {} })).rejects.toThrow(/at least one database/);
  });

  it('rejects a tampered blob via the checksum', async () => {
    const archive = await packBackup({ game, user, versions });
    const tar = await gunzipAsync(archive);
    // The game blob's bytes are distinctive enough to locate directly; flip one
    // so its content no longer matches the manifest hash.
    const at = indexOfSeq(tar, game);
    expect(at).toBeGreaterThanOrEqual(0);
    tar[at] ^= 0xff;
    await expect(readBackup(await gzipAsync(tar))).rejects.toThrow(/corrupt/);
  });
});

function bytesEqual(a: Uint8Array | undefined, b: Uint8Array): boolean {
  return a != null && Array.from(a).join(',') === Array.from(b).join(',');
}

function indexOfSeq(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
