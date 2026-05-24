import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QuestLink } from '@/components/entity-links';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Crown, Loader2, ScrollText, Skull } from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { getDbClient } from '@/db';
import { useFeatures } from '@/lib/useFeatures';

export default function MobDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();

  const mobQ = useQuery({
    queryKey: ['db', 'mob', id],
    queryFn: () => client.getMob(id),
    enabled: Number.isFinite(id),
  });
  const questsQ = useQuery({
    queryKey: ['db', 'mob', id, 'quests'],
    queryFn: () => client.getMobQuests(id),
    enabled: Number.isFinite(id) && features.hasQuests,
  });

  if (mobQ.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading mob {id}…
      </p>
    );
  }
  if (mobQ.error) {
    return <p className="text-destructive text-sm">{(mobQ.error as Error).message}</p>;
  }
  if (!mobQ.data) {
    return (
      <div className="max-w-3xl">
        <Link
          to="/mobs"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to mobs
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Mob not found</h1>
      </div>
    );
  }

  const m = mobQ.data;
  return (
    <div className="max-w-4xl space-y-6">
      <Link
        to="/mobs"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to mobs
      </Link>

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <article className="space-y-4">
          <header className="flex items-center gap-3">
            <EntityIcon
              entity="mob"
              id={m.id}
              size={96}
              placeholder={Skull}
              alt={m.name}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">{m.name}</h1>
                {m.isBoss && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Crown className="h-3 w-3" /> Boss
                  </span>
                )}
              </div>
              <p className="text-muted-foreground font-mono text-xs">{m.id}</p>
            </div>
          </header>

          <p className="text-muted-foreground text-xs">
            Drops, animations, and elemental modifiers come from server data; we only have the base
            stats from <code className="font-mono">Mob.wz</code>.
          </p>

          {features.hasQuests && questsQ.data && questsQ.data.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <ScrollText className="h-4 w-4" /> Required by quests
                <span className="text-muted-foreground text-xs normal-case">
                  ({questsQ.data.length})
                </span>
              </h2>
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {questsQ.data.map((q) => (
                  <li key={q.id}>
                    <QuestLink
                      id={q.id}
                      className="hover:bg-accent flex items-center gap-2 px-3 py-1.5 text-sm"
                    >
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
            </section>
          )}
        </article>

        <aside className="border-border bg-card text-card-foreground rounded-md border p-4 text-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Stats</h2>
          <dl className="divide-border divide-y">
            <Row label="ID" value={String(m.id)} mono />
            <Row label="Level" value={m.level !== null ? String(m.level) : '—'} />
            <Row label="HP" value={m.hp !== null ? m.hp.toLocaleString() : '—'} />
            <Row label="MP" value={m.mp !== null ? m.mp.toLocaleString() : '—'} />
            <Row label="EXP" value={m.exp !== null ? m.exp.toLocaleString() : '—'} />
            <Row label="Element" value={m.elementAttack ?? '—'} />
            <Row label="Boss" value={m.isBoss ? 'Yes' : 'No'} />
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
