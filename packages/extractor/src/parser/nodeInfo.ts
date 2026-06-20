import type { WzCanvasProperty, WzConvexProperty, WzProperty, WzSubProperty } from '@scrolled/wz';
import type { WzNodeInfo, WzPropertyKind } from './types';

function propertyKindOf(prop: WzProperty): WzPropertyKind {
  switch (prop.type) {
    case 'string':
    case 'int':
    case 'short':
    case 'long':
    case 'float':
    case 'double':
    case 'vector':
    case 'canvas':
    case 'sub':
    case 'uol':
    case 'convex':
    case 'null':
      return prop.type;
    case 'sound':
      return 'binary';
    case 'lua':
      return 'lua';
    default:
      return 'unknown';
  }
}

function scalarOf(prop: WzProperty, kind: WzPropertyKind): string | number | null | undefined {
  switch (kind) {
    case 'string':
    case 'int':
    case 'short':
    case 'float':
    case 'double':
      return (prop as { value: string | number }).value;
    case 'long': {
      const v = (prop as { value: bigint | number }).value;
      return typeof v === 'bigint' ? v.toString() : v;
    }
    case 'uol':
      return (prop as { target: string }).target;
    case 'vector': {
      const v = prop as { x: number; y: number };
      return `${v.x},${v.y}`;
    }
    default:
      return undefined;
  }
}

function propertyHasChildren(prop: WzProperty): boolean {
  if (prop.type === 'sub' || prop.type === 'convex' || prop.type === 'canvas') {
    return (prop as WzSubProperty | WzConvexProperty | WzCanvasProperty).children.length > 0;
  }
  return false;
}

/**
 * Convert an `@scrolled/wz` `WzProperty` to a worker-boundary `WzNodeInfo`. The
 * result is structurally cloneable (plain object, primitive scalars only).
 */
export function propertyToNodeInfo(prop: WzProperty, fullPath: string): WzNodeInfo {
  const propKind = propertyKindOf(prop);
  const info: WzNodeInfo = {
    name: prop.name,
    fullPath,
    kind: 'property',
    propertyKind: propKind,
    hasChildren: propertyHasChildren(prop),
  };
  const scalar = scalarOf(prop, propKind);
  if (scalar !== undefined) info.scalar = scalar;
  return info;
}
