import { useEffect, useMemo, useState } from 'react';
import { List, Loader2 } from 'lucide-react';
import { Modal } from '@/components/collections';
import { buildPortalGraph, classifyPortal } from '@/domain/portal-types';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { MapViewerCanvas } from './MapViewerCanvas';
import { MapViewerLayerControls } from './MapViewerLayerControls';
import { MapViewerMobileSheet } from './MapViewerMobileSheet';
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
  const isMobile = useIsMobile();
  const showIds = useShowEntityIds((s) => s.enabled);

  const [visible, setVisible] = useState<LayerVisibility>(DEFAULT_VISIBLE);
  // Hover highlight is transient UI state — intentionally NOT in the URL.
  const [hovered, setHovered] = useState<MapViewerHighlight | null>(null);
  // Mobile-only: the entity browser lives in a bottom sheet behind a FAB.
  const [browserOpen, setBrowserOpen] = useState(false);

  // Clear stale hover state when the modal re-opens (selection is controlled,
  // so it's already coming from the URL — nothing to reset there).
  useEffect(() => {
    if (open) setHovered(null);
  }, [open]);
  // Close the mobile browser sheet when the parent modal closes so it doesn't
  // reappear stale next session.
  useEffect(() => {
    if (!open) setBrowserOpen(false);
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

  const title = map
    ? map.name
      ? showIds
        ? `${map.name} · ${map.id}`
        : map.name
      : `Map ${map.id}`
    : `Map ${mapId}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={map?.streetName ?? undefined}
      // Below md, claim the whole viewport — the desktop sidebar+canvas
      // split doesn't fit on a phone, and the bottom sheet replaces it.
      panelClassName="w-[95vw] h-[90vh] max-w-[1600px] max-md:h-[100dvh] max-md:w-screen max-md:max-w-none max-md:rounded-none"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      {isLoading || !map ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1">
          {!isMobile && (
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
          )}
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
          {isMobile && (
            <>
              <button
                type="button"
                onClick={() => setBrowserOpen(true)}
                aria-label="Browse map entities"
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/60 absolute bottom-4 right-4 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg focus-visible:outline-none focus-visible:ring-2"
              >
                <List className="h-5 w-5" />
              </button>
              <MapViewerMobileSheet
                open={browserOpen}
                onOpenChange={setBrowserOpen}
                mapId={map.id}
                npcs={npcs}
                mobSpawns={mobSpawns}
                portals={portals}
                portalGraph={portalGraph}
                selection={selection}
                onSelectionChange={onSelectionChange}
                onHover={setHovered}
                onLayerEnable={enableLayer}
              />
            </>
          )}
        </div>
      )}
      <MapViewerLayerControls value={visible} onChange={setVisible} counts={counts} />
    </Modal>
  );
}
