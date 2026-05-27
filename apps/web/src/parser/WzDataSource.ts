import {
  decodeCanvas,
  openFile,
  resolveUol,
  type WzCanvasProperty,
  type WzFile,
  type WzVersion,
} from '@scrolled/wz';
import type {
  Diagnostics,
  GameDataSource,
  LoadFileSpec,
  LoadResult,
  WzMapleVersionName,
  WzNodeInfo,
  WzNodeTree,
} from './types';
import { createLogger, describeError, getLogEntries } from '@/lib/logger';
import { ensureWzInit, getAesSmokeTestResult } from './wzInit';
import type { ProgressFn } from '@/lib/progress';
import {
  buildSubtree,
  makeProperty,
  pathOfResolution,
  resolvePath,
  type ResolvedNode,
} from './wzResolve';
import { encodeRgbaToPng } from './pngCodec';

const log = createLogger('wz-data-source');

interface LoadedFile {
  name: string;
  file: WzFile;
}

/**
 * Parser implementation backed by `@scrolled/wz`. Holds open `WzFile` instances
 * keyed by logical name (e.g. "String.wz", "Item.wz") and resolves paths
 * formatted as `<file>/<segments…>`.
 *
 * No mutex: `@scrolled/wz`'s `Reader` is structurally cloneable, so concurrent
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
          onProgress({
            phase: `Parsing ${spec.name}`,
            current: 0,
            total: 0,
            detail: 'reading header',
          });
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
