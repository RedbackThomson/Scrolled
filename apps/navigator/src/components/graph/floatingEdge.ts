// Geometry for floating edges: instead of anchoring to fixed Top/Bottom
// handles, an edge meets each node on the border point facing the other node.
// This is the standard React Flow floating-edge maths, adapted to v12's
// `InternalNode` (measured size + absolute position).

import { Position, type InternalNode } from '@xyflow/react';

interface Center {
  x: number;
  y: number;
  w: number;
  h: number;
}

function center(node: InternalNode): Center {
  const pos = node.internals.positionAbsolute;
  const w = node.measured?.width ?? 0;
  const h = node.measured?.height ?? 0;
  return { x: pos.x + w / 2, y: pos.y + h / 2, w, h };
}

// Point where the line from `node`'s centre toward `other`'s centre crosses
// `node`'s border (treating the node as a rectangle).
function intersection(node: InternalNode, other: InternalNode): { x: number; y: number } {
  const s = center(node);
  const t = center(other);
  const w2 = s.w / 2;
  const h2 = s.h / 2;
  if (w2 === 0 || h2 === 0) return { x: s.x, y: s.y };

  const xx1 = (t.x - s.x) / (2 * w2) - (t.y - s.y) / (2 * h2);
  const yy1 = (t.x - s.x) / (2 * w2) + (t.y - s.y) / (2 * h2);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  return { x: w2 * (xx3 + yy3) + s.x, y: h2 * (-xx3 + yy3) + s.y };
}

function sideOf(node: InternalNode, point: { x: number; y: number }): Position {
  const c = center(node);
  const left = c.x - c.w / 2;
  const top = c.y - c.h / 2;
  if (Math.round(point.x) <= Math.round(left + 1)) return Position.Left;
  if (Math.round(point.x) >= Math.round(left + c.w - 1)) return Position.Right;
  if (Math.round(point.y) <= Math.round(top + 1)) return Position.Top;
  return Position.Bottom;
}

export interface FloatingEdgeParams {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position;
  targetPos: Position;
}

export function getFloatingEdgeParams(
  source: InternalNode,
  target: InternalNode,
): FloatingEdgeParams {
  const sp = intersection(source, target);
  const tp = intersection(target, source);
  return {
    sx: sp.x,
    sy: sp.y,
    tx: tp.x,
    ty: tp.y,
    sourcePos: sideOf(source, sp),
    targetPos: sideOf(target, tp),
  };
}
