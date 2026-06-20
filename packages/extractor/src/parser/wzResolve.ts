import {
  resolveUol,
  type WzCanvasProperty,
  type WzDirEntry,
  type WzDirNode,
  type WzFile,
  type WzImageNode,
  type WzProperty,
} from '@scrolled/wz';
import type { WzNodeInfo, WzNodeTree } from './types';
import { propertyToNodeInfo } from './nodeInfo';

/**
 * The minimal shape the canvas decoder and UOL resolver read off a parsed
 * source: the backing bytes (canvas `dataOffset`s index into these) and the
 * region keystream. Both a `WzFile` and a standalone `ImageFile` satisfy it,
 * so property/canvas resolution is the same code for WZ and IMG sources.
 */
export interface CanvasHost {
  bytes: Uint8Array;
  keystream: Uint8Array;
}

export type ResolvedNode =
  | {
      kind: 'file';
      file: WzFile;
      fullPath: string;
      toNodeInfo(): WzNodeInfo;
      listChildren(): WzNodeInfo[];
    }
  | {
      kind: 'dir';
      file: WzFile;
      dir: WzDirNode;
      fullPath: string;
      toNodeInfo(): WzNodeInfo;
      listChildren(): WzNodeInfo[];
    }
  | {
      kind: 'image';
      file: CanvasHost;
      image: WzImageNode;
      props: WzProperty[];
      fullPath: string;
      toNodeInfo(): WzNodeInfo;
      listChildren(): WzNodeInfo[];
    }
  | {
      kind: 'property';
      file: CanvasHost;
      prop: WzProperty;
      imageRoot: WzProperty[];
      imagePath: string[];
      fullPath: string;
      toNodeInfo(): WzNodeInfo;
      listChildren(): WzNodeInfo[];
    };

export function resolvePath(file: WzFile, fileName: string, rest: string[]): ResolvedNode | null {
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

export function walkProperties(
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
  file: CanvasHost,
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
    listChildren: () => props.map((p) => propertyToNodeInfo(p, `${fullPath}/${p.name}`)),
  };
}

export function makeProperty(
  file: CanvasHost,
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

/**
 * Walk a resolved node (which may sit inside a property tree) toward a canvas.
 * Follows UOLs and `"PNG"` sub-children. Shared by both data sources — it only
 * reads `.bytes`/`.keystream` via the `CanvasHost` on the resolved node, so it
 * works identically for a WZ archive and a standalone `.img`.
 */
export function resolveToCanvas(
  resolved: ResolvedNode,
  depth = 0,
): { host: CanvasHost; canvas: WzCanvasProperty } | null {
  if (depth > 4) return null;
  if (resolved.kind !== 'property') return null;
  const p = resolved.prop;
  if (p.type === 'canvas') return { host: resolved.file, canvas: p };
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
    return resolveToCanvas(linked, depth + 1);
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
      return resolveToCanvas(linked, depth + 1);
    }
  }
  return null;
}

export function pathOfResolution(from: string[], target: string): string[] {
  // Apply the UOL target to `from` (which is the path TO the UOL itself).
  const stack = from.slice(0, -1);
  for (const seg of target.split('/').filter(Boolean)) {
    if (seg === '..') stack.pop();
    else stack.push(seg);
  }
  return stack;
}

export function buildSubtree(
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
