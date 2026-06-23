// Animated PNG (APNG) encoder.
//
// Pure JS, identical in the browser worker and the headless CLI — no Canvas,
// no native/WASM dependency. APNG plays natively inside an `<img>` on every
// modern browser, so the wiki shows the chair animation with no canvas loop.
//
// Layout (see the APNG spec linked in docs/format_sources.md):
//   signature · IHDR · acTL · (fcTL · IDAT|fdAT)[] · IEND
// Every frame is full-canvas — the caller normalizes all frames to one shared
// size before calling — so each frame's region is the whole image at offset
// (0,0). Frames dispose-to-background and replace (no blend) so a transparent
// region never ghosts the previous frame.

import { zlibSync } from 'fflate';
import { PNG_SIGNATURE, filterRows, makeChunk } from './pngChunks';

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

const APNG_DISPOSE_OP_BACKGROUND = 1;
const APNG_BLEND_OP_SOURCE = 0;

export function encodeAnimatedPng(frames: AnimFrame[]): EncodedAnimation {
  if (frames.length === 0) throw new Error('encodeAnimatedPng: no frames');
  const width = frames[0]!.width;
  const height = frames[0]!.height;
  for (const f of frames) {
    if (f.width !== width || f.height !== height) {
      throw new Error('encodeAnimatedPng: frames must share canvas size');
    }
  }

  const pieces: Uint8Array[] = [PNG_SIGNATURE, makeChunk('IHDR', ihdr(width, height))];
  pieces.push(makeChunk('acTL', actl(frames.length)));

  // Sequence numbers run in order across every fcTL and fdAT; frame 0's pixels
  // ride in an IDAT, which carries no sequence number.
  let seq = 0;
  frames.forEach((frame, i) => {
    pieces.push(makeChunk('fcTL', fctl(seq++, width, height, frame.delayMs)));
    const compressed = zlibSync(filterRows(frame.rgba, width, height));
    if (i === 0) {
      pieces.push(makeChunk('IDAT', compressed));
    } else {
      const fdat = new Uint8Array(4 + compressed.length);
      new DataView(fdat.buffer).setUint32(0, seq++);
      fdat.set(compressed, 4);
      pieces.push(makeChunk('fdAT', fdat));
    }
  });

  pieces.push(makeChunk('IEND', new Uint8Array(0)));
  return { data: concat(pieces), width, height };
}

function ihdr(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  data[8] = 8; // bit depth
  data[9] = 6; // color type: RGBA
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  return data;
}

function actl(numFrames: number): Uint8Array {
  const data = new Uint8Array(8);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, numFrames);
  dv.setUint32(4, 0); // num_plays: 0 = loop forever
  return data;
}

function fctl(seq: number, width: number, height: number, delayMs: number): Uint8Array {
  const data = new Uint8Array(26);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, seq);
  dv.setUint32(4, width);
  dv.setUint32(8, height);
  dv.setUint32(12, 0); // x_offset
  dv.setUint32(16, 0); // y_offset
  // delay = delay_num / delay_den seconds. delay_num is u16; clamp away 0 (which
  // means "render as fast as possible") and the upper bound.
  dv.setUint16(20, Math.max(1, Math.min(0xffff, Math.round(delayMs))));
  dv.setUint16(22, 1000); // delay_den (milliseconds)
  data[24] = APNG_DISPOSE_OP_BACKGROUND;
  data[25] = APNG_BLEND_OP_SOURCE;
  return data;
}

function concat(pieces: Uint8Array[]): Uint8Array {
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
