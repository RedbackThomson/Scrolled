import type { Reader } from '../io/Reader';
import { readWzString } from '../io/wzString';
import { decryptDirectoryOffset } from './offsetCipher';
import type { WzHeader } from './header';

export type WzDirEntryKind = 'dir' | 'image';

export interface WzDirEntry {
  kind: WzDirEntryKind;
  name: string;
  /** Compressed-int "blockSize" written in the entry header. */
  fileSize: number;
  /** Compressed-int checksum; 0 means "children not materialised yet" for dirs. */
  checksum: number;
  /** Absolute byte offset where this entry's payload begins. */
  offset: number;
}

export interface WzDirNode extends WzDirEntry {
  kind: 'dir';
  /** Direct children (subdirectories and images). Excludes type-1 "skipped" entries. */
  children: WzDirEntry[];
}

export interface WzImageNode extends WzDirEntry {
  kind: 'image';
}

export interface ReadDirectoryArgs {
  reader: Reader;
  header: WzHeader;
  versionHash: number;
  keystream: Uint8Array;
  name?: string;
}

/**
 * Read the root directory beginning at the reader's current position
 * (typically `header.dataStart + 2` — right after the encVersion uint16).
 *
 * Recursively materialises subdirectory children. Image bodies are NOT
 * parsed here; only the per-image metadata (offset, size, checksum) is
 * recorded so callers can lazily `readImage()` later.
 *
 * Throws if any entry has a type byte outside the 1..4 range (a strong
 * signal the wrong versionHash is being tried).
 */
export function readDirectory(args: ReadDirectoryArgs): WzDirNode {
  const { reader, header, versionHash, keystream } = args;
  return parseDir(reader, header, versionHash, keystream, args.name ?? '', reader.position);
}

function parseDir(
  reader: Reader,
  header: WzHeader,
  versionHash: number,
  keystream: Uint8Array,
  name: string,
  dirOffset: number,
): WzDirNode {
  reader.seek(dirOffset);
  const entryCount = reader.readCompressedInt32();
  if (entryCount < 0 || entryCount > 100_000) {
    throw new Error(`invalid directory entry count ${entryCount}; likely wrong versionHash`);
  }

  const children: WzDirEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    let type = reader.readUInt8();
    let entryName = '';
    let rememberPos = 0;

    switch (type) {
      case 1: {
        // "Skipped" entry — int32, int16, then an encrypted offset (unused).
        reader.readInt32LE();
        reader.readInt16LE();
        // Consume the 4-byte encrypted offset to keep the cursor aligned.
        reader.readUInt32LE();
        continue;
      }
      case 2: {
        // "Retrieve string from offset" — the actual name + override-type
        // live elsewhere in the data section. Read int32 nameOffset,
        // jump there, read type+name, restore position.
        const stringOffset = reader.readInt32LE();
        rememberPos = reader.position;
        reader.seek(header.dataStart + stringOffset);
        type = reader.readUInt8();
        entryName = readWzString(reader, keystream);
        break;
      }
      case 3:
      case 4: {
        entryName = readWzString(reader, keystream);
        rememberPos = reader.position;
        break;
      }
      default:
        throw new Error(`unknown WzDirectory entry type ${type} at offset ${reader.position - 1}`);
    }

    reader.seek(rememberPos);
    const fileSize = reader.readCompressedInt32();
    const checksum = reader.readCompressedInt32();
    const offsetPos = reader.position;
    const encrypted = reader.readUInt32LE();
    const offset = decryptDirectoryOffset(offsetPos, header.dataStart, versionHash, encrypted);

    if (type === 3) {
      children.push({
        kind: 'dir',
        name: entryName,
        fileSize,
        checksum,
        offset,
        children: [],
      } as WzDirNode);
    } else if (type === 4) {
      children.push({ kind: 'image', name: entryName, fileSize, checksum, offset });
    } else {
      throw new Error(`unexpected directory entry type ${type} after string read`);
    }
  }

  // Recursively materialise every sub-directory. @tybys/wz only recurses
  // into entries whose `checksum != 0`, leaving the others lazy (the caller
  // has to invoke `parseDirectory()` on demand) — but our parser is fully
  // eager, so we always descend. Empty sub-directories simply return an
  // empty `children` array.
  for (const child of children) {
    if (child.kind === 'dir') {
      const sub = child as WzDirNode;
      try {
        const parsed = parseDir(reader, header, versionHash, keystream, sub.name, sub.offset);
        sub.children = parsed.children;
      } catch {
        // Directory body is unreadable (truncated dataset, etc.) — leave
        // children empty rather than failing the whole parse.
        sub.children = [];
      }
    }
  }

  return { kind: 'dir', name, fileSize: 0, checksum: 0, offset: dirOffset, children };
}
