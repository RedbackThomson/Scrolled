import {
  BaseEdge,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import type { TravelMethod } from '@scrolled/nav-graph';

export interface TravelEdgeData extends Record<string, unknown> {
  method: TravelMethod;
  bidirectional: boolean;
}

export type TravelFlowEdge = Edge<TravelEdgeData, 'travel'>;

export function TravelEdgeView({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  markerStart,
  selected,
}: EdgeProps<TravelFlowEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      markerStart={markerStart}
      style={{
        stroke: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
        strokeWidth: selected ? 2.25 : 1.5,
      }}
    />
  );
}
