import { describe, it, expect } from 'vitest';
import { Reader } from '../io/Reader';
import { readHeader } from './header';

const DEFAULT_COPYRIGHT = 'Package file v1.0 Copyright 2002 Wizet, ZMS';

/**
 * Build a synthetic WZ header with the given copyright, dataStart, fileSize
 * and encVersion. The header size depends on `dataStart` (padding sits between
 * the null terminator after copyright and the encVersion word at dataStart).
 */
function buildHeader(opts: {
  copyright?: string;
  dataStart?: number;
  fileSize?: bigint;
  encVersion?: number;
}): Uint8Array {
  const copyright = opts.copyright ?? DEFAULT_COPYRIGHT;
  // Default minimum dataStart: 4 + 8 + 4 + copyright.length + 1 (null terminator)
  const minStart = 4 + 8 + 4 + copyright.length + 1;
  const dataStart = opts.dataStart ?? minStart;
  if (dataStart < minStart) {
    throw new Error(`dataStart ${dataStart} smaller than minimum ${minStart}`);
  }
  const fileSize = opts.fileSize ?? 0n;
  const encVersion = opts.encVersion ?? 0;

  const total = dataStart + 2;
  const buf = new Uint8Array(total);
  const dv = new DataView(buf.buffer);
  let pos = 0;
  for (const ch of 'PKG1') buf[pos++] = ch.charCodeAt(0);
  dv.setBigUint64(pos, fileSize, true);
  pos += 8;
  dv.setUint32(pos, dataStart, true);
  pos += 4;
  for (let i = 0; i < copyright.length; i++) buf[pos++] = copyright.charCodeAt(i);
  buf[pos++] = 0; // null terminator
  // (padding zeros up to dataStart)
  pos = dataStart;
  dv.setUint16(pos, encVersion, true);
  return buf;
}

describe('readHeader', () => {
  it('reads the default MapleStory header', () => {
    const buf = buildHeader({
      copyright: DEFAULT_COPYRIGHT,
      fileSize: 12345678n,
      encVersion: 0x1234,
    });
    const h = readHeader(new Reader(buf));
    expect(h.ident).toBe('PKG1');
    expect(h.fileSize).toBe(12345678n);
    expect(h.copyright).toBe(DEFAULT_COPYRIGHT);
    expect(h.dataStart).toBe(60);
    expect(h.encVersion).toBe(0x1234);
  });

  it('reads exactly dataStart-17 ASCII bytes verbatim (matches @tybys/wz)', () => {
    // Padding between copyright-null and dataStart shows up as trailing
    // null chars in the returned string — we don't trim, to keep byte-equality
    // with the oracle.
    const buf = buildHeader({ copyright: 'short', dataStart: 100, encVersion: 7 });
    expect(buf.byteLength).toBe(102);
    const h = readHeader(new Reader(buf));
    expect(h.copyright.length).toBe(100 - 17);
    expect(h.copyright.startsWith('short\0')).toBe(true);
    expect(h.dataStart).toBe(100);
    expect(h.encVersion).toBe(7);
  });

  it('rejects non-PKG1 magic', () => {
    const buf = buildHeader({});
    // Corrupt the magic.
    buf[0] = 0x58;
    expect(() => readHeader(new Reader(buf))).toThrow(/not a WZ file/);
  });

  it('rejects an impossibly small dataStart', () => {
    // Build a header by hand with dataStart = 10 (smaller than the
    // 4 + 8 + 4 = 16-byte fixed prefix).
    const buf = new Uint8Array(64);
    for (const ch of 'PKG1') buf[0] = ch.charCodeAt(0); // smudge a valid magic
    buf[0] = 'P'.charCodeAt(0);
    buf[1] = 'K'.charCodeAt(0);
    buf[2] = 'G'.charCodeAt(0);
    buf[3] = '1'.charCodeAt(0);
    const dv = new DataView(buf.buffer);
    dv.setBigUint64(4, 0n, true);
    dv.setUint32(12, 10, true);
    expect(() => readHeader(new Reader(buf))).toThrow(/negative copyright length/);
  });

  it('advances the reader to dataStart + 2', () => {
    const buf = buildHeader({ copyright: 'x', dataStart: 25, encVersion: 1 });
    const r = new Reader(buf);
    readHeader(r);
    expect(r.position).toBe(27);
  });
});
