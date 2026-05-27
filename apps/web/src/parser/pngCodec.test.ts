import { describe, expect, it } from 'vitest';
import { encodeRgbaToPng } from './pngCodec';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('encodeRgbaToPng', () => {
  it('emits a valid PNG with the requested dimensions', async () => {
    const width = 2;
    const height = 3;
    const rgba = new Uint8ClampedArray(width * height * 4).fill(0xff);

    const png = await encodeRgbaToPng(rgba, width, height);

    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    // IHDR data starts at byte 16 (8 sig + 4 len + 4 type): width then height, big-endian uint32.
    const dv = new DataView(png.buffer, png.byteOffset);
    expect(dv.getUint32(16)).toBe(width);
    expect(dv.getUint32(20)).toBe(height);
  });
});
