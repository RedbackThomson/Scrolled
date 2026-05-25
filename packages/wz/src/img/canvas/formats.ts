/**
 * Per-format pixel decoders.
 *
 * Each function takes decompressed raw bytes plus dimensions and returns a
 * `Uint8ClampedArray` in **RGBA8888** layout (one byte per channel, in R,G,B,A
 * order), `width * height * 4` bytes long. Callers wrap with
 * `new ImageData(rgba, width, height)` for browser display, or pass straight
 * to a PNG encoder for OPFS persistence.
 */

const channel4 = (n: number) => ((n << 4) | n) & 0xff;

/** BGRA4444 — 2 bytes per pixel, low/high nibble of each byte encodes one channel. */
export function decodeBgra4444(raw: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const expected = width * height * 2;
  if (raw.length < expected) {
    throw new RangeError(`BGRA4444 raw too short: have ${raw.length}, need ${expected}`);
  }
  const out = new Uint8ClampedArray(width * height * 4);
  // raw layout per pixel (2 bytes): [BG, RA] — low nibble = first channel,
  // high nibble = second channel.
  for (let i = 0, p = 0; i < expected; i += 2, p += 4) {
    const bg = raw[i]!;
    const ra = raw[i + 1]!;
    out[p + 2] = channel4(bg & 0x0f); // B → store at index 2 of RGBA
    out[p + 1] = channel4(bg >>> 4); // G
    out[p + 0] = channel4(ra & 0x0f); // R
    out[p + 3] = channel4(ra >>> 4); // A
  }
  return out;
}

/** BGRA8888 — already a full byte per channel; swap B and R into RGBA. */
export function decodeBgra8888(raw: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const expected = width * height * 4;
  if (raw.length < expected) {
    throw new RangeError(`BGRA8888 raw too short: have ${raw.length}, need ${expected}`);
  }
  const out = new Uint8ClampedArray(expected);
  for (let i = 0; i < expected; i += 4) {
    out[i + 0] = raw[i + 2]!;
    out[i + 1] = raw[i + 1]!;
    out[i + 2] = raw[i + 0]!;
    out[i + 3] = raw[i + 3]!;
  }
  return out;
}

/** ARGB1555 — 2 bytes per pixel, 1 alpha + 5R + 5G + 5B bits. */
export function decodeArgb1555(raw: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; i < raw.length; i += 2, p += 4) {
    const word = raw[i]! | (raw[i + 1]! << 8);
    const a = (word & 0x8000) !== 0 ? 255 : 0;
    const r5 = (word >>> 10) & 0x1f;
    const g5 = (word >>> 5) & 0x1f;
    const b5 = word & 0x1f;
    out[p + 0] = (r5 << 3) | (r5 >>> 2);
    out[p + 1] = (g5 << 3) | (g5 >>> 2);
    out[p + 2] = (b5 << 3) | (b5 >>> 2);
    out[p + 3] = a;
  }
  return out;
}

/** RGB565 — 2 bytes per pixel; opaque (alpha = 0xFF). */
export function decodeRgb565(raw: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; i < raw.length; i += 2, p += 4) {
    const word = raw[i]! | (raw[i + 1]! << 8);
    const r5 = (word >>> 11) & 0x1f;
    const g6 = (word >>> 5) & 0x3f;
    const b5 = word & 0x1f;
    out[p + 0] = (r5 << 3) | (r5 >>> 2);
    out[p + 1] = (g6 << 2) | (g6 >>> 4);
    out[p + 2] = (b5 << 3) | (b5 >>> 2);
    out[p + 3] = 0xff;
  }
  return out;
}

// ---- DXT3 / DXT5 (Block compression; one 16-pixel 4×4 block per 16 input bytes)

function rgb565ToRgb(c: number): [number, number, number] {
  const r5 = (c >>> 11) & 0x1f;
  const g6 = (c >>> 5) & 0x3f;
  const b5 = c & 0x1f;
  return [(r5 << 3) | (r5 >>> 2), (g6 << 2) | (g6 >>> 4), (b5 << 3) | (b5 >>> 2)];
}

function expandDxtColors(c0: number, c1: number): [number, number, number][] {
  const out: [number, number, number][] = [rgb565ToRgb(c0), rgb565ToRgb(c1), [0, 0, 0], [0, 0, 0]];
  // DXT colour interpolation matches the c0 > c1 branch used by MapleLib /
  // @tybys/wz (DXT5 always uses this branch since it has an explicit alpha
  // table).
  if (c0 > c1) {
    out[2] = [
      Math.trunc((out[0]![0] * 2 + out[1]![0] + 1) / 3),
      Math.trunc((out[0]![1] * 2 + out[1]![1] + 1) / 3),
      Math.trunc((out[0]![2] * 2 + out[1]![2] + 1) / 3),
    ];
    out[3] = [
      Math.trunc((out[0]![0] + out[1]![0] * 2 + 1) / 3),
      Math.trunc((out[0]![1] + out[1]![1] * 2 + 1) / 3),
      Math.trunc((out[0]![2] + out[1]![2] * 2 + 1) / 3),
    ];
  } else {
    out[2] = [
      Math.trunc((out[0]![0] + out[1]![0]) / 2),
      Math.trunc((out[0]![1] + out[1]![1]) / 2),
      Math.trunc((out[0]![2] + out[1]![2]) / 2),
    ];
    out[3] = [0, 0, 0];
  }
  return out;
}

function setPixel(
  out: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  rgb: [number, number, number],
  alpha: number,
): void {
  const offset = (y * width + x) * 4;
  out[offset + 0] = rgb[0];
  out[offset + 1] = rgb[1];
  out[offset + 2] = rgb[2];
  out[offset + 3] = alpha;
}

export function decodeDxt3(raw: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const off = x * 4 + y * width;
      // 16-byte block: 8 bytes alpha (4-bit each, 16 pixels) + 4 bytes color
      // endpoints (RGB565 × 2) + 4 bytes color indices.
      const alpha = new Uint8Array(16);
      for (let i = 0, j = 0; i < 8; i++, j += 2) {
        const b = raw[off + i]!;
        alpha[j] = ((b & 0x0f) | ((b & 0x0f) << 4)) & 0xff;
        alpha[j + 1] = ((b & 0xf0) | (b >>> 4)) & 0xff;
      }
      const c0 = raw[off + 8]! | (raw[off + 9]! << 8);
      const c1 = raw[off + 10]! | (raw[off + 11]! << 8);
      const colors = expandDxtColors(c0, c1);
      for (let j = 0, idxOff = off + 12; j < 4; j++, idxOff++) {
        const row = raw[idxOff]!;
        for (let i = 0; i < 4; i++) {
          const ci = (row >>> (i * 2)) & 0x03;
          setPixel(out, x + i, y + j, width, colors[ci]!, alpha[j * 4 + i]!);
        }
      }
    }
  }
  return out;
}

export function decodeDxt5(raw: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const off = x * 4 + y * width;
      const a0 = raw[off]!;
      const a1 = raw[off + 1]!;
      const alphaTable = new Uint8Array(8);
      alphaTable[0] = a0;
      alphaTable[1] = a1;
      if (a0 > a1) {
        for (let i = 2; i < 8; i++) {
          alphaTable[i] = Math.trunc(((8 - i) * a0 + (i - 1) * a1 + 3) / 7) & 0xff;
        }
      } else {
        for (let i = 2; i < 6; i++) {
          alphaTable[i] = Math.trunc(((6 - i) * a0 + (i - 1) * a1 + 2) / 5) & 0xff;
        }
        alphaTable[6] = 0;
        alphaTable[7] = 255;
      }
      const alphaIdx = new Uint8Array(16);
      // 6 bytes of 3-bit alpha indices, packed across two 24-bit words.
      for (let i = 0, ao = off + 2; i < 16; i += 8, ao += 3) {
        const flags = raw[ao]! | (raw[ao + 1]! << 8) | (raw[ao + 2]! << 16);
        for (let j = 0; j < 8; j++) {
          alphaIdx[i + j] = (flags >>> (3 * j)) & 0x07;
        }
      }
      const c0 = raw[off + 8]! | (raw[off + 9]! << 8);
      const c1 = raw[off + 10]! | (raw[off + 11]! << 8);
      const colors = expandDxtColors(c0, c1);
      for (let j = 0, idxOff = off + 12; j < 4; j++, idxOff++) {
        const row = raw[idxOff]!;
        for (let i = 0; i < 4; i++) {
          const ci = (row >>> (i * 2)) & 0x03;
          setPixel(out, x + i, y + j, width, colors[ci]!, alphaTable[alphaIdx[j * 4 + i]!]!);
        }
      }
    }
  }
  return out;
}
