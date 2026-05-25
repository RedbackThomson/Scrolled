import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, Loader2, ScrollText, Skull } from 'lucide-react';
import { EntityRow } from '@/components/EntityRow';
import { ItemIcon } from '@/components/ItemIcon';
import { ListSectionHeader } from '@/components/ListSectionHeader';
import { ListSortControl } from '@/components/ListSortControl';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import { useFeatures } from '@/lib/useFeatures';
import { useListSort } from '@/lib/useListSort';

export default function ItemDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();

  const itemQ = useQuery({
    queryKey: ['db', 'item', id],
    queryFn: () => client.getItem(id),
    enabled: Number.isFinite(id),
  });
  const questsQ = useQuery({
    queryKey: ['db', 'item', id, 'quests'],
    queryFn: () => client.getItemQuests(id),
    enabled: Number.isFinite(id) && features.hasQuests,
  });
  const droppedByQ = useQuery({
    queryKey: ['db', 'item', id, 'dropped-by'],
    queryFn: () => client.getItemDroppedBy(id),
    enabled: Number.isFinite(id) && features.hasMobs,
  });

  const questsSort = useListSort(questsQ.data, [
    { id: 'name', label: 'Quest name', get: (q) => q.name },
  ]);
  const droppedBySort = useListSort(droppedByQ.data, [
    { id: 'name', label: 'Mob name', get: (m) => m.name },
    { id: 'level', label: 'Level', get: (m) => m.level },
  ]);

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'copy-item-id',
        group: 'context',
        label: 'Copy item ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id],
  );
  useDetailPalette({ entity: 'item', id, name: itemQ.data?.name, items: paletteItems });

  if (itemQ.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading item {id}…
      </p>
    );
  }

  if (itemQ.error) {
    return <p className="text-destructive text-sm">{(itemQ.error as Error).message}</p>;
  }

  if (!itemQ.data) {
    return (
      <div className="max-w-3xl">
        <Link
          to="/items"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to items
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Item not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Item <code className="font-mono">{id}</code> isn't in your library yet. It may not have
          been loaded —{' '}
          <Link to="/setup" className="text-primary hover:underline">
            visit Setup
          </Link>{' '}
          to add more files.
        </p>
      </div>
    );
  }

  const item = itemQ.data;

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        to="/items"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to items
      </Link>

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <article className="space-y-6">
          <header className="flex items-center gap-3">
            <ItemIcon entity="item" id={item.id} size={48} alt={item.name} />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{item.name}</h1>
              <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-mono">{item.id}</span>
                {item.subcategory && (
                  <span className="inline-flex items-center rounded bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                    {item.subcategory}
                  </span>
                )}
              </div>
            </div>
          </header>

          <CollectionBadgeStrip entityType="item" entityId={item.id} />

          {item.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{item.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm italic">No description available.</p>
          )}

          {features.hasQuests && (
            <section>
              <ListSectionHeader
                icon={ScrollText}
                title="Used in quests"
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

          {features.hasMobs && (
            <section>
              <ListSectionHeader
                icon={Skull}
                title="Dropped by"
                count={droppedByQ.data?.length}
                action={
                  droppedByQ.data && droppedByQ.data.length > 0 ? (
                    <ListSortControl
                      fields={droppedBySort.fieldOptions}
                      value={droppedBySort.sort}
                      onChange={droppedBySort.setSort}
                    />
                  ) : null
                }
              />
              {droppedByQ.isLoading && (
                <p className="text-muted-foreground text-xs">Loading mobs…</p>
              )}
              {droppedByQ.data && droppedByQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {droppedByQ.data && droppedByQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {droppedBySort.sorted.map((m) => (
                    <EntityRow
                      key={m.mobId}
                      entity="mob"
                      id={m.mobId}
                      name={m.name}
                      meta={m.level !== null ? `Lv ${m.level}` : undefined}
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
              <Row label="ID" value={String(item.id)} mono />
              <Row label="Category" value={item.category ?? '—'} />
              {item.subcategory && <Row label="Subcategory" value={item.subcategory} />}
            </dl>
          </section>

          {(item.price !== null || item.stackSize !== null || item.requiredLevel !== null) && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Stats</h2>
              <dl className="divide-border divide-y">
                {item.price !== null && <Row label="Price" value={item.price.toLocaleString()} />}
                {item.stackSize !== null && <Row label="Stack" value={String(item.stackSize)} />}
                {item.requiredLevel !== null && (
                  <Row label="Req. level" value={String(item.requiredLevel)} />
                )}
              </dl>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Source</h2>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">WZ path</p>
            <code className="text-muted-foreground break-all font-mono text-xs">
              {item.sourcePath}
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
