import { useCallback, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type {
  QuestChainEdgeRecord,
  QuestChainExternalEdgeWithName,
  QuestChainMemberWithName,
} from '@/db';
import { IconButton } from '@scrolled/design';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { clamp } from '@scrolled/game-db/lib/math';
import { edgeKey, shortestPathTo, type ChainPath } from './chainPath';
import { QuestChainGraphNode } from './QuestChainGraphNode';
import { QuestChainLegend } from './QuestChainLegend';
import { QuestChainSidePanel } from './QuestChainSidePanel';
import { useDagreLayout, type DagreEdge } from './useDagreLayout';

interface Props {
  members: readonly QuestChainMemberWithName[];
  edges: readonly QuestChainEdgeRecord[];
  externalEdges?: readonly QuestChainExternalEdgeWithName[];
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const DOTTED_CANVAS = [
  'radial-gradient(var(--border-1) 1.2px, transparent 1.3px) 0 0 / 22px 22px',
  'var(--surface-sunken)',
].join(', ');

/**
 * Pan + zoom container for the chain graph. One-finger drag and native
 * overflow scroll handle pan; two-finger pinch and the toolbar buttons
 * drive zoom. Lifted from `MapViewerCanvas.tsx` with the WZ projection math
 * stripped — the nodes already live in dagre's pixel space.
 */
export function QuestChainGraphCanvas({ members, edges, externalEdges }: Props) {
  const layout = useDagreLayout(members, edges, externalEdges);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showIds = useShowEntityIds((s) => s.enabled);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = layout.nodes.find((n) => n.questId === selectedId) ?? null;
  const path = useMemo<ChainPath | null>(() => {
    if (selectedId === null) return null;
    const starts = layout.nodes.filter((n) => n.isRoot).map((n) => n.questId);
    return shortestPathTo(selectedId, starts, layout.edges);
  }, [selectedId, layout]);

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
    setZoom(
      clamp(pinchStart.current.zoom * (distance / pinchStart.current.distance), MIN_ZOOM, MAX_ZOOM),
    );
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }, []);

  return (
    <div className="flex h-full w-full max-md:flex-col">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <QuestChainLegend />
        <div className="bg-card shadow-float absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-full p-1">
          <IconButton
            variant="ghost"
            round
            size={32}
            icon={Minus}
            label="Zoom out"
            onClick={() => setZoom((z) => clamp(z / 1.25, MIN_ZOOM, MAX_ZOOM))}
          />
          <IconButton
            variant="ghost"
            round
            size={32}
            icon={RotateCcw}
            label="Reset zoom"
            title={`Zoom ${Math.round(zoom * 100)}% — click to reset`}
            onClick={() => setZoom(1)}
          />
          <IconButton
            variant="ghost"
            round
            size={32}
            icon={Plus}
            label="Zoom in"
            onClick={() => setZoom((z) => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM))}
          />
        </div>
        <div
          ref={scrollRef}
          className="relative flex-1 overflow-auto"
          style={{ touchAction: 'pan-x pan-y', background: DOTTED_CANVAS }}
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
                <EdgeLayer
                  edges={layout.edges}
                  path={path}
                  width={layout.width}
                  height={layout.height}
                />
                {layout.nodes.map((n) => (
                  <QuestChainGraphNode
                    key={n.questId}
                    node={n}
                    showId={showIds}
                    selected={n.questId === selectedId}
                    onPath={path?.questIds.has(n.questId) ?? false}
                    onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <QuestChainSidePanel node={selected} />
    </div>
  );
}

function EdgeLayer({
  edges,
  path,
  width,
  height,
}: {
  edges: readonly DagreEdge[];
  path: ChainPath | null;
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
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--border-1)' }} />
        </marker>
        <marker
          id="qcg-arrow-cycle"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-amber-500" />
        </marker>
        <marker
          id="qcg-arrow-path"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--accent)' }} />
        </marker>
      </defs>
      {sortPathLast(edges, path).map((e, i) => {
        if (e.points.length < 2) return null;
        if (path?.edgeKeys.has(edgeKey(e.fromQuestId, e.toQuestId))) {
          return (
            <path
              key={`${e.fromQuestId}-${e.toQuestId}-${i}`}
              d={smoothPath(e.points)}
              fill="none"
              style={{ stroke: 'var(--accent)' }}
              strokeWidth={3}
              strokeLinecap="round"
              markerEnd="url(#qcg-arrow-path)"
            />
          );
        }
        const d = smoothPath(e.points);
        // Four styles, in priority order: cycle edges (amber dashed),
        // external edges (very faint, sparse dash), optional edges
        // (medium faint), and the default critical solid line.
        const stroke = e.inCycle
          ? 'stroke-amber-500'
          : e.isExternal
            ? 'opacity-[.55]'
            : e.isCritical
              ? undefined
              : 'opacity-70';
        const dash = e.inCycle ? '4 3' : e.isExternal ? '1 4' : e.isCritical ? undefined : '2 4';
        return (
          <path
            key={`${e.fromQuestId}-${e.toQuestId}-${i}`}
            d={d}
            fill="none"
            className={stroke}
            style={e.inCycle ? undefined : { stroke: 'var(--border-1)' }}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={dash}
            markerEnd={e.inCycle ? 'url(#qcg-arrow-cycle)' : 'url(#qcg-arrow)'}
          />
        );
      })}
    </svg>
  );
}

/** Path edges go last so they draw over the edges they cross. */
function sortPathLast(edges: readonly DagreEdge[], path: ChainPath | null): readonly DagreEdge[] {
  if (!path) return edges;
  const onPath = (e: DagreEdge) => path.edgeKeys.has(edgeKey(e.fromQuestId, e.toQuestId));
  return [...edges.filter((e) => !onPath(e)), ...edges.filter(onPath)];
}

/** Rounds dagre's polyline corners into quadratic curves through each segment midpoint. */
function smoothPath(points: readonly { x: number; y: number }[]): string {
  const [first, ...rest] = points;
  if (rest.length < 2) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const p = rest[i];
    const next = rest[i + 1];
    d += ` Q ${p.x} ${p.y} ${(p.x + next.x) / 2} ${(p.y + next.y) / 2}`;
  }
  const last = rest[rest.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}
