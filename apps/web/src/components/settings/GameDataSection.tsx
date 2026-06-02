import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Loader2, Trash2, Upload } from 'lucide-react';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { Button } from '@/components/ui/button';
import { getDbClient } from '@/db';
import { RunCard } from '@/components/settings/RunCard';

export function GameDataSection() {
  const sectionProps = useSettingsSection('game-data');
  const db = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();

  const datasetsQ = useQuery({
    queryKey: ['db', 'datasets'],
    queryFn: () => db.listDatasets(),
  });
  const statusQ = useQuery({
    queryKey: ['db', 'status'],
    queryFn: () => db.status(),
  });

  const clearM = useMutation({
    mutationFn: () => db.clearAllData(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['db'] }),
  });

  const onClear = useCallback(() => {
    if (
      confirm(
        'Clear all data from the local library? Every loaded item, mob, NPC, map, and quest will be removed. Your game files on disk are untouched.',
      )
    ) {
      clearM.mutate();
    }
  }, [clearM]);

  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Game Data</h2>
      </div>

      <div className="border-border bg-card text-card-foreground rounded-md border p-4">
        <h3 className="text-sm font-semibold">Recent setup runs</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Each setup run records which files were loaded and what was indexed. Expand a row to see
          per-file results and counts.
        </p>
        {datasetsQ.isLoading && (
          <p className="text-muted-foreground mt-2 text-sm">
            <Loader2 className="inline h-3 w-3 animate-spin" /> Loading…
          </p>
        )}
        {datasetsQ.data && datasetsQ.data.length === 0 && (
          <p className="text-muted-foreground mt-2 text-sm">
            No game files loaded yet. Start by setting up your wiki.
          </p>
        )}
        {datasetsQ.data && datasetsQ.data.length > 0 && (
          <ul className="mt-3 space-y-2">
            {datasetsQ.data.slice(0, 5).map((d) => (
              <RunCard key={d.id} dataset={d} />
            ))}
            {datasetsQ.data.length > 5 && (
              <li className="text-muted-foreground pt-1 text-xs">
                …{datasetsQ.data.length - 5} older run
                {datasetsQ.data.length - 5 === 1 ? '' : 's'} not shown.
              </li>
            )}
          </ul>
        )}
        <div className="mt-4">
          <Link
            to="/setup"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium"
          >
            <Upload className="h-4 w-4" />
            Manage game files
          </Link>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Re-running setup is additive — existing data stays, new files extend it.
        </p>
        <div className="border-border mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClear}
            disabled={
              clearM.isPending || !statusQ.data || statusQ.data.counts.datasets === 0
            }
          >
            {clearM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Clear library
          </Button>
          <p className="text-muted-foreground text-xs">
            Removes every loaded entity from your library. Your game files on disk are untouched.
          </p>
        </div>
      </div>
    </section>
  );
}
