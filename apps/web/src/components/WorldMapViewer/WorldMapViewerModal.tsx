import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  /** World map to show first. Parent navigation swaps it in place. */
  worldMapId: string;
  /** Highlight (and scroll to) the marker that contains this map id. */
  focusMapId?: number;
}

export function WorldMapViewerModal({
  open,
  onClose,
  worldMapId,
  focusMapId,
}: WorldMapViewerModalProps) {
  const navigate = useNavigate();
  const [currentId, setCurrentId] = useState(worldMapId);
  // Marker drilled into via canvas click / sidebar. Seeded from the focus map
  // on load (see below), then fully user-controlled — so the sidebar's "back"
  // can clear it rather than snapping back to the focus marker.
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  // Transient highlight from hovering a sidebar row — takes visual priority
  // over the selection but never scrolls. Intentionally not persisted.
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  // World map id the current selection was seeded for; guards one-time seeding.
  const seededFor = useRef<string | null>(null);

  // Re-sync to the requested world map whenever it changes or the modal
  // reopens, so navigation from a previous session doesn't stick.
  useEffect(() => {
    if (open) {
      setCurrentId(worldMapId);
      setSelectedMarkerId(null);
      setHoveredMarkerId(null);
      seededFor.current = null;
    }
  }, [open, worldMapId]);
  // Clear any drill-in when the displayed world map changes (parent nav) and
  // allow the new world map to seed afresh.
  useEffect(() => {
    setSelectedMarkerId(null);
    setHoveredMarkerId(null);
    seededFor.current = null;
  }, [currentId]);

  const { worldMap, markers, isLoading } = useWorldMapViewerData(currentId, open);

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

  // Once the world map's data has loaded, seed the drill-in with the focus
  // map's marker — but only once per world map, so clearing it sticks.
  useEffect(() => {
    if (isLoading || seededFor.current === currentId) return;
    seededFor.current = currentId;
    setSelectedMarkerId(focusMarkerId);
  }, [isLoading, currentId, focusMarkerId]);

  const goToMap = (mapId: number) => {
    navigate(`/maps/${mapId}`);
    onClose();
  };

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
      scrollKey={selectedMarkerId}
      layers={layers}
      mobileSheetTitle="Browse world map"
      toolbar={
        worldMap?.parentId ? (
          <button
            type="button"
            onClick={() => setCurrentId(worldMap.parentId!)}
            className="border-border bg-card/90 text-foreground hover:bg-card inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs shadow-sm backdrop-blur"
          >
            <ChevronUp className="h-3.5 w-3.5" /> Up one level
          </button>
        ) : undefined
      }
      sidebar={() => (
        <WorldMapViewerSidebar
          markers={markers}
          selectedMarkerId={selectedMarkerId}
          onSelectMarker={setSelectedMarkerId}
          onHoverMarker={setHoveredMarkerId}
          onNavigateMap={goToMap}
        />
      )}
      overlays={({ view, visible, openSidebar }) => {
        if (!worldMap || !visible.markers) return null;
        // Hover takes visual priority while present; selection persists otherwise.
        const effective = hoveredMarkerId ?? selectedMarkerId;
        return markers.map((m) => {
          const single = m.mapIds.length === 1;
          const firstId = m.mapIds[0];
          const label =
            firstId !== undefined ? (mapNameById.get(firstId) ?? `Map ${firstId}`) : (m.title ?? 'Marker');
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
                  ? () => goToMap(m.mapIds[0]!)
                  : () => {
                      setSelectedMarkerId(m.id);
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
