// Animated WebP encoder.
//
// Browsers ship a static WebP encoder via `OffscreenCanvas.convertToBlob({type:
// 'image/webp'})`, but no built-in animation. This module fills that gap:
//
//   1. Render every frame onto an OffscreenCanvas and encode it as a static
//      WebP via the browser encoder.
//   2. Strip each static WebP's RIFF/WEBP header, lift the inner VP8 / VP8L
//      bitstream chunk, and re-wrap them inside an animated WebP container
//      (VP8X + ANIM + ANMF[]).
//
// All frames must share the same canvas size — the caller normalizes before
// calling, so we trust that here.
//
// Node (vitest) has no `OffscreenCanvas`. The encoder falls back to a minimal
// RIFF/WEBP stub whose magic + canvas dims are valid but whose frame data is
// empty. That lets extractor tests assert "we produced WebP bytes" without
// pulling a native encoder into the test runner.

export interface AnimFrame {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  delayMs: number;
}

export interface EncodedAnimation {
  data: Uint8Array;
  width: number;
  height: number;
}

export async function encodeAnimatedWebp(frames: AnimFrame[]): Promise<EncodedAnimation> {
  if (frames.length === 0) throw new Error('encodeAnimatedWebp: no frames');
  const width = frames[0]!.width;
  const height = frames[0]!.height;
  for (const f of frames) {
    if (f.width !== width || f.height !== height) {
      throw new Error('encodeAnimatedWebp: frames must share canvas size');
    }
  }

  if (typeof OffscreenCanvas === 'undefined') {
    return { data: makeNodeStub(width, height), width, height };
  }

  const staticWebps: Uint8Array[] = [];
  for (const f of frames) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('encodeAnimatedWebp: 2d context unavailable');
    const ab = new ArrayBuffer(f.rgba.byteLength);
    new Uint8ClampedArray(ab).set(f.rgba);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(ab), width, height), 0, 0);
    // quality=1.0 nudges Chromium to emit VP8L (lossless); lossy WebP would
    // place alpha in a separate ALPH chunk and visibly garble pixel-art edges
    // when compressed. We still handle the ALPH-chunk path below for browsers
    // that ignore the hint.
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 1 });
    staticWebps.push(new Uint8Array(await blob.arrayBuffer()));
  }

  const data = buildAnimatedWebp(
    staticWebps.map(extractFrameChunk),
    frames.map((f) => f.delayMs),
    width,
    height,
  );
  return { data, width, height };
}

interface FrameChunk {
  fourcc: 'VP8 ' | 'VP8L';
  payload: Uint8Array;
  // Lossy WebP keeps alpha in a sibling ALPH chunk; lossless (VP8L) embeds it.
  alph?: Uint8Array;
}

function extractFrameChunk(webp: Uint8Array): FrameChunk {
  if (readFourCC(webp, 0) !== 'RIFF' || readFourCC(webp, 8) !== 'WEBP') {
    throw new Error('encodeAnimatedWebp: encoder returned non-WebP bytes');
  }
  let alph: Uint8Array | undefined;
  let image: { fourcc: 'VP8 ' | 'VP8L'; payload: Uint8Array } | undefined;
  let off = 12;
  while (off + 8 <= webp.length) {
    const tag = readFourCC(webp, off);
    const size = readU32LE(webp, off + 4);
    const dataOff = off + 8;
    if (tag === 'ALPH') {
      alph = webp.subarray(dataOff, dataOff + size);
    } else if (tag === 'VP8 ' || tag === 'VP8L') {
      image = { fourcc: tag, payload: webp.subarray(dataOff, dataOff + size) };
    }
    off = dataOff + size + (size & 1);
  }
  if (!image) {
    throw new Error('encodeAnimatedWebp: VP8/VP8L chunk missing in encoded frame');
  }
  return { ...image, alph };
}

function buildAnimatedWebp(
  frames: FrameChunk[],
  delaysMs: number[],
  width: number,
  height: number,
): Uint8Array {
  // Pad each payload to even length so every ANMF chunk lands on a word
  // boundary — the spec requires it, and computing it inline avoids a
  // separate "did the previous chunk need a tail byte" pass at write time.
  const padPayload = (buf: Uint8Array) => {
    const len = buf.length;
    if (len & 1) {
      const p = new Uint8Array(len + 1);
      p.set(buf);
      return { padded: p, size: len };
    }
    return { padded: buf, size: len };
  };
  const padded = frames.map((f) => ({
    fourcc: f.fourcc,
    image: padPayload(f.payload),
    alph: f.alph ? padPayload(f.alph) : undefined,
  }));

  const hasAlpha = padded.some((f) => f.alph !== undefined) || padded.some((f) => f.fourcc === 'VP8L');

  // Body = 'WEBP' + VP8X chunk + ANIM chunk + ANMF chunks. Each ANMF body is
  // the 16-byte frame header + optional ALPH sub-chunk (lossy alpha) + the
  // image sub-chunk (VP8 / VP8L) + padded payloads.
  let bodySize = 4;
  bodySize += 8 + 10;
  bodySize += 8 + 6;
  for (const f of padded) {
    bodySize += 8 + 16 + 8 + f.image.padded.length;
    if (f.alph) bodySize += 8 + f.alph.padded.length;
  }

  const out = new Uint8Array(8 + bodySize);
  let off = 0;
  writeFourCC(out, off, 'RIFF');
  off += 4;
  writeU32LE(out, off, bodySize);
  off += 4;
  writeFourCC(out, off, 'WEBP');
  off += 4;

  // VP8X — animation flag (bit 6, MSB-first within byte 0) plus the alpha
  // flag (bit 3) when any frame carries alpha. Decoders rely on this hint to
  // composite frames with transparency instead of treating them as opaque.
  writeFourCC(out, off, 'VP8X');
  off += 4;
  writeU32LE(out, off, 10);
  off += 4;
  out[off++] = 0x02 | (hasAlpha ? 0x10 : 0);
  out[off++] = 0;
  out[off++] = 0;
  out[off++] = 0;
  writeU24LE(out, off, width - 1);
  off += 3;
  writeU24LE(out, off, height - 1);
  off += 3;

  // ANIM — background BGRA = 0 (transparent), loop count = 0 (infinite).
  writeFourCC(out, off, 'ANIM');
  off += 4;
  writeU32LE(out, off, 6);
  off += 4;
  writeU32LE(out, off, 0);
  off += 4;
  out[off++] = 0;
  out[off++] = 0;

  for (let i = 0; i < padded.length; i++) {
    const f = padded[i]!;
    const delay = Math.max(1, Math.min(0xffffff, Math.round(delaysMs[i] ?? 100)));
    let anmfDataSize = 16 + 8 + f.image.padded.length;
    if (f.alph) anmfDataSize += 8 + f.alph.padded.length;
    writeFourCC(out, off, 'ANMF');
    off += 4;
    writeU32LE(out, off, anmfDataSize);
    off += 4;
    // Frame header: x/2, y/2, width-1, height-1, duration, flags.
    writeU24LE(out, off, 0);
    off += 3;
    writeU24LE(out, off, 0);
    off += 3;
    writeU24LE(out, off, width - 1);
    off += 3;
    writeU24LE(out, off, height - 1);
    off += 3;
    writeU24LE(out, off, delay);
    off += 3;
    // Flags byte: bit 6 (B) = no-blend, bit 7 (D) = dispose-to-background.
    // Each chair frame is a complete rendering, so alpha-blending on top of
    // the previous frame would leave ghost pixels where this frame is
    // transparent but the previous frame wasn't.
    out[off++] = 0x03;
    // Lossy-alpha frames carry ALPH before VP8; lossless (VP8L) skips it.
    if (f.alph) {
      writeFourCC(out, off, 'ALPH');
      off += 4;
      writeU32LE(out, off, f.alph.size);
      off += 4;
      out.set(f.alph.padded, off);
      off += f.alph.padded.length;
    }
    writeFourCC(out, off, f.fourcc);
    off += 4;
    writeU32LE(out, off, f.image.size);
    off += 4;
    out.set(f.image.padded, off);
    off += f.image.padded.length;
  }

  return out;
}

function makeNodeStub(width: number, height: number): Uint8Array {
  const out = new Uint8Array(12 + 18);
  writeFourCC(out, 0, 'RIFF');
  writeU32LE(out, 4, out.length - 8);
  writeFourCC(out, 8, 'WEBP');
  writeFourCC(out, 12, 'VP8X');
  writeU32LE(out, 16, 10);
  out[20] = 0x02;
  writeU24LE(out, 24, width - 1);
  writeU24LE(out, 27, height - 1);
  return out;
}

function readFourCC(b: Uint8Array, off: number): string {
  return String.fromCharCode(b[off]!, b[off + 1]!, b[off + 2]!, b[off + 3]!);
}

function writeFourCC(b: Uint8Array, off: number, fourcc: string): void {
  b[off] = fourcc.charCodeAt(0);
  b[off + 1] = fourcc.charCodeAt(1);
  b[off + 2] = fourcc.charCodeAt(2);
  b[off + 3] = fourcc.charCodeAt(3);
}

function readU32LE(b: Uint8Array, off: number): number {
  return (b[off]! | (b[off + 1]! << 8) | (b[off + 2]! << 16) | (b[off + 3]! << 24)) >>> 0;
}

function writeU32LE(b: Uint8Array, off: number, v: number): void {
  b[off] = v & 0xff;
  b[off + 1] = (v >>> 8) & 0xff;
  b[off + 2] = (v >>> 16) & 0xff;
  b[off + 3] = (v >>> 24) & 0xff;
}

function writeU24LE(b: Uint8Array, off: number, v: number): void {
  b[off] = v & 0xff;
  b[off + 1] = (v >>> 8) & 0xff;
  b[off + 2] = (v >>> 16) & 0xff;
}
