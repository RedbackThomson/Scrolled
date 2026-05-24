import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, ScrollText, Skull } from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { ItemIcon } from '@/components/ItemIcon';
import { MobLink, QuestLink } from '@/components/entity-links';
import { CollectionBadgeStrip } from '@/components/collections';
import { getDbClient } from '@/db';
import { useFeatures } from '@/lib/useFeatures';

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
          ID <code className="font-mono">{id}</code> isn't in the local database. Try running
          extraction on the{' '}
          <Link to="/debug" className="text-primary hover:underline">
            /debug
          </Link>{' '}
          page.
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
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <ScrollText className="h-4 w-4" /> Used in quests
                {questsQ.data && (
                  <span className="text-muted-foreground text-xs normal-case">
                    ({questsQ.data.length})
                  </span>
                )}
              </h2>
              {questsQ.isLoading && (
                <p className="text-muted-foreground text-xs">Loading quests…</p>
              )}
              {questsQ.data && questsQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {questsQ.data && questsQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {questsQ.data.map((q) => (
                    <li key={q.id}>
                      <QuestLink
                        id={q.id}
                        className="hover:bg-accent flex items-center gap-3 px-3 py-1.5 text-sm"
                      >
                        <ScrollText className="text-muted-foreground h-6 w-6 shrink-0" />
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
              )}
            </section>
          )}

          {features.hasMobs && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <Skull className="h-4 w-4" /> Dropped by
                {droppedByQ.data && (
                  <span className="text-muted-foreground text-xs normal-case">
                    ({droppedByQ.data.length})
                  </span>
                )}
              </h2>
              {droppedByQ.isLoading && (
                <p className="text-muted-foreground text-xs">Loading mobs…</p>
              )}
              {droppedByQ.data && droppedByQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {droppedByQ.data && droppedByQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {droppedByQ.data.map((m) => (
                    <li key={m.mobId}>
                      <MobLink
                        id={m.mobId}
                        className="hover:bg-accent flex items-center gap-3 px-3 py-1.5 text-sm"
                      >
                        <EntityIcon entity="mob" id={m.mobId} size={24} placeholder={Skull} alt={m.name} />
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                        {m.level !== null && (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            Lv {m.level}
                          </span>
                        )}
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {m.mobId}
                        </span>
                      </MobLink>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </article>

        <aside className="border-border bg-card text-card-foreground self-start space-y-4 rounded-md border p-4 text-sm">
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
                {item.price !== null && (
                  <Row label="Price" value={item.price.toLocaleString()} />
                )}
                {item.stackSize !== null && (
                  <Row label="Stack" value={String(item.stackSize)} />
                )}
                {item.requiredLevel !== null && (
                  <Row label="Req. level" value={String(item.requiredLevel)} />
                )}
              </dl>
            </section>
          )}

          <div className="text-muted-foreground text-xs">
            <div className="uppercase tracking-wide">WZ path</div>
            <code className="break-all font-mono">{item.sourcePath}</code>
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
