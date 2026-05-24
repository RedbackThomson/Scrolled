// Public types for the parser layer.
//
// These types cross the worker → main-thread boundary, so everything here
// must be structurally cloneable. Do not put class instances or WZ-library
// objects in these types.

export type WzNodeKind = 'file' | 'directory' | 'image' | 'property';

export type WzPropertyKind =
  | 'string'
  | 'int'
  | 'long'
  | 'short'
  | 'float'
  | 'double'
  | 'vector'
  | 'canvas'
  | 'sub'
  | 'uol'
  | 'binary'
  | 'lua'
  | 'null'
  | 'convex'
  | 'unknown';

export interface WzNodeInfo {
  /** Display name of this node (last path segment). */
  name: string;
  /** Slash-separated path from the root, e.g. "Item.wz/Use/0200" or "0200.img/info/icon". */
  fullPath: string;
  kind: WzNodeKind;
  /** For `kind === 'property'`, the specific property type. */
  propertyKind?: WzPropertyKind;
  /** Whether this node has children that can be listed. */
  hasChildren: boolean;
  /** Best-effort scalar value for primitive properties (strings, numbers). */
  scalar?: string | number | null;
}

/**
 * A `WzNodeInfo` plus its recursive children, returned from
 * `readImageTree`. Always structured-cloneable.
 *
 * `children` is always an array — empty when the node is a leaf, has no
 * children at all, or was reached at `maxDepth` and not walked further.
 */
export interface WzNodeTree extends WzNodeInfo {
  children: WzNodeTree[];
}

export type WzMapleVersionName = 'BMS' | 'GMS' | 'EMS' | 'CLASSIC';

export interface LoadFileSpec {
  /** Logical name (e.g. "String.wz"). Used as the root segment of paths. */
  name: string;
  /** Browser path: pass a File. Node path: pass an absolute filepath string. */
  source: File | string;
}

/**
 * Boundary contract for the parser layer. Implementations may run in the main
 * thread (Node/tests) or in a Web Worker (browser, via comlink).
 */
export interface GameDataSource {
  init(version: WzMapleVersionName): Promise<void>;
  load(files: LoadFileSpec[], onProgress?: ProgressFn): Promise<LoadResult>;
  /** Get info for a single node by path. Returns null if not found. */
  getNode(path: string): Promise<WzNodeInfo | null>;
  /** List the immediate children of a node. */
  listChildren(path: string): Promise<WzNodeInfo[]>;
  /**
   * Fetch a `WzImage`'s parsed property tree in one mutex acquisition.
   *
   * Use this when an extractor needs to read many properties from a
   * single image — e.g. a map's `info`/`life`/`portal` subtrees. After
   * `parseImage` runs, the property tree is fully in memory; walking it
   * via `getNode(...)` per leaf re-acquires the per-file lock and
   * re-resolves the path on every call. `readImageTree` walks it once
   * inside the lock and returns a structured tree the caller can iterate
   * with no further awaits.
   *
   * @param path must point at a `WzImage` (e.g. `Map.wz/Map/Map0/100000000.img`).
   *             Returns `null` if the path doesn't resolve, doesn't point
   *             at an image, or the image fails to parse.
   * @param opts.subtrees restricts the depth-1 children expanded — useful
   *             for maps where we want `info`/`life`/`portal` but not
   *             `back`/`foothold`/`ladderRope`.
   * @param opts.maxDepth caps recursion depth from the image (default 4).
   *             Depth 0 is the image, depth 1 is its top-level subtrees,
   *             depth 2 is their children, etc.
   */
  readImageTree(
    path: string,
    opts?: { subtrees?: string[]; maxDepth?: number },
  ): Promise<WzNodeTree | null>;
  /** List the loaded top-level files. */
  listFiles(): Promise<WzNodeInfo[]>;
  /**
   * Decode a `WzCanvasProperty` / `WzPngProperty` node to PNG bytes. Returns
   * null if the path doesn't resolve, doesn't point to a canvas, or decoding
   * fails. The main thread wraps the bytes in a Blob to make an object URL.
   */
  getIconPng(path: string): Promise<Uint8Array | null>;
  /** Diagnostics for bug reports. */
  diagnose(): Promise<Diagnostics>;
  dispose(): Promise<void>;
}

export interface LoadResult {
  loaded: { name: string; rootDirectories: string[] }[];
  errors: { name: string; message: string }[];
}

import type { LogEntry } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';

/**
 * Snapshot of the parser-side log buffer and a synchronous smoke test of the
 * AES path. Surfaced via `GameDataSource.diagnose()` so the UI can include it
 * in user-submitted bug reports.
 */
export interface Diagnostics {
  /** Log entries from the Worker (or Node-side data source). */
  log: LogEntry[];
  /**
   * Result of a 32-byte zero-key `aesCreate` call. If `ok` is false, image
   * decryption is broken — likely the WASM init/crypto patch didn't fully
   * succeed.
   */
  aesSmokeTest: { ok: true } | { ok: false; error: string };
  /** Files currently held open by the parser. */
  loadedFiles: { name: string }[];
}
