import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, MapPin } from 'lucide-react';
import {
  GraphicViewerModal,
  GraphicViewerIcon,
  type LayerDescriptor,
} from '@/components/GraphicViewer';
import { MapLink } from '@/components/entity-links';
import type { WorldMapMarkerWithMaps } from '@/db';
import { useWorldMapViewerData } from './useWorldMapViewerData';

interface WorldMapViewerModalProps {
  open: boolean;
  onClose: () => void;
  /** World map to show first. Parent navigation swaps it in place. */
  worldMapId: string;
  /** Highlight (and scroll to) the marker that contains this map id. */
  focusMapId?: number;
}

function MarkerTooltip({ marker }: { marker: WorldMapMarkerWithMaps }) {
  return (
    <div className="space-y-1 text-xs">
      {marker.title && <div className="text-foreground font-medium">{marker.title}</div>}
      {marker.description && <div className="text-muted-foreground">{marker.description}</div>}
      <div className="flex flex-col gap-0.5">
        {marker.mapIds.map((id) => (
          <MapLink key={id} id={id} className="text-primary hover:underline">
            Map {id}
          </MapLink>
        ))}
      </div>
    </div>
  );
}

export function WorldMapViewerModal({
  open,
  onClose,
  worldMapId,
  focusMapId,
}: WorldMapViewerModalProps) {
  const navigate = useNavigate();
  const [currentId, setCurrentId] = useState(worldMapId);

  // Re-sync to the requested world map whenever it changes or the modal
  // reopens, so parent navigation from a previous session doesn't stick.
  useEffect(() => {
    if (open) setCurrentId(worldMapId);
  }, [open, worldMapId]);

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
      scrollKey={focusMarkerId}
      layers={layers}
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
      overlays={({ view, visible }) => {
        if (!worldMap || !visible.markers) return null;
        return markers.map((m) => {
          const single = m.mapIds.length === 1;
          return (
            <GraphicViewerIcon
              key={m.id}
              pixelX={worldMap.originX + m.wzX}
              pixelY={worldMap.originY + m.wzY}
              parentScale={view.scale}
              Icon={MapPin}
              colorClass="text-sky-500"
              ariaLabel={m.title ?? `Region of ${m.mapIds.length} maps`}
              tooltip={<MarkerTooltip marker={m} />}
              highlighted={m.id === focusMarkerId}
              dimmed={focusMarkerId !== null && m.id !== focusMarkerId}
              onClick={single ? () => goToMap(m.mapIds[0]!) : undefined}
            />
          );
        });
      }}
    />
  );
}
