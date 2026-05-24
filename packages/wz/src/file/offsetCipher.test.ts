import { describe, it, expect } from 'vitest';
import { decryptDirectoryOffset, rotateLeft32 } from './offsetCipher';
import { WZ_OFFSET_CONSTANT } from '../crypto/keys';

describe('rotateLeft32', () => {
  it('is identity for n=0 mod 32', () => {
    expect(rotateLeft32(0x12345678, 0)).toBe(0x12345678);
    expect(rotateLeft32(0x12345678, 32)).toBe(0x12345678);
  });

  it('rotates known values correctly', () => {
    expect(rotateLeft32(0x12345678, 4)).toBe(0x23456781);
    expect(rotateLeft32(0x80000000, 1)).toBe(0x00000001);
    expect(rotateLeft32(0xffffffff, 5)).toBe(0xffffffff);
  });
});

describe('decryptDirectoryOffset', () => {
  it('round-trips by encoding & decoding the same value', () => {
    // Pick a plain offset, encrypt it forward (the inverse of decryption),
    // then decrypt and check we get back the original.
    const dataStart = 60;
    const versionHash = 1876;
    const positionInFile = 200; // arbitrary
    const targetOffset = 0x12345678;

    // Forward: compute the same key, then encryptedOffset = (target - 2*dataStart) ^ key
    let key = (positionInFile - dataStart) >>> 0;
    key = (key ^ 0xffffffff) >>> 0;
    key = Math.imul(key, versionHash) >>> 0;
    key = (key - WZ_OFFSET_CONSTANT) >>> 0;
    key = rotateLeft32(key, key & 0x1f);
    const encrypted = (((targetOffset - dataStart * 2) >>> 0) ^ key) >>> 0;

    const decoded = decryptDirectoryOffset(positionInFile, dataStart, versionHash, encrypted);
    expect(decoded).toBe(targetOffset);
  });

  it('is stateless — same inputs always produce the same output', () => {
    const a = decryptDirectoryOffset(100, 60, 1876, 0xdeadbeef);
    const b = decryptDirectoryOffset(100, 60, 1876, 0xdeadbeef);
    expect(a).toBe(b);
  });

  it('produces a uint32 result', () => {
    const r = decryptDirectoryOffset(123, 60, 1876, 0xffffffff);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(0xffffffff);
  });
});
