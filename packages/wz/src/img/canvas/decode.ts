import type { WzCanvasProperty } from '../property';
import {
  decodeArgb1555,
  decodeBgra4444,
  decodeBgra8888,
  decodeDxt3,
  decodeDxt5,
  decodeRgb565,
} from './formats';

export interface CanvasPixels {
  width: number;
  height: number;
  /** RGBA8888 — `width * height * 4` bytes. */
  rgba: Uint8ClampedArray;
}

/**
 * Detect zlib magic at offset 0 (`78 9C`, `78 DA`, `78 01`, `78 5E`).
 *
 * If false, the payload is `listWz`-encoded — XOR'd with the file's
 * WzKey before deflation.
 */
function looksLikeZlib(buf: Uint8Array): boolean {
  if (buf.length < 2 || buf[0] !== 0x78) return false;
  const b1 = buf[1]!;
  return b1 === 0x9c || b1 === 0xda || b1 === 0x01 || b1 === 0x5e;
}

/**
 * `listWz` decryption: concatenated [uint32 length][length bytes] blocks, each
 * block XOR'd with the keystream starting from index 0.
 */
function listWzDecode(payload: Uint8Array, keystream: Uint8Array): Uint8Array {
  const out: number[] = [];
  let pos = 0;
  while (pos < payload.length) {
    const blockLen =
      payload[pos]! |
      (payload[pos + 1]! << 8) |
      (payload[pos + 2]! << 16) |
      (payload[pos + 3]! << 24);
    pos += 4;
    for (let i = 0; i < blockLen; i++) {
      if (i >= keystream.length) {
        throw new RangeError(
          `listWz keystream exhausted at block byte ${i}; pass a larger keystream`,
        );
      }
      out.push(payload[pos + i]! ^ keystream[i]!);
    }
    pos += blockLen;
  }
  return new Uint8Array(out);
}

export interface DecodeCanvasArgs {
  /** The parsed canvas property. */
  canvas: WzCanvasProperty;
  /** The full WZ file bytes (the canvas payload lives at canvas.dataOffset). */
  fileBytes: Uint8Array;
  /** The keystream used for this file (also used for listWz XOR). */
  keystream: Uint8Array;
}

/**
 * Decode a canvas property to RGBA8888 pixels.
 *
 * No `OffscreenCanvas`, no per-pixel `setPixelColor`, no `convertToBlob`
 * round-trip. The output `Uint8ClampedArray` is shaped for `new ImageData()`
 * directly.
 *
 * Returns a `Promise` because the underlying zlib decompressor is a streaming
 * primitive (`DecompressionStream` in the browser; `node:zlib` in Node). WZ
 * canvas payloads in MapleRoyals v83 are consistently 1 byte shy of the
 * full zlib Adler-32 trailer — @tybys/wz tolerates this with streaming
 * inflate, and we do the same here.
 */
export async function decodeCanvas(args: DecodeCanvasArgs): Promise<CanvasPixels> {
  const { canvas, fileBytes, keystream } = args;
  const start = canvas.dataOffset;
  const dv = new DataView(fileBytes.buffer, fileBytes.byteOffset);
  const rawLen = dv.getInt32(start, true);
  const payloadStart = start + 4 + 1;
  const payloadLen = rawLen - 1;
  if (payloadLen <= 0) {
    throw new RangeError(`canvas payload length non-positive: ${payloadLen} at ${start}`);
  }
  const payload = fileBytes.subarray(payloadStart, payloadStart + payloadLen);

  const compressed = looksLikeZlib(payload) ? payload : listWzDecode(payload, keystream);
  const raw = await lenientInflate(compressed, uncompressedSize(canvas));

  return dispatch(canvas, raw);
}

/**
 * Inflate a zlib stream (CMF + FLG header, raw deflate body, optional
 * Adler-32 trailer) into at most `expectedSize` bytes. Tolerates a missing
 * Adler-32 / truncated final block by returning whatever the decoder
 * produced before EOF.
 *
 * Uses `node:zlib` in Node and `DecompressionStream` in the browser; both
 * are streaming primitives that emit chunks as they decompress and ignore
 * trailing-byte issues.
 */
async function lenientInflate(zlibData: Uint8Array, expectedSize: number): Promise<Uint8Array> {
  const buffer = new Uint8Array(expectedSize);
  let offset = 0;
  const append = (chunk: Uint8Array): void => {
    if (offset >= buffer.length) return;
    const copyLen = Math.min(chunk.length, buffer.length - offset);
    buffer.set(chunk.subarray(0, copyLen), offset);
    offset += copyLen;
  };

  if (typeof process !== 'undefined' && process.versions?.node) {
    // Node: streaming inflate via `zlib.createInflate`. On `error` (truncated
    // stream), keep whatever chunks have already been emitted.
    const zlib = await import('node:zlib');
    await new Promise<void>((resolve) => {
      const stream = zlib.createInflate();
      stream.on('data', (chunk: Buffer) =>
        append(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)),
      );
      stream.on('end', () => resolve());
      stream.on('error', () => resolve());
      stream.end(zlibData);
    });
  } else {
    // Browser / Worker: DecompressionStream('deflate') handles zlib-wrapped
    // streams; whatever bytes arrive before the stream closes are kept.
    const ds = new DecompressionStream('deflate');
    const reader = new Response(new Blob([new Uint8Array(zlibData)]))
      .body!.pipeThrough(ds)
      .getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (value) append(value);
        if (done) break;
      }
    } catch {
      // Truncated stream — keep what we have.
    }
  }

  return offset === buffer.length ? buffer : buffer.subarray(0, offset);
}

function uncompressedSize(canvas: WzCanvasProperty): number {
  const code = canvas.format1 + canvas.format2;
  const w = canvas.width;
  const h = canvas.height;
  switch (code) {
    case 1:
      return w * h * 2; // BGRA4444
    case 2:
      return w * h * 4; // BGRA8888
    case 3:
    case 1026:
      return w * h * 4; // DXT3 (alloc to spec; actual algorithm needs w*h)
    case 257:
      return w * h * 2; // ARGB1555
    case 513:
      return w * h * 2; // RGB565
    case 2050:
      return w * h; // DXT5
    default:
      // Best guess; the decoder will throw on unknown formats anyway.
      return w * h * 4;
  }
}

function dispatch(canvas: WzCanvasProperty, raw: Uint8Array): CanvasPixels {
  const code = canvas.format1 + canvas.format2;
  const { width, height } = canvas;
  switch (code) {
    case 1:
      return { width, height, rgba: decodeBgra4444(raw, width, height) };
    case 2:
      return { width, height, rgba: decodeBgra8888(raw, width, height) };
    case 3:
    case 1026:
      // Some files distinguish format 3 (raw "DXT3 + alpha pre-expanded") vs
      // 1026 (DXT3 proper). MapleLib treats them identically.
      return { width, height, rgba: decodeDxt3(raw, width, height) };
    case 2050:
      return { width, height, rgba: decodeDxt5(raw, width, height) };
    case 257:
      return { width, height, rgba: decodeArgb1555(raw, width, height) };
    case 513:
      return { width, height, rgba: decodeRgb565(raw, width, height) };
    default:
      throw new Error(`unknown canvas format ${canvas.format1}+${canvas.format2} (= ${code})`);
  }
}
