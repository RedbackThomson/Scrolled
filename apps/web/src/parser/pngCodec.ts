import type * as NodeZlibModule from 'node:zlib';

type NodeZlib = typeof NodeZlibModule;

/**
 * Encode RGBA8888 pixels as a PNG. Runs in both browser/Worker (OffscreenCanvas)
 * and Node (vitest, where we use `node:zlib` to build a minimal PNG). One
 * synchronous `putImageData` + `convertToBlob` — none of the old per-pixel
 * round-tripping.
 */
export async function encodeRgbaToPng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Uint8Array> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
    const ab = new ArrayBuffer(rgba.byteLength);
    new Uint8ClampedArray(ab).set(rgba);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(ab), width, height), 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await blob.arrayBuffer());
  }
  // Node fallback (vitest).
  const { default: zlib } = await import('node:zlib');
  return encodePngNode(rgba, width, height, zlib);
}

function encodePngNode(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  zlib: NodeZlib,
): Uint8Array {
  // Build a minimal PNG: signature + IHDR + IDAT + IEND.
  const signature = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

  const ihdrData = new Uint8Array(13);
  const dv = new DataView(ihdrData.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  // Filter byte 0 prepended to each row.
  const rowBytes = width * 4;
  const filtered = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (rowBytes + 1)] = 0;
    filtered.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  }
  const idatData = zlib.deflateSync(filtered);

  const pieces: Uint8Array[] = [signature];
  pieces.push(makeChunk('IHDR', ihdrData));
  pieces.push(makeChunk('IDAT', new Uint8Array(idatData)));
  pieces.push(makeChunk('IEND', new Uint8Array(0)));
  let total = 0;
  for (const p of pieces) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of pieces) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc);
  return chunk;
}

let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
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
