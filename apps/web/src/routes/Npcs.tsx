import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { getDbClient } from '@/db';

export default function Npcs() {
  const client = useMemo(() => getDbClient(), []);
  const [search, setSearch] = useState('');

  const npcsQ = useQuery({
    queryKey: ['db', 'npcs', { search }],
    queryFn: () => client.listNpcs({ search: search || undefined, limit: 1000 }),
  });

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">NPCs</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Non-player characters extracted from <code className="font-mono text-xs">Npc.wz</code> and
          joined with names from <code className="font-mono text-xs">String.wz/Npc.img</code>.
        </p>
      </header>

      <section className="space-y-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search NPCs by name"
            className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2"
          />
        </div>

        {npcsQ.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {npcsQ.data && npcsQ.data.length === 0 && (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              {search ? 'No NPCs match.' : 'No NPCs yet.'} Run{' '}
              <Link to="/debug" className="text-primary hover:underline">
                Extract everything
              </Link>{' '}
              after loading <code className="font-mono">Npc.wz</code>.
            </p>
          </div>
        )}
        {npcsQ.data && npcsQ.data.length > 0 && (
          <ul className="divide-border border-border bg-card text-card-foreground divide-y rounded-md border">
            {npcsQ.data.map((n) => (
              <li key={n.id}>
                <Link
                  to={`/npcs/${n.id}`}
                  className="hover:bg-accent flex items-center gap-3 px-4 py-2 transition-colors"
                >
                  <Users className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{n.name}</div>
                    {n.description && (
                      <div className="text-muted-foreground line-clamp-1 text-xs">
                        {n.description}
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground shrink-0 font-mono text-xs">{n.id}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
