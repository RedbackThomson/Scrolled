import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Loader2, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemIcon } from '@/components/ItemIcon';
import { getDbClient } from '@/db';

const CATEGORIES = ['all', 'use', 'setup', 'etc', 'cash'] as const;
type Category = (typeof CATEGORIES)[number];

export default function Items() {
  const client = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('all');

  const statusQ = useQuery({
    queryKey: ['db', 'status'],
    queryFn: () => client.status(),
  });

  const itemsQ = useQuery({
    queryKey: ['db', 'items', { search, category }],
    queryFn: () =>
      client.listItems({
        search: search || undefined,
        category: category === 'all' ? undefined : category,
        limit: 1000,
      }),
  });

  const clearM = useMutation({
    mutationFn: () => client.clearAllData(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['db'] }),
  });

  const onClear = useCallback(() => {
    if (confirm('Clear all data from the local database? This cannot be undone.')) {
      clearM.mutate();
    }
  }, [clearM]);

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Items</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Items extracted from your local game files. Load WZ files on{' '}
            <Link to="/debug" className="text-primary hover:underline">
              /debug
            </Link>{' '}
            and run “Extract items + equips” to populate.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={clearM.isPending || !statusQ.data || statusQ.data.counts.items === 0}
        >
          {clearM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Clear database
        </Button>
      </header>

      <DbStatusCard
        loading={statusQ.isLoading}
        status={statusQ.data}
        error={statusQ.error as Error | null}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by name"
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2"
            />
          </div>
          <div className="flex items-center gap-1 text-xs">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={
                  category === c
                    ? 'bg-primary text-primary-foreground rounded-md px-2.5 py-1.5 capitalize'
                    : 'text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1.5 capitalize'
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {itemsQ.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {itemsQ.error && (
          <p className="text-destructive text-sm">{(itemsQ.error as Error).message}</p>
        )}
        {itemsQ.data && itemsQ.data.length === 0 && (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              {search || category !== 'all' ? 'No items match.' : 'No items yet.'} Start by{' '}
              <Link to="/setup" className="text-primary hover:underline">
                loading your WZ files
              </Link>
              .
            </p>
          </div>
        )}
        {itemsQ.data && itemsQ.data.length > 0 && (
          <ul className="divide-border border-border bg-card text-card-foreground divide-y rounded-md border">
            {itemsQ.data.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/items/${item.id}`}
                  className="hover:bg-accent flex items-center gap-3 px-4 py-2 transition-colors"
                >
                  <ItemIcon entity="item" id={item.id} size={32} alt={item.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-muted-foreground line-clamp-1 text-xs">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground shrink-0 text-right text-xs">
                    <div className="font-mono">{item.id}</div>
                    {item.category && <div className="capitalize">{item.category}</div>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface DbStatusCardProps {
  loading: boolean;
  status: Awaited<ReturnType<ReturnType<typeof getDbClient>['status']>> | undefined;
  error: Error | null;
}

function DbStatusCard({ loading, status, error }: DbStatusCardProps) {
  if (loading) {
    return (
      <div className="border-border bg-card text-card-foreground rounded-md border p-4 text-sm">
        <Loader2 className="text-muted-foreground inline h-4 w-4 animate-spin" /> Connecting to
        local database…
      </div>
    );
  }
  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
        {error.message}
      </div>
    );
  }
  if (!status) return null;
  return (
    <div className="border-border bg-card text-card-foreground rounded-md border p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Database className="h-4 w-4" />
        Local database
        <span
          className={
            status.backend === 'opfs'
              ? 'text-foreground/80 ml-2 rounded bg-green-500/15 px-2 py-0.5 text-xs font-medium'
              : 'text-foreground/80 ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium'
          }
        >
          {status.backend === 'opfs' ? 'OPFS (persistent)' : 'memory (not persistent)'}
        </span>
        <span className="text-muted-foreground ml-auto text-xs">
          schema v{status.schemaVersion}
        </span>
      </div>
      <dl className="text-muted-foreground mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-7">
        {(
          [
            ['items', status.counts.items],
            ['equips', status.counts.equips],
            ['mobs', status.counts.mobs],
            ['npcs', status.counts.npcs],
            ['maps', status.counts.maps],
            ['quests', status.counts.quests],
            ['datasets', status.counts.datasets],
          ] as const
        ).map(([label, count]) => (
          <div key={label}>
            <dt className="uppercase tracking-wide">{label}</dt>
            <dd className="text-foreground font-mono text-sm">{count}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
