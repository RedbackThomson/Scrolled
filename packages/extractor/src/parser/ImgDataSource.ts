import {
  decodeCanvas,
  openImageFile,
  type ImageFile,
  getKeystream,
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
import { createLogger, describeError, getLogEntries } from '@scrolled/game-db/lib/logger';
import { ensureWzInit, getAesSmokeTestResult } from './wzInit';
import type { ProgressFn } from '@scrolled/game-db/lib/progress';
import { buildImgDataset, type ImgDataset, type ImgTreeNode } from './imgTree';
import { buildSubtree, makeProperty, resolveToCanvas, walkProperties } from './wzResolve';
import { propertyToNodeInfo } from './nodeInfo';
import { toBytes } from './toBytes';
import { encodeRgbaToPng } from './pngCodec';

const log = createLogger('img-data-source');

/**
 * `GameDataSource` backed by a folder of standalone `.img` files (a
 * HaRepacker-style dump whose folder tree mirrors a WZ archive). It reconstructs
 * the same logical path space as `WzDataSource` — folder `Item` is exposed as
 * `Item.wz` — so the extractors run against it unchanged.
 *
 * Each `.img` is parsed lazily on first access and memoised. Canvas decode and
 * UOL resolution reuse the shared `wzResolve` helpers via the `CanvasHost`
 * shape that a parsed `ImageFile` satisfies.
 *
 * Path conventions match `WzDataSource`:
 *   - "" or "/" → the source root (list of logical files)
 *   - "Item.wz" → a logical root (folder `Item`)
 *   - "Item.wz/Consume/0200/0200.img" → an image file
 *   - "Item.wz/Consume/0200/0200.img/info/price" → a property inside it
 */
export class ImgDataSource implements GameDataSource {
  private keystream: Uint8Array = new Uint8Array(0);
  private dataset: ImgDataset = { roots: new Map() };
  // Cache the in-flight promise (not just the result) so a burst of concurrent
  // reads of the same image — e.g. an extractor's parallel `getNode`s — reads
  // and parses the file once rather than once per call.
  private readonly imageCache = new Map<string, Promise<ImageFile | null>>();

  async init(version: WzMapleVersionName): Promise<void> {
    log.info('init', { version });
    await ensureWzInit(version);
    this.keystream = await getKeystream(version as WzVersion, 256 * 1024);
  }

  async load(files: LoadFileSpec[], _onProgress?: ProgressFn): Promise<LoadResult> {
    // For IMG, `name` carries the full relative path (e.g.
    // "Item/Consume/0200/0200.img"). Bytes are read lazily per image.
    this.dataset = buildImgDataset(files.map((f) => ({ relPath: f.name, source: f.source })));

    const loaded: LoadResult['loaded'] = [];
    for (const [logical, root] of this.dataset.roots) {
      loaded.push({ name: logical, rootDirectories: [...root.children.keys()] });
    }
    log.info('dataset built', {
      roots: loaded.map((l) => l.name),
      fileCount: files.length,
    });
    return { loaded, errors: [] };
  }

  async listFiles(): Promise<WzNodeInfo[]> {
    return [...this.dataset.roots.entries()].map(([logical, root]) => ({
      name: logical,
      fullPath: logical,
      kind: 'file',
      hasChildren: root.children.size > 0,
    }));
  }

  async getNode(path: string): Promise<WzNodeInfo | null> {
    log.debug('getNode', { path });
    const loc = this.locate(path);
    if (!loc) return null;
    switch (loc.type) {
      case 'root':
        return null;
      case 'file':
        return { name: loc.logical, fullPath: loc.logical, kind: 'file', hasChildren: loc.node.children.size > 0 };
      case 'dir':
        return {
          name: loc.node.name,
          fullPath: loc.fullPath,
          kind: 'directory',
          hasChildren: loc.node.children.size > 0,
        };
      case 'image': {
        const img = await this.loadImage(loc.node, loc.fullPath);
        if (!img) return null;
        if (loc.propPath.length === 0) {
          return {
            name: loc.node.name,
            fullPath: loc.fullPath,
            kind: 'image',
            hasChildren: img.properties.length > 0,
          };
        }
        const found = walkProperties(img.properties, loc.propPath);
        if (!found) return null;
        const fullPath = `${loc.fullPath}/${loc.propPath.slice(0, found.depth).join('/')}`;
        return propertyToNodeInfo(found.prop, fullPath);
      }
    }
  }

  async listChildren(path: string): Promise<WzNodeInfo[]> {
    log.debug('listChildren', { path });
    if (!path || path === '/') return this.listFiles();
    const loc = this.locate(path);
    if (!loc) return [];
    switch (loc.type) {
      case 'root':
        return this.listFiles();
      case 'file':
      case 'dir':
        return [...loc.node.children.values()].map((c) => ({
          name: c.name,
          fullPath: `${path}/${c.name}`,
          kind: c.kind === 'dir' ? 'directory' : 'image',
          hasChildren: c.kind === 'dir' ? c.children.size > 0 : true,
        }));
      case 'image': {
        const img = await this.loadImage(loc.node, loc.fullPath);
        if (!img) return [];
        if (loc.propPath.length === 0) {
          return img.properties.map((p) => propertyToNodeInfo(p, `${loc.fullPath}/${p.name}`));
        }
        const found = walkProperties(img.properties, loc.propPath);
        if (!found) return [];
        const base = `${loc.fullPath}/${loc.propPath.slice(0, found.depth).join('/')}`;
        const prop = found.prop;
        if (prop.type === 'sub' || prop.type === 'convex' || prop.type === 'canvas') {
          return prop.children.map((c) => propertyToNodeInfo(c, `${base}/${c.name}`));
        }
        return [];
      }
    }
  }

  async readImageTree(
    path: string,
    opts: { subtrees?: string[]; maxDepth?: number } = {},
  ): Promise<WzNodeTree | null> {
    log.debug('readImageTree', { path });
    const loc = this.locate(path);
    if (!loc || loc.type !== 'image' || loc.propPath.length !== 0) {
      log.debug('readImageTree miss or non-image', { path });
      return null;
    }
    const img = await this.loadImage(loc.node, loc.fullPath);
    if (!img) return null;
    const maxDepth = opts.maxDepth ?? 4;
    const topSubtrees = opts.subtrees ? new Set(opts.subtrees) : null;
    return buildSubtree(img.properties, loc.fullPath, 0, maxDepth, topSubtrees);
  }

  async getIconPng(path: string): Promise<Uint8Array | null> {
    log.debug('getIconPng', { path });
    const loc = this.locate(path);
    if (!loc || loc.type !== 'image' || loc.propPath.length === 0) {
      log.debug('getIconPng: path is not a property inside an image', { path });
      return null;
    }
    const img = await this.loadImage(loc.node, loc.fullPath);
    if (!img) return null;
    const found = walkProperties(img.properties, loc.propPath);
    if (!found) return null;
    const imagePath = loc.propPath.slice(0, found.depth);
    const fullPath = `${loc.fullPath}/${imagePath.join('/')}`;
    const resolved = makeProperty(img, found.prop, img.properties, imagePath, fullPath);
    const canvas = resolveToCanvas(resolved);
    if (!canvas) {
      log.debug('getIconPng: not a canvas-like node', { path });
      return null;
    }
    try {
      const pixels = await decodeCanvas({
        canvas: canvas.canvas,
        fileBytes: canvas.host.bytes,
        keystream: canvas.host.keystream,
      });
      return await encodeRgbaToPng(pixels.rgba, pixels.width, pixels.height);
    } catch (e) {
      log.warn('getIconPng failed', describeError(e));
      return null;
    }
  }

  async diagnose(): Promise<Diagnostics> {
    return {
      log: getLogEntries(),
      aesSmokeTest: getAesSmokeTestResult(),
      loadedFiles: [...this.dataset.roots.keys()].map((name) => ({ name })),
    };
  }

  async dispose(): Promise<void> {
    log.info('dispose', { roots: this.dataset.roots.size });
    this.dataset = { roots: new Map() };
    this.imageCache.clear();
  }

  private loadImage(node: ImgTreeNode, fullPath: string): Promise<ImageFile | null> {
    const cached = this.imageCache.get(fullPath);
    if (cached) return cached;
    const pending = (async (): Promise<ImageFile | null> => {
      if (!node.source) return null;
      try {
        const bytes = await toBytes(node.source, fullPath);
        return openImageFile(bytes, this.keystream);
      } catch (e) {
        log.warn('failed to parse image', { fullPath, ...describeError(e) });
        return null;
      }
    })();
    this.imageCache.set(fullPath, pending);
    return pending;
  }

  /** Walk the virtual tree to whatever `path` names, splitting off any trailing
   * property segments once an `.img` leaf is reached. */
  private locate(path: string): LocateResult | null {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return { type: 'root' };
    const logical = segments[0]!;
    const root = this.dataset.roots.get(logical);
    if (!root) return null;
    if (segments.length === 1) return { type: 'file', logical, node: root };

    let node = root;
    for (let i = 1; i < segments.length; i++) {
      const child = node.children.get(segments[i]!);
      if (!child) return null;
      if (child.kind === 'image') {
        return {
          type: 'image',
          node: child,
          fullPath: segments.slice(0, i + 1).join('/'),
          propPath: segments.slice(i + 1),
        };
      }
      node = child;
    }
    return { type: 'dir', node, fullPath: segments.join('/') };
  }
}

type LocateResult =
  | { type: 'root' }
  | { type: 'file'; logical: string; node: ImgTreeNode }
  | { type: 'dir'; node: ImgTreeNode; fullPath: string }
  | { type: 'image'; node: ImgTreeNode; fullPath: string; propPath: string[] };
