import type { WzVersion } from '../types';
import { Reader } from '../io/Reader';
import { getKeystream } from '../crypto/keystream';
import { readHeader, type WzHeader } from './header';
import { computeVersionHash, findVersionCandidates } from './versionHash';
import { readDirectory, type WzDirEntry, type WzDirNode, type WzImageNode } from './directory';
import { readImage, type ParsedImage } from '../img/readImage';

export interface OpenFileOptions {
  version: WzVersion;
  /** Logical name (e.g. "Map.wz"). Used as the root's display name. */
  name?: string;
  /**
   * If provided, skip brute-forcing the MapleStory patch version and use
   * this one directly. Useful when many files in the same dataset share a
   * version (typical for MapleRoyals v83).
   */
  mapleVersion?: number;
}

export interface WzFile {
  readonly name: string;
  readonly version: WzVersion;
  readonly mapleVersion: number;
  readonly header: WzHeader;
  readonly root: WzDirNode;
  readonly bytes: Uint8Array;
  readonly versionHash: number;
  /** AES keystream applicable to this file's version. */
  readonly keystream: Uint8Array;

  /** Walk the directory tree. Segments are path parts after the file root. */
  resolve(segments: readonly string[]): WzDirEntry | null;
  /**
   * Lazily parse and memoise the image at `segments`. Returns null if the
   * path doesn't terminate at an image. The returned tree is the same
   * object across calls (no double-parse).
   */
  readImage(segments: readonly string[]): ParsedImage | null;
  /** Drop the cached parsed-image tree for `segments`, freeing memory. */
  evict(segments: readonly string[]): void;
}

/**
 * Parse a WZ file's header + directory tree and return an opened-file handle.
 *
 * The header and directory are eagerly materialised (cheap — a few MB of
 * metadata even for Map.wz). Image bodies are parsed lazily on first call to
 * `readImage(path)` and memoised.
 */
export async function openFile(bytes: Uint8Array, options: OpenFileOptions): Promise<WzFile> {
  const { version, name = '', mapleVersion: pinnedVersion } = options;
  const header = readHeader(new Reader(bytes));
  const keystream = await getKeystream(version, 256 * 1024);

  const { mapleVersion, hash } =
    pinnedVersion !== undefined
      ? { mapleVersion: pinnedVersion, hash: computeVersionHash(pinnedVersion).hash }
      : detectMapleVersion(bytes, header, keystream);

  const root = readDirectory({
    reader: new Reader(bytes, header.dataStart + 2),
    header,
    versionHash: hash,
    keystream,
    name,
  });

  const imageCache = new Map<string, ParsedImage>();

  const file: WzFile = {
    name,
    version,
    mapleVersion,
    header,
    root,
    bytes,
    versionHash: hash,
    keystream,
    resolve(segments) {
      return walkSegments(root, segments);
    },
    readImage(segments) {
      const node = walkSegments(root, segments);
      if (!node || node.kind !== 'image') return null;
      const key = segments.join('/');
      const cached = imageCache.get(key);
      if (cached) return cached;
      const img = node as WzImageNode;
      const parsed = readImage({
        reader: new Reader(bytes, img.offset),
        imageOffset: img.offset,
        keystream,
      });
      imageCache.set(key, parsed);
      return parsed;
    },
    evict(segments) {
      imageCache.delete(segments.join('/'));
    },
  };

  return file;
}

function walkSegments(root: WzDirNode, segments: readonly string[]): WzDirEntry | null {
  let current: WzDirEntry = root;
  for (const seg of segments) {
    if (current.kind !== 'dir') return null;
    const next = (current as WzDirNode).children.find((c) => c.name === seg);
    if (!next) return null;
    current = next;
  }
  return current;
}

/**
 * Find a MapleStory patch version whose hash matches the encVersion in the
 * header AND yields a sane root directory. Tries the canonical MapleRoyals
 * patch (v83) first because most fixtures we see are that version.
 */
function detectMapleVersion(
  bytes: Uint8Array,
  header: WzHeader,
  keystream: Uint8Array,
): { mapleVersion: number; hash: number } {
  const candidates = findVersionCandidates(header.encVersion, 1000);
  // Reorder so v83 is tried first.
  const prioritized = [
    ...candidates.filter((c) => c.mapleVersion === 83),
    ...candidates.filter((c) => c.mapleVersion !== 83),
  ];
  for (const cand of prioritized) {
    try {
      const probe = readDirectory({
        reader: new Reader(bytes, header.dataStart + 2),
        header,
        versionHash: cand.hash,
        keystream,
      });
      if (probe.children.length > 0) {
        return { mapleVersion: cand.mapleVersion, hash: cand.hash };
      }
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    `could not find a patch version whose hash matches encVersion=${header.encVersion}`,
  );
}
