import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useInternalNode,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import type { TravelMethod } from '@scrolled/nav-graph';
import { getFloatingEdgeParams } from './floatingEdge';

export interface TravelEdgeData extends Record<string, unknown> {
  method: TravelMethod;
  bidirectional: boolean;
  /** On the active route — drawn in the accent colour, above everything else. */
  onPath: boolean;
  /** How many authored edges this single line represents. */
  count: number;
  /** A hidden-by-default link, surfaced only because it's on the route. */
  minor: boolean;
  /** 0–1. Calm by default, lit when on the route or when its region is focused. */
  opacity: number;
}

export type TravelFlowEdge = Edge<TravelEdgeData, 'travel'>;

export function TravelEdgeView({
  source,
  target,
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
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  let sx = sourceX;
  let sy = sourceY;
  let tx = targetX;
  let ty = targetY;
  let sPos = sourcePosition;
  let tPos = targetPosition;
  if (sourceNode?.measured?.width && targetNode?.measured?.width) {
    const p = getFloatingEdgeParams(sourceNode, targetNode);
    sx = p.sx;
    sy = p.sy;
    tx = p.tx;
    ty = p.ty;
    sPos = p.sourcePos;
    tPos = p.targetPos;
  }

  const [path, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    sourcePosition: sPos,
    targetPosition: tPos,
  });

  const onPath = data?.onPath ?? false;
  const count = data?.count ?? 1;
  const opacity = data?.opacity ?? 1;
  const stroke = onPath ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke,
          strokeWidth: onPath ? 2.5 : count > 1 ? 1.75 : 1.25,
          strokeDasharray: onPath && data?.minor ? '6 4' : undefined,
          opacity,
        }}
      />
      {count > 1 && opacity > 0.3 ? (
        <EdgeLabelRenderer>
          <div
            className="bg-background text-muted-foreground border-border pointer-events-none rounded-full border px-1.5 text-[10px] leading-tight"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              opacity,
            }}
          >
            ×{count}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
