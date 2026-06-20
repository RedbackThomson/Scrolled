import { lazy, Suspense, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Copy,
  DoorOpen,
  Globe2,
  LogIn,
  Map as MapIcon,
  MapPin,
  Maximize,
  Skull,
  Users,
} from 'lucide-react';
import { DetailListSection } from '@/components/layout/DetailListSection';
import {
  DetailPageLayout,
  DetailPageLoading,
  DetailPageNotFound,
  InfoRow,
  InfoSection,
  SourceSection,
} from '@/components/layout/DetailPageLayout';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { EntityRow } from '@/components/entity-display/EntityRow';
import { ListSortControl } from '@/components/common/ListSortControl';
import { Badge } from '@/components/ui/badge';
import { MapLink } from '@/components/entity-links';
import { CollectionBadgeStrip } from '@/components/collections';
import type { MapViewerHighlight } from '@/components/MapViewer';
import { parseViewerParam, serializeViewerParam } from '@/components/MapViewer/viewerState';

const MapViewerModal = lazy(() =>
  import('@/components/MapViewer/MapViewerModal').then((m) => ({ default: m.MapViewerModal })),
);
const WorldMapViewerModal = lazy(() =>
  import('@/components/WorldMapViewer').then((m) => ({ default: m.WorldMapViewerModal })),
);
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient, type WorldMapForMap } from '@/db';
import { classifyPortal, isUsefulPortal, type PortalLayer } from '@scrolled/extractor/domain/portal-types';
import { useFeatures } from '@/hooks/useFeatures';
import { useListSort } from '@/hooks/useListSort';
import { useEntitySummaryNames } from '@/hooks/useEntitySummaries';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { useHideMinorPortals } from '@/stores/hideMinorPortals';

// Sentinel value the WZ data uses to mean "no map" for return / target fields.
const NO_TARGET = 999999999;

// Portal-row subtitle: the portal you take, and the portal you arrive at when
// the data names it. Shared by the outbound ("Portals") and inbound ("Ways in")
// lists so both read the same way under their leading map name.
function portalSubtitle(p: { portalName: string; targetPortal: string | null }): string {
  return p.targetPortal ? `${p.portalName} → ${p.targetPortal}` : p.portalName;
}

// Portal location, rendered like NPC/mob coords. Null when the portal carries
// no position so EntityRow's meta slot stays empty.
function portalCoords(p: { x: number | null; y: number | null }) {
  if (p.x === null && p.y === null) return null;
  return (
    <span className="font-mono">
      ({p.x ?? '?'}, {p.y ?? '?'})
    </span>
  );
}

// Default ordering for the Portals section: inter-map first, then intra-map
// teleports, then anything unclassified, then spawn points.
const PORTAL_LAYER_RANK: Record<PortalLayer, number> = {
  portal: 0,
  internalTeleport: 1,
  unknown: 2,
  spawn: 3,
};

export default function MapDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();
  const showIds = useShowEntityIds((s) => s.enabled);

  const mapQ = useQuery({
    queryKey: ['db', 'map', id],
    queryFn: () => client.getMap(id),
    enabled: Number.isFinite(id),
  });
  const worldMapsQ = useQuery({
    queryKey: ['db', 'map', id, 'world-maps'],
    queryFn: () => client.findWorldMapsForMap(id),
    enabled: Number.isFinite(id),
  });
  // One entry per distinct world map this map appears on (first containing
  // marker wins for the label). A map can sit on several world maps —
  // typically a broad overview plus a more specific regional map — so we
  // default to the deepest (leaf) placement in the parentMap hierarchy and
  // only surface several when they're genuinely equally specific.
  const worldMapPlacements = useMemo(() => {
    const seen = new Map<string, WorldMapForMap>();
    for (const p of worldMapsQ.data ?? []) if (!seen.has(p.worldMapId)) seen.set(p.worldMapId, p);
    const all = [...seen.values()];
    if (all.length === 0) return all;
    const maxDepth = Math.max(...all.map((p) => p.depth));
    return all.filter((p) => p.depth === maxDepth);
  }, [worldMapsQ.data]);
  const npcsQ = useQuery({
    queryKey: ['db', 'map', id, 'npcs'],
    queryFn: () => client.getMapNpcs(id),
    enabled: Number.isFinite(id) && features.hasNpcs,
  });
  const mobsQ = useQuery({
    queryKey: ['db', 'map', id, 'mobs'],
    queryFn: () => client.getMapMobs(id),
    enabled: Number.isFinite(id) && features.hasMobs,
  });
  const portalsQ = useQuery({
    queryKey: ['db', 'map', id, 'portals'],
    queryFn: () => client.getMapPortals(id),
    enabled: Number.isFinite(id),
  });
  const portalsInQ = useQuery({
    queryKey: ['db', 'map', id, 'portals-into'],
    queryFn: () => client.getMapPortalsInto(id),
    enabled: Number.isFinite(id),
  });

  // Batch-fetch display names for the return/forced-return maps so the aside
  // can show "Henesys" instead of a raw ID.
  const returnIds = useMemo(() => {
    const m = mapQ.data;
    if (!m) return [];
    const ids = new Set<number>();
    if (m.returnMapId !== null && m.returnMapId !== NO_TARGET) ids.add(m.returnMapId);
    if (m.forcedReturnMapId !== null && m.forcedReturnMapId !== NO_TARGET) {
      ids.add(m.forcedReturnMapId);
    }
    return [...ids].sort((a, b) => a - b);
  }, [mapQ.data]);
  const returnNameById = useEntitySummaryNames('map', returnIds);

  const npcsSort = useListSort(npcsQ.data, [
    { id: 'name', label: 'Name', get: (n) => n.name },
    { id: 'id', label: 'NPC ID', get: (n) => n.npcId },
  ]);
  const mobsSort = useListSort(mobsQ.data, [
    { id: 'name', label: 'Name', get: (m) => m.name },
    { id: 'level', label: 'Level', get: (m) => m.level },
    { id: 'count', label: 'Count', get: (m) => m.count },
  ]);
  // Default portal order groups by purpose so users see how to leave the map
  // first, then teleports within it, then anything ambiguous, then spawn
  // points. The query returns rows in WZ `idx` order, which we preserve as the
  // intra-bucket tiebreaker.
  const portalsOrdered = useMemo(() => {
    if (!portalsQ.data) return undefined;
    return [...portalsQ.data].sort((a, b) => {
      const ra = PORTAL_LAYER_RANK[classifyPortal(a, id)];
      const rb = PORTAL_LAYER_RANK[classifyPortal(b, id)];
      return ra !== rb ? ra - rb : a.idx - b.idx;
    });
  }, [portalsQ.data, id]);
  // Spawn points, GM portals, and dead-end teleports clutter the list without
  // telling a visitor anything they can act on. Hidden by default; the toggle
  // only appears when there's actually something to hide.
  const hideMinorPortals = useHideMinorPortals((s) => s.enabled);
  const minorPortalCount = useMemo(
    () => portalsOrdered?.reduce((n, p) => (isUsefulPortal(p, id) ? n : n + 1), 0) ?? 0,
    [portalsOrdered, id],
  );
  const portalsVisible = useMemo(() => {
    if (!portalsOrdered) return undefined;
    return hideMinorPortals ? portalsOrdered.filter((p) => isUsefulPortal(p, id)) : portalsOrdered;
  }, [portalsOrdered, hideMinorPortals, id]);
  const portalsSort = useListSort(portalsVisible, [
    { id: 'portal', label: 'Portal name', get: (p) => p.portalName },
    {
      id: 'target',
      label: 'Target map',
      get: (p) =>
        p.targetMapId === null || p.targetMapId === NO_TARGET
          ? null
          : (p.targetMapName ?? p.targetMapId),
    },
  ]);
  // Inbound portals come pre-ordered by source map name. We drop GM/staff-only
  // ones — from the source map's perspective a portal that targets us is a
  // normal external doorway, so classify it against its own map id.
  const portalsInVisible = useMemo(
    () => portalsInQ.data?.filter((p) => isUsefulPortal(p, p.mapId)),
    [portalsInQ.data],
  );

  // The whole viewer lives in the URL so every level — minimap, world map,
  // a drilled region — is hard-linkable and recalled by browser back/forward.
  //   ?viewer=1|npc:..|…   → minimap viewer for this route's map
  //   ?worldmap=<id>       → world map viewer (focused on this route's map)
  //   &region=<index>      → drilled into that world map's marker
  // The two views are mutually exclusive; opening one clears the other.
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewerParam = searchParams.get('viewer');
  const viewerState = useMemo(() => parseViewerParam(viewerParam), [viewerParam]);
  const worldMapId = searchParams.get('worldmap');
  const regionParam = searchParams.get('region');
  const regionMarkerIndex =
    regionParam !== null && regionParam !== '' && Number.isFinite(Number(regionParam))
      ? Number(regionParam)
      : null;

  const writeViewerParam = useCallback(
    (next: { open: boolean; highlight: MapViewerHighlight | null }, opts: { replace: boolean }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const serialized = serializeViewerParam(next.open, next.highlight);
          if (serialized === null) {
            params.delete('viewer');
          } else {
            params.set('viewer', serialized);
            // Minimap and world map are mutually exclusive.
            params.delete('worldmap');
            params.delete('region');
          }
          return params;
        },
        { replace: opts.replace },
      );
    },
    [setSearchParams],
  );

  // Open/close add history entries (so back button closes the modal).
  // Selection changes inside the modal use `replace` so the back-stack
  // doesn't fill up with every entity the user clicks on.
  const openViewer = (highlight: MapViewerHighlight | null = null) =>
    writeViewerParam({ open: true, highlight }, { replace: false });
  const closeViewer = () => writeViewerParam({ open: false, highlight: null }, { replace: false });
  const setViewerSelection = (highlight: MapViewerHighlight | null) =>
    writeViewerParam({ open: true, highlight }, { replace: true });

  // World map navigation — each step pushes a history entry.
  const openWorldMap = useCallback(
    (wmId: string) =>
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.delete('viewer');
          params.delete('region');
          params.set('worldmap', wmId);
          return params;
        },
        { replace: false },
      ),
    [setSearchParams],
  );
  const navigateWorldMap = (wmId: string) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('region');
        params.set('worldmap', wmId);
        return params;
      },
      { replace: false },
    );
  const drillRegion = (markerIndex: number | null) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (markerIndex === null) params.delete('region');
        else params.set('region', String(markerIndex));
        return params;
      },
      { replace: false },
    );
  const closeWorldMap = () =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('worldmap');
        params.delete('region');
        return params;
      },
      { replace: false },
    );
  // Clicking a map in the world map hard-links to its minimap viewer.
  const openMapMinimap = (mapId: number) => navigate(`/maps/${mapId}?viewer=1`);

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'open-mapviewer',
        group: 'context',
        label: 'Open in MapViewer',
        keywords: ['minimap', 'viewer', 'map'],
        icon: Maximize,
        onSelect: () => writeViewerParam({ open: true, highlight: null }, { replace: false }),
      },
      ...(worldMapPlacements.length > 0
        ? [
            {
              id: 'open-world-map',
              group: 'context' as const,
              label: 'Open world map',
              keywords: ['world', 'map', 'region', 'overview'],
              icon: Globe2,
              onSelect: () => openWorldMap(worldMapPlacements[0]!.worldMapId),
            },
          ]
        : []),
      {
        id: 'copy-map-id',
        group: 'context',
        label: 'Copy map ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id, writeViewerParam, worldMapPlacements, openWorldMap],
  );
  useDetailPalette({ entity: 'map', id, name: mapQ.data?.name, items: paletteItems });
  usePageTitle(mapQ.data?.name);

  if (mapQ.isLoading) return <DetailPageLoading entity="Map" id={id} />;
  if (!mapQ.data) return <DetailPageNotFound entity="Map" id={id} />;

  const m = mapQ.data;
  return (
    <>
      <DetailPageLayout
        maxWidth="max-w-5xl"
        header={
          <header className="flex items-center gap-3">
            <EntityIcon
              entity="map-mark"
              id={m.id}
              size={48}
              placeholder={MapIcon}
              alt={m.name ?? `Map ${m.id}`}
            />
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-xl font-semibold tracking-tight md:text-3xl">
                {m.name ?? `Map ${m.id}`}
              </h1>
              {m.streetName && <p className="text-muted-foreground text-sm">{m.streetName}</p>}
              {showIds && <p className="text-muted-foreground font-mono text-xs">{m.id}</p>}
            </div>
          </header>
        }
        aside={
          <>
            <InfoSection title="Info">
              {showIds && <InfoRow label="ID" value={String(m.id)} mono />}
              <InfoRow label="Street" value={m.streetName ?? '—'} />
            </InfoSection>
            {(m.returnMapId !== null || m.forcedReturnMapId !== null) && (
              <InfoSection title="Connections">
                {m.returnMapId !== null && m.returnMapId !== NO_TARGET && (
                  <RowLink
                    label="Return map"
                    id={m.returnMapId}
                    name={returnNameById.get(m.returnMapId) ?? null}
                  />
                )}
                {m.forcedReturnMapId !== null && m.forcedReturnMapId !== NO_TARGET && (
                  <RowLink
                    label="Forced return"
                    id={m.forcedReturnMapId}
                    name={returnNameById.get(m.forcedReturnMapId) ?? null}
                  />
                )}
              </InfoSection>
            )}
            {(m.fieldLimit !== null || m.mobRate !== null) && (
              <InfoSection title="Stats">
                {m.fieldLimit !== null && (
                  <InfoRow label="Field limit" value={String(m.fieldLimit)} />
                )}
                {m.mobRate !== null && <InfoRow label="Mob rate" value={m.mobRate.toFixed(2)} />}
              </InfoSection>
            )}
            <SourceSection path={m.sourcePath} />
          </>
        }
      >
        <CollectionBadgeStrip entityType="map" entityId={m.id} />

        {m.minimapPath && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Minimap</h2>
            <div className="flex flex-col items-start gap-2 sm:max-w-full">
              <button
                type="button"
                onClick={() => openViewer()}
                aria-label="Open map viewer"
                className="border-border bg-card hover:ring-primary/40 focus-visible:ring-primary/60 sm:width-full inline-flex max-w-full items-center justify-start rounded-md border p-3 transition hover:ring-2 focus-visible:outline-none focus-visible:ring-2"
              >
                <EntityIcon
                  entity="map-mini"
                  id={m.id}
                  placeholder={MapIcon}
                  fit={{ maxWidth: 480, maxHeight: 360 }}
                  alt={`Minimap for ${m.name ?? `Map ${m.id}`}`}
                />
              </button>
              <button
                type="button"
                onClick={() => openViewer()}
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" /> Show map details
              </button>
            </div>
          </section>
        )}

        {features.hasNpcs && (
          <DetailListSection
            icon={Users}
            title="NPCs"
            count={npcsQ.data?.length}
            isEmpty={npcsQ.data?.length === 0}
            action={
              npcsQ.data && npcsQ.data.length > 0 ? (
                <ListSortControl
                  fields={npcsSort.fieldOptions}
                  value={npcsSort.sort}
                  onChange={npcsSort.setSort}
                />
              ) : null
            }
          >
            {npcsSort.sorted.map((n) => (
              <EntityRow
                key={`${n.npcId}-${n.x}-${n.y}`}
                entity="npc"
                id={n.npcId}
                name={n.name}
                meta={
                  n.x !== null || n.y !== null ? (
                    <span className="font-mono">
                      ({n.x ?? '?'}, {n.y ?? '?'})
                    </span>
                  ) : undefined
                }
                trailing={
                  m.minimapPath && (
                    <button
                      type="button"
                      onClick={() => openViewer({ kind: 'npc', key: String(n.npcId) })}
                      aria-label={`Show ${n.name ?? `NPC ${n.npcId}`} on map`}
                      title="Show on map"
                      className="text-muted-foreground hover:bg-background hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                    >
                      <MapPin className="h-4 w-4" />
                    </button>
                  )
                }
              />
            ))}
          </DetailListSection>
        )}

        {features.hasMobs && (
          <DetailListSection
            icon={Skull}
            title="Mobs"
            count={mobsQ.data?.length}
            isEmpty={mobsQ.data?.length === 0}
            action={
              mobsQ.data && mobsQ.data.length > 0 ? (
                <ListSortControl
                  fields={mobsSort.fieldOptions}
                  value={mobsSort.sort}
                  onChange={mobsSort.setSort}
                />
              ) : null
            }
          >
            {mobsSort.sorted.map((mob) => (
              <EntityRow
                key={mob.mobId}
                entity="mob"
                id={mob.mobId}
                name={mob.name}
                meta={
                  (mob.level !== null || (mob.count !== null && mob.count > 1)) && (
                    <span className="flex items-center gap-3">
                      {mob.level !== null && <span>Lvl {mob.level}</span>}
                      {mob.count !== null && mob.count > 1 && <span>×{mob.count}</span>}
                    </span>
                  )
                }
                trailing={
                  m.minimapPath && (
                    <button
                      type="button"
                      onClick={() => openViewer({ kind: 'mob', key: String(mob.mobId) })}
                      aria-label={`Show ${mob.name ?? `Mob ${mob.mobId}`} on map`}
                      title="Show on map"
                      className="text-muted-foreground hover:bg-background hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                    >
                      <MapPin className="h-4 w-4" />
                    </button>
                  )
                }
              />
            ))}
          </DetailListSection>
        )}

        <DetailListSection
          icon={DoorOpen}
          title="Portals"
          count={portalsVisible?.length}
          isEmpty={portalsVisible?.length === 0}
          emptyLabel={
            hideMinorPortals && minorPortalCount > 0
              ? 'Only spawn and system portals here, hidden by your settings.'
              : 'None.'
          }
          action={
            portalsVisible && portalsVisible.length > 0 ? (
              <ListSortControl
                fields={portalsSort.fieldOptions}
                value={portalsSort.sort}
                onChange={portalsSort.setSort}
              />
            ) : null
          }
        >
          {portalsSort.sorted.map((p) => {
            const layer = classifyPortal(p, id);
            const coords = portalCoords(p);
            const pin = m.minimapPath ? (
              <button
                type="button"
                onClick={() => openViewer({ kind: 'portal', key: String(p.idx) })}
                aria-label={`Show portal ${p.portalName} on map`}
                title="Show on map"
                className="text-muted-foreground hover:bg-background hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
              >
                <MapPin className="h-4 w-4" />
              </button>
            ) : null;
            return layer === 'portal' ? (
              <EntityRow
                key={p.idx}
                entity="map"
                id={p.targetMapId!}
                name={p.targetMapName}
                subtitle={portalSubtitle(p)}
                meta={coords}
                trailing={pin}
              />
            ) : (
              // Teleports that loop back into this map (or spawn points and
              // scripted dead-ends) have no other map to lead with — leading
              // with this map's own name would read as a map→map portal. Lead
              // with the portal name and tag internal teleports so they're not
              // mistaken for a way out.
              <EntityRow
                key={p.idx}
                entity="map"
                id={p.idx}
                name={`Portal ${p.portalName}`}
                subtitle={p.script ?? (p.targetPortal ? `→ ${p.targetPortal}` : null)}
                meta={
                  layer === 'internalTeleport' || coords ? (
                    <span className="flex items-center gap-2">
                      {layer === 'internalTeleport' && <Badge tone="slate">Internal teleport</Badge>}
                      {coords}
                    </span>
                  ) : undefined
                }
                linkable={false}
                hideId
                trailing={pin}
              />
            );
          })}
        </DetailListSection>

        {portalsInVisible && portalsInVisible.length > 0 && (
          <DetailListSection icon={LogIn} title="Ways in" count={portalsInVisible.length}>
            {portalsInVisible.map((p) => (
              <EntityRow
                key={`${p.mapId}-${p.idx}`}
                entity="map"
                id={p.mapId}
                name={p.sourceMapName}
                subtitle={portalSubtitle(p)}
                meta={portalCoords(p)}
              />
            ))}
          </DetailListSection>
        )}
      </DetailPageLayout>

      {viewerState.open ? (
        <Suspense fallback={null}>
          <MapViewerModal
            open={viewerState.open}
            onClose={closeViewer}
            mapId={m.id}
            selection={viewerState.highlight}
            onSelectionChange={setViewerSelection}
            onNavigateMap={openMapMinimap}
            worldMapPlacements={worldMapPlacements}
            onOpenWorldMap={openWorldMap}
          />
        </Suspense>
      ) : null}

      {worldMapId && !viewerState.open ? (
        <Suspense fallback={null}>
          <WorldMapViewerModal
            open
            onClose={closeWorldMap}
            worldMapId={worldMapId}
            focusMapId={m.id}
            regionMarkerIndex={regionMarkerIndex}
            onOpenMap={openMapMinimap}
            onNavigateWorldMap={navigateWorldMap}
            onDrillRegion={drillRegion}
          />
        </Suspense>
      ) : null}
    </>
  );
}

function RowLink({ label, id, name }: { label: string; id: number; name: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="min-w-0 truncate text-sm">
        <MapLink id={id} className="text-primary hover:underline">
          {name ?? `Map ${id}`}
        </MapLink>
      </dd>
    </div>
  );
}
