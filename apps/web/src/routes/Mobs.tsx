import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Crown, Search, Skull } from 'lucide-react';
import { getDbClient } from '@/db';

export default function Mobs() {
  const client = useMemo(() => getDbClient(), []);
  const [search, setSearch] = useState('');
  const [bossOnly, setBossOnly] = useState(false);

  const mobsQ = useQuery({
    queryKey: ['db', 'mobs', { search, bossOnly }],
    queryFn: () => client.listMobs({ search: search || undefined, bossOnly, limit: 1000 }),
  });

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Mobs</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Monsters extracted from <code className="font-mono text-xs">Mob.wz</code>, named via{' '}
          <code className="font-mono text-xs">String.wz/Mob.img</code>. Sprites come in a later
          phase.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search mobs by name"
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2"
            />
          </div>
          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={bossOnly}
              onChange={(e) => setBossOnly(e.target.checked)}
              className="accent-primary h-3.5 w-3.5"
            />
            Bosses only
          </label>
        </div>

        {mobsQ.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {mobsQ.data && mobsQ.data.length === 0 && (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              {search || bossOnly ? 'No mobs match.' : 'No mobs yet.'} Run{' '}
              <Link to="/debug" className="text-primary hover:underline">
                Extract everything
              </Link>{' '}
              after loading <code className="font-mono">Mob.wz</code>.
            </p>
          </div>
        )}
        {mobsQ.data && mobsQ.data.length > 0 && (
          <ul className="divide-border border-border bg-card text-card-foreground divide-y rounded-md border">
            {mobsQ.data.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/mobs/${m.id}`}
                  className="hover:bg-accent flex items-center gap-3 px-4 py-2 transition-colors"
                >
                  <Skull className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{m.name}</span>
                      {m.isBoss && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                          <Crown className="h-3 w-3" />
                          Boss
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Lv {m.level ?? '?'} · HP {m.hp ?? '?'} · EXP {m.exp ?? '?'}
                    </div>
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
