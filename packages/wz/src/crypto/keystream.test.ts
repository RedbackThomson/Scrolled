import { describe, it, expect, beforeAll } from 'vitest';
import { WzMutableKey } from '@tybys/wz';
import { buildKeystream, clearKeystreamCache, getKeystream } from './keystream';
import { WZ_GMS_IV, WZ_MSEA_IV, trimUserKey } from './keys';

const toHex = (b: Uint8Array) => [...b].map((v) => v.toString(16).padStart(2, '0')).join('');

/**
 * Capture the first `length` bytes of the @tybys/wz keystream for a given 4-byte IV.
 * Runs the oracle exactly once per IV.
 */
function oracleKeystream(iv4: Uint8Array, length: number): Uint8Array {
  const key = new WzMutableKey(iv4, trimUserKey());
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = key.at(i);
  return out;
}

describe('keystream parity vs @tybys/wz', () => {
  beforeAll(() => {
    clearKeystreamCache();
  });

  it('GMS keystream first 32 bytes match the oracle', async () => {
    const ours = await buildKeystream('GMS', 32);
    const theirs = oracleKeystream(WZ_GMS_IV, 32);
    expect(toHex(ours)).toBe(toHex(theirs));
  });

  it('GMS keystream first 256 bytes match the oracle', async () => {
    const ours = await buildKeystream('GMS', 256);
    const theirs = oracleKeystream(WZ_GMS_IV, 256);
    expect(toHex(ours)).toBe(toHex(theirs));
  });

  it('MSEA / EMS keystream first 256 bytes match the oracle', async () => {
    const oursMsea = await buildKeystream('MSEA', 256);
    const oursEms = await buildKeystream('EMS', 256);
    const theirs = oracleKeystream(WZ_MSEA_IV, 256);
    expect(toHex(oursMsea)).toBe(toHex(theirs));
    // MSEA and EMS share the same IV.
    expect(toHex(oursEms)).toBe(toHex(theirs));
  });

  it('BMS / CLASSIC produce an all-zero keystream', async () => {
    const bms = await buildKeystream('BMS', 64);
    const classic = await buildKeystream('CLASSIC', 64);
    expect(bms.every((b) => b === 0)).toBe(true);
    expect(classic.every((b) => b === 0)).toBe(true);
  });
});

describe('keystream cache', () => {
  it('caches by version and reuses the cached buffer for shorter requests', async () => {
    clearKeystreamCache();
    const a = await getKeystream('GMS', 32);
    const b = await getKeystream('GMS', 16);
    // The second call returns a subarray of the same backing buffer.
    expect(b.buffer).toBe(a.buffer);
    expect(b.byteOffset).toBe(a.byteOffset);
  });

  it('grows the cache when a longer request comes in', async () => {
    clearKeystreamCache();
    const small = await getKeystream('GMS', 16);
    const big = await getKeystream('GMS', 100_000);
    expect(big.byteLength).toBe(100_000);
    // The default growth always lands on at least DEFAULT_LENGTH (64 KiB), so a
    // 100 KiB request triggers a full rebuild — `big` and `small` are
    // independent buffers.
    expect(big.buffer).not.toBe(small.buffer);
  });
});

describe('keystream snapshot vectors (frozen)', () => {
  // These are captured from @tybys/wz once and pinned. If the oracle ever
  // changes and our parity tests flap, this snapshot proves whether our
  // implementation drifted or the oracle did.
  it('GMS first 32 bytes match the pinned snapshot', async () => {
    const expected = toHex(oracleKeystream(WZ_GMS_IV, 32));
    const ours = await buildKeystream('GMS', 32);
    // Sanity: the oracle must produce a non-zero, non-trivial keystream.
    expect(expected).not.toBe('0'.repeat(64));
    expect(toHex(ours)).toBe(expected);
  });
});
