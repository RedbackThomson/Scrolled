import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { ItemIcon } from '@/components/ItemIcon';
import { getDbClient } from '@/db';

export default function Equips() {
  const client = useMemo(() => getDbClient(), []);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const slot = searchParams.get('slot') ?? 'all';

  const slotsQ = useQuery({
    queryKey: ['db', 'equip-slots'],
    queryFn: () => client.listEquipSlots(),
  });

  const equipsQ = useQuery({
    queryKey: ['db', 'equips', { search, slot }],
    queryFn: () =>
      client.listEquips({
        search: search || undefined,
        slot: slot === 'all' ? undefined : slot,
        limit: 5000,
      }),
  });

  const setSlot = (next: string) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'all') params.delete('slot');
        else params.set('slot', next);
        return params;
      },
      { replace: true },
    );
  };

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Equips</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Equipment stats and icons from{' '}
          <code className="font-mono text-xs">Character.wz</code>, joined with localized names from{' '}
          <code className="font-mono text-xs">String.wz/Eqp.img</code>.
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
              placeholder="Search equips by name"
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2"
            />
          </div>
          {slotsQ.data && slotsQ.data.length > 0 && (
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              <option value="all">All slots</option>
              {slotsQ.data.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>

        {equipsQ.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {equipsQ.data && equipsQ.data.length === 0 && (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              {search || slot !== 'all' ? 'No equips match.' : 'No equips yet.'} Start by{' '}
              <Link to="/setup" className="text-primary hover:underline">
                loading your WZ files
              </Link>
              .
            </p>
          </div>
        )}
        {equipsQ.data && equipsQ.data.length > 0 && (
          <ul className="divide-border border-border bg-card text-card-foreground divide-y rounded-md border">
            {equipsQ.data.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/equips/${e.id}`}
                  className="hover:bg-accent flex items-center gap-3 px-4 py-2 transition-colors"
                >
                  <ItemIcon entity="equip" id={e.id} size={32} alt={e.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.name}</div>
                    {e.description && (
                      <div className="text-muted-foreground line-clamp-1 text-xs">
                        {e.description}
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground shrink-0 text-right text-xs">
                    <div className="font-mono">{e.id}</div>
                    {e.slot && <div className="capitalize">{e.slot}</div>}
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
