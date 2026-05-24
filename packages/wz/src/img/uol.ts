import type { WzProperty } from './property';

/**
 * Properties that can contain children. The property-tree walker dives into
 * these when resolving a UOL path.
 */
type ChildBearing =
  | { type: 'sub'; children: WzProperty[] }
  | { type: 'convex'; children: WzProperty[] }
  | { type: 'canvas'; children: WzProperty[] };

function childrenOf(p: WzProperty | undefined): WzProperty[] | null {
  if (!p) return null;
  if (p.type === 'sub' || p.type === 'convex' || p.type === 'canvas') {
    return (p as ChildBearing).children;
  }
  return null;
}

function findChild(props: WzProperty[], name: string): WzProperty | undefined {
  return props.find((p) => p.name === name);
}

/**
 * Resolve an in-image UOL.
 *
 * @param rootProps   the parsed image's top-level properties.
 * @param fromPath    path segments from the image root to the UOL property
 *                    itself (inclusive). The resolver walks from the UOL's
 *                    parent (i.e. fromPath minus the last segment) and then
 *                    applies the target path.
 * @param target      the UOL's `target` string, slash-separated. Segments
 *                    equal to `..` pop up one level.
 *
 * Returns the resolved property, or `null` if any segment fails to bind
 * (path leaves the tree, cycles, or hits a leaf when more segments remain).
 */
export function resolveUol(
  rootProps: WzProperty[],
  fromPath: readonly string[],
  target: string,
  maxDepth = 8,
): WzProperty | null {
  return resolveUolInternal(rootProps, fromPath, target, maxDepth, new Set());
}

function resolveUolInternal(
  rootProps: WzProperty[],
  fromPath: readonly string[],
  target: string,
  maxDepth: number,
  visited: Set<string>,
): WzProperty | null {
  if (maxDepth <= 0) return null;

  // Start from the UOL's parent (drop the UOL's own name from fromPath).
  const stack = fromPath.slice(0, -1);
  const targetSegments = target.split('/').filter((s) => s.length > 0);
  for (const seg of targetSegments) {
    if (seg === '..') {
      if (stack.length === 0) return null; // walked off the top
      stack.pop();
    } else {
      stack.push(seg);
    }
  }

  // Now walk the tree by stack[].
  let level: WzProperty[] | null = rootProps;
  let current: WzProperty | undefined;
  for (const seg of stack) {
    if (!level) return null;
    current = findChild(level, seg);
    if (!current) return null;
    level = childrenOf(current);
  }
  if (!current) return null;

  // If the resolved node is itself a UOL, recurse to follow the chain.
  if (current.type === 'uol') {
    const newPath = [...stack];
    const key = newPath.join('/') + '|' + current.target;
    if (visited.has(key)) return null;
    visited.add(key);
    return resolveUolInternal(rootProps, newPath, current.target, maxDepth - 1, visited);
  }
  return current;
}
