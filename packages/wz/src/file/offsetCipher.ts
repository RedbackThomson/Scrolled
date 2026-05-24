import { WZ_OFFSET_CONSTANT } from '../crypto/keys';

/** Unsigned 32-bit left rotation. `n` is taken mod 32 by the language. */
export function rotateLeft32(x: number, n: number): number {
  n = n & 0x1f;
  if (n === 0) return x >>> 0;
  return (((x << n) >>> 0) | (x >>> (32 - n))) >>> 0;
}

/**
 * Decrypt a directory-entry offset.
 *
 * Algorithm (matches @tybys/wz `readWzOffset` and HaRepacker `WzBinaryReader`):
 *
 *   raw         = reader.pos - dataStart
 *   key         = ((raw ^ 0xFFFFFFFF) * versionHash - 0x581C3F6D) rotateLeft (key & 0x1F)
 *   offset      = (key ^ encryptedOffset + dataStart * 2) mod 2^32
 *
 * The cipher is stateless per entry — there is no chained state — so multiple
 * threads can decrypt different offsets concurrently as long as each has its
 * own `positionInFile`.
 *
 * @param positionInFile absolute byte offset where the encrypted 4-byte offset
 *                       *was read from* (i.e. the position right before
 *                       `readUInt32LE()`).
 * @param dataStart       the file's `header.dataStart`.
 * @param versionHash    `computeVersionHash(mapleVersion).hash`.
 * @param encryptedOffset the uint32 just read from disk.
 */
export function decryptDirectoryOffset(
  positionInFile: number,
  dataStart: number,
  versionHash: number,
  encryptedOffset: number,
): number {
  let key = (positionInFile - dataStart) >>> 0;
  key = (key ^ 0xffffffff) >>> 0;
  key = Math.imul(key, versionHash) >>> 0;
  key = (key - WZ_OFFSET_CONSTANT) >>> 0;
  key = rotateLeft32(key, key & 0x1f);
  let offset = (key ^ encryptedOffset) >>> 0;
  offset = (offset + dataStart * 2) >>> 0;
  return offset;
}
