import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Copy,
  Crown,
  Loader2,
  Map as MapIcon,
  MapPin,
  Package,
  ScrollText,
  Skull,
} from 'lucide-react';
import { EntityAvatar } from '@/components/EntityAvatar';
import { EntityIcon } from '@/components/EntityIcon';
import { EntityRow } from '@/components/EntityRow';
import { ListSectionHeader } from '@/components/ListSectionHeader';
import { ListSortControl } from '@/components/ListSortControl';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import { useFeatures } from '@/lib/useFeatures';
import { useListSort } from '@/lib/useListSort';
import {
  ELEMENT_ORDER,
  ELEMENT_STATUS_CLASSES,
  ELEMENT_STATUS_LABELS,
  parseMobElements,
} from '@/lib/mobElements';
import { cn } from '@/lib/utils';

export default function MobDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();

  const mobQ = useQuery({
    queryKey: ['db', 'mob', id],
    queryFn: () => client.getMob(id),
    enabled: Number.isFinite(id),
  });
  const questsQ = useQuery({
    queryKey: ['db', 'mob', id, 'quests'],
    queryFn: () => client.getMobQuests(id),
    enabled: Number.isFinite(id) && features.hasQuests,
  });
  const dropsQ = useQuery({
    queryKey: ['db', 'mob', id, 'drops'],
    queryFn: () => client.getMobDrops(id),
    enabled: Number.isFinite(id),
  });
  const mapsQ = useQuery({
    queryKey: ['db', 'mob', id, 'maps'],
    queryFn: () => client.getMobMaps(id),
    enabled: Number.isFinite(id) && features.hasMaps,
  });

  const dropSort = useListSort(dropsQ.data, [
    { id: 'name', label: 'Name', get: (d) => d.itemName },
    { id: 'id', label: 'Item ID', get: (d) => d.itemId },
  ]);
  const mapsSort = useListSort(mapsQ.data, [
    { id: 'name', label: 'Map name', get: (m) => m.name },
    { id: 'street', label: 'Street', get: (m) => m.streetName },
    { id: 'spawns', label: 'Spawns', get: (m) => m.spawnCount },
  ]);
  const questsSort = useListSort(questsQ.data, [
    { id: 'name', label: 'Quest name', get: (q) => q.name },
  ]);

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'copy-mob-id',
        group: 'context',
        label: 'Copy mob ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id],
  );
  useDetailPalette({ entity: 'mob', id, name: mobQ.data?.name, items: paletteItems });

  if (mobQ.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading mob {id}…
      </p>
    );
  }
  if (mobQ.error) {
    return <p className="text-destructive text-sm">{(mobQ.error as Error).message}</p>;
  }
  if (!mobQ.data) {
    return (
      <div className="max-w-3xl">
        <Link
          to="/mobs"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to mobs
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Mob not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Mob <code className="font-mono">{id}</code> isn't in your library yet. It may not have
          been loaded —{' '}
          <Link to="/setup" className="text-primary hover:underline">
            visit Setup
          </Link>{' '}
          to add more files.
        </p>
      </div>
    );
  }

  const m = mobQ.data;
  return (
    <div className="max-w-4xl space-y-6">
      <Link
        to="/mobs"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to mobs
      </Link>

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <article className="space-y-6">
          <header className="flex items-center gap-3">
            <EntityIcon entity="mob" id={m.id} size={96} placeholder={Skull} alt={m.name} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">{m.name}</h1>
                {m.isBoss && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Crown className="h-3 w-3" /> Boss
                  </span>
                )}
              </div>
              <p className="text-muted-foreground font-mono text-xs">{m.id}</p>
            </div>
          </header>

          <CollectionBadgeStrip entityType="mob" entityId={m.id} />

          <section>
            <ListSectionHeader
              icon={Package}
              title="Drops"
              count={dropsQ.data?.length}
              action={
                dropsQ.data && dropsQ.data.length > 0 ? (
                  <ListSortControl
                    fields={dropSort.fieldOptions}
                    value={dropSort.sort}
                    onChange={dropSort.setSort}
                  />
                ) : null
              }
            />
            {dropsQ.isLoading && <p className="text-muted-foreground text-xs">Loading drops…</p>}
            {dropsQ.data && dropsQ.data.length === 0 && (
              <p className="text-muted-foreground text-xs italic">None.</p>
            )}
            {dropsQ.data && dropsQ.data.length > 0 && (
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {dropSort.sorted.map((d) =>
                  d.entity === null ? (
                    <li key={d.itemId} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                      <EntityAvatar entity="item" id={d.itemId} alt={d.itemName ?? undefined} />
                      <span className="text-muted-foreground min-w-0 flex-1 truncate italic">
                        {d.itemName ?? `Item #${d.itemId}`}
                      </span>
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {d.itemId}
                      </span>
                    </li>
                  ) : (
                    <EntityRow key={d.itemId} entity={d.entity} id={d.itemId} name={d.itemName} />
                  ),
                )}
              </ul>
            )}
          </section>

          {features.hasMaps && (
            <section>
              <ListSectionHeader
                icon={MapIcon}
                title="Appears on"
                count={mapsQ.data?.length}
                action={
                  mapsQ.data && mapsQ.data.length > 0 ? (
                    <ListSortControl
                      fields={mapsSort.fieldOptions}
                      value={mapsSort.sort}
                      onChange={mapsSort.setSort}
                    />
                  ) : null
                }
              />
              {mapsQ.isLoading && <p className="text-muted-foreground text-xs">Loading maps…</p>}
              {mapsQ.data && mapsQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {mapsQ.data && mapsQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {mapsSort.sorted.map((mp) => (
                    <EntityRow
                      key={mp.id}
                      entity="map"
                      id={mp.id}
                      name={mp.name}
                      subtitle={mp.streetName}
                      meta={
                        mp.spawnCount !== null && mp.spawnCount > 0 ? `×${mp.spawnCount}` : undefined
                      }
                      trailing={
                        mp.minimapPath && (
                          <Link
                            to={`/maps/${mp.id}?viewer=mob:${m.id}`}
                            aria-label={`Show ${m.name} on ${mp.name ?? `Map ${mp.id}`}`}
                            title="Show on map"
                            className="text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-primary/60 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 group-hover:opacity-100"
                          >
                            <MapPin className="h-4 w-4" />
                          </Link>
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          )}

          {features.hasQuests && (
            <section>
              <ListSectionHeader
                icon={ScrollText}
                title="Required by quests"
                count={questsQ.data?.length}
                action={
                  questsQ.data && questsQ.data.length > 0 ? (
                    <ListSortControl
                      fields={questsSort.fieldOptions}
                      value={questsSort.sort}
                      onChange={questsSort.setSort}
                    />
                  ) : null
                }
              />
              {questsQ.isLoading && (
                <p className="text-muted-foreground text-xs">Loading quests…</p>
              )}
              {questsQ.data && questsQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {questsQ.data && questsQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {questsSort.sorted.map((q) => (
                    <EntityRow
                      key={q.id}
                      entity="quest"
                      id={q.id}
                      name={q.name}
                      subtitle={q.parent}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </article>

        <aside className="border-border bg-card text-card-foreground space-y-4 self-start rounded-md border p-4 text-sm">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Info</h2>
            <dl className="divide-border divide-y">
              <Row label="ID" value={String(m.id)} mono />
              {m.isBoss && <Row label="Boss" value="Yes" />}
            </dl>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Stats</h2>
            <dl className="divide-border divide-y">
              <Row label="Level" value={m.level !== null ? String(m.level) : '—'} />
              <Row label="HP" value={m.hp !== null ? m.hp.toLocaleString() : '—'} />
              <Row label="MP" value={m.mp !== null ? m.mp.toLocaleString() : '—'} />
              <Row label="EXP" value={m.exp !== null ? m.exp.toLocaleString() : '—'} />
            </dl>
          </section>

          <ElementsSection element={m.elementAttack} />

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

function ElementsSection({ element }: { element: string | null }) {
  const statuses = parseMobElements(element);
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Elements</h2>
      <dl className="divide-border divide-y">
        {ELEMENT_ORDER.map((name) => {
          const status = statuses[name];
          return (
            <div key={name} className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">{name}</dt>
              <dd className={cn('text-sm', ELEMENT_STATUS_CLASSES[status])}>
                {ELEMENT_STATUS_LABELS[status]}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
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
