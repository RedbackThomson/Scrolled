import { describe, it, expect } from 'vitest';
import { Reader } from './Reader';

const u8 = (...bytes: number[]) => new Uint8Array(bytes);

describe('compressed int32', () => {
  it('encodes 0 / 127 / -127 as a single signed byte', () => {
    const r = new Reader(u8(0, 0x7f, 0x81)); // 0, 127, -127
    expect(r.readCompressedInt32()).toBe(0);
    expect(r.readCompressedInt32()).toBe(127);
    expect(r.readCompressedInt32()).toBe(-127);
  });

  it('uses the -128 sentinel to escape into a full int32', () => {
    // -128 sentinel, then int32 = 0x12345678
    const r = new Reader(u8(0x80, 0x78, 0x56, 0x34, 0x12));
    expect(r.readCompressedInt32()).toBe(0x12345678);
  });

  it('handles INT32_MIN behind the -128 escape', () => {
    // -128 sentinel, then int32 = 0x80000000 (-2147483648)
    const r = new Reader(u8(0x80, 0x00, 0x00, 0x00, 0x80));
    expect(r.readCompressedInt32()).toBe(-0x80000000);
  });
});

describe('compressed int64', () => {
  it('encodes small values as a single signed byte', () => {
    const r = new Reader(u8(0, 0x7f, 0x81)); // 0, 127, -127
    expect(r.readCompressedInt64()).toBe(0n);
    expect(r.readCompressedInt64()).toBe(127n);
    expect(r.readCompressedInt64()).toBe(-127n);
  });

  it('escapes into int64 on -128 sentinel', () => {
    // -128 sentinel, then int64 = 0x1122334455667788
    const r = new Reader(u8(0x80, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11));
    expect(r.readCompressedInt64()).toBe(0x1122334455667788n);
  });

  it('handles negative escaped values', () => {
    // -128 sentinel, then int64 = -1
    const r = new Reader(u8(0x80, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff));
    expect(r.readCompressedInt64()).toBe(-1n);
  });
});

describe('compressed float32', () => {
  it('encodes whole values that fit in a signed byte', () => {
    const r = new Reader(u8(0, 0x7f, 0x81)); // 0, 127, -127
    expect(r.readCompressedFloat32()).toBe(0);
    expect(r.readCompressedFloat32()).toBe(127);
    expect(r.readCompressedFloat32()).toBe(-127);
  });

  it('escapes into float32 on -128 sentinel', () => {
    // -128 sentinel, then float32 = 3.14
    const buf = new Uint8Array(5);
    buf[0] = 0x80;
    new DataView(buf.buffer, buf.byteOffset).setFloat32(1, 3.14, true);
    const r = new Reader(buf);
    expect(r.readCompressedFloat32()).toBeCloseTo(3.14, 5);
  });
});
