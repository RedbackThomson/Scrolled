import { useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, DoorOpen, Map as MapIcon, MapPin, Maximize, Skull, Users } from 'lucide-react';
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
import { MapPortalRow } from '@/components/entity-display/MapPortalRow';
import { ListSortControl } from '@/components/common/ListSortControl';
import { MapLink } from '@/components/entity-links';
import { CollectionBadgeStrip } from '@/components/collections';
import { MapViewerModal, type MapViewerHighlight } from '@/components/MapViewer';
import { parseViewerParam, serializeViewerParam } from '@/components/MapViewer/viewerState';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import { classifyPortal, type PortalLayer } from '@/domain/portal-types';
import { useFeatures } from '@/hooks/useFeatures';
import { useListSort } from '@/hooks/useListSort';
import { useEntitySummaryNames } from '@/hooks/useEntitySummaries';
import { useShowEntityIds } from '@/stores/showEntityIds';

// Sentinel value the WZ data uses to mean "no map" for return / target fields.
const NO_TARGET = 999999999;

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
  const portalsSort = useListSort(portalsOrdered, [
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

  // Viewer open + selection live in the URL (`?viewer=1`, `?viewer=npc:1234`,
  // …) so the modal can be hard-linked and restored on reload.
  const [searchParams, setSearchParams] = useSearchParams();
  const viewerParam = searchParams.get('viewer');
  const viewerState = useMemo(() => parseViewerParam(viewerParam), [viewerParam]);

  const writeViewerParam = useCallback(
    (next: { open: boolean; highlight: MapViewerHighlight | null }, opts: { replace: boolean }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const serialized = serializeViewerParam(next.open, next.highlight);
          if (serialized === null) params.delete('viewer');
          else params.set('viewer', serialized);
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
      {
        id: 'copy-map-id',
        group: 'context',
        label: 'Copy map ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id, writeViewerParam],
  );
  useDetailPalette({ entity: 'map', id, name: mapQ.data?.name, items: paletteItems });

  if (mapQ.isLoading) return <DetailPageLoading entity="Map" id={id} />;
  if (!mapQ.data) return <DetailPageNotFound entity="Map" id={id} />;

  const m = mapQ.data;
  return (
    <>
      <DetailPageLayout
        maxWidth="max-w-5xl"
        header={
          <header className="flex items-center gap-3">
            <MapIcon className="text-muted-foreground h-12 w-12 shrink-0" />
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
                      {mob.level !== null && <span>Lv {mob.level}</span>}
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
          count={portalsQ.data?.length}
          isEmpty={portalsQ.data?.length === 0}
          action={
            portalsQ.data && portalsQ.data.length > 0 ? (
              <ListSortControl
                fields={portalsSort.fieldOptions}
                value={portalsSort.sort}
                onChange={portalsSort.setSort}
              />
            ) : null
          }
        >
          {portalsSort.sorted.map((p) => (
            <MapPortalRow
              key={`${p.portalName}-${p.x ?? 0}-${p.y ?? 0}`}
              portal={p}
              noTargetId={NO_TARGET}
              trailing={
                m.minimapPath && (
                  <button
                    type="button"
                    onClick={() => openViewer({ kind: 'portal', key: String(p.idx) })}
                    aria-label={`Show portal ${p.portalName} on map`}
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
      </DetailPageLayout>

      <MapViewerModal
        open={viewerState.open}
        onClose={closeViewer}
        mapId={m.id}
        selection={viewerState.highlight}
        onSelectionChange={setViewerSelection}
      />
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
