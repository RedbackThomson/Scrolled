import type { WzVersion } from '../types';
import { aesChainEncryptZeros } from './aes';
import { ivForVersion, isUnencrypted, trimUserKey } from './keys';

const DEFAULT_LENGTH = 64 * 1024;

const cache = new Map<WzVersion, Uint8Array>();

/**
 * Return a precomputed AES keystream of at least `length` bytes for the
 * given version. Cached per-version, growing on demand. Calls with a
 * shorter `length` return a subarray of the cached buffer.
 *
 * BMS / CLASSIC short-circuit to an all-zero buffer (their IV is zero — the
 * WZ "AES" step is a no-op, leaving only the literal XOR mask).
 */
export async function getKeystream(
  version: WzVersion,
  length: number = DEFAULT_LENGTH,
): Promise<Uint8Array> {
  const existing = cache.get(version);
  if (existing && existing.length >= length) return existing.subarray(0, length);

  const targetLength = Math.max(length, DEFAULT_LENGTH, existing?.length ?? 0);
  const grown = await buildKeystream(version, targetLength);
  cache.set(version, grown);
  return grown.subarray(0, length);
}

/** Build a fresh keystream of exactly `lengthBytes` bytes, ignoring the cache. */
export async function buildKeystream(
  version: WzVersion,
  lengthBytes: number,
): Promise<Uint8Array> {
  if (lengthBytes === 0) return new Uint8Array(0);
  if (isUnencrypted(version)) return new Uint8Array(lengthBytes);

  const iv4 = ivForVersion(version);
  const ivBlock = new Uint8Array(16);
  for (let i = 0; i < 16; i++) ivBlock[i] = iv4[i % 4]!;

  const key = trimUserKey();
  const numBlocks = Math.ceil(lengthBytes / 16);
  const full = await aesChainEncryptZeros(key, ivBlock, numBlocks);
  return full.subarray(0, lengthBytes);
}

/** Test/diagnostic helper — purges the per-version keystream cache. */
export function clearKeystreamCache(): void {
  cache.clear();
}
