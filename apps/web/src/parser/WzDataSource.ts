import {
  decodeCanvas,
  openFile,
  resolveUol,
  type WzCanvasProperty,
  type WzDirEntry,
  type WzDirNode,
  type WzFile,
  type WzImageNode,
  type WzProperty,
  type WzVersion,
} from '@mge/wz';
import type {
  Diagnostics,
  GameDataSource,
  LoadFileSpec,
  LoadResult,
  WzMapleVersionName,
  WzNodeInfo,
  WzNodeTree,
} from './types';
import { propertyToNodeInfo } from './nodeInfo';
import { createLogger, describeError, getLogEntries } from '@/lib/logger';
import { ensureWzInit, getAesSmokeTestResult } from './wzInit';
import type { ProgressFn } from '@/lib/progress';

const log = createLogger('wz-data-source');

interface LoadedFile {
  name: string;
  file: WzFile;
}

/**
 * Parser implementation backed by `@mge/wz`. Holds open `WzFile` instances
 * keyed by logical name (e.g. "String.wz", "Item.wz") and resolves paths
 * formatted as `<file>/<segments…>`.
 *
 * No mutex: `@mge/wz`'s `Reader` is structurally cloneable, so concurrent
 * reads against the same file run truly in parallel within one Worker.
 *
 * Path conventions:
 *   - "" or "/" → the source root (list of loaded files)
 *   - "String.wz" → the WzFile root
 *   - "String.wz/Eqp.img" → an image inside the file
 *   - "String.wz/Eqp.img/Eqp/Cap/1002000/name" → a property inside the image
 */
export class WzDataSource implements GameDataSource {
  private version: WzMapleVersionName = 'BMS';
  private readonly files = new Map<string, LoadedFile>();

  async init(version: WzMapleVersionName): Promise<void> {
    log.info('init', { version });
    this.version = version;
    await ensureWzInit(version);
  }

  async load(files: LoadFileSpec[], onProgress?: ProgressFn): Promise<LoadResult> {
    const loaded: LoadResult['loaded'] = [];
    const errors: LoadResult['errors'] = [];

    for (const spec of files) {
      const size = typeof spec.source !== 'string' ? spec.source.size : undefined;
      log.info('loading file', { name: spec.name, size, version: this.version });
      try {
        const bytes = await this.toBytes(spec.source, spec.name, onProgress);
        if (onProgress) {
          onProgress({ phase: `Parsing ${spec.name}`, current: 0, total: 0, detail: 'reading header' });
        }
        const file = await openFile(bytes, {
          version: this.version as WzVersion,
          name: spec.name,
        });
        this.files.set(spec.name, { name: spec.name, file });
        const rootDirectories = file.root.children.map((c) => c.name);
        log.info('file loaded', {
          name: spec.name,
          rootCount: rootDirectories.length,
          rootHead: rootDirectories.slice(0, 5),
        });
        loaded.push({ name: spec.name, rootDirectories });
      } catch (err) {
        log.error('exception during load', { name: spec.name, ...describeError(err) });
        errors.push({ name: spec.name, message: (err as Error).message });
      }
    }

    return { loaded, errors };
  }

  async listFiles(): Promise<WzNodeInfo[]> {
    return [...this.files.values()].map((f) => ({
      name: f.name,
      fullPath: f.name,
      kind: 'file',
      hasChildren: f.file.root.children.length > 0,
    }));
  }

  async getNode(path: string): Promise<WzNodeInfo | null> {
    log.debug('getNode', { path });
    const resolved = this.resolve(path);
    if (!resolved) {
      log.debug('getNode miss', { path });
      return null;
    }
    return resolved.toNodeInfo();
  }

  async listChildren(path: string): Promise<WzNodeInfo[]> {
    log.debug('listChildren', { path });
    if (!path || path === '/') return this.listFiles();
    const resolved = this.resolve(path);
    if (!resolved) return [];
    return resolved.listChildren();
  }

  async readImageTree(
    path: string,
    opts: { subtrees?: string[]; maxDepth?: number } = {},
  ): Promise<WzNodeTree | null> {
    log.debug('readImageTree', { path });
    const resolved = this.resolve(path);
    if (!resolved || resolved.kind !== 'image') {
      log.debug('readImageTree miss or non-image', { path });
      return null;
    }
    const maxDepth = opts.maxDepth ?? 4;
    const topSubtrees = opts.subtrees ? new Set(opts.subtrees) : null;
    return buildSubtree(resolved.props, resolved.fullPath, 0, maxDepth, topSubtrees);
  }

  async getIconPng(path: string): Promise<Uint8Array | null> {
    log.debug('getIconPng', { path });
    const resolved = this.resolve(path);
    if (!resolved) {
      log.debug('getIconPng: path did not resolve', { path });
      return null;
    }
    const canvas = await this.resolveToCanvas(resolved);
    if (!canvas) {
      log.debug('getIconPng: not a canvas-like node', { path });
      return null;
    }
    try {
      const t0 = performance.now();
      const pixels = await decodeCanvas({
        canvas: canvas.canvas,
        fileBytes: canvas.file.bytes,
        keystream: canvas.file.keystream,
      });
      const t1 = performance.now();
      const png = await encodeRgbaToPng(pixels.rgba, pixels.width, pixels.height);
      const t2 = performance.now();
      log.debug('getIconPng ok', {
        bytes: png.byteLength,
        decodeMs: Math.round(t1 - t0),
        encodeMs: Math.round(t2 - t1),
      });
      return png;
    } catch (e) {
      log.warn('getIconPng failed', describeError(e));
      return null;
    }
  }

  async diagnose(): Promise<Diagnostics> {
    return {
      log: getLogEntries(),
      aesSmokeTest: getAesSmokeTestResult(),
      loadedFiles: [...this.files.keys()].map((name) => ({ name })),
    };
  }

  async dispose(): Promise<void> {
    log.info('dispose', { count: this.files.size });
    this.files.clear();
  }

  private async toBytes(
    input: File | string,
    logName: string,
    onProgress?: ProgressFn,
  ): Promise<Uint8Array> {
    if (typeof input === 'string') {
      // Node path (vitest). Use dynamic import to keep this dead code in the browser.
      const { readFile } = await import('node:fs/promises');
      const buf = await readFile(input);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    const started = performance.now();
    const total = input.size;
    let buf: Uint8Array;
    if (typeof input.stream === 'function') {
      const chunks: Uint8Array[] = [];
      let read = 0;
      const reader = input.stream().getReader();
      const phase = `Loading ${logName}`;
      onProgress?.({ phase, current: 0, total });
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          read += value.byteLength;
          onProgress?.({ phase, current: read, total });
        }
      }
      buf = new Uint8Array(read);
      let offset = 0;
      for (const c of chunks) {
        buf.set(c, offset);
        offset += c.byteLength;
      }
    } else {
      buf = new Uint8Array(await input.arrayBuffer());
    }
    log.info('buffered file into memory', {
      name: logName,
      bytes: buf.byteLength,
      ms: Math.round(performance.now() - started),
    });
    return buf;
  }

  private resolve(path: string): ResolvedNode | null {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const [fileName, ...rest] = segments;
    const loaded = this.files.get(fileName!);
    if (!loaded) return null;
    return resolvePath(loaded.file, fileName!, rest);
  }

  /**
   * Walk a resolved node (which may be inside a property tree) toward a
   * canvas. Follows UOLs and "PNG" sub-children to mirror the old
   * `resolveCanvas` helper in icons.ts.
   */
  private async resolveToCanvas(
    resolved: ResolvedNode,
    depth = 0,
  ): Promise<{ file: WzFile; canvas: WzCanvasProperty } | null> {
    if (depth > 4) return null;
    if (resolved.kind !== 'property') return null;
    const p = resolved.prop;
    if (p.type === 'canvas') return { file: resolved.file, canvas: p };
    if (p.type === 'uol') {
      const target = resolveUol(resolved.imageRoot, resolved.imagePath, p.target);
      if (!target) return null;
      const newPath = pathOfResolution(resolved.imagePath, p.target);
      const linked = makeProperty(
        resolved.file,
        target,
        resolved.imageRoot,
        newPath,
        resolved.fullPath,
      );
      return this.resolveToCanvas(linked, depth + 1);
    }
    if (p.type === 'sub' || p.type === 'convex') {
      const pngChild = p.children.find((c) => c.name === 'PNG');
      if (pngChild) {
        const linked = makeProperty(
          resolved.file,
          pngChild,
          resolved.imageRoot,
          [...resolved.imagePath, 'PNG'],
          resolved.fullPath + '/PNG',
        );
        return this.resolveToCanvas(linked, depth + 1);
      }
    }
    return null;
  }
}

// ----------------------------------------------------------------------------
// Path resolution
// ----------------------------------------------------------------------------

type ResolvedNode =
  | { kind: 'file'; file: WzFile; fullPath: string; toNodeInfo(): WzNodeInfo; listChildren(): WzNodeInfo[] }
  | { kind: 'dir'; file: WzFile; dir: WzDirNode; fullPath: string; toNodeInfo(): WzNodeInfo; listChildren(): WzNodeInfo[] }
  | {
      kind: 'image';
      file: WzFile;
      image: WzImageNode;
      props: WzProperty[];
      fullPath: string;
      toNodeInfo(): WzNodeInfo;
      listChildren(): WzNodeInfo[];
    }
  | {
      kind: 'property';
      file: WzFile;
      prop: WzProperty;
      imageRoot: WzProperty[];
      imagePath: string[];
      fullPath: string;
      toNodeInfo(): WzNodeInfo;
      listChildren(): WzNodeInfo[];
    };

function resolvePath(file: WzFile, fileName: string, rest: string[]): ResolvedNode | null {
  if (rest.length === 0) {
    return makeFile(file, fileName);
  }

  // Walk the directory tree until we hit an image or run out of dir segments.
  let dir: WzDirNode = file.root;
  let consumed = 0;
  for (; consumed < rest.length; consumed++) {
    const seg = rest[consumed]!;
    const child = dir.children.find((c) => c.name === seg) as WzDirEntry | undefined;
    if (!child) return null;
    if (child.kind === 'dir') {
      dir = child as WzDirNode;
      continue;
    }
    // It's an image.
    const imagePath = rest.slice(0, consumed + 1);
    const propPath = rest.slice(consumed + 1);
    const parsed = file.readImage(imagePath);
    if (!parsed) return null;
    const fullPath = [fileName, ...imagePath].join('/');
    if (propPath.length === 0) {
      return makeImage(file, child as WzImageNode, parsed.properties, fullPath);
    }
    const found = walkProperties(parsed.properties, propPath);
    if (!found) return null;
    return makeProperty(
      file,
      found.prop,
      parsed.properties,
      propPath.slice(0, found.depth),
      [fileName, ...imagePath, ...propPath.slice(0, found.depth)].join('/'),
    );
  }
  // We consumed all segments and only saw directories.
  return makeDir(file, dir, [fileName, ...rest].join('/'));
}

function walkProperties(
  root: WzProperty[],
  segments: string[],
): { prop: WzProperty; depth: number } | null {
  let level: WzProperty[] = root;
  let current: WzProperty | undefined;
  let depth = 0;
  for (const seg of segments) {
    current = level.find((p) => p.name === seg);
    if (!current) return null;
    depth++;
    if (current.type === 'sub' || current.type === 'convex' || current.type === 'canvas') {
      level = (current as { children: WzProperty[] }).children;
    } else {
      // Leaf — if there are more segments to consume, the path doesn't exist.
      if (depth < segments.length) return null;
      level = [];
    }
  }
  if (!current) return null;
  return { prop: current, depth };
}

function makeFile(file: WzFile, name: string): ResolvedNode {
  return {
    kind: 'file',
    file,
    fullPath: name,
    toNodeInfo: () => ({
      name,
      fullPath: name,
      kind: 'file',
      hasChildren: file.root.children.length > 0,
    }),
    listChildren: () =>
      file.root.children.map((c) => ({
        name: c.name,
        fullPath: `${name}/${c.name}`,
        kind: c.kind === 'dir' ? 'directory' : 'image',
        hasChildren: c.kind === 'dir' ? (c as WzDirNode).children.length > 0 : true,
      })),
  };
}

function makeDir(file: WzFile, dir: WzDirNode, fullPath: string): ResolvedNode {
  return {
    kind: 'dir',
    file,
    dir,
    fullPath,
    toNodeInfo: () => ({
      name: dir.name,
      fullPath,
      kind: 'directory',
      hasChildren: dir.children.length > 0,
    }),
    listChildren: () =>
      dir.children.map((c) => ({
        name: c.name,
        fullPath: `${fullPath}/${c.name}`,
        kind: c.kind === 'dir' ? 'directory' : 'image',
        hasChildren: c.kind === 'dir' ? (c as WzDirNode).children.length > 0 : true,
      })),
  };
}

function makeImage(
  file: WzFile,
  image: WzImageNode,
  props: WzProperty[],
  fullPath: string,
): ResolvedNode {
  return {
    kind: 'image',
    file,
    image,
    props,
    fullPath,
    toNodeInfo: () => ({
      name: image.name,
      fullPath,
      kind: 'image',
      hasChildren: props.length > 0,
    }),
    listChildren: () =>
      props.map((p) => propertyToNodeInfo(p, `${fullPath}/${p.name}`)),
  };
}

function makeProperty(
  file: WzFile,
  prop: WzProperty,
  imageRoot: WzProperty[],
  imagePath: string[],
  fullPath: string,
): ResolvedNode {
  return {
    kind: 'property',
    file,
    prop,
    imageRoot,
    imagePath,
    fullPath,
    toNodeInfo: () => propertyToNodeInfo(prop, fullPath),
    listChildren: () => {
      if (prop.type === 'sub' || prop.type === 'convex' || prop.type === 'canvas') {
        return (prop as { children: WzProperty[] }).children.map((c) =>
          propertyToNodeInfo(c, `${fullPath}/${c.name}`),
        );
      }
      return [];
    },
  };
}

function pathOfResolution(from: string[], target: string): string[] {
  // Apply the UOL target to `from` (which is the path TO the UOL itself).
  const stack = from.slice(0, -1);
  for (const seg of target.split('/').filter(Boolean)) {
    if (seg === '..') stack.pop();
    else stack.push(seg);
  }
  return stack;
}

function buildSubtree(
  props: WzProperty[],
  fullPath: string,
  depth: number,
  maxDepth: number,
  topSubtrees: Set<string> | null,
): WzNodeTree {
  const root: WzNodeTree = {
    name: '',
    fullPath,
    kind: 'image',
    hasChildren: props.length > 0,
    children: [],
  };
  if (depth >= maxDepth) return root;
  for (const child of props) {
    if (depth === 0 && topSubtrees && !topSubtrees.has(child.name)) continue;
    root.children.push(walkProperty(child, `${fullPath}/${child.name}`, depth + 1, maxDepth));
  }
  return root;
}

function walkProperty(
  prop: WzProperty,
  fullPath: string,
  depth: number,
  maxDepth: number,
): WzNodeTree {
  const info = propertyToNodeInfo(prop, fullPath);
  const tree: WzNodeTree = { ...info, children: [] };
  if (depth >= maxDepth) return tree;
  if (prop.type === 'sub' || prop.type === 'convex' || prop.type === 'canvas') {
    for (const child of (prop as { children: WzProperty[] }).children) {
      tree.children.push(walkProperty(child, `${fullPath}/${child.name}`, depth + 1, maxDepth));
    }
  }
  return tree;
}

// ----------------------------------------------------------------------------
// PNG encoding
// ----------------------------------------------------------------------------

/**
 * Encode RGBA8888 pixels as a PNG. Runs in both browser/Worker (OffscreenCanvas)
 * and Node (vitest, where we use `node:zlib` to build a minimal PNG). One
 * synchronous `putImageData` + `convertToBlob` — none of the old per-pixel
 * round-tripping.
 */
async function encodeRgbaToPng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Uint8Array> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
    const ab = new ArrayBuffer(rgba.byteLength);
    new Uint8ClampedArray(ab).set(rgba);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(ab), width, height), 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await blob.arrayBuffer());
  }
  // Node fallback (vitest).
  const { default: zlib } = await import('node:zlib');
  return encodePngNode(rgba, width, height, zlib);
}

type NodeZlib = typeof import('node:zlib');

function encodePngNode(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  zlib: NodeZlib,
): Uint8Array {
  // Build a minimal PNG: signature + IHDR + IDAT + IEND.
  const signature = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

  const ihdrData = new Uint8Array(13);
  const dv = new DataView(ihdrData.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  // Filter byte 0 prepended to each row.
  const rowBytes = width * 4;
  const filtered = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (rowBytes + 1)] = 0;
    filtered.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  }
  const idatData = zlib.deflateSync(filtered);

  const pieces: Uint8Array[] = [signature];
  pieces.push(makeChunk('IHDR', ihdrData));
  pieces.push(makeChunk('IDAT', new Uint8Array(idatData)));
  pieces.push(makeChunk('IEND', new Uint8Array(0)));
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

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc);
  return chunk;
}

let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crcTable[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
