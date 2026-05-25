import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, Loader2, Map as MapIcon, MapPin, ScrollText, Users } from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { EntityRow } from '@/components/EntityRow';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import { useFeatures } from '@/lib/useFeatures';

export default function NpcDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();

  const npcQ = useQuery({
    queryKey: ['db', 'npc', id],
    queryFn: () => client.getNpc(id),
    enabled: Number.isFinite(id),
  });
  const mapsQ = useQuery({
    queryKey: ['db', 'npc', id, 'maps'],
    queryFn: () => client.getNpcMaps(id),
    enabled: Number.isFinite(id) && features.hasMaps,
  });
  const questsQ = useQuery({
    queryKey: ['db', 'npc', id, 'quests'],
    queryFn: () => client.getNpcQuests(id),
    enabled: Number.isFinite(id) && features.hasQuests,
  });

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'copy-npc-id',
        group: 'context',
        label: 'Copy NPC ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id],
  );
  useDetailPalette({ entity: 'npc', id, name: npcQ.data?.name, items: paletteItems });

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
        <p className="text-muted-foreground mt-2 text-sm">
          NPC <code className="font-mono">{id}</code> isn't in your library yet. It may not have
          been loaded —{' '}
          <Link to="/setup" className="text-primary hover:underline">
            visit Setup
          </Link>{' '}
          to add more files.
        </p>
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
            <EntityIcon entity="npc" id={n.id} size={96} placeholder={Users} alt={n.name} />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{n.name}</h1>
              <p className="text-muted-foreground font-mono text-xs">{n.id}</p>
            </div>
          </header>

          <CollectionBadgeStrip entityType="npc" entityId={n.id} />

          {n.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{n.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm italic">No description.</p>
          )}

          {features.hasQuests && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <ScrollText className="h-4 w-4" /> Quests
                {questsQ.data && (
                  <span className="text-muted-foreground text-xs normal-case">
                    ({questsQ.data.length})
                  </span>
                )}
              </h2>
              {questsQ.data && questsQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {questsQ.data && questsQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {questsQ.data.map((q) => (
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
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {mapsQ.data && mapsQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {mapsQ.data.map((m) => (
                    <EntityRow
                      key={m.id}
                      entity="map"
                      id={m.id}
                      name={m.name}
                      subtitle={m.streetName}
                      trailing={
                        m.minimapPath && (
                          <Link
                            to={`/maps/${m.id}?viewer=npc:${n.id}`}
                            aria-label={`Show ${n.name} on ${m.name ?? `Map ${m.id}`}`}
                            title="Show on map"
                            className="text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-primary/60 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 group-hover:opacity-100"
                          >
                            <MapPin className="h-4 w-4" />
                          </Link>
                        )
                      }
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
              <div className="flex items-baseline justify-between gap-3 py-1.5">
                <dt className="text-muted-foreground text-xs uppercase tracking-wide">ID</dt>
                <dd className="font-mono text-sm">{n.id}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Source</h2>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">WZ path</p>
            <code className="text-muted-foreground break-all font-mono text-xs">
              {n.sourcePath}
            </code>
          </section>
        </aside>
      </div>
    </div>
  );
}
