import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ItemIcon } from '@/components/ItemIcon';
import { getDbClient } from '@/db';

export default function ItemDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);

  const itemQ = useQuery({
    queryKey: ['db', 'item', id],
    queryFn: () => client.getItem(id),
    enabled: Number.isFinite(id),
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
        <article className="space-y-4">
          <header className="flex items-center gap-3">
            <ItemIcon entity="item" id={item.id} size={48} alt={item.name} />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{item.name}</h1>
              <p className="text-muted-foreground font-mono text-xs">{item.id}</p>
            </div>
          </header>

          {item.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{item.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm italic">No description available.</p>
          )}
        </article>

        <aside className="border-border bg-card text-card-foreground rounded-md border p-4 text-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Info</h2>
          <dl className="divide-border divide-y">
            <Row label="ID" value={String(item.id)} mono />
            <Row label="Category" value={item.category ?? '—'} />
            {item.subcategory && <Row label="Subcategory" value={item.subcategory} />}
            <Row label="Price" value={item.price !== null ? item.price.toLocaleString() : '—'} />
            <Row label="Stack" value={item.stackSize !== null ? String(item.stackSize) : '—'} />
            <Row
              label="Req. level"
              value={item.requiredLevel !== null ? String(item.requiredLevel) : '—'}
            />
          </dl>
          <div className="text-muted-foreground mt-4 text-xs">
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
