import type { Reader } from './Reader';

/**
 * WZ string codec.
 *
 * Encoded strings are XOR-masked with a per-character index counter and then
 * XOR-masked again with an AES-derived keystream (the "WzKey").
 *
 *  - ASCII: mask byte starts at `0xAA` and increments by 1 per byte.
 *  - Unicode (UTF-16LE): mask word starts at `0xAAAA` and increments by 1 per
 *    character.
 *
 * The keystream is supplied by the caller — pass an all-zero buffer for BMS
 * (no AES) or the precomputed keystream for GMS/MSEA/EMS. The buffer must be
 * at least `length` bytes for ASCII or `length * 2` bytes for Unicode.
 */

/** Decode `length` bytes as a WZ ASCII (Latin-1) string. */
export function readWzAsciiString(r: Reader, length: number, keystream: Uint8Array): string {
  if (length === 0) return '';
  if (keystream.length < length) {
    throw new RangeError(`ascii keystream too short: need ${length}, got ${keystream.length}`);
  }
  const enc = r.readBytes(length);
  let s = '';
  let mask = 0xaa;
  for (let i = 0; i < length; i++) {
    const c = enc[i]! ^ mask ^ keystream[i]!;
    s += String.fromCharCode(c & 0xff);
    mask = (mask + 1) & 0xff;
  }
  return s;
}

/** Decode `length` UTF-16LE characters as a WZ Unicode string. */
export function readWzUnicodeString(r: Reader, length: number, keystream: Uint8Array): string {
  if (length === 0) return '';
  const byteLen = length * 2;
  if (keystream.length < byteLen) {
    throw new RangeError(`unicode keystream too short: need ${byteLen}, got ${keystream.length}`);
  }
  const enc = r.readBytes(byteLen);
  let s = '';
  let mask = 0xaaaa;
  for (let i = 0; i < length; i++) {
    const lo = enc[i * 2]!;
    const hi = enc[i * 2 + 1]!;
    const word = (hi << 8) | lo;
    const kLo = keystream[i * 2]!;
    const kHi = keystream[i * 2 + 1]!;
    const kWord = (kHi << 8) | kLo;
    const c = word ^ mask ^ kWord;
    s += String.fromCharCode(c & 0xffff);
    mask = (mask + 1) & 0xffff;
  }
  return s;
}

/**
 * Read a WZ "length-prefixed" string at the current reader position.
 *
 * Length sentinel (int8):
 *   - `0`            → empty string
 *   - positive       → Unicode; if sentinel === `127`, the real length is the
 *                      next int32 (number of chars). Otherwise the sentinel
 *                      *is* the length.
 *   - negative       → ASCII; if sentinel === `-128`, the real length is the
 *                      next int32. Otherwise `-sentinel` is the length.
 */
export function readWzString(r: Reader, keystream: Uint8Array): string {
  const sb = r.readInt8();
  if (sb === 0) return '';
  if (sb > 0) {
    const length = sb === 127 ? r.readInt32LE() : sb;
    return readWzUnicodeString(r, length, keystream);
  }
  // sb < 0
  const length = sb === -128 ? r.readInt32LE() : -sb;
  return readWzAsciiString(r, length, keystream);
}

/**
 * Read a WZ string from a specific *offset* relative to a base position
 * (used inside an IMG, where property names share a string-offset table).
 * Does not advance the caller's reader position.
 */
export function readWzStringAtOffset(
  r: Reader,
  base: number,
  offset: number,
  keystream: Uint8Array,
): string {
  const sub = r.clone(base + offset);
  return readWzString(sub, keystream);
}

// ---------- helpers for tests: matching in-process encoders ----------

/** Inverse of {@link readWzAsciiString} — encode a plain string to WZ ASCII bytes. */
export function encodeWzAsciiString(s: string, keystream: Uint8Array): Uint8Array {
  const out = new Uint8Array(s.length);
  let mask = 0xaa;
  for (let i = 0; i < s.length; i++) {
    out[i] = (s.charCodeAt(i) ^ mask ^ keystream[i]!) & 0xff;
    mask = (mask + 1) & 0xff;
  }
  return out;
}

/** Inverse of {@link readWzUnicodeString}. */
export function encodeWzUnicodeString(s: string, keystream: Uint8Array): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  let mask = 0xaaaa;
  for (let i = 0; i < s.length; i++) {
    const enc =
      (s.charCodeAt(i) ^ mask ^ ((keystream[i * 2 + 1]! << 8) | keystream[i * 2]!)) & 0xffff;
    out[i * 2] = enc & 0xff;
    out[i * 2 + 1] = (enc >> 8) & 0xff;
    mask = (mask + 1) & 0xffff;
  }
  return out;
}
