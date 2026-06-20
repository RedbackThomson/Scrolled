import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, MapPin } from 'lucide-react';
import {
  GraphicViewerModal,
  GraphicViewerIcon,
  type LayerDescriptor,
} from '@/components/GraphicViewer';
import { MapHoverCard } from '@/components/entity-links';
import { useEntitySummaryNames } from '@/hooks/useEntitySummaries';
import { useWorldMapViewerData } from './useWorldMapViewerData';
import { WorldMapViewerSidebar } from './WorldMapViewerSidebar';

interface WorldMapViewerModalProps {
  open: boolean;
  onClose: () => void;
  /** World map currently shown — driven by the URL. */
  worldMapId: string;
  /** Highlight (and scroll to) the marker that contains this map id. */
  focusMapId?: number;
  /** Marker index drilled into, from the URL (`region` param), or null. */
  regionMarkerIndex: number | null;
  /** Open a map's minimap viewer (hard-links to `/maps/:id`). */
  onOpenMap: (mapId: number) => void;
  /** Switch the viewer to another world map (e.g. the parent). */
  onNavigateWorldMap: (worldMapId: string) => void;
  /** Drill into a region marker (or clear with null). */
  onDrillRegion: (markerIndex: number | null) => void;
}

/** Marker ids are `"<worldMapId>:<index>"`; pull the trailing index back out. */
function markerIndexOf(markerId: string): number {
  return Number(markerId.slice(markerId.lastIndexOf(':') + 1));
}

export function WorldMapViewerModal({
  open,
  onClose,
  worldMapId,
  focusMapId,
  regionMarkerIndex,
  onOpenMap,
  onNavigateWorldMap,
  onDrillRegion,
}: WorldMapViewerModalProps) {
  // Transient highlight from hovering a sidebar row — never persisted.
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  // Drop stale hover when the displayed world map changes.
  useEffect(() => setHoveredMarkerId(null), [worldMapId]);

  const { worldMap, markers, isLoading } = useWorldMapViewerData(worldMapId, open);

  const layers = useMemo<LayerDescriptor[]>(
    () => [
      {
        key: 'markers',
        label: 'Markers',
        Icon: MapPin,
        swatch: 'text-sky-500',
        count: markers.length,
      },
    ],
    [markers.length],
  );

  const focusMarkerId = useMemo(() => {
    if (focusMapId === undefined) return null;
    return markers.find((m) => m.mapIds.includes(focusMapId))?.id ?? null;
  }, [markers, focusMapId]);

  // The drilled-into marker (URL `region`), if any.
  const drilledMarkerId = regionMarkerIndex !== null ? `${worldMapId}:${regionMarkerIndex}` : null;

  // Each marker's hover label is the name of its first map (matching in-game):
  // single markers show that map, regions default to their first. One batched
  // lookup over the representative ids keeps it cheap.
  const representativeMapIds = useMemo(() => {
    const ids = new Set<number>();
    for (const m of markers) {
      const first = m.mapIds[0];
      if (first !== undefined) ids.add(first);
    }
    return [...ids].sort((a, b) => a - b);
  }, [markers]);
  const mapNameById = useEntitySummaryNames('map', representativeMapIds);

  // Hover wins; otherwise the drilled region, otherwise the focus map's marker.
  const effective = hoveredMarkerId ?? drilledMarkerId ?? focusMarkerId;

  return (
    <GraphicViewerModal
      open={open}
      onClose={onClose}
      title="World Map"
      isLoading={isLoading || !worldMap}
      loadingMessage="Loading world map…"
      image={worldMap?.baseImageData ?? null}
      imageUnavailableMessage="This world map has no image."
      imageLoadingMessage="Loading world map…"
      ariaLabel="World Map"
      scrollKey={drilledMarkerId ?? focusMarkerId}
      layers={layers}
      mobileSheetTitle="Browse world map"
      toolbar={
        worldMap?.parentId ? (
          <button
            type="button"
            onClick={() => onNavigateWorldMap(worldMap.parentId!)}
            className="border-border bg-card/90 text-foreground hover:bg-card inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs shadow-sm backdrop-blur"
          >
            <ChevronUp className="h-3.5 w-3.5" /> Up one level
          </button>
        ) : undefined
      }
      sidebar={() => (
        <WorldMapViewerSidebar
          markers={markers}
          selectedMarkerId={drilledMarkerId}
          onSelectMarker={(id) => onDrillRegion(id ? markerIndexOf(id) : null)}
          onHoverMarker={setHoveredMarkerId}
          onNavigateMap={onOpenMap}
        />
      )}
      overlays={({ view, visible, openSidebar }) => {
        if (!worldMap || !visible.markers) return null;
        return markers.map((m) => {
          const single = m.mapIds.length === 1;
          const firstId = m.mapIds[0];
          const label =
            firstId !== undefined
              ? (mapNameById.get(firstId) ?? `Map ${firstId}`)
              : (m.title ?? 'Marker');
          return (
            <GraphicViewerIcon
              key={m.id}
              pixelX={worldMap.originX + m.wzX}
              pixelY={worldMap.originY + m.wzY}
              parentScale={view.scale}
              Icon={MapPin}
              colorClass="text-sky-500"
              ariaLabel={label}
              tooltip={
                firstId !== undefined ? (
                  <div className="space-y-1.5">
                    <MapHoverCard id={firstId} />
                    <div className="border-border text-muted-foreground border-t pt-1.5 text-[11px]">
                      {single ? 'Click to open' : `${m.mapIds.length} maps · click to browse`}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs">{m.title ?? 'Marker'}</div>
                )
              }
              highlighted={m.id === effective}
              dimmed={effective !== null && m.id !== effective}
              onClick={
                single
                  ? () => onOpenMap(m.mapIds[0]!)
                  : () => {
                      onDrillRegion(markerIndexOf(m.id));
                      openSidebar();
                    }
              }
            />
          );
        });
      }}
    />
  );
}
