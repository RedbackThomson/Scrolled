import { describe, it, expect } from 'vitest';
import { Reader } from './Reader';
import {
  encodeWzAsciiString,
  encodeWzUnicodeString,
  readWzAsciiString,
  readWzString,
  readWzStringAtOffset,
  readWzUnicodeString,
} from './wzString';

const zeros = (n: number) => new Uint8Array(n);

describe('readWzAsciiString', () => {
  it('decodes the empty string', () => {
    const r = new Reader(new Uint8Array(0));
    expect(readWzAsciiString(r, 0, zeros(0))).toBe('');
  });

  it('round-trips a Latin-1 string under a zero keystream (BMS-equivalent)', () => {
    const plain = 'Hello, World!';
    const enc = encodeWzAsciiString(plain, zeros(plain.length));
    const r = new Reader(enc);
    expect(readWzAsciiString(r, plain.length, zeros(plain.length))).toBe(plain);
  });

  it('round-trips under a non-zero keystream (GMS-equivalent)', () => {
    const plain = 'abcdefghijklmnop';
    const key = new Uint8Array(plain.length);
    for (let i = 0; i < key.length; i++) key[i] = (i * 7 + 13) & 0xff;
    const enc = encodeWzAsciiString(plain, key);
    const r = new Reader(enc);
    expect(readWzAsciiString(r, plain.length, key)).toBe(plain);
  });

  it('handles all 256 byte values to prove the mask is applied byte-by-byte', () => {
    let plain = '';
    for (let i = 0; i < 256; i++) plain += String.fromCharCode(i);
    const key = zeros(plain.length);
    const r = new Reader(encodeWzAsciiString(plain, key));
    expect(readWzAsciiString(r, plain.length, key)).toBe(plain);
  });

  it('throws when the keystream is shorter than length', () => {
    const r = new Reader(new Uint8Array(4));
    expect(() => readWzAsciiString(r, 4, zeros(2))).toThrow(/keystream too short/);
  });
});

describe('readWzUnicodeString', () => {
  it('decodes the empty string', () => {
    const r = new Reader(new Uint8Array(0));
    expect(readWzUnicodeString(r, 0, zeros(0))).toBe('');
  });

  it('round-trips a multi-byte string under a zero keystream', () => {
    const plain = 'こんにちは';
    const enc = encodeWzUnicodeString(plain, zeros(plain.length * 2));
    const r = new Reader(enc);
    expect(readWzUnicodeString(r, plain.length, zeros(plain.length * 2))).toBe(plain);
  });

  it('round-trips under a non-zero keystream', () => {
    const plain = '한glish—mix';
    const key = new Uint8Array(plain.length * 2);
    for (let i = 0; i < key.length; i++) key[i] = (i * 31 + 5) & 0xff;
    const enc = encodeWzUnicodeString(plain, key);
    const r = new Reader(enc);
    expect(readWzUnicodeString(r, plain.length, key)).toBe(plain);
  });
});

describe('readWzString (length-sentinel)', () => {
  it('reads an empty string from a zero sentinel', () => {
    const r = new Reader(new Uint8Array([0]));
    expect(readWzString(r, zeros(0))).toBe('');
  });

  it('reads ASCII with a small negative sentinel', () => {
    const plain = 'wz';
    const enc = encodeWzAsciiString(plain, zeros(2));
    // sentinel = -length = -2 → 0xFE
    const buf = new Uint8Array(1 + enc.length);
    buf[0] = 0xfe;
    buf.set(enc, 1);
    const r = new Reader(buf);
    expect(readWzString(r, zeros(2))).toBe(plain);
  });

  it('reads ASCII with the -128 length escape (int32 length follows)', () => {
    const plain = 'x'.repeat(300);
    const enc = encodeWzAsciiString(plain, zeros(plain.length));
    const buf = new Uint8Array(1 + 4 + enc.length);
    buf[0] = 0x80; // -128
    new DataView(buf.buffer, buf.byteOffset).setInt32(1, plain.length, true);
    buf.set(enc, 5);
    const r = new Reader(buf);
    expect(readWzString(r, zeros(plain.length))).toBe(plain);
  });

  it('reads Unicode with a small positive sentinel', () => {
    const plain = 'ä';
    const enc = encodeWzUnicodeString(plain, zeros(2));
    const buf = new Uint8Array(1 + enc.length);
    buf[0] = plain.length; // 1
    buf.set(enc, 1);
    const r = new Reader(buf);
    expect(readWzString(r, zeros(2))).toBe(plain);
  });

  it('reads Unicode with the 127 length escape', () => {
    const plain = 'á'.repeat(300);
    const enc = encodeWzUnicodeString(plain, zeros(plain.length * 2));
    const buf = new Uint8Array(1 + 4 + enc.length);
    buf[0] = 127;
    new DataView(buf.buffer, buf.byteOffset).setInt32(1, plain.length, true);
    buf.set(enc, 5);
    const r = new Reader(buf);
    expect(readWzString(r, zeros(plain.length * 2))).toBe(plain);
  });
});

describe('readWzStringAtOffset', () => {
  it('reads from a specific offset without advancing the caller reader', () => {
    // Build a buffer with [pad, len-sentinel, ascii bytes] where the string
    // lives at offset 4 from a base. The caller passes the base + offset.
    const plain = 'hi';
    const enc = encodeWzAsciiString(plain, zeros(2));
    const buf = new Uint8Array(10);
    buf[4] = 0xfe; // -2 sentinel
    buf.set(enc, 5);

    const r = new Reader(buf);
    r.position = 9; // caller cursor is past the string
    const out = readWzStringAtOffset(r, 0, 4, zeros(2));
    expect(out).toBe(plain);
    // caller position must not move
    expect(r.position).toBe(9);
  });
});
