import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Map as MapIcon, Search } from 'lucide-react';
import { getDbClient } from '@/db';

export default function Maps() {
  const client = useMemo(() => getDbClient(), []);
  const [search, setSearch] = useState('');

  const mapsQ = useQuery({
    queryKey: ['db', 'maps', { search }],
    queryFn: () => client.listMaps({ search: search || undefined, limit: 1000 }),
  });

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Maps</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Map metadata, NPC/mob placements, and portals extracted from{' '}
          <code className="font-mono text-xs">Map.wz</code>.
        </p>
      </header>

      <section className="space-y-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search maps by name or street"
            className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2"
          />
        </div>

        {mapsQ.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {mapsQ.data && mapsQ.data.length === 0 && (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              {search ? 'No maps match.' : 'No maps yet.'} Load{' '}
              <code className="font-mono">Map.wz</code> via{' '}
              <Link to="/setup" className="text-primary hover:underline">
                setup
              </Link>{' '}
              to populate this list.
            </p>
          </div>
        )}
        {mapsQ.data && mapsQ.data.length > 0 && (
          <ul className="divide-border border-border bg-card text-card-foreground divide-y rounded-md border">
            {mapsQ.data.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/maps/${m.id}`}
                  className="hover:bg-accent flex items-center gap-3 px-4 py-2 transition-colors"
                >
                  <MapIcon className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.name ?? `Map ${m.id}`}</div>
                    {m.streetName && (
                      <div className="text-muted-foreground truncate text-xs">{m.streetName}</div>
                    )}
                  </div>
                  <div className="text-muted-foreground shrink-0 font-mono text-xs">{m.id}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
