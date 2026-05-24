import type { Reader } from '../io/Reader';
import { readWzString } from '../io/wzString';
import { parsePropertyList, type WzProperty } from './property';

export const WZ_IMG_HEADER_WITHOUT_OFFSET = 0x73;
export const WZ_IMG_HEADER_WITH_OFFSET = 0x1b;
export const WZ_IMG_HEADER_LUA = 0x01;

export interface ParsedImage {
  /** Image's absolute file offset (passed in by the caller). */
  offset: number;
  /** Top-level properties. */
  properties: WzProperty[];
  /** True when the image body is a Lua script rather than a property tree. */
  isLua: boolean;
}

export interface ReadImageArgs {
  /** Reader positioned at the image's start offset. */
  reader: Reader;
  /** Absolute file offset where the image begins (used as the base for string-offset references). */
  imageOffset: number;
  /** Precomputed AES keystream. */
  keystream: Uint8Array;
}

/**
 * Parse a WZ image body.
 *
 * The image starts with a single header byte:
 *   - `0x73`  → property tree. Followed by a WZ string ("Property") and a
 *               uint16 (`0`), then the property list.
 *   - `0x01`  → Lua script. Followed by a compressed-int length and that
 *               many encrypted bytes.
 *
 * The caller is responsible for positioning the reader at the image's
 * `offset` first.
 */
export function readImage(args: ReadImageArgs): ParsedImage {
  const { reader, imageOffset, keystream } = args;
  reader.seek(imageOffset);
  const headerByte = reader.readUInt8();
  if (headerByte === WZ_IMG_HEADER_LUA) {
    // Compressed-int length, then `len` encrypted bytes. The Lua source is
    // recovered by XOR-decrypting with the file's WzKey; that's a Stage I+
    // concern. For now, expose the raw bytes verbatim.
    const len = reader.readCompressedInt32();
    const rawBytes = reader.readBytesCopy(len);
    return {
      offset: imageOffset,
      isLua: true,
      properties: [{ type: 'lua', name: 'Script', rawBytes }],
    };
  }
  if (headerByte !== WZ_IMG_HEADER_WITHOUT_OFFSET) {
    throw new Error(
      `unknown image header byte 0x${headerByte.toString(16)} at ${imageOffset}`,
    );
  }
  const propTag = readWzString(reader, keystream);
  const reserved = reader.readUInt16LE();
  if (propTag !== 'Property' || reserved !== 0) {
    throw new Error(
      `image header mismatch: tag=${JSON.stringify(propTag)} reserved=${reserved}`,
    );
  }
  const properties = parsePropertyList({ reader, imageOffset, keystream });
  return { offset: imageOffset, isLua: false, properties };
}
