import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/collections';
import { buildPortalGraph, classifyPortal } from '@/lib/portal-types';
import { MapViewerCanvas } from './MapViewerCanvas';
import { MapViewerLayerControls } from './MapViewerLayerControls';
import { MapViewerSidebar } from './MapViewerSidebar';
import { useMapViewerData } from './useMapViewerData';
import type { LayerKey, LayerVisibility, MapViewerHighlight } from './types';

interface MapViewerModalProps {
  open: boolean;
  onClose: () => void;
  mapId: number;
  /** Controlled — the current sticky highlight. Lives in the URL so the
   *  viewer can be deep-linked / restored on reload. */
  selection: MapViewerHighlight | null;
  onSelectionChange: (sel: MapViewerHighlight | null) => void;
}

const DEFAULT_VISIBLE: LayerVisibility = {
  spawns: true,
  portals: true,
  teleports: true,
  npcs: true,
  mobs: true,
};

export function MapViewerModal({
  open,
  onClose,
  mapId,
  selection,
  onSelectionChange,
}: MapViewerModalProps) {
  const { map, npcs, portals, mobSpawns, isLoading } = useMapViewerData(mapId, open);

  const [visible, setVisible] = useState<LayerVisibility>(DEFAULT_VISIBLE);
  // Hover highlight is transient UI state — intentionally NOT in the URL.
  const [hovered, setHovered] = useState<MapViewerHighlight | null>(null);

  // Clear stale hover state when the modal re-opens (selection is controlled,
  // so it's already coming from the URL — nothing to reset there).
  useEffect(() => {
    if (open) setHovered(null);
  }, [open]);

  // Same-map teleport graph (`tn` -> `pn` resolution within this map).
  // Built once per (portals, mapId) and shared with the sidebar (to render
  // "Same map -> foo" labels) and the canvas (to highlight every portal in
  // the same teleport chain when one is selected/hovered).
  const portalGraph = useMemo(() => buildPortalGraph(portals, mapId), [portals, mapId]);

  const counts = useMemo<Record<LayerKey, number>>(() => {
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
    return {
      spawns,
      portals: portalCount,
      teleports,
      npcs: npcs.length,
      mobs: mobSpawns.length,
    };
  }, [map, portals, npcs.length, mobSpawns.length]);

  const enableLayer = (key: LayerKey) => {
    setVisible((v) => (v[key] ? v : { ...v, [key]: true }));
  };

  const title = map ? (map.name ? `${map.name} · ${map.id}` : `Map ${map.id}`) : `Map ${mapId}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={map?.streetName ?? undefined}
      panelClassName="w-[95vw] h-[90vh] max-w-[1600px]"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      {isLoading || !map ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <MapViewerSidebar
            mapId={map.id}
            npcs={npcs}
            mobSpawns={mobSpawns}
            portals={portals}
            portalGraph={portalGraph}
            selection={selection}
            onSelect={onSelectionChange}
            onHover={setHovered}
            onLayerEnable={enableLayer}
          />
          <MapViewerCanvas
            map={map}
            npcs={npcs}
            mobSpawns={mobSpawns}
            portals={portals}
            portalGraph={portalGraph}
            visible={visible}
            selection={selection}
            hovered={hovered}
          />
        </div>
      )}
      <MapViewerLayerControls value={visible} onChange={setVisible} counts={counts} />
    </Modal>
  );
}
