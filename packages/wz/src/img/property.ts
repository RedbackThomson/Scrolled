import type { Reader } from '../io/Reader';
import { readWzString, readWzStringAtOffset } from '../io/wzString';

export type WzPropertyType =
  | 'null'
  | 'short'
  | 'int'
  | 'long'
  | 'float'
  | 'double'
  | 'string'
  | 'sub'
  | 'canvas'
  | 'vector'
  | 'convex'
  | 'uol'
  | 'sound'
  | 'lua'
  | 'unknown';

interface WzPropertyBase {
  name: string;
  type: WzPropertyType;
}

export interface WzNullProperty extends WzPropertyBase {
  type: 'null';
}
export interface WzShortProperty extends WzPropertyBase {
  type: 'short';
  value: number;
}
export interface WzIntProperty extends WzPropertyBase {
  type: 'int';
  value: number;
}
export interface WzLongProperty extends WzPropertyBase {
  type: 'long';
  value: bigint;
}
export interface WzFloatProperty extends WzPropertyBase {
  type: 'float';
  value: number;
}
export interface WzDoubleProperty extends WzPropertyBase {
  type: 'double';
  value: number;
}
export interface WzStringProperty extends WzPropertyBase {
  type: 'string';
  value: string;
}
export interface WzSubProperty extends WzPropertyBase {
  type: 'sub';
  children: WzProperty[];
}
export interface WzVectorProperty extends WzPropertyBase {
  type: 'vector';
  x: number;
  y: number;
}
export interface WzConvexProperty extends WzPropertyBase {
  type: 'convex';
  children: WzProperty[];
}
export interface WzUolProperty extends WzPropertyBase {
  type: 'uol';
  target: string;
}
export interface WzCanvasProperty extends WzPropertyBase {
  type: 'canvas';
  width: number;
  height: number;
  format1: number;
  format2: number;
  /** Absolute file offset where the length-prefixed canvas payload begins. */
  dataOffset: number;
  /** Total bytes from `dataOffset` covering the int32 length prefix + payload. */
  dataLength: number;
  /** Children embedded in the canvas header (rare; usually empty). */
  children: WzProperty[];
}
export interface WzSoundProperty extends WzPropertyBase {
  type: 'sound';
  /** Absolute file offset to the WAV/MP3 header. */
  headerOffset: number;
  headerLength: number;
  /** Absolute file offset to the raw audio bytes. */
  dataOffset: number;
  dataLength: number;
  /** Sound length in ms. */
  durationMs: number;
}
export interface WzLuaProperty extends WzPropertyBase {
  type: 'lua';
  /** Raw encrypted Lua bytes (XOR-decrypt with the file key to obtain source). */
  rawBytes: Uint8Array;
}

export type WzProperty =
  | WzNullProperty
  | WzShortProperty
  | WzIntProperty
  | WzLongProperty
  | WzFloatProperty
  | WzDoubleProperty
  | WzStringProperty
  | WzSubProperty
  | WzVectorProperty
  | WzConvexProperty
  | WzUolProperty
  | WzCanvasProperty
  | WzSoundProperty
  | WzLuaProperty;

const SOUND_HEADER_LEN = 51;

export interface ParsePropsArgs {
  /** Reader positioned at the start of the property list (entryCount compressed int). */
  reader: Reader;
  /** Absolute file offset of the parent image's start (`imgEntry.offset`). */
  imageOffset: number;
  /** Precomputed AES keystream for the file's version. */
  keystream: Uint8Array;
}

/**
 * Parse a "string block" — a single tagged string that is either inline or
 * referenced by offset into the image's string table.
 */
export function readStringBlock(args: ParsePropsArgs): string {
  const { reader, imageOffset, keystream } = args;
  const tag = reader.readUInt8();
  switch (tag) {
    case 0x00:
    case 0x73:
      return readWzString(reader, keystream);
    case 0x01:
    case 0x1b: {
      const offset = reader.readInt32LE();
      return readWzStringAtOffset(reader, imageOffset, offset, keystream);
    }
    default:
      return '';
  }
}

/** Parse a flat list of properties (the body inside an image or a `Property` sub). */
export function parsePropertyList(args: ParsePropsArgs): WzProperty[] {
  const { reader } = args;
  const entryCount = reader.readCompressedInt32();
  if (entryCount < 0 || entryCount > 1_000_000) {
    throw new Error(`invalid property entry count ${entryCount} at ${reader.position}`);
  }
  const out: WzProperty[] = new Array(entryCount);
  for (let i = 0; i < entryCount; i++) {
    const name = readStringBlock(args);
    const ptype = reader.readUInt8();
    out[i] = parseProperty(args, name, ptype);
  }
  return out;
}

function parseProperty(args: ParsePropsArgs, name: string, ptype: number): WzProperty {
  const { reader } = args;
  switch (ptype) {
    case 0:
      return { type: 'null', name };
    case 2:
    case 11:
      return { type: 'short', name, value: reader.readInt16LE() };
    case 3:
    case 19:
      return { type: 'int', name, value: reader.readCompressedInt32() };
    case 20:
      return { type: 'long', name, value: reader.readCompressedInt64() };
    case 4: {
      const t = reader.readUInt8();
      if (t === 0x80) return { type: 'float', name, value: reader.readFloat32LE() };
      if (t === 0) return { type: 'float', name, value: 0 };
      throw new Error(`unknown float subtype 0x${t.toString(16)} at ${reader.position - 1}`);
    }
    case 5:
      return { type: 'double', name, value: reader.readFloat64LE() };
    case 8:
      return { type: 'string', name, value: readStringBlock(args) };
    case 9: {
      const blockSize = reader.readUInt32LE();
      const endOfBlock = reader.position + blockSize;
      const prop = parseExtendedProperty(args, name);
      // Some extended types (canvas) leave the cursor at a known good
      // position; others (sub, convex) consume the full block. Snap to
      // end-of-block to keep the parent loop aligned.
      reader.seek(endOfBlock);
      return prop;
    }
    default:
      throw new Error(`unknown property type ${ptype} at ${reader.position - 1}`);
  }
}

function parseExtendedProperty(args: ParsePropsArgs, name: string): WzProperty {
  const { reader, imageOffset, keystream } = args;
  const discriminator = reader.readUInt8();
  let iname: string;
  switch (discriminator) {
    case 0x00:
    case 0x73:
      iname = readWzString(reader, keystream);
      break;
    case 0x01:
    case 0x1b: {
      const offset = reader.readInt32LE();
      iname = readWzStringAtOffset(reader, imageOffset, offset, keystream);
      break;
    }
    default:
      throw new Error(
        `invalid extended-property discriminator 0x${discriminator.toString(16)} at ${reader.position - 1}`,
      );
  }

  switch (iname) {
    case 'Property': {
      // Two reserved bytes, then a property list.
      reader.skip(2);
      const children = parsePropertyList(args);
      return { type: 'sub', name, children };
    }
    case 'Canvas': {
      reader.skip(1);
      const flag = reader.readUInt8();
      let children: WzProperty[] = [];
      if (flag === 1) {
        reader.skip(2);
        children = parsePropertyList(args);
      }
      const width = reader.readCompressedInt32();
      const height = reader.readCompressedInt32();
      const format1 = reader.readCompressedInt32();
      const format2 = reader.readUInt8();
      reader.skip(4);
      const dataOffset = reader.position;
      const rawLen = reader.readInt32LE();
      // Total bytes from dataOffset: 4 (int32) + rawLen. We skip the 1 padding
      // byte and the rawLen-1 payload bytes in @tybys/wz's convention.
      reader.skip(1);
      reader.skip(rawLen - 1);
      const dataLength = 4 + rawLen;
      return {
        type: 'canvas',
        name,
        width,
        height,
        format1,
        format2,
        dataOffset,
        dataLength,
        children,
      };
    }
    case 'Shape2D#Vector2D': {
      const x = reader.readCompressedInt32();
      const y = reader.readCompressedInt32();
      return { type: 'vector', name, x, y };
    }
    case 'Shape2D#Convex2D': {
      const count = reader.readCompressedInt32();
      const children: WzProperty[] = new Array(count);
      for (let i = 0; i < count; i++) {
        children[i] = parseExtendedProperty(args, name);
      }
      return { type: 'convex', name, children };
    }
    case 'Sound_DX8': {
      reader.skip(1);
      const soundDataLen = reader.readCompressedInt32();
      const durationMs = reader.readCompressedInt32();
      const headerOffset = reader.position;
      reader.skip(SOUND_HEADER_LEN);
      const wavFormatLen = reader.readUInt8();
      const headerLength = SOUND_HEADER_LEN + 1 + wavFormatLen;
      // Restore to start of header so we can skip the full header in one go.
      reader.seek(headerOffset + headerLength);
      const dataOffset = reader.position;
      reader.skip(soundDataLen);
      return {
        type: 'sound',
        name,
        headerOffset,
        headerLength,
        dataOffset,
        dataLength: soundDataLen,
        durationMs,
      };
    }
    case 'UOL': {
      reader.skip(1);
      const t = reader.readUInt8();
      if (t === 0) return { type: 'uol', name, target: readWzString(reader, keystream) };
      if (t === 1) {
        const offset = reader.readInt32LE();
        return {
          type: 'uol',
          name,
          target: readWzStringAtOffset(reader, imageOffset, offset, keystream),
        };
      }
      throw new Error(`unknown UOL subtype ${t} at ${reader.position - 1}`);
    }
    default:
      throw new Error(`unknown extended property type "${iname}" at ${reader.position}`);
  }
}
