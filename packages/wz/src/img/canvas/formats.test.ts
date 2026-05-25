import { describe, it, expect } from 'vitest';
import { decodeArgb1555, decodeBgra4444, decodeBgra8888, decodeRgb565 } from './formats';

describe('decodeBgra8888', () => {
  it('swaps B and R into RGBA layout', () => {
    // Single 1×1 pixel: input BGRA = [0x11, 0x22, 0x33, 0x44]
    // Output RGBA should be [0x33, 0x22, 0x11, 0x44]
    const raw = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const out = decodeBgra8888(raw, 1, 1);
    expect(Array.from(out)).toEqual([0x33, 0x22, 0x11, 0x44]);
  });
});

describe('decodeBgra4444', () => {
  it('expands nibbles to full bytes with the 0x11 multiplier', () => {
    // Single pixel: 2 bytes [BG, RA] where each nibble is 4-bit channel.
    // BG = 0x21 → B=0x1 (low) → 0x11, G=0x2 (high) → 0x22
    // RA = 0x43 → R=0x3 (low) → 0x33, A=0x4 (high) → 0x44
    // Output RGBA = [0x33, 0x22, 0x11, 0x44]
    const raw = new Uint8Array([0x21, 0x43]);
    const out = decodeBgra4444(raw, 1, 1);
    expect(Array.from(out)).toEqual([0x33, 0x22, 0x11, 0x44]);
  });

  it('throws when raw bytes are smaller than width*height*2', () => {
    const raw = new Uint8Array(3);
    expect(() => decodeBgra4444(raw, 2, 1)).toThrow(/too short/);
  });
});

describe('decodeArgb1555', () => {
  it('scales 5-bit channels with the standard <<3|>>2 expansion', () => {
    // Opaque white: A=1, R=31, G=31, B=31 → 0xFFFF
    // RGBA out: [255, 255, 255, 255]
    const raw = new Uint8Array([0xff, 0xff]);
    const out = decodeArgb1555(raw, 1, 1);
    expect(Array.from(out)).toEqual([255, 255, 255, 255]);

    // Transparent black: 0x0000
    const black = decodeArgb1555(new Uint8Array([0, 0]), 1, 1);
    expect(Array.from(black)).toEqual([0, 0, 0, 0]);
  });
});

describe('decodeRgb565', () => {
  it('outputs alpha=0xFF and 5-6-5 channel expansion', () => {
    // 0xFFFF: R=31, G=63, B=31 → all 255
    const out = decodeRgb565(new Uint8Array([0xff, 0xff]), 1, 1);
    expect(Array.from(out)).toEqual([255, 255, 255, 255]);
    const black = decodeRgb565(new Uint8Array([0, 0]), 1, 1);
    expect(Array.from(black)).toEqual([0, 0, 0, 255]);
  });
});
