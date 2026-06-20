import { describe, expect, it } from 'vitest';
import { gunzipAsync, gzipAsync } from './container';
import { looksLikeDataset, packDataset, readDataset } from './dataset';

const CREATED_AT = '2026-06-20T00:00:00.000Z';

function gameBytes(): Uint8Array {
  return new Uint8Array([11, 22, 33, 44, 55, 66, 77, 88]);
}

function indexOfSeq(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

describe('packDataset / readDataset', () => {
  it('round-trips the game blob and manifest', async () => {
    const game = gameBytes();
    const packed = await packDataset({
      game,
      schemaVersion: 34,
      dataRevision: 17,
      createdAt: CREATED_AT,
    });

    expect(looksLikeDataset(packed)).toBe(true);

    const contents = await readDataset(packed);
    expect(contents.game).toEqual(game);
    expect(contents.manifest.format).toBe('scrolled-dataset');
    expect(contents.manifest.game.schemaVersion).toBe(34);
    expect(contents.manifest.game.dataRevision).toBe(17);
    expect(contents.manifest.game.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects bytes that are not a dataset container', async () => {
    await expect(readDataset(new Uint8Array([0, 1, 2]))).rejects.toThrow();
  });

  it('rejects a tampered blob via the checksum', async () => {
    const game = gameBytes();
    const packed = await packDataset({ game, schemaVersion: 1, dataRevision: 1, createdAt: CREATED_AT });
    const tar = await gunzipAsync(packed);
    // Flip a byte of the game blob so its content no longer matches the manifest hash.
    const at = indexOfSeq(tar, game);
    expect(at).toBeGreaterThanOrEqual(0);
    tar[at] ^= 0xff;
    await expect(readDataset(await gzipAsync(tar))).rejects.toThrow(/corrupt/);
  });
});
