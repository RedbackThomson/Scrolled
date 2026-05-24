import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EquipLink, ItemLink, MapLink, QuestLink } from '@/components/entity-links';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Crown,
  Loader2,
  Map as MapIcon,
  MapPin,
  Package,
  ScrollText,
  Skull,
} from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { CollectionBadgeStrip } from '@/components/collections';
import { getDbClient } from '@/db';
import { useFeatures } from '@/lib/useFeatures';

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
        <article className="space-y-4">
          <header className="flex items-center gap-3">
            <EntityIcon
              entity="mob"
              id={m.id}
              size={96}
              placeholder={Skull}
              alt={m.name}
            />
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

          <p className="text-muted-foreground text-xs">
            Drop possibilities come from <code className="font-mono">MonsterBook.img</code> in{' '}
            <code className="font-mono">String.wz</code>; rates, quantities, animations, and
            elemental modifiers are server data and aren't in the WZ files.
          </p>

          {dropsQ.data && dropsQ.data.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <Package className="h-4 w-4" /> Drops
                <span className="text-muted-foreground text-xs normal-case">
                  ({dropsQ.data.length})
                </span>
              </h2>
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {dropsQ.data.map((d) => {
                  const label = d.itemName ?? `Item ${d.itemId}`;
                  const row = (
                    <div className="hover:bg-accent flex items-center gap-3 px-3 py-1.5 text-sm">
                      <EntityIcon
                        entity={d.entity ?? 'item'}
                        id={d.itemId}
                        size={24}
                        placeholder={Package}
                        alt={label}
                      />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {d.itemId}
                      </span>
                    </div>
                  );
                  return (
                    <li key={d.itemId}>
                      {d.entity === 'equip' ? (
                        <EquipLink id={d.itemId} className="block">
                          {row}
                        </EquipLink>
                      ) : d.entity === 'item' ? (
                        <ItemLink id={d.itemId} className="block">
                          {row}
                        </ItemLink>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {features.hasMaps && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <MapIcon className="h-4 w-4" /> Appears on
                {mapsQ.data && (
                  <span className="text-muted-foreground text-xs normal-case">
                    ({mapsQ.data.length})
                  </span>
                )}
              </h2>
              {mapsQ.isLoading && <p className="text-muted-foreground text-xs">Loading maps…</p>}
              {mapsQ.data && mapsQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">No map placements found.</p>
              )}
              {mapsQ.data && mapsQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {mapsQ.data.map((mp) => (
                    <li
                      key={mp.id}
                      className="hover:bg-accent group flex items-center gap-1 px-1"
                    >
                      <MapLink
                        id={mp.id}
                        className="flex flex-1 items-center gap-2 px-2 py-2 text-sm"
                      >
                        <MapIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          {mp.name ?? `Map ${mp.id}`}
                          {mp.streetName && (
                            <span className="text-muted-foreground"> · {mp.streetName}</span>
                          )}
                        </span>
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {mp.id}
                        </span>
                      </MapLink>
                      {mp.minimapPath && (
                        <Link
                          to={`/maps/${mp.id}?viewer=mob:${m.id}`}
                          aria-label={`Show ${m.name} on ${mp.name ?? `Map ${mp.id}`}`}
                          title="Show on map"
                          className="text-muted-foreground hover:bg-background hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <MapPin className="h-4 w-4" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {features.hasQuests && questsQ.data && questsQ.data.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <ScrollText className="h-4 w-4" /> Required by quests
                <span className="text-muted-foreground text-xs normal-case">
                  ({questsQ.data.length})
                </span>
              </h2>
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {questsQ.data.map((q) => (
                  <li key={q.id}>
                    <QuestLink
                      id={q.id}
                      className="hover:bg-accent flex items-center gap-2 px-3 py-1.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {q.name}
                        {q.parent && <span className="text-muted-foreground"> · {q.parent}</span>}
                      </span>
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {q.id}
                      </span>
                    </QuestLink>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="border-border bg-card text-card-foreground self-start rounded-md border p-4 text-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Stats</h2>
          <dl className="divide-border divide-y">
            <Row label="ID" value={String(m.id)} mono />
            <Row label="Level" value={m.level !== null ? String(m.level) : '—'} />
            <Row label="HP" value={m.hp !== null ? m.hp.toLocaleString() : '—'} />
            <Row label="MP" value={m.mp !== null ? m.mp.toLocaleString() : '—'} />
            <Row label="EXP" value={m.exp !== null ? m.exp.toLocaleString() : '—'} />
            <Row label="Element" value={m.elementAttack ?? '—'} />
            <Row label="Boss" value={m.isBoss ? 'Yes' : 'No'} />
          </dl>
          <div className="text-muted-foreground mt-4 text-xs">
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
