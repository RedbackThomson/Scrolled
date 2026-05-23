import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, DoorOpen, Loader2, Map as MapIcon, Skull, Users } from 'lucide-react';
import { getDbClient } from '@/db';

export default function MapDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);

  const mapQ = useQuery({
    queryKey: ['db', 'map', id],
    queryFn: () => client.getMap(id),
    enabled: Number.isFinite(id),
  });
  const npcsQ = useQuery({
    queryKey: ['db', 'map', id, 'npcs'],
    queryFn: () => client.getMapNpcs(id),
    enabled: Number.isFinite(id),
  });
  const mobsQ = useQuery({
    queryKey: ['db', 'map', id, 'mobs'],
    queryFn: () => client.getMapMobs(id),
    enabled: Number.isFinite(id),
  });
  const portalsQ = useQuery({
    queryKey: ['db', 'map', id, 'portals'],
    queryFn: () => client.getMapPortals(id),
    enabled: Number.isFinite(id),
  });

  if (mapQ.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading map {id}…
      </p>
    );
  }
  if (!mapQ.data) {
    return (
      <div className="max-w-3xl">
        <Link
          to="/maps"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to maps
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Map not found</h1>
      </div>
    );
  }

  const m = mapQ.data;
  return (
    <div className="max-w-5xl space-y-6">
      <Link
        to="/maps"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to maps
      </Link>

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <article className="space-y-6">
          <header className="flex items-center gap-3">
            <MapIcon className="text-muted-foreground h-12 w-12" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{m.name ?? `Map ${m.id}`}</h1>
              {m.streetName && <p className="text-muted-foreground text-sm">{m.streetName}</p>}
              <p className="text-muted-foreground font-mono text-xs">{m.id}</p>
            </div>
          </header>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <Users className="h-4 w-4" /> NPCs
              {npcsQ.data && (
                <span className="text-muted-foreground text-xs normal-case">
                  ({npcsQ.data.length})
                </span>
              )}
            </h2>
            {npcsQ.data && npcsQ.data.length === 0 && (
              <p className="text-muted-foreground text-xs italic">None.</p>
            )}
            {npcsQ.data && npcsQ.data.length > 0 && (
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {npcsQ.data.map((n) => (
                  <li key={`${n.npcId}-${n.x}-${n.y}`}>
                    <Link
                      to={`/npcs/${n.npcId}`}
                      className="hover:bg-accent flex items-center gap-3 px-3 py-1.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{n.name ?? `NPC ${n.npcId}`}</span>
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {n.npcId}
                      </span>
                      {(n.x !== null || n.y !== null) && (
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          ({n.x ?? '?'}, {n.y ?? '?'})
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <Skull className="h-4 w-4" /> Mobs
              {mobsQ.data && (
                <span className="text-muted-foreground text-xs normal-case">
                  ({mobsQ.data.length})
                </span>
              )}
            </h2>
            {mobsQ.data && mobsQ.data.length === 0 && (
              <p className="text-muted-foreground text-xs italic">None.</p>
            )}
            {mobsQ.data && mobsQ.data.length > 0 && (
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {mobsQ.data.map((mob) => (
                  <li key={mob.mobId}>
                    <Link
                      to={`/mobs/${mob.mobId}`}
                      className="hover:bg-accent flex items-center gap-3 px-3 py-1.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {mob.name ?? `Mob ${mob.mobId}`}
                      </span>
                      {mob.level !== null && (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          Lv {mob.level}
                        </span>
                      )}
                      {mob.count !== null && mob.count > 1 && (
                        <span className="text-muted-foreground shrink-0 text-xs">×{mob.count}</span>
                      )}
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {mob.mobId}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <DoorOpen className="h-4 w-4" /> Portals
              {portalsQ.data && (
                <span className="text-muted-foreground text-xs normal-case">
                  ({portalsQ.data.length})
                </span>
              )}
            </h2>
            {portalsQ.data && portalsQ.data.length === 0 && (
              <p className="text-muted-foreground text-xs italic">None.</p>
            )}
            {portalsQ.data && portalsQ.data.length > 0 && (
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {portalsQ.data.map((p) => (
                  <li
                    key={`${p.portalName}-${p.x ?? 0}-${p.y ?? 0}`}
                    className="flex items-center gap-3 px-3 py-1.5 text-sm"
                  >
                    <span className="font-mono text-xs">{p.portalName}</span>
                    <span className="text-muted-foreground">→</span>
                    {p.targetMapId && p.targetMapId !== 999999999 ? (
                      <Link
                        to={`/maps/${p.targetMapId}`}
                        className="text-primary min-w-0 flex-1 truncate hover:underline"
                      >
                        Map {p.targetMapId}
                        {p.targetPortal && (
                          <span className="text-muted-foreground"> · {p.targetPortal}</span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground italic">no target</span>
                    )}
                    {(p.x !== null || p.y !== null) && (
                      <span className="text-muted-foreground ml-auto shrink-0 font-mono text-xs">
                        ({p.x ?? '?'}, {p.y ?? '?'})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </article>

        <aside className="border-border bg-card text-card-foreground rounded-md border p-4 text-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Info</h2>
          <dl className="divide-border divide-y">
            <Row label="ID" value={String(m.id)} mono />
            <Row label="Street" value={m.streetName ?? '—'} />
            <RowLink label="Return map" value={m.returnMapId} />
            <RowLink label="Forced return" value={m.forcedReturnMapId} />
            <Row label="Field limit" value={m.fieldLimit !== null ? String(m.fieldLimit) : '—'} />
            <Row label="Mob rate" value={m.mobRate !== null ? m.mobRate.toFixed(2) : '—'} />
          </dl>
          <div className="text-muted-foreground mt-4 text-xs">
            <div className="uppercase tracking-wide">WZ path</div>
            <code className="break-all font-mono">{m.sourcePath}</code>
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

function RowLink({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-sm">
        {value !== null && value !== 999999999 ? (
          <Link to={`/maps/${value}`} className="text-primary hover:underline">
            {value}
          </Link>
        ) : (
          '—'
        )}
      </dd>
    </div>
  );
}
