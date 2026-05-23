import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Map as MapIcon, Users } from 'lucide-react';
import { getDbClient } from '@/db';

export default function NpcDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);

  const npcQ = useQuery({
    queryKey: ['db', 'npc', id],
    queryFn: () => client.getNpc(id),
    enabled: Number.isFinite(id),
  });
  const mapsQ = useQuery({
    queryKey: ['db', 'npc', id, 'maps'],
    queryFn: () => client.getNpcMaps(id),
    enabled: Number.isFinite(id),
  });

  if (npcQ.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading NPC {id}…
      </p>
    );
  }
  if (!npcQ.data) {
    return (
      <div className="max-w-3xl">
        <Link
          to="/npcs"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to NPCs
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">NPC not found</h1>
      </div>
    );
  }

  const n = npcQ.data;
  return (
    <div className="max-w-4xl space-y-6">
      <Link
        to="/npcs"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to NPCs
      </Link>

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <article className="space-y-6">
          <header className="flex items-center gap-3">
            <Users className="text-muted-foreground h-12 w-12" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{n.name}</h1>
              <p className="text-muted-foreground font-mono text-xs">{n.id}</p>
            </div>
          </header>

          {n.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{n.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm italic">No description.</p>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Appears on</h2>
            {mapsQ.isLoading && <p className="text-muted-foreground text-xs">Loading maps…</p>}
            {mapsQ.data && mapsQ.data.length === 0 && (
              <p className="text-muted-foreground text-xs italic">No map placements found.</p>
            )}
            {mapsQ.data && mapsQ.data.length > 0 && (
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {mapsQ.data.map((m) => (
                  <li key={m.id}>
                    <Link
                      to={`/maps/${m.id}`}
                      className="hover:bg-accent flex items-center gap-2 px-3 py-2 text-sm"
                    >
                      <MapIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {m.name ?? `Map ${m.id}`}
                        {m.streetName && (
                          <span className="text-muted-foreground"> · {m.streetName}</span>
                        )}
                      </span>
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {m.id}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </article>

        <aside className="border-border bg-card text-card-foreground rounded-md border p-4 text-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Info</h2>
          <dl className="divide-border divide-y">
            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">ID</dt>
              <dd className="font-mono text-sm">{n.id}</dd>
            </div>
          </dl>
          <div className="text-muted-foreground mt-4 text-xs">
            <div className="uppercase tracking-wide">WZ path</div>
            <code className="break-all font-mono">{n.sourcePath}</code>
          </div>
        </aside>
      </div>
    </div>
  );
}
