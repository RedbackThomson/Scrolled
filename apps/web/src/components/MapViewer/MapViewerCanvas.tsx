import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DoorOpen, Repeat, Skull, Sparkles, Users, type LucideIcon } from 'lucide-react';
import type { MapMobSpawnWithName, MapNpcWithName, MapPortalRecord, MapRecord } from '@/db';
import { MapHoverCard, MobHoverCard, NpcHoverCard } from '@/components/entity-links';
import { classifyPortal, gameToPixel, type PortalGraph } from '@/domain/portal-types';
import type { LayerVisibility, MapViewerHighlight } from './types';
import { MapViewerIcon } from './MapViewerIcon';
import { clamp } from '@/lib/math';
import { bytesToUrl } from '@/lib/blob';

interface MapViewerCanvasProps {
  map: MapRecord;
  npcs: MapNpcWithName[];
  mobSpawns: MapMobSpawnWithName[];
  portals: MapPortalRecord[];
  portalGraph: PortalGraph;
  visible: LayerVisibility;
  /** Sticky highlight set via clicking a sidebar row. Triggers scroll-into-view. */
  selection: MapViewerHighlight | null;
  /** Transient highlight set via hovering a sidebar row. Visual only — no scroll. */
  hovered: MapViewerHighlight | null;
}

// Picks the largest integer multiplier (1..MAX_SCALE) such that the scaled
// minimap is at least TARGET_MIN px on its longer side. Keeps tiny minimaps
// from being too small while not over-blowing already-large ones.
const MAX_SCALE = 6;
const TARGET_MIN = 800;
function pickScale(width: number, height: number): number {
  const longer = Math.max(width, height);
  if (longer <= 0) return 1;
  const ratio = TARGET_MIN / longer;
  return clamp(Math.ceil(ratio), 1, MAX_SCALE);
}

// Very generous bounds — only reject icons that project to wildly off-canvas
// coordinates (typically a sign of malformed WZ geometry). MapleStory dumps
// occasionally place edge spawns a handful of pixels outside the visible
// minimap, and the WZ centerX/centerY/mag aren't always perfectly calibrated.
const BOUNDS_MARGIN = 200;

const PORTAL_LAYER_META = {
  spawn: { Icon: Sparkles, color: 'text-emerald-500', label: 'Player spawn' },
  portal: { Icon: DoorOpen, color: 'text-sky-500', label: 'Portal' },
  internalTeleport: {
    Icon: Repeat,
    color: 'text-violet-500',
    label: 'Internal teleport',
  },
  unknown: { Icon: DoorOpen, color: 'text-zinc-400', label: 'Portal' },
} as const satisfies Record<string, { Icon: LucideIcon; color: string; label: string }>;

export function MapViewerCanvas({
  map,
  npcs,
  mobSpawns,
  portals,
  portalGraph,
  visible,
  selection,
  hovered,
}: MapViewerCanvasProps) {
  // Hover takes visual priority while present; selection persists otherwise.
  const effective = hovered ?? selection;

  // When a portal is highlighted, every portal in the same teleport chain
  // (pairs, cycles, unidirectional links via tn -> pn) is also marked as
  // linked. The actively-selected portal still gets the primary emerald
  // ring; siblings get a subtler violet ring (see MapViewerIcon).
  const linkedPortalIdxSet =
    effective?.kind === 'portal'
      ? (portalGraph.componentOf.get(Number(effective.key)) ?? null)
      : null;
  // Build a blob URL once per minimap blob. The DB returns a fresh
  // Uint8Array per query so the blob is keyed by reference, not content.
  const blobUrl = useMemo(() => {
    if (!map.minimapData) return null;
    return bytesToUrl(map.minimapData, 'image/png');
  }, [map.minimapData]);
  useEffect(() => {
    if (!blobUrl) return;
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  // Measure the minimap PNG's natural pixel dimensions. WZ-extracted
  // `minimapWidth`/`minimapHeight` aren't reliably the canvas-pixel size on
  // every dump, but the image's intrinsic dimensions always are. The
  // projection (`(gameX + centerX) / mag`) produces coords in this same
  // canvas-pixel space, so anchoring layout to the measured size keeps
  // the icons and image in lockstep.
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!blobUrl) {
      setImgSize(null);
      return;
    }
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (cancelled) return;
      setImgSize({ w: probe.naturalWidth, h: probe.naturalHeight });
    };
    probe.src = blobUrl;
    return () => {
      cancelled = true;
    };
  }, [blobUrl]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll the first highlighted icon into the center of the scroll container
  // when the selection changes.
  useLayoutEffect(() => {
    if (!selection) return;
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>('[data-highlighted="true"]');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [selection]);

  const centerX = map.minimapCenterX;
  const centerY = map.minimapCenterY;
  const mag = map.minimapMag;

  if (!blobUrl || centerX === null || centerY === null || mag === null || mag === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
        This map has no minimap geometry.
      </div>
    );
  }
  if (!imgSize) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
        Loading minimap…
      </div>
    );
  }
  // Render at the PNG's natural pixel size for crisp output, then rescale
  // the projection into that space. `(gameX + centerX) / mag` gives a
  // canvas-pixel coordinate whose extent is `declaredW / mag` × `declaredH / mag`
  // (i.e. the WZ-declared canvas measured in game-coord units divided down
  // by `mag`). We compress that into natural image space with a ratio of
  // `natural / (declared / mag)` so icons land at their proportional spot
  // on the image. The `mag` cancellation in this ratio is what was missing
  // earlier and caused icons to cluster in one corner.
  const width = imgSize.w;
  const height = imgSize.h;
  const declaredW = map.minimapWidth ?? imgSize.w * mag;
  const declaredH = map.minimapHeight ?? imgSize.h * mag;
  const ratioX = declaredW > 0 ? (imgSize.w * mag) / declaredW : 1;
  const ratioY = declaredH > 0 ? (imgSize.h * mag) / declaredH : 1;
  const scale = pickScale(width, height);

  const project = (gx: number, gy: number) => {
    const p = gameToPixel(gx, gy, centerX, centerY, mag);
    return { x: p.x * ratioX, y: p.y * ratioY };
  };

  const inBounds = (p: { x: number; y: number }) =>
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= -BOUNDS_MARGIN &&
    p.y >= -BOUNDS_MARGIN &&
    p.x <= width + BOUNDS_MARGIN &&
    p.y <= height + BOUNDS_MARGIN;

  const npcMatches = (n: MapNpcWithName) =>
    effective?.kind === 'npc' && effective.key === String(n.npcId);
  const mobMatches = (m: MapMobSpawnWithName) =>
    effective?.kind === 'mob' && effective.key === String(m.mobId);
  const portalMatches = (p: MapPortalRecord) =>
    effective?.kind === 'portal' && effective.key === String(p.idx);

  return (
    <div
      ref={scrollRef}
      className="bg-muted/30 relative flex-1 overflow-auto"
      role="img"
      aria-label={`Map of ${map.name ?? `Map ${map.id}`}`}
    >
      {/* `grid place-content-center` keeps the minimap centred when it's
          smaller than the scroll viewport, while still letting the grid track
          grow past `min-h/w-full` (triggering scroll) for larger maps. */}
      <div className="grid min-h-full min-w-full place-content-center p-6">
        <div style={{ width: width * scale, height: height * scale }} className="relative">
          <div
            style={{
              width,
              height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              position: 'relative',
            }}
          >
            <img
              src={blobUrl}
              width={width}
              height={height}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                display: 'block',
                imageRendering: 'pixelated',
              }}
            />

            {visible.mobs &&
              mobSpawns.map((m, i) => {
                if (m.x === null || m.y === null) return null;
                const p = project(m.x, m.y);
                if (!inBounds(p)) return null;
                const highlighted = mobMatches(m);
                return (
                  <MapViewerIcon
                    key={`mob-${i}`}
                    pixelX={p.x}
                    pixelY={p.y}
                    parentScale={scale}
                    Icon={Skull}
                    colorClass="text-rose-500"
                    ariaLabel={m.name ?? `Mob ${m.mobId}`}
                    tooltip={<MobHoverCard id={m.mobId} />}
                    highlighted={highlighted}
                    dimmed={effective !== null && !highlighted}
                  />
                );
              })}

            {visible.npcs &&
              npcs.map((n, i) => {
                if (n.x === null || n.y === null) return null;
                const p = project(n.x, n.y);
                if (!inBounds(p)) return null;
                const highlighted = npcMatches(n);
                return (
                  <MapViewerIcon
                    key={`npc-${i}`}
                    pixelX={p.x}
                    pixelY={p.y}
                    parentScale={scale}
                    Icon={Users}
                    colorClass="text-amber-500"
                    ariaLabel={n.name ?? `NPC ${n.npcId}`}
                    tooltip={<NpcHoverCard id={n.npcId} />}
                    highlighted={highlighted}
                    dimmed={effective !== null && !highlighted}
                  />
                );
              })}

            {portals.map((p) => {
              if (p.x === null || p.y === null) return null;
              const layer = classifyPortal(p, map.id);
              const layerVisible =
                (layer === 'spawn' && visible.spawns) ||
                (layer === 'portal' && visible.portals) ||
                (layer === 'internalTeleport' && visible.teleports) ||
                (layer === 'unknown' && visible.portals);
              if (!layerVisible) return null;
              const projected = project(p.x, p.y);
              if (!inBounds(projected)) return null;
              const meta = PORTAL_LAYER_META[layer];
              const tooltip =
                layer === 'portal' && p.targetMapId !== null && p.targetMapId !== 999999999 ? (
                  <MapHoverCard id={p.targetMapId} />
                ) : (
                  <div className="text-xs">
                    <div className="text-foreground font-mono">{p.portalName}</div>
                    <div className="text-muted-foreground">{meta.label}</div>
                    {p.targetMapId !== null && p.targetMapId !== 999999999 && (
                      <div className="text-muted-foreground">→ Map {p.targetMapId}</div>
                    )}
                  </div>
                );
              const highlighted = portalMatches(p);
              const linked =
                !highlighted &&
                linkedPortalIdxSet !== null &&
                linkedPortalIdxSet.has(p.idx) &&
                linkedPortalIdxSet.size > 1;
              return (
                <MapViewerIcon
                  key={`portal-${p.idx}`}
                  pixelX={projected.x}
                  pixelY={projected.y}
                  parentScale={scale}
                  Icon={meta.Icon}
                  colorClass={meta.color}
                  ariaLabel={`${meta.label} ${p.portalName}`}
                  tooltip={tooltip}
                  highlighted={highlighted}
                  linked={linked}
                  dimmed={effective !== null && !highlighted && !linked}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
