/**
 * Compute the version hash and its encrypted version byte for a candidate
 * MapleStory patch version. Mirrors `_checkAndGetVersionHash` in @tybys/wz.
 *
 * The "version hash" is what every encrypted directory offset is multiplied
 * by. The "encrypted version" is the uint16 stored at the file's `dataStart`;
 * its low byte is `0xFF` XOR'd with the four bytes of the hash.
 */
export function computeVersionHash(mapleVersion: number): { hash: number; encVersion: number } {
  const s = mapleVersion.toString();
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    // The multiplication can briefly overflow 32 bits in JS doubles; coerce
    // with `>>> 0` to keep it as an unsigned 32-bit integer.
    hash = ((32 * hash + s.charCodeAt(i) + 1) >>> 0);
  }
  const b0 = (hash >>> 24) & 0xff;
  const b1 = (hash >>> 16) & 0xff;
  const b2 = (hash >>> 8) & 0xff;
  const b3 = hash & 0xff;
  const encVersion = (0xff ^ b0 ^ b1 ^ b2 ^ b3) & 0xff;
  return { hash, encVersion };
}

/**
 * Brute-force the MapleStory patch version whose `encVersion` matches the
 * uint16 found in the file header.
 *
 * Multiple `mapleVersion` candidates can produce the same `encVersion`; the
 * caller must validate each by trying to decode the directory at offset 0
 * and seeing whether the entries look sane. Stage G calls this with a small
 * `max` (the docs note that 1..32767 is the spec ceiling, but in practice
 * versions stay under ~1000 even for current-day MapleStory).
 */
export function findVersionCandidates(
  encVersionHeader: number,
  max = 1000,
): { mapleVersion: number; hash: number }[] {
  const out: { mapleVersion: number; hash: number }[] = [];
  for (let v = 1; v < max; v++) {
    const { hash, encVersion } = computeVersionHash(v);
    if (encVersion === (encVersionHeader & 0xff)) {
      out.push({ mapleVersion: v, hash });
    }
  }
  return out;
}
