// Shared low-level PNG plumbing: signature, chunk framing, CRC32, and the
// row-filter step. Used by the single-frame encoder (`pngCodec`) and the
// animated encoder (`apng`) so both speak the same chunk format.

/** The 8-byte PNG file signature. */
export const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

/**
 * Wrap chunk `data` in the PNG framing: 4-byte big-endian length, 4-byte type,
 * the data, then a 4-byte CRC32 over type+data.
 */
export function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc);
  return chunk;
}

/**
 * Prepend the "None" filter byte (0) to each RGBA8888 row, producing the raw
 * pre-compression scanline buffer a PNG IDAT/fdAT expects.
 */
export function filterRows(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const rowBytes = width * 4;
  const filtered = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (rowBytes + 1)] = 0;
    filtered.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  }
  return filtered;
}

let crcTable: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crcTable[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
