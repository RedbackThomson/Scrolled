import { useMemo, useState } from 'react';
import {
  DoorOpen,
  Globe2,
  Repeat,
  Skull,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { GraphicViewerModal, GraphicViewerIcon, type LayerDescriptor } from '@/components/GraphicViewer';
import { MapHoverCard, MobHoverCard, NpcHoverCard } from '@/components/entity-links';
import type { WorldMapForMap } from '@/db';
import {
  buildPortalGraph,
  classifyPortal,
  gameToPixel,
  isUsefulPortal,
  type PortalLayer,
} from '@scrolled/extractor/domain/portal-types';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { useHideMinorPortals } from '@/stores/hideMinorPortals';
import { MapViewerSidebar } from './MapViewerSidebar';
import { useMapViewerData } from './useMapViewerData';
import type { MapViewerHighlight } from './types';

interface MapViewerModalProps {
  open: boolean;
  onClose: () => void;
  mapId: number;
  /** Controlled — the current sticky highlight. Lives in the URL so the
   *  viewer can be deep-linked / restored on reload. */
  selection: MapViewerHighlight | null;
  onSelectionChange: (sel: MapViewerHighlight | null) => void;
  /** Navigate to another map's minimap viewer (clicking an external portal). */
  onNavigateMap: (mapId: number) => void;
  /** World maps this map sits on — surfaced as "up to world map" controls. */
  worldMapPlacements?: WorldMapForMap[];
  onOpenWorldMap?: (worldMapId: string) => void;
}

const PORTAL_LAYER_META = {
  spawn: { Icon: Sparkles, color: 'text-emerald-500', label: 'Player spawn' },
  portal: { Icon: DoorOpen, color: 'text-sky-500', label: 'Portal' },
  internalTeleport: { Icon: Repeat, color: 'text-violet-500', label: 'Internal teleport' },
  unknown: { Icon: DoorOpen, color: 'text-zinc-400', label: 'Portal' },
} as const satisfies Record<string, { Icon: LucideIcon; color: string; label: string }>;

// Very generous bounds — only reject icons that project to wildly off-canvas
// coordinates (typically malformed WZ geometry). Edge spawns occasionally land
// a few pixels outside the visible minimap.
const BOUNDS_MARGIN = 200;

export function MapViewerModal({
  open,
  onClose,
  mapId,
  selection,
  onSelectionChange,
  onNavigateMap,
  worldMapPlacements,
  onOpenWorldMap,
}: MapViewerModalProps) {
  const { map, npcs, portals: allPortals, mobSpawns, isLoading } = useMapViewerData(mapId, open);
  const showIds = useShowEntityIds((s) => s.enabled);
  // Mirror the Portals list on the detail page: when the "hide minor portals"
  // setting is on, keep only the portals a visitor can travel through. Filtering
  // here flows through to the layer counts, sidebar, teleport graph, and overlays.
  const hideMinorPortals = useHideMinorPortals((s) => s.enabled);
  const portals = useMemo(
    () => (hideMinorPortals ? allPortals.filter((p) => isUsefulPortal(p, mapId)) : allPortals),
    [allPortals, hideMinorPortals, mapId],
  );

  // Hover highlight is transient UI state — intentionally NOT in the URL.
  const [hovered, setHovered] = useState<MapViewerHighlight | null>(null);

  // Clicking a canvas icon toggles its sticky selection — re-clicking the
  // selected entity clears it, mirroring the sidebar rows.
  const toggleSelect = (sel: MapViewerHighlight) =>
    onSelectionChange(
      selection?.kind === sel.kind && selection.key === sel.key ? null : sel,
    );

  // Same-map teleport graph (`tn` -> `pn` resolution within this map), shared
  // with the sidebar (for "Same map -> foo" labels) and the overlays (to
  // highlight every portal in the same teleport chain when one is selected).
  const portalGraph = useMemo(() => buildPortalGraph(portals, mapId), [portals, mapId]);

  const layers = useMemo<LayerDescriptor[]>(() => {
    let spawns = 0;
    let portalCount = 0;
    let teleports = 0;
    if (map) {
      for (const p of portals) {
        const layer = classifyPortal(p, map.id);
        if (layer === 'spawn') spawns += 1;
        else if (layer === 'portal' || layer === 'unknown') portalCount += 1;
        else if (layer === 'internalTeleport') teleports += 1;
      }
    }
    return [
      { key: 'spawns', label: 'Spawns', Icon: Sparkles, swatch: 'text-emerald-500', count: spawns },
      { key: 'portals', label: 'Portals', Icon: DoorOpen, swatch: 'text-sky-500', count: portalCount },
      { key: 'teleports', label: 'Teleports', Icon: Repeat, swatch: 'text-violet-500', count: teleports },
      { key: 'npcs', label: 'NPCs', Icon: Users, swatch: 'text-amber-500', count: npcs.length },
      { key: 'mobs', label: 'Mobs', Icon: Skull, swatch: 'text-rose-500', count: mobSpawns.length },
    ];
  }, [map, portals, npcs.length, mobSpawns.length]);

  const title = map
    ? map.name
      ? showIds
        ? `${map.name} · ${map.id}`
        : map.name
      : `Map ${map.id}`
    : `Map ${mapId}`;

  const centerX = map?.minimapCenterX ?? null;
  const centerY = map?.minimapCenterY ?? null;
  const mag = map?.minimapMag ?? null;
  const geometryReady =
    !!map?.minimapData && centerX !== null && centerY !== null && mag !== null && mag !== 0;

  const scrollKey = selection ? `${selection.kind}:${selection.key}` : null;

  return (
    <GraphicViewerModal
      open={open}
      onClose={onClose}
      title={title}
      description={map?.streetName ?? undefined}
      isLoading={isLoading || !map}
      loadingMessage="Loading map…"
      image={geometryReady ? map!.minimapData : null}
      imageUnavailableMessage="This map has no minimap geometry."
      imageLoadingMessage="Loading minimap…"
      ariaLabel={`Map of ${map?.name ?? `Map ${mapId}`}`}
      scrollKey={scrollKey}
      layers={layers}
      mobileSheetTitle="Browse map"
      toolbar={
        worldMapPlacements && worldMapPlacements.length > 0 && onOpenWorldMap ? (
          <div className="flex flex-col items-start gap-1">
            {worldMapPlacements.map((p) => (
              <button
                key={p.worldMapId}
                type="button"
                onClick={() => onOpenWorldMap(p.worldMapId)}
                className="border-border bg-card/90 text-foreground hover:bg-card inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs shadow-sm backdrop-blur"
              >
                <Globe2 className="h-3.5 w-3.5" /> {p.markerTitle ?? 'World map'}
              </button>
            ))}
          </div>
        ) : undefined
      }
      sidebar={({ enableLayer, closeMobile }) =>
        map ? (
          <MapViewerSidebar
            mapId={map.id}
            npcs={npcs}
            mobSpawns={mobSpawns}
            portals={portals}
            portalGraph={portalGraph}
            selection={selection}
            onSelect={(sel) => {
              onSelectionChange(sel);
              if (sel !== null) closeMobile?.();
            }}
            onHover={setHovered}
            onLayerEnable={enableLayer}
          />
        ) : null
      }
      overlays={({ view, visible }) => {
        if (!map || centerX === null || centerY === null || mag === null || mag === 0) return null;
        const { w: width, h: height } = view.imageSize;
        const declaredW = map.minimapWidth ?? width * mag;
        const declaredH = map.minimapHeight ?? height * mag;
        const ratioX = declaredW > 0 ? (width * mag) / declaredW : 1;
        const ratioY = declaredH > 0 ? (height * mag) / declaredH : 1;
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

        // Hover takes visual priority while present; selection persists otherwise.
        const effective = hovered ?? selection;
        const linkedPortalIdxSet =
          effective?.kind === 'portal'
            ? (portalGraph.componentOf.get(Number(effective.key)) ?? null)
            : null;
        const npcMatches = (id: number) => effective?.kind === 'npc' && effective.key === String(id);
        const mobMatches = (id: number) => effective?.kind === 'mob' && effective.key === String(id);

        return (
          <>
            {visible.mobs &&
              mobSpawns.map((m, i) => {
                if (m.x === null || m.y === null) return null;
                const p = project(m.x, m.y);
                if (!inBounds(p)) return null;
                const highlighted = mobMatches(m.mobId);
                return (
                  <GraphicViewerIcon
                    key={`mob-${i}`}
                    pixelX={p.x}
                    pixelY={p.y}
                    parentScale={view.scale}
                    Icon={Skull}
                    colorClass="text-rose-500"
                    ariaLabel={m.name ?? `Mob ${m.mobId}`}
                    tooltip={<MobHoverCard id={m.mobId} />}
                    highlighted={highlighted}
                    dimmed={effective !== null && !highlighted}
                    onClick={() => toggleSelect({ kind: 'mob', key: String(m.mobId) })}
                  />
                );
              })}

            {visible.npcs &&
              npcs.map((n, i) => {
                if (n.x === null || n.y === null) return null;
                const p = project(n.x, n.y);
                if (!inBounds(p)) return null;
                const highlighted = npcMatches(n.npcId);
                return (
                  <GraphicViewerIcon
                    key={`npc-${i}`}
                    pixelX={p.x}
                    pixelY={p.y}
                    parentScale={view.scale}
                    Icon={Users}
                    colorClass="text-amber-500"
                    ariaLabel={n.name ?? `NPC ${n.npcId}`}
                    tooltip={<NpcHoverCard id={n.npcId} />}
                    highlighted={highlighted}
                    dimmed={effective !== null && !highlighted}
                    onClick={() => toggleSelect({ kind: 'npc', key: String(n.npcId) })}
                  />
                );
              })}

            {portals.map((p) => {
              if (p.x === null || p.y === null) return null;
              const layer: PortalLayer = classifyPortal(p, map.id);
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
              const highlighted = effective?.kind === 'portal' && effective.key === String(p.idx);
              const linked =
                !highlighted &&
                linkedPortalIdxSet !== null &&
                linkedPortalIdxSet.has(p.idx) &&
                linkedPortalIdxSet.size > 1;
              // External portals jump to the target map's minimap; spawns and
              // same-map teleports have nowhere to go, so they toggle-select.
              const navigates =
                layer === 'portal' &&
                p.targetMapId !== null &&
                p.targetMapId !== 999999999 &&
                p.targetMapId !== map.id;
              return (
                <GraphicViewerIcon
                  key={`portal-${p.idx}`}
                  pixelX={projected.x}
                  pixelY={projected.y}
                  parentScale={view.scale}
                  Icon={meta.Icon}
                  colorClass={meta.color}
                  ariaLabel={`${meta.label} ${p.portalName}`}
                  tooltip={tooltip}
                  highlighted={highlighted}
                  linked={linked}
                  dimmed={effective !== null && !highlighted && !linked}
                  onClick={
                    navigates
                      ? () => onNavigateMap(p.targetMapId!)
                      : () => toggleSelect({ kind: 'portal', key: String(p.idx) })
                  }
                />
              );
            })}
          </>
        );
      }}
    />
  );
}
