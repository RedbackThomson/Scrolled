import type { Reader } from '../io/Reader';

export const WZ_IDENT = 'PKG1';

export interface WzHeader {
  /** Always `"PKG1"`. */
  ident: string;
  /** File size declared in the header (excludes the header itself). */
  fileSize: bigint;
  /** Absolute offset where data (the root directory) starts. */
  dataStart: number;
  /** ASCII copyright string; no trailing null. */
  copyright: string;
  /** Encrypted version number stored right at `dataStart`. */
  encVersion: number;
}

/**
 * Read a WZ file header and the immediately-following encVersion word.
 *
 * Layout:
 *   off  0..3    ident ("PKG1")
 *   off  4..11   fileSize (uint64 LE)
 *   off 12..15   dataStart (uint32 LE)
 *   off 16..(dataStart-1)
 *                copyright (ASCII, `dataStart - 17` bytes) + null terminator + padding
 *   off dataStart..(dataStart+1)
 *                encVersion (uint16 LE)
 *
 * Advances `r.position` to `dataStart + 2`.
 */
export function readHeader(r: Reader): WzHeader {
  const ident = r.readAscii(4);
  if (ident !== WZ_IDENT) {
    throw new Error(`not a WZ file: expected magic "PKG1", got ${JSON.stringify(ident)}`);
  }
  const fileSize = r.readUInt64LE();
  const dataStart = r.readUInt32LE();
  const copyrightLen = dataStart - 17;
  if (copyrightLen < 0) {
    throw new Error(`invalid dataStart=${dataStart}; would yield negative copyright length`);
  }
  const copyright = r.readAscii(copyrightLen);
  // Skip the null terminator + any padding up to dataStart.
  r.seek(dataStart);
  const encVersion = r.readUInt16LE();
  return { ident, fileSize, dataStart, copyright, encVersion };
}
