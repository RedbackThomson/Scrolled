import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proxy } from 'comlink';
import { Database, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ProgressBar';
import { getParserClient } from '@/parser';
import { getDbClient } from '@/db';
import { createLogger, describeError } from '@/lib/logger';
import type { ProgressUpdate } from '@/lib/progress';

const log = createLogger('extract-ui');

interface ExtractStats {
  items: number;
  equips: number;
  skipped: number;
  ms: number;
}

/**
 * Phase 3 bulk extraction: walks Item.wz + String.wz in the parser worker and
 * mass-upserts items + equips into the local DB. Progress is streamed back
 * from the worker through a comlink-proxied callback.
 */
export function ExtractAllPanel() {
  const parser = useMemo(() => getParserClient(), []);
  const db = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();
  const [stats, setStats] = useState<ExtractStats | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);

  const runM = useMutation({
    mutationFn: async () => {
      const started = performance.now();
      setProgress({ phase: 'Starting extraction', current: 0 });

      // Comlink-proxy a callback so the worker can ping us with updates.
      const onProgress = proxy((p: ProgressUpdate) => setProgress(p));

      const itemsResult = await parser.extractItems(onProgress);
      const equipsResult = await parser.extractEquips(onProgress);

      log.info('extract complete in worker', {
        items: itemsResult.items.length,
        equips: equipsResult.equips.length,
      });

      // Persistence is fast (one transaction), but it's still worth showing
      // some feedback so the bar doesn't sit empty at the end.
      setProgress({
        phase: 'Saving to database',
        current: 0,
        total: itemsResult.items.length + equipsResult.equips.length,
      });
      const [itemCount, equipCount] = await Promise.all([
        itemsResult.items.length > 0 ? db.upsertItems(itemsResult.items) : Promise.resolve(0),
        equipsResult.equips.length > 0 ? db.upsertEquips(equipsResult.equips) : Promise.resolve(0),
      ]);
      setProgress({
        phase: 'Saving to database',
        current: itemCount + equipCount,
        total: itemsResult.items.length + equipsResult.equips.length,
      });

      const ms = Math.round(performance.now() - started);
      const result: ExtractStats = {
        items: itemCount,
        equips: equipCount,
        skipped: itemsResult.skipped.length + equipsResult.skipped.length,
        ms,
      };
      log.info('extract+persist complete', result);
      return result;
    },
    onSuccess: (r) => {
      setStats(r);
      setProgress(null);
      queryClient.invalidateQueries({ queryKey: ['db'] });
    },
    onError: (e) => {
      log.error('extract failed', describeError(e));
      setProgress(null);
    },
  });

  const onRun = useCallback(() => runM.mutate(), [runM]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Bulk extract to database</h2>
      <p className="text-muted-foreground text-sm">
        Walks <code className="font-mono text-xs">Item.wz</code> and joins names from{' '}
        <code className="font-mono text-xs">String.wz</code> for items, plus equipment names from{' '}
        <code className="font-mono text-xs">String.wz/Eqp.img</code>. Records are saved to the local
        SQLite database.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={onRun} disabled={runM.isPending}>
          {runM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {runM.isPending ? 'Extracting…' : 'Extract items + equips'}
        </Button>
        {stats && !runM.isPending && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            <span>
              {stats.items} items, {stats.equips} equips
              {stats.skipped > 0 ? `, ${stats.skipped} skipped` : ''} in {stats.ms} ms
            </span>
            <Link to="/items" className="text-primary text-xs hover:underline">
              View items →
            </Link>
          </div>
        )}
      </div>
      {progress && (
        <div className="border-border bg-card text-card-foreground rounded-md border p-3">
          <ProgressBar progress={progress} />
        </div>
      )}
      {runM.isError && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
          {(runM.error as Error).message}
        </div>
      )}
    </section>
  );
}
