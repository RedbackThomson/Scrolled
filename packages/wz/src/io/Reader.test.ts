import { describe, it, expect } from 'vitest';
import { Reader } from './Reader';

describe('Reader', () => {
  it('reads unsigned integers little-endian', () => {
    const r = new Reader(new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
    expect(r.readUInt8()).toBe(0x01);
    expect(r.readUInt16LE()).toBe(0x0302);
    // position should now be 3, remaining 5 bytes
    expect(r.position).toBe(3);
    expect(r.readUInt32LE()).toBe(0x07060504);
    expect(r.position).toBe(7);
    expect(r.readUInt8()).toBe(0x08);
  });

  it('reads signed integers little-endian with two\'s-complement semantics', () => {
    const r = new Reader(
      new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x80, 0x80]),
    );
    expect(r.readInt32LE()).toBe(-1);
    expect(r.readInt32LE()).toBe(-0x80000000); // INT32_MIN
    expect(r.readInt8()).toBe(-128);
  });

  it('reads 64-bit ints as bigint', () => {
    const r = new Reader(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]));
    expect(r.readInt64LE()).toBe(0x7fffffffffffffffn);
  });

  it('reads 64-bit ints with negative values', () => {
    const r = new Reader(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80]));
    expect(r.readInt64LE()).toBe(-0x8000000000000000n);
  });

  it('reads floats and doubles', () => {
    const buf = new ArrayBuffer(12);
    new DataView(buf).setFloat32(0, 1.5, true);
    new DataView(buf).setFloat64(4, Math.PI, true);
    const r = new Reader(new Uint8Array(buf));
    expect(r.readFloat32LE()).toBe(1.5);
    expect(r.readFloat64LE()).toBe(Math.PI);
  });

  it('represents NaN floats correctly', () => {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, NaN, true);
    const r = new Reader(new Uint8Array(buf));
    expect(Number.isNaN(r.readFloat32LE())).toBe(true);
  });

  it('throws on read past end', () => {
    const r = new Reader(new Uint8Array([1, 2]));
    r.readUInt8();
    r.readUInt8();
    expect(() => r.readUInt8()).toThrow(/read past end/);
  });

  it('throws on negative or oversized seeks', () => {
    const r = new Reader(new Uint8Array([1, 2, 3]));
    expect(() => r.seek(-1)).toThrow(/out of range/);
    expect(() => r.seek(4)).toThrow(/out of range/);
    // seeking to the exact end is allowed (one past last byte, like .length)
    expect(() => r.seek(3)).not.toThrow();
  });

  it('readBytes returns a view, readBytesCopy returns an independent buffer', () => {
    const src = new Uint8Array([1, 2, 3, 4, 5]);
    const r = new Reader(src);
    const view = r.readBytes(2);
    expect(Array.from(view)).toEqual([1, 2]);
    expect(view.buffer).toBe(src.buffer);

    const copy = r.readBytesCopy(2);
    expect(Array.from(copy)).toEqual([3, 4]);
    expect(copy.buffer).not.toBe(src.buffer);
  });

  it('reads fixed-length ASCII', () => {
    const r = new Reader(new TextEncoder().encode('PKG1abcd'));
    expect(r.readAscii(4)).toBe('PKG1');
    expect(r.readAscii(4)).toBe('abcd');
  });

  it('reads null-terminated ASCII', () => {
    const r = new Reader(new Uint8Array([0x68, 0x69, 0x00, 0x77, 0x65, 0x65])); // "hi\0wee"
    expect(r.readNullTerminatedAscii()).toBe('hi');
    expect(r.position).toBe(3);
  });

  describe('clone()', () => {
    it('produces an independent cursor over the same bytes', () => {
      const src = new Uint8Array([10, 20, 30, 40, 50]);
      const a = new Reader(src);
      a.readUInt8(); // pos = 1
      const b = a.clone();
      expect(b.position).toBe(1);

      b.readUInt8(); // b.pos = 2
      expect(a.position).toBe(1);
      expect(b.position).toBe(2);

      // mutating a doesn't move b, vice versa
      expect(a.readUInt8()).toBe(20);
      expect(b.readUInt8()).toBe(30);
    });

    it('clones to a specific position', () => {
      const r = new Reader(new Uint8Array([1, 2, 3, 4, 5]));
      const tail = r.clone(3);
      expect(tail.position).toBe(3);
      expect(tail.readUInt8()).toBe(4);
      // original untouched
      expect(r.position).toBe(0);
    });

    it('shares the same backing buffer (cheap clone)', () => {
      const src = new Uint8Array([1, 2, 3]);
      const a = new Reader(src);
      const b = a.clone();
      expect(b.buf).toBe(a.buf);
      expect(b.view.buffer).toBe(a.view.buffer);
    });
  });

  describe('skip and remaining', () => {
    it('skip advances position; remaining tracks bytes left', () => {
      const r = new Reader(new Uint8Array(10));
      expect(r.remaining).toBe(10);
      r.skip(3);
      expect(r.position).toBe(3);
      expect(r.remaining).toBe(7);
      r.skip(7);
      expect(r.remaining).toBe(0);
      expect(() => r.skip(1)).toThrow(/out of range/);
    });
  });
});
