import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import type { TravelMethod } from '@scrolled/nav-graph';

export interface TravelEdgeData extends Record<string, unknown> {
  method: TravelMethod;
  bidirectional: boolean;
  /** On the active route — drawn in the accent colour, above everything else. */
  onPath: boolean;
  /** How many authored edges this single line represents. */
  count: number;
  /** A hidden-by-default link, surfaced only because it's on the route. */
  minor: boolean;
  /** A route is active and this edge isn't part of it. */
  dimmed: boolean;
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
  data,
}: EdgeProps<TravelFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const onPath = data?.onPath ?? false;
  const count = data?.count ?? 1;
  const stroke = onPath ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke,
          // Aggregated lines read a touch heavier so a bundle of routes looks
          // weightier than a single connection.
          strokeWidth: onPath ? 2.5 : count > 1 ? 2 : 1.5,
          strokeDasharray: onPath && data?.minor ? '6 4' : undefined,
          opacity: data?.dimmed ? 0.25 : 1,
        }}
      />
      {count > 1 ? (
        <EdgeLabelRenderer>
          <div
            className="bg-background text-muted-foreground border-border pointer-events-none rounded-full border px-1.5 text-[10px] leading-tight"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              opacity: data?.dimmed ? 0.25 : 1,
            }}
          >
            ×{count}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
