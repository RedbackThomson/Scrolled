import { Activity, Database, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { getDbClient } from '@/db';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

export function LibraryStatusSection() {
  const sectionProps = useSettingsSection('library-status');
  const db = useMemo(() => getDbClient(), []);
  const statusQ = useQuery({
    queryKey: ['db', 'status'],
    queryFn: () => db.status(),
  });

  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Library Status</h2>
      </div>

      <div className="border-border bg-card text-card-foreground rounded-md border p-4">
        {statusQ.isLoading ? (
          <p className="text-muted-foreground text-sm">
            <Loader2 className="text-muted-foreground inline h-4 w-4 animate-spin" /> Connecting
            to local library…
          </p>
        ) : statusQ.error ? (
          <p className="text-destructive text-sm">{(statusQ.error as Error).message}</p>
        ) : statusQ.data ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4 shrink-0" />
                <span>Local library</span>
                <span
                  className={cn(
                    'text-foreground/80 rounded px-2 py-0.5 text-xs font-medium',
                    statusQ.data.backend === 'opfs' ? 'bg-green-500/15' : 'bg-amber-500/15',
                  )}
                >
                  {statusQ.data.backend === 'opfs'
                    ? 'OPFS (persistent)'
                    : 'memory (not persistent)'}
                </span>
              </div>
              <span className="text-muted-foreground text-xs sm:ml-auto">
                schema v{statusQ.data.schemaVersion} · data rev {statusQ.data.dataRevision}
              </span>
            </div>
            <dl className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
              {(
                [
                  ['items', statusQ.data.counts.items],
                  ['equips', statusQ.data.counts.equips],
                  ['mobs', statusQ.data.counts.mobs],
                  ['npcs', statusQ.data.counts.npcs],
                  ['maps', statusQ.data.counts.maps],
                  ['quests', statusQ.data.counts.quests],
                  ['skills', statusQ.data.counts.skills],
                  ['jobs', statusQ.data.counts.jobs],
                  ['datasets', statusQ.data.counts.datasets],
                ] as const
              ).map(([label, count]) => (
                <div key={label} className="min-w-0">
                  <dt className="truncate uppercase tracking-wide">{label}</dt>
                  <dd className="text-foreground font-mono text-sm tabular-nums">{count}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </div>
    </section>
  );
}
