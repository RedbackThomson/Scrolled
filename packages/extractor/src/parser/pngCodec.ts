import type * as NodeZlibModule from 'node:zlib';
import { PNG_SIGNATURE, filterRows, makeChunk } from '../lib/pngChunks';

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
  const ihdrData = new Uint8Array(13);
  const dv = new DataView(ihdrData.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const idatData = zlib.deflateSync(filterRows(rgba, width, height));

  const pieces: Uint8Array[] = [PNG_SIGNATURE];
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
