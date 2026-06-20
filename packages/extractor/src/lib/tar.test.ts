import { describe, expect, it } from 'vitest';
import { packTar, unpackTar } from './tar';

function bytes(...nums: number[]): Uint8Array {
  return new Uint8Array(nums);
}

describe('tar', () => {
  it('round-trips a single entry', () => {
    const entries = [{ name: 'manifest.json', bytes: new TextEncoder().encode('{"a":1}') }];
    const out = unpackTar(packTar(entries));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('manifest.json');
    expect(new TextDecoder().decode(out[0].bytes)).toBe('{"a":1}');
  });

  it('round-trips multiple entries preserving order', () => {
    const entries = [
      { name: 'manifest.json', bytes: bytes(1, 2, 3) },
      { name: 'game.sqlite3', bytes: bytes(4, 5, 6, 7, 8) },
      { name: 'user.sqlite3', bytes: bytes(9) },
    ];
    const out = unpackTar(packTar(entries));
    expect(out.map((e) => e.name)).toEqual(['manifest.json', 'game.sqlite3', 'user.sqlite3']);
    expect(out[1].bytes).toEqual(bytes(4, 5, 6, 7, 8));
  });

  it('handles non-block-aligned and empty payloads with correct padding', () => {
    const big = new Uint8Array(513).map((_, i) => i % 256); // spans 2 content blocks
    const entries = [
      { name: 'empty', bytes: new Uint8Array(0) },
      { name: 'odd', bytes: big },
    ];
    const packed = packTar(entries);
    // header(empty) + 0 + header(odd) + 2 blocks + 2 EOF blocks
    expect(packed.byteLength % 512).toBe(0);
    const out = unpackTar(packed);
    expect(out[0].bytes.byteLength).toBe(0);
    expect(out[1].bytes).toEqual(big);
  });

  it('stops at the zero-block terminator and ignores trailing bytes', () => {
    const packed = packTar([{ name: 'a', bytes: bytes(42) }]);
    const withJunk = new Uint8Array(packed.byteLength + 16);
    withJunk.set(packed);
    withJunk.fill(0xff, packed.byteLength); // junk after the EOF blocks
    const out = unpackTar(withJunk);
    expect(out).toHaveLength(1);
    expect(out[0].bytes).toEqual(bytes(42));
  });
});
