// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { unzlibSync } from 'fflate';
import { encodeAnimatedPng, type AnimFrame } from './apng';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Walk the chunk list, returning [type, dataOffset, length] for each chunk. */
function chunks(bytes: Uint8Array): { type: string; dataOff: number; length: number }[] {
  const out: { type: string; dataOff: number; length: number }[] = [];
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 8; // skip signature
  while (off + 8 <= bytes.length) {
    const length = dv.getUint32(off);
    const type = String.fromCharCode(bytes[off + 4]!, bytes[off + 5]!, bytes[off + 6]!, bytes[off + 7]!);
    out.push({ type, dataOff: off + 8, length });
    off += 12 + length; // length + type + data + crc
  }
  return out;
}

function frame(width: number, height: number, delayMs: number): AnimFrame {
  return { rgba: new Uint8ClampedArray(width * height * 4).fill(0x80), width, height, delayMs };
}

describe('encodeAnimatedPng', () => {
  it('emits a valid APNG: signature, IHDR, acTL, one fcTL per frame, IEND', () => {
    const width = 4;
    const height = 3;
    const { data } = encodeAnimatedPng([
      frame(width, height, 120),
      frame(width, height, 80),
      frame(width, height, 80),
    ]);

    expect([...data.subarray(0, 8)]).toEqual(PNG_SIGNATURE);

    const list = chunks(data);
    const types = list.map((c) => c.type);
    expect(types[0]).toBe('IHDR');
    expect(types[1]).toBe('acTL');
    expect(types.at(-1)).toBe('IEND');

    // IHDR carries the canvas dimensions.
    const dv = new DataView(data.buffer, data.byteOffset);
    const ihdr = list[0]!;
    expect(dv.getUint32(ihdr.dataOff)).toBe(width);
    expect(dv.getUint32(ihdr.dataOff + 4)).toBe(height);

    // acTL num_frames matches; one fcTL per frame; first frame is IDAT, the
    // rest are fdAT.
    const actl = list[1]!;
    expect(dv.getUint32(actl.dataOff)).toBe(3);
    expect(types.filter((t) => t === 'fcTL')).toHaveLength(3);
    expect(types.filter((t) => t === 'IDAT')).toHaveLength(1);
    expect(types.filter((t) => t === 'fdAT')).toHaveLength(2);
  });

  it('round-trips frame pixels: IDAT decompresses to the filtered scanlines', () => {
    const width = 2;
    const height = 2;
    const rgba = new Uint8ClampedArray([
      // row 0
      10, 20, 30, 40, 50, 60, 70, 80,
      // row 1
      90, 100, 110, 120, 130, 140, 150, 160,
    ]);
    const { data } = encodeAnimatedPng([{ rgba, width, height, delayMs: 100 }]);

    const idat = chunks(data).find((c) => c.type === 'IDAT')!;
    const raw = unzlibSync(data.subarray(idat.dataOff, idat.dataOff + idat.length));
    // Each scanline is prefixed with a filter byte (0 = None).
    const rowBytes = width * 4;
    expect(raw[0]).toBe(0);
    expect([...raw.subarray(1, 1 + rowBytes)]).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(raw[1 + rowBytes]).toBe(0);
    expect([...raw.subarray(2 + rowBytes, 2 + 2 * rowBytes)]).toEqual([
      90, 100, 110, 120, 130, 140, 150, 160,
    ]);
  });

  it('rejects frames of differing sizes and an empty frame list', () => {
    expect(() => encodeAnimatedPng([])).toThrow(/no frames/);
    expect(() => encodeAnimatedPng([frame(4, 4, 100), frame(5, 4, 100)])).toThrow(
      /share canvas size/,
    );
  });
});
