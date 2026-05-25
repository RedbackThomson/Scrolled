import { useCallback, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Copy,
  DoorOpen,
  Loader2,
  Map as MapIcon,
  MapPin,
  Maximize,
  Skull,
  Users,
} from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { EntityRow } from '@/components/EntityRow';
import { ListSectionHeader } from '@/components/ListSectionHeader';
import { ListSortControl } from '@/components/ListSortControl';
import { MapLink } from '@/components/entity-links';
import { CollectionBadgeStrip } from '@/components/collections';
import { MapViewerModal, type MapViewerHighlight } from '@/components/MapViewer';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import { useFeatures } from '@/lib/useFeatures';
import { useListSort } from '@/lib/useListSort';

// Sentinel value the WZ data uses to mean "no map" for return / target fields.
const NO_TARGET = 999999999;

export default function MapDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();

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
  const returnNamesQ = useQuery({
    queryKey: ['db', 'map-summaries', returnIds],
    queryFn: () => client.getEntitySummariesByIds('map', returnIds),
    enabled: returnIds.length > 0,
    staleTime: 5 * 60_000,
  });
  const returnNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of returnNamesQ.data ?? []) m.set(s.id, s.name);
    return m;
  }, [returnNamesQ.data]);

  const npcsSort = useListSort(npcsQ.data, [
    { id: 'name', label: 'Name', get: (n) => n.name },
    { id: 'id', label: 'NPC ID', get: (n) => n.npcId },
  ]);
  const mobsSort = useListSort(mobsQ.data, [
    { id: 'name', label: 'Name', get: (m) => m.name },
    { id: 'level', label: 'Level', get: (m) => m.level },
    { id: 'count', label: 'Count', get: (m) => m.count },
  ]);
  const portalsSort = useListSort(portalsQ.data, [
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

  if (mapQ.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading map {id}…
      </p>
    );
  }
  if (!mapQ.data) {
    return (
      <div className="max-w-3xl">
        <Link
          to="/maps"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to maps
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Map not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Map <code className="font-mono">{id}</code> isn't in your library yet. It may not have
          been loaded —{' '}
          <Link to="/setup" className="text-primary hover:underline">
            visit Setup
          </Link>{' '}
          to add more files.
        </p>
      </div>
    );
  }

  const m = mapQ.data;
  return (
    <div className="max-w-5xl space-y-6">
      <Link
        to="/maps"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to maps
      </Link>

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <article className="space-y-6">
          <header className="flex items-center gap-3">
            <MapIcon className="text-muted-foreground h-12 w-12" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{m.name ?? `Map ${m.id}`}</h1>
              {m.streetName && <p className="text-muted-foreground text-sm">{m.streetName}</p>}
              <p className="text-muted-foreground font-mono text-xs">{m.id}</p>
            </div>
          </header>

          <CollectionBadgeStrip entityType="map" entityId={m.id} />

          {m.minimapPath && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Minimap</h2>
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() => openViewer()}
                  aria-label="Open map viewer"
                  className="border-border bg-card hover:ring-primary/40 focus-visible:ring-primary/60 inline-flex max-w-full items-center justify-start rounded-md border p-3 transition hover:ring-2 focus-visible:outline-none focus-visible:ring-2"
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
            <section>
              <ListSectionHeader
                icon={Users}
                title="NPCs"
                count={npcsQ.data?.length}
                action={
                  npcsQ.data && npcsQ.data.length > 0 ? (
                    <ListSortControl
                      fields={npcsSort.fieldOptions}
                      value={npcsSort.sort}
                      onChange={npcsSort.setSort}
                    />
                  ) : null
                }
              />
              {npcsQ.data && npcsQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {npcsQ.data && npcsQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
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
                            className="text-muted-foreground hover:bg-background hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            <MapPin className="h-4 w-4" />
                          </button>
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          )}

          {features.hasMobs && (
            <section>
              <ListSectionHeader
                icon={Skull}
                title="Mobs"
                count={mobsQ.data?.length}
                action={
                  mobsQ.data && mobsQ.data.length > 0 ? (
                    <ListSortControl
                      fields={mobsSort.fieldOptions}
                      value={mobsSort.sort}
                      onChange={mobsSort.setSort}
                    />
                  ) : null
                }
              />
              {mobsQ.data && mobsQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {mobsQ.data && mobsQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
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
                            className="text-muted-foreground hover:bg-background hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            <MapPin className="h-4 w-4" />
                          </button>
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          )}

          <section>
            <ListSectionHeader
              icon={DoorOpen}
              title="Portals"
              count={portalsQ.data?.length}
              action={
                portalsQ.data && portalsQ.data.length > 0 ? (
                  <ListSortControl
                    fields={portalsSort.fieldOptions}
                    value={portalsSort.sort}
                    onChange={portalsSort.setSort}
                  />
                ) : null
              }
            />
            {portalsQ.data && portalsQ.data.length === 0 && (
              <p className="text-muted-foreground text-xs italic">None.</p>
            )}
            {portalsQ.data && portalsQ.data.length > 0 && (
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {portalsSort.sorted.map((p) => (
                  <li
                    key={`${p.portalName}-${p.x ?? 0}-${p.y ?? 0}`}
                    className="flex items-center gap-3 px-3 py-1.5 text-sm"
                  >
                    <span className="font-mono text-xs">{p.portalName}</span>
                    <span className="text-muted-foreground">→</span>
                    {p.targetMapId && p.targetMapId !== NO_TARGET ? (
                      <MapLink
                        id={p.targetMapId}
                        className="text-primary min-w-0 flex-1 truncate hover:underline"
                      >
                        {p.targetMapName ?? `Map ${p.targetMapId}`}
                        {p.targetPortal && (
                          <span className="text-muted-foreground"> · {p.targetPortal}</span>
                        )}
                      </MapLink>
                    ) : (
                      <span className="text-muted-foreground italic">no target</span>
                    )}
                    {(p.x !== null || p.y !== null) && (
                      <span className="text-muted-foreground ml-auto shrink-0 font-mono text-xs">
                        ({p.x ?? '?'}, {p.y ?? '?'})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </article>

        <MapViewerModal
          open={viewerState.open}
          onClose={closeViewer}
          mapId={m.id}
          selection={viewerState.highlight}
          onSelectionChange={setViewerSelection}
        />

        <aside className="border-border bg-card text-card-foreground space-y-4 self-start rounded-md border p-4 text-sm">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Info</h2>
            <dl className="divide-border divide-y">
              <Row label="ID" value={String(m.id)} mono />
              <Row label="Street" value={m.streetName ?? '—'} />
            </dl>
          </section>

          {(m.returnMapId !== null || m.forcedReturnMapId !== null) && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Connections</h2>
              <dl className="divide-border divide-y">
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
              </dl>
            </section>
          )}

          {(m.fieldLimit !== null || m.mobRate !== null) && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Stats</h2>
              <dl className="divide-border divide-y">
                {m.fieldLimit !== null && <Row label="Field limit" value={String(m.fieldLimit)} />}
                {m.mobRate !== null && <Row label="Mob rate" value={m.mobRate.toFixed(2)} />}
              </dl>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Source</h2>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">WZ path</p>
            <code className="text-muted-foreground break-all font-mono text-xs">
              {m.sourcePath}
            </code>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</dd>
    </div>
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

// URL serialisation for the `viewer` search param:
//   absent     → modal closed
//   "1"        → modal open, no highlight
//   "npc:1234" → modal open, NPC 1234 highlighted (likewise mob:, portal:)
// Splits on the first `:` so portal names containing colons round-trip.
function parseViewerParam(value: string | null): {
  open: boolean;
  highlight: MapViewerHighlight | null;
} {
  if (!value) return { open: false, highlight: null };
  if (value === '1') return { open: true, highlight: null };
  const idx = value.indexOf(':');
  if (idx < 0) return { open: true, highlight: null };
  const kind = value.slice(0, idx);
  const key = value.slice(idx + 1);
  if (!key) return { open: true, highlight: null };
  if (kind === 'npc' || kind === 'mob' || kind === 'portal') {
    return { open: true, highlight: { kind, key } };
  }
  return { open: true, highlight: null };
}

function serializeViewerParam(open: boolean, highlight: MapViewerHighlight | null): string | null {
  if (!open) return null;
  if (!highlight) return '1';
  return `${highlight.kind}:${highlight.key}`;
}
