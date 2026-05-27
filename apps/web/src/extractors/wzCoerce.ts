import type { GameDataSource, WzNodeTree } from '@/parser';

type Scalar = string | number | null | undefined;

/** A node carrying a best-effort primitive scalar (WzNodeInfo or WzNodeTree). */
interface NodeWithScalar {
  scalar?: string | number | null;
}

/** Coerce a raw WZ scalar (number or numeric string) to a number, or null. */
export function scalarToNumber(scalar: Scalar): number | null {
  if (typeof scalar === 'number') return scalar;
  if (typeof scalar === 'string') {
    const n = Number(scalar);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Coerce a raw WZ scalar to a string, or null. */
export function scalarToString(scalar: Scalar): string | null {
  return typeof scalar === 'string' ? scalar : null;
}

/** Read a node's scalar as a number. */
export function nodeToNumber(node: NodeWithScalar | undefined): number | null {
  return node ? scalarToNumber(node.scalar) : null;
}

/** Index sibling tree nodes by their `name`. */
export function indexChildrenByName(nodes: WzNodeTree[]): Map<string, WzNodeTree> {
  const out = new Map<string, WzNodeTree>();
  for (const n of nodes) out.set(n.name, n);
  return out;
}

/** Scalar of a named child of a tree node, or undefined. */
export function childScalar(parent: WzNodeTree | undefined, name: string): Scalar {
  if (!parent) return undefined;
  for (const child of parent.children) {
    if (child.name === name) return child.scalar;
  }
  return undefined;
}

/** Number value of a named child of a tree node, or null. */
export function childToNumber(parent: WzNodeTree | undefined, name: string): number | null {
  return scalarToNumber(childScalar(parent, name));
}

/** String value of a named child of a tree node, or null. */
export function childToString(parent: WzNodeTree | undefined, name: string): string | null {
  return scalarToString(childScalar(parent, name));
}

/** Fetch a node by path and coerce its scalar to a number, or null. */
export async function pathToNumber(source: GameDataSource, path: string): Promise<number | null> {
  const node = await source.getNode(path);
  return scalarToNumber(node?.scalar);
}
