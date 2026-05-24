import { useCallback, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  DoorOpen,
  Loader2,
  Map as MapIcon,
  MapPin,
  Skull,
  Users,
} from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { MapLink, MobLink, NpcLink } from '@/components/entity-links';
import { CollectionBadgeStrip } from '@/components/collections';
import { MapViewerModal, type MapViewerHighlight } from '@/components/MapViewer';
import { getDbClient } from '@/db';
import { useFeatures } from '@/lib/useFeatures';

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

  // Viewer open + selection live in the URL (`?viewer=1`, `?viewer=npc:1234`,
  // …) so the modal can be hard-linked and restored on reload.
  const [searchParams, setSearchParams] = useSearchParams();
  const viewerParam = searchParams.get('viewer');
  const viewerState = useMemo(() => parseViewerParam(viewerParam), [viewerParam]);

  const writeViewerParam = useCallback(
    (
      next: { open: boolean; highlight: MapViewerHighlight | null },
      opts: { replace: boolean },
    ) => {
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
  const closeViewer = () =>
    writeViewerParam({ open: false, highlight: null }, { replace: false });
  const setViewerSelection = (highlight: MapViewerHighlight | null) =>
    writeViewerParam({ open: true, highlight }, { replace: true });

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
                  className="border-border bg-card hover:ring-primary/40 inline-flex max-w-full items-center justify-start rounded-md border p-3 transition hover:ring-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <Users className="h-4 w-4" /> NPCs
                {npcsQ.data && (
                  <span className="text-muted-foreground text-xs normal-case">
                    ({npcsQ.data.length})
                  </span>
                )}
              </h2>
              {npcsQ.data && npcsQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {npcsQ.data && npcsQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {npcsQ.data.map((n) => (
                    <li
                      key={`${n.npcId}-${n.x}-${n.y}`}
                      className="hover:bg-accent group flex items-center gap-1 px-1"
                    >
                      <NpcLink
                        id={n.npcId}
                        className="flex flex-1 items-center gap-3 px-2 py-1.5 text-sm"
                      >
                        <EntityIcon
                          entity="npc"
                          id={n.npcId}
                          size={24}
                          placeholder={Users}
                          alt={n.name ?? `NPC ${n.npcId}`}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {n.name ?? `NPC ${n.npcId}`}
                        </span>
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {n.npcId}
                        </span>
                        {(n.x !== null || n.y !== null) && (
                          <span className="text-muted-foreground shrink-0 font-mono text-xs">
                            ({n.x ?? '?'}, {n.y ?? '?'})
                          </span>
                        )}
                      </NpcLink>
                      {m.minimapPath && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openViewer({ kind: 'npc', key: String(n.npcId) });
                          }}
                          aria-label={`Show ${n.name ?? `NPC ${n.npcId}`} on map`}
                          title="Show on map"
                          className="text-muted-foreground hover:bg-background hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <MapPin className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {features.hasMobs && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <Skull className="h-4 w-4" /> Mobs
                {mobsQ.data && (
                  <span className="text-muted-foreground text-xs normal-case">
                    ({mobsQ.data.length})
                  </span>
                )}
              </h2>
              {mobsQ.data && mobsQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {mobsQ.data && mobsQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {mobsQ.data.map((mob) => (
                    <li
                      key={mob.mobId}
                      className="hover:bg-accent group flex items-center gap-1 px-1"
                    >
                      <MobLink
                        id={mob.mobId}
                        className="flex flex-1 items-center gap-3 px-2 py-1.5 text-sm"
                      >
                        <EntityIcon
                          entity="mob"
                          id={mob.mobId}
                          size={24}
                          placeholder={Skull}
                          alt={mob.name ?? `Mob ${mob.mobId}`}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {mob.name ?? `Mob ${mob.mobId}`}
                        </span>
                        {mob.level !== null && (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            Lv {mob.level}
                          </span>
                        )}
                        {mob.count !== null && mob.count > 1 && (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            ×{mob.count}
                          </span>
                        )}
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {mob.mobId}
                        </span>
                      </MobLink>
                      {m.minimapPath && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openViewer({ kind: 'mob', key: String(mob.mobId) });
                          }}
                          aria-label={`Show ${mob.name ?? `Mob ${mob.mobId}`} on map`}
                          title="Show on map"
                          className="text-muted-foreground hover:bg-background hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <MapPin className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <DoorOpen className="h-4 w-4" /> Portals
              {portalsQ.data && (
                <span className="text-muted-foreground text-xs normal-case">
                  ({portalsQ.data.length})
                </span>
              )}
            </h2>
            {portalsQ.data && portalsQ.data.length === 0 && (
              <p className="text-muted-foreground text-xs italic">None.</p>
            )}
            {portalsQ.data && portalsQ.data.length > 0 && (
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {portalsQ.data.map((p) => (
                  <li
                    key={`${p.portalName}-${p.x ?? 0}-${p.y ?? 0}`}
                    className="flex items-center gap-3 px-3 py-1.5 text-sm"
                  >
                    <span className="font-mono text-xs">{p.portalName}</span>
                    <span className="text-muted-foreground">→</span>
                    {p.targetMapId && p.targetMapId !== 999999999 ? (
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

        <aside className="border-border bg-card text-card-foreground self-start space-y-4 rounded-md border p-4 text-sm">
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
                {m.returnMapId !== null && m.returnMapId !== 999999999 && (
                  <RowLink label="Return map" value={m.returnMapId} />
                )}
                {m.forcedReturnMapId !== null && m.forcedReturnMapId !== 999999999 && (
                  <RowLink label="Forced return" value={m.forcedReturnMapId} />
                )}
              </dl>
            </section>
          )}

          {(m.fieldLimit !== null || m.mobRate !== null) && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Stats</h2>
              <dl className="divide-border divide-y">
                {m.fieldLimit !== null && (
                  <Row label="Field limit" value={String(m.fieldLimit)} />
                )}
                {m.mobRate !== null && <Row label="Mob rate" value={m.mobRate.toFixed(2)} />}
              </dl>
            </section>
          )}

          <div className="text-muted-foreground text-xs">
            <div className="uppercase tracking-wide">WZ path</div>
            <code className="break-all font-mono">{m.sourcePath}</code>
          </div>
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

function RowLink({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-sm">
        {value !== null && value !== 999999999 ? (
          <MapLink id={value} className="text-primary hover:underline">
            {value}
          </MapLink>
        ) : (
          '—'
        )}
      </dd>
    </div>
  );
}

// URL serialisation for the `viewer` search param:
//   absent     → modal closed
//   "1"        → modal open, no highlight
//   "npc:1234" → modal open, NPC 1234 highlighted (likewise mob:, portal:)
// Splits on the first `:` so portal names containing colons round-trip.
function parseViewerParam(
  value: string | null,
): { open: boolean; highlight: MapViewerHighlight | null } {
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

function serializeViewerParam(
  open: boolean,
  highlight: MapViewerHighlight | null,
): string | null {
  if (!open) return null;
  if (!highlight) return '1';
  return `${highlight.kind}:${highlight.key}`;
}
