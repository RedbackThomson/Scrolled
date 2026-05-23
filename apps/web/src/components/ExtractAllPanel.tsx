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
  mobs: number;
  npcs: number;
  maps: number;
  skipped: number;
  ms: number;
}

/**
 * Bulk extraction across every entity type the app knows how to parse from
 * the loaded WZ files. Each extractor runs sequentially (the parser
 * worker's per-file lock would serialize them anyway), and the persisted
 * records show up immediately on their respective routes.
 *
 * Progress is streamed from the worker through a comlink-proxied callback.
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

      const onProgress = proxy((p: ProgressUpdate) => setProgress(p));

      const itemsResult = await parser.extractItems(onProgress);
      setProgress({
        phase: 'Saving items to database',
        current: 0,
        total: itemsResult.items.length,
      });
      const itemCount = itemsResult.items.length > 0 ? await db.upsertItems(itemsResult.items) : 0;

      const equipsResult = await parser.extractEquips(onProgress);
      setProgress({
        phase: 'Saving equips to database',
        current: 0,
        total: equipsResult.equips.length,
      });
      const equipCount =
        equipsResult.equips.length > 0 ? await db.upsertEquips(equipsResult.equips) : 0;

      const mobsResult = await parser.extractMobs(onProgress);
      setProgress({
        phase: 'Saving mobs to database',
        current: 0,
        total: mobsResult.mobs.length,
      });
      const mobCount = mobsResult.mobs.length > 0 ? await db.upsertMobs(mobsResult.mobs) : 0;

      const npcsResult = await parser.extractNpcs(onProgress);
      setProgress({
        phase: 'Saving NPCs to database',
        current: 0,
        total: npcsResult.npcs.length,
      });
      const npcCount = npcsResult.npcs.length > 0 ? await db.upsertNpcs(npcsResult.npcs) : 0;

      const mapsResult = await parser.extractMaps(onProgress);
      setProgress({
        phase: 'Saving maps to database',
        current: 0,
        total: mapsResult.maps.length,
      });
      const mapCount = mapsResult.maps.length > 0 ? await db.upsertMaps(mapsResult.maps) : 0;
      // Map life + portals are written as a single replace transaction.
      if (
        mapsResult.mapNpcs.length > 0 ||
        mapsResult.mapMobs.length > 0 ||
        mapsResult.mapPortals.length > 0
      ) {
        setProgress({
          phase: 'Saving map life + portals',
          current: 0,
          total:
            mapsResult.mapNpcs.length + mapsResult.mapMobs.length + mapsResult.mapPortals.length,
        });
        await db.replaceMapLife({
          npcs: mapsResult.mapNpcs,
          mobs: mapsResult.mapMobs,
          portals: mapsResult.mapPortals,
        });
      }

      const ms = Math.round(performance.now() - started);
      const result: ExtractStats = {
        items: itemCount,
        equips: equipCount,
        mobs: mobCount,
        npcs: npcCount,
        maps: mapCount,
        skipped:
          itemsResult.skipped.length +
          equipsResult.skipped.length +
          mobsResult.skipped.length +
          npcsResult.skipped.length +
          mapsResult.skipped.length,
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
        Walks every loaded WZ file: items + equips + mobs + NPCs + maps (with their NPC, mob, and
        portal placements). Records are saved to the local SQLite database. Map.wz extraction is
        memory-intensive — load it only if you want full map data.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={onRun} disabled={runM.isPending}>
          {runM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {runM.isPending ? 'Extracting…' : 'Extract everything'}
        </Button>
        {stats && !runM.isPending && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            <span>
              {stats.items} items, {stats.equips} equips, {stats.mobs} mobs, {stats.npcs} NPCs,{' '}
              {stats.maps} maps
              {stats.skipped > 0 ? `, ${stats.skipped} skipped` : ''} in {stats.ms} ms
            </span>
            <Link to="/items" className="text-primary text-xs hover:underline">
              Browse →
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
