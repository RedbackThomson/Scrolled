import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proxy } from 'comlink';
import { getParserClient } from '@/parser';
import { getDbClient, type DatasetFileRef } from '@/db';
import { createLogger, describeError } from '@/lib/logger';
import type { ProgressUpdate } from '@/lib/progress';

const log = createLogger('extract-ui');

export interface ExtractStats {
  items: number;
  equips: number;
  mobs: number;
  npcs: number;
  maps: number;
  skipped: number;
  ms: number;
}

export interface UseExtractAllOptions {
  /**
   * WZ files we should NOT re-process (typically because their hashes
   * matched a previously-loaded dataset entry). Match is by lowercased file
   * name with the `.wz` extension stripped — e.g. `'item'`, `'mob'`.
   */
  skipWz?: Set<string>;
  /**
   * Files to record into `datasets` / `dataset_files` when the run finishes.
   * The wizard fills this in; `ExtractAllPanel` may omit it for ad-hoc
   * extractions.
   */
  recordFiles?: DatasetFileRef[];
  /** WZ encryption version, e.g. 'GMS'. Used for the dataset record. */
  wzVersion?: string;
  /** Optional human-readable label for the dataset record. */
  label?: string;
}

function shouldSkip(skipWz: Set<string> | undefined, wz: string): boolean {
  return !!skipWz && skipWz.has(wz);
}

/**
 * Normalise a `.wz` file name to the lowercase stem we use for skip-keys.
 * `Item.wz` → `item`, `MAP.WZ` → `map`.
 */
export function wzKey(fileName: string): string {
  return fileName.toLowerCase().replace(/\.wz$/i, '');
}

/**
 * Drives the full extract → persist pipeline. Used both by `ExtractAllPanel`
 * (on the parser debug page) and the first-run wizard. Skipping per-WZ-file
 * lets the wizard short-circuit extractors when an uploaded file's hash
 * matches a previously-recorded one.
 */
export function useExtractAll(opts: UseExtractAllOptions = {}) {
  const parser = useMemo(() => getParserClient(), []);
  const db = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [stats, setStats] = useState<ExtractStats | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const started = performance.now();
      setProgress({ phase: 'Starting extraction', current: 0 });
      const onProgress = proxy((p: ProgressUpdate) => setProgress(p));

      let itemCount = 0;
      let equipCount = 0;
      let mobCount = 0;
      let npcCount = 0;
      let mapCount = 0;
      let skippedTotal = 0;

      if (!shouldSkip(opts.skipWz, 'item')) {
        const r = await parser.extractItems(onProgress);
        setProgress({
          phase: 'Saving items to database',
          current: 0,
          total: r.items.length,
        });
        itemCount = r.items.length > 0 ? await db.upsertItems(r.items) : 0;
        skippedTotal += r.skipped.length;

        const e = await parser.extractEquips(onProgress);
        setProgress({
          phase: 'Saving equips to database',
          current: 0,
          total: e.equips.length,
        });
        equipCount = e.equips.length > 0 ? await db.upsertEquips(e.equips) : 0;
        skippedTotal += e.skipped.length;
      } else {
        log.info('skipping items+equips (Item.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'mob')) {
        const r = await parser.extractMobs(onProgress);
        setProgress({ phase: 'Saving mobs to database', current: 0, total: r.mobs.length });
        mobCount = r.mobs.length > 0 ? await db.upsertMobs(r.mobs) : 0;
        skippedTotal += r.skipped.length;
      } else {
        log.info('skipping mobs (Mob.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'npc')) {
        const r = await parser.extractNpcs(onProgress);
        setProgress({ phase: 'Saving NPCs to database', current: 0, total: r.npcs.length });
        npcCount = r.npcs.length > 0 ? await db.upsertNpcs(r.npcs) : 0;
        skippedTotal += r.skipped.length;
      } else {
        log.info('skipping npcs (Npc.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'map')) {
        const r = await parser.extractMaps(onProgress);
        setProgress({ phase: 'Saving maps to database', current: 0, total: r.maps.length });
        mapCount = r.maps.length > 0 ? await db.upsertMaps(r.maps) : 0;
        skippedTotal += r.skipped.length;
        if (r.mapNpcs.length > 0 || r.mapMobs.length > 0 || r.mapPortals.length > 0) {
          setProgress({
            phase: 'Saving map life + portals',
            current: 0,
            total: r.mapNpcs.length + r.mapMobs.length + r.mapPortals.length,
          });
          await db.replaceMapLife({
            npcs: r.mapNpcs,
            mobs: r.mapMobs,
            portals: r.mapPortals,
          });
        }
      } else {
        log.info('skipping maps (Map.wz hash unchanged)');
      }

      // Record a datasets row so feature flags pick up the new files.
      if (opts.recordFiles && opts.recordFiles.length > 0) {
        setProgress({ phase: 'Recording dataset', current: 0 });
        await db.recordDataset({
          label: opts.label ?? `WZ load · ${new Date().toLocaleString()}`,
          wzVersion: opts.wzVersion ?? 'GMS',
          files: opts.recordFiles,
        });
      }

      const ms = Math.round(performance.now() - started);
      const result: ExtractStats = {
        items: itemCount,
        equips: equipCount,
        mobs: mobCount,
        npcs: npcCount,
        maps: mapCount,
        skipped: skippedTotal,
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

  const run = useCallback(() => mutation.mutate(), [mutation]);

  return {
    run,
    isRunning: mutation.isPending,
    error: mutation.error as Error | null,
    progress,
    stats,
    reset: () => {
      setProgress(null);
      setStats(null);
      mutation.reset();
    },
  };
}
