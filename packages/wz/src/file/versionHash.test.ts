import { describe, it, expect } from 'vitest';
import { computeVersionHash, findVersionCandidates } from './versionHash';

describe('computeVersionHash', () => {
  it('matches the reference algorithm for a small version number', () => {
    // Verify against the algorithm spelled out in @tybys/wz/WzFile.js
    // `_checkAndGetVersionHash`.
    const { hash, encVersion } = computeVersionHash(83);
    // hash of "83":
    //  step 1 (char '8'): 32*0 + 56 + 1 = 57
    //  step 2 (char '3'): 32*57 + 51 + 1 = 1876
    expect(hash).toBe(1876);
    // hash bytes: [0x00, 0x00, 0x07, 0x54]
    // encVersion = 0xFF ^ 0x00 ^ 0x00 ^ 0x07 ^ 0x54 = 0xAC
    expect(encVersion).toBe(0xac);
  });

  it('computes encVersion as a single byte', () => {
    for (let v = 1; v < 500; v++) {
      const { encVersion } = computeVersionHash(v);
      expect(encVersion).toBeGreaterThanOrEqual(0);
      expect(encVersion).toBeLessThanOrEqual(0xff);
    }
  });

  it('handles longer patch numbers without overflow', () => {
    // Confirm the >>> 0 trick keeps hashes as uint32 even for ~5-digit
    // versions where (32 * hash + ...) exceeds 2^31.
    const { hash } = computeVersionHash(99999);
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('findVersionCandidates', () => {
  it('finds the canonical MapleRoyals patch (v83) for encVersion 0xAC', () => {
    const candidates = findVersionCandidates(0xac, 200);
    expect(candidates.length).toBeGreaterThan(0);
    const v83 = candidates.find((c) => c.mapleVersion === 83);
    expect(v83).toBeDefined();
    expect(v83?.hash).toBe(1876);
  });

  it('returns an empty array when no version matches the encVersion byte', () => {
    // Use a value that no version 1..200 should produce. We probe by
    // collecting all encVersions and picking one that doesn't appear.
    const seen = new Set<number>();
    for (let v = 1; v < 200; v++) {
      seen.add(computeVersionHash(v).encVersion);
    }
    const unused = [...Array(256).keys()].find((b) => !seen.has(b));
    if (unused === undefined) {
      // All 256 byte values are produced by 1..200 — extremely unlikely; skip.
      return;
    }
    expect(findVersionCandidates(unused, 200)).toEqual([]);
  });
});
