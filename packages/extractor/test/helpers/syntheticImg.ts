// Serializes a property tree into a standalone `.img` byte buffer — the exact
// layout `@scrolled/wz`'s `readImage` expects: header byte 0x73, the WZ-string
// "Property", a uint16 0, then a property list. Used to build fixtures for the
// IMG data source without any real game data.

import { deflateSync } from 'node:zlib';
// Node's File (unlike jsdom's) implements `stream()`/`arrayBuffer()`, which
// `toBytes` needs. The shapes are compatible enough to stand in for a DOM File.
import { File as NodeFile } from 'node:buffer';
import { encodeWzAsciiString } from '@scrolled/wz';

export type SynProp =
  | { type: 'null'; name: string }
  | { type: 'int'; name: string; value: number }
  | { type: 'string'; name: string; value: string }
  | { type: 'vector'; name: string; x: number; y: number }
  | { type: 'uol'; name: string; target: string }
  | { type: 'sub'; name: string; children: SynProp[] }
  | {
      type: 'canvas';
      name: string;
      width: number;
      height: number;
      /** Raw BGRA8888 pixels, `width * height * 4` bytes. */
      bgra: Uint8Array;
    };

function pushInt32LE(out: number[], v: number): void {
  out.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
}

function pushCompressedInt(out: number[], v: number): void {
  if (v >= -127 && v <= 127) out.push(v & 0xff);
  else {
    out.push(0x80);
    pushInt32LE(out, v);
  }
}

/** WZ ASCII string: int8 length sentinel (`-len`, or `-128` + int32), then bytes. */
function pushWzString(out: number[], s: string, keystream: Uint8Array): void {
  if (s.length === 0) {
    out.push(0);
    return;
  }
  if (s.length < 128) out.push((0x100 - s.length) & 0xff);
  else {
    out.push(0x80);
    pushInt32LE(out, s.length);
  }
  for (const b of encodeWzAsciiString(s, keystream)) out.push(b);
}

/** A "string block": inline tag (0x00) followed by a WZ string. */
function pushStringBlock(out: number[], s: string, keystream: Uint8Array): void {
  out.push(0x00);
  pushWzString(out, s, keystream);
}

function pushExtended(out: number[], iname: string, body: number[], keystream: Uint8Array): void {
  out.push(0x09); // extended-property type byte
  const ext: number[] = [];
  ext.push(0x73); // inline name discriminator
  pushWzString(ext, iname, keystream);
  for (const b of body) ext.push(b);
  pushInt32LE(out, ext.length); // blockSize
  for (const b of ext) out.push(b);
}

function pushProperty(out: number[], p: SynProp, keystream: Uint8Array): void {
  pushStringBlock(out, p.name, keystream);
  switch (p.type) {
    case 'null':
      out.push(0);
      return;
    case 'int':
      out.push(3);
      pushCompressedInt(out, p.value);
      return;
    case 'string':
      out.push(8);
      pushStringBlock(out, p.value, keystream);
      return;
    case 'vector': {
      const body: number[] = [];
      pushCompressedInt(body, p.x);
      pushCompressedInt(body, p.y);
      pushExtended(out, 'Shape2D#Vector2D', body, keystream);
      return;
    }
    case 'uol': {
      const body: number[] = [0x00, 0x00]; // skip(1) byte, then subtype 0 (inline)
      pushWzString(body, p.target, keystream);
      pushExtended(out, 'UOL', body, keystream);
      return;
    }
    case 'sub': {
      const body: number[] = [0x00, 0x00]; // 2 reserved bytes
      pushPropertyList(body, p.children, keystream);
      pushExtended(out, 'Property', body, keystream);
      return;
    }
    case 'canvas': {
      const payload = deflateSync(Buffer.from(p.bgra));
      const body: number[] = [];
      body.push(0x00); // skip(1)
      body.push(0x00); // flag = 0 (no embedded children)
      pushCompressedInt(body, p.width);
      pushCompressedInt(body, p.height);
      pushCompressedInt(body, 1); // format1
      body.push(1); // format2 → format1+format2 = 2 (BGRA8888)
      body.push(0, 0, 0, 0); // skip(4)
      const rawLen = payload.length + 1;
      pushInt32LE(body, rawLen);
      body.push(0x00); // 1 pad byte
      for (const b of payload) body.push(b);
      pushExtended(out, 'Canvas', body, keystream);
      return;
    }
  }
}

function pushPropertyList(out: number[], props: SynProp[], keystream: Uint8Array): void {
  pushCompressedInt(out, props.length);
  for (const p of props) pushProperty(out, p, keystream);
}

/** Serialize a top-level property list into a standalone `.img` byte buffer. */
export function buildSyntheticImg(props: SynProp[], keystream: Uint8Array): Uint8Array {
  const out: number[] = [];
  out.push(0x73); // image header: property tree
  pushWzString(out, 'Property', keystream);
  out.push(0x00, 0x00); // reserved uint16 = 0
  pushPropertyList(out, props, keystream);
  return new Uint8Array(out);
}

/** A `File` whose bytes are a synthetic `.img`, for feeding `LoadFileSpec`. */
export function syntheticImgFile(
  relName: string,
  props: SynProp[],
  keystream: Uint8Array,
): File {
  const bytes = buildSyntheticImg(props, keystream);
  return new NodeFile([bytes], relName) as unknown as File;
}
