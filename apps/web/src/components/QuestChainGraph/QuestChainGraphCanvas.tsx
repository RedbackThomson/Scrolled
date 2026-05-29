import { useCallback, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { QuestChainEdgeRecord, QuestChainMemberWithName } from '@/db';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { clamp } from '@/lib/math';
import { QuestChainGraphNode } from './QuestChainGraphNode';
import { useDagreLayout, type DagreEdge } from './useDagreLayout';

interface Props {
  members: readonly QuestChainMemberWithName[];
  edges: readonly QuestChainEdgeRecord[];
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

/**
 * Pan + zoom container for the chain graph. One-finger drag and native
 * overflow scroll handle pan; two-finger pinch and the toolbar buttons
 * drive zoom. Lifted from `MapViewerCanvas.tsx` with the WZ projection math
 * stripped — the nodes already live in dagre's pixel space.
 */
export function QuestChainGraphCanvas({ members, edges }: Props) {
  const layout = useDagreLayout(members, edges);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showIds = useShowEntityIds((s) => s.enabled);

  const [zoom, setZoom] = useState(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'touch') return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      }
    },
    [zoom],
  );
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size !== 2 || !pinchStart.current) return;
    const [a, b] = [...pointers.current.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchStart.current.distance === 0) return;
    setZoom(clamp(pinchStart.current.zoom * (distance / pinchStart.current.distance), MIN_ZOOM, MAX_ZOOM));
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="border-border bg-muted/40 absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border px-1 py-1 shadow-sm">
        <button
          type="button"
          onClick={() => setZoom((z) => clamp(z / 1.25, MIN_ZOOM, MAX_ZOOM))}
          className="hover:bg-accent inline-flex h-7 w-7 items-center justify-center rounded"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="hover:bg-accent inline-flex h-7 w-7 items-center justify-center rounded"
          aria-label="Reset zoom"
          title={`Zoom ${Math.round(zoom * 100)}% — click to reset`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM))}
          className="hover:bg-accent inline-flex h-7 w-7 items-center justify-center rounded"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="bg-muted/30 relative flex-1 overflow-auto"
        style={{ touchAction: 'pan-x pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="grid min-h-full min-w-full place-content-center p-4">
          <div
            style={{ width: layout.width * zoom, height: layout.height * zoom }}
            className="relative"
          >
            <div
              style={{
                width: layout.width,
                height: layout.height,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                position: 'relative',
              }}
            >
              <EdgeLayer edges={layout.edges} width={layout.width} height={layout.height} />
              {layout.nodes.map((n) => (
                <QuestChainGraphNode key={n.questId} node={n} showId={showIds} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EdgeLayer({
  edges,
  width,
  height,
}: {
  edges: readonly DagreEdge[];
  width: number;
  height: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden
    >
      <defs>
        <marker
          id="qcg-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
        </marker>
        <marker
          id="qcg-arrow-cycle"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-amber-500" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        if (e.points.length < 2) return null;
        const d = e.points
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
          .join(' ');
        // Three styles, in priority order: cycle edges (amber dashed),
        // optional edges (faint), and the default critical solid line.
        const stroke = e.inCycle
          ? 'stroke-amber-500'
          : e.isCritical
            ? 'stroke-muted-foreground/60'
            : 'stroke-muted-foreground/25';
        // Cycle edges keep their distinctive dash; optional edges use a
        // sparser dash to read as "secondary" without competing.
        const dash = e.inCycle ? '4 3' : e.isCritical ? undefined : '2 4';
        return (
          <path
            key={`${e.fromQuestId}-${e.toQuestId}-${i}`}
            d={d}
            fill="none"
            className={stroke}
            strokeWidth={1.5}
            strokeDasharray={dash}
            markerEnd={e.inCycle ? 'url(#qcg-arrow-cycle)' : 'url(#qcg-arrow)'}
          />
        );
      })}
    </svg>
  );
}
