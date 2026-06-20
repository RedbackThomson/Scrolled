import { decodeCanvas, openFile, type WzFile, type WzVersion } from '@scrolled/wz';
import type {
  Diagnostics,
  GameDataSource,
  LoadFileSpec,
  LoadResult,
  WzMapleVersionName,
  WzNodeInfo,
  WzNodeTree,
} from './types';
import { createLogger, describeError, getLogEntries } from '../lib/logger';
import { ensureWzInit, getAesSmokeTestResult } from './wzInit';
import type { ProgressFn } from '../lib/progress';
import { buildSubtree, resolvePath, resolveToCanvas, type ResolvedNode } from './wzResolve';
import { toBytes } from './toBytes';
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
        const bytes = await toBytes(spec.source, spec.name, onProgress);
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
    const canvas = resolveToCanvas(resolved);
    if (!canvas) {
      log.debug('getIconPng: not a canvas-like node', { path });
      return null;
    }
    try {
      const t0 = performance.now();
      const pixels = await decodeCanvas({
        canvas: canvas.canvas,
        fileBytes: canvas.host.bytes,
        keystream: canvas.host.keystream,
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

  private resolve(path: string): ResolvedNode | null {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const [fileName, ...rest] = segments;
    const loaded = this.files.get(fileName!);
    if (!loaded) return null;
    return resolvePath(loaded.file, fileName!, rest);
  }
}
