import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proxy } from 'comlink';
import { getParserClient } from '@/parser';
import { getDbClient, type DatasetFileRef, type ExtractorResultRecord } from '@/db';
import { createLogger, describeError } from '@/lib/logger';
import type { ProgressUpdate } from '@/lib/progress';

const log = createLogger('extract-ui');

export interface ExtractStats {
  items: number;
  equips: number;
  mobs: number;
  npcs: number;
  maps: number;
  quests: number;
  skipped: number;
  ms: number;
  /** Per-extractor outcome rows persisted into `extraction_extractors`. */
  perExtractor: ExtractorResultRecord[];
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
  /**
   * Per-file errors from `parser.load`. Merged into each `recordFiles`
   * entry as `loadStatus` / `loadError` before the dataset is persisted, so
   * the Settings → extraction-reports panel can show what failed.
   */
  loadErrors?: { name: string; message: string }[];
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
 * (on the parser debug page) and the first-run wizard. The mutation
 * records a `datasets` row at the end with per-file load outcomes (from
 * `loadErrors`) and a per-extractor breakdown so the Settings panel can
 * show a full report after the run.
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

      const tracker = new ExtractorTracker(opts.skipWz);
      let skippedTotal = 0;

      if (!shouldSkip(opts.skipWz, 'item')) {
        try {
          const r = await parser.extractItems(onProgress);
          setProgress({
            phase: 'Saving items to database',
            current: 0,
            total: r.items.length,
          });
          const itemCount = r.items.length > 0 ? await db.upsertItems(r.items) : 0;
          tracker.ran('item', itemCount, r.skipped.length);
          skippedTotal += r.skipped.length;

          const e = await parser.extractEquips(onProgress);
          setProgress({
            phase: 'Saving equips to database',
            current: 0,
            total: e.equips.length,
          });
          const equipCount = e.equips.length > 0 ? await db.upsertEquips(e.equips) : 0;
          tracker.ran('equip', equipCount, e.skipped.length);
          skippedTotal += e.skipped.length;
        } catch (err) {
          tracker.failed('item', err);
          tracker.failed('equip', err);
          throw err;
        }
      } else {
        log.info('skipping items+equips (Item.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'mob')) {
        try {
          const r = await parser.extractMobs(onProgress);
          setProgress({ phase: 'Saving mobs to database', current: 0, total: r.mobs.length });
          const mobCount = r.mobs.length > 0 ? await db.upsertMobs(r.mobs) : 0;
          tracker.ran('mob', mobCount, r.skipped.length);
          skippedTotal += r.skipped.length;
        } catch (err) {
          tracker.failed('mob', err);
          throw err;
        }
      } else {
        log.info('skipping mobs (Mob.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'npc')) {
        try {
          const r = await parser.extractNpcs(onProgress);
          setProgress({ phase: 'Saving NPCs to database', current: 0, total: r.npcs.length });
          const npcCount = r.npcs.length > 0 ? await db.upsertNpcs(r.npcs) : 0;
          tracker.ran('npc', npcCount, r.skipped.length);
          skippedTotal += r.skipped.length;
        } catch (err) {
          tracker.failed('npc', err);
          throw err;
        }
      } else {
        log.info('skipping npcs (Npc.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'map')) {
        try {
          const r = await parser.extractMaps(onProgress);
          setProgress({ phase: 'Saving maps to database', current: 0, total: r.maps.length });
          const mapCount = r.maps.length > 0 ? await db.upsertMaps(r.maps) : 0;
          tracker.ran('map', mapCount, r.skipped.length);
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
        } catch (err) {
          tracker.failed('map', err);
          throw err;
        }
      } else {
        log.info('skipping maps (Map.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'quest')) {
        try {
          const r = await parser.extractQuests(onProgress);
          setProgress({ phase: 'Saving quests to database', current: 0, total: r.quests.length });
          const questCount = r.quests.length > 0 ? await db.upsertQuests(r.quests) : 0;
          tracker.ran('quest', questCount, r.skipped.length, r.placeholderNames);
          skippedTotal += r.skipped.length;
          if (r.requirements.length > 0 || r.rewards.length > 0) {
            setProgress({
              phase: 'Saving quest requirements + rewards',
              current: 0,
              total: r.requirements.length + r.rewards.length,
            });
            await db.replaceQuestRelations({
              requirements: r.requirements,
              rewards: r.rewards,
            });
          }
        } catch (err) {
          tracker.failed('quest', err);
          throw err;
        }
      } else {
        log.info('skipping quests (Quest.wz hash unchanged)');
      }

      const ms = Math.round(performance.now() - started);
      const perExtractor = tracker.records();

      // Persist the run. Merge load errors into the file refs so the
      // recorded dataset knows which files made it into the parser.
      if (opts.recordFiles && opts.recordFiles.length > 0) {
        setProgress({ phase: 'Recording dataset', current: 0 });
        const errorByName = new Map((opts.loadErrors ?? []).map((e) => [e.name, e.message]));
        const filesWithStatus: DatasetFileRef[] = opts.recordFiles.map((f) => {
          const err = errorByName.get(f.name);
          return {
            ...f,
            loadStatus: err ? 'load_failed' : 'loaded',
            loadError: err ?? null,
          };
        });
        await db.recordDataset({
          label: opts.label ?? `WZ load · ${new Date().toLocaleString()}`,
          wzVersion: opts.wzVersion ?? 'GMS',
          files: filesWithStatus,
          totalMs: ms,
          ok: perExtractor.every((e) => !e.error),
          extractors: perExtractor,
        });
      }

      const result: ExtractStats = {
        items: countOf(perExtractor, 'item'),
        equips: countOf(perExtractor, 'equip'),
        mobs: countOf(perExtractor, 'mob'),
        npcs: countOf(perExtractor, 'npc'),
        maps: countOf(perExtractor, 'map'),
        quests: countOf(perExtractor, 'quest'),
        skipped: skippedTotal,
        ms,
        perExtractor,
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

function countOf(records: ExtractorResultRecord[], key: string): number {
  return records.find((r) => r.extractor === key)?.rows ?? 0;
}

/**
 * Accumulates per-extractor results as the pipeline runs. Every known
 * extractor key starts as `skipped` and is upgraded to `ran` when its
 * stage actually executes — that way `extraction_extractors` records the
 * full picture even for extractors that didn't run, which keeps the
 * Settings panel from leaving question marks in its breakdown.
 */
class ExtractorTracker {
  private readonly map = new Map<string, ExtractorResultRecord>();

  constructor(skipWz?: Set<string>) {
    const allKeys: ExtractorResultRecord['extractor'][] = [
      'item',
      'equip',
      'mob',
      'npc',
      'map',
      'quest',
    ];
    for (const k of allKeys) {
      this.map.set(k, {
        extractor: k,
        status: shouldSkip(skipWz, equivWzKey(k)) ? 'skipped' : 'skipped',
        rows: 0,
        skippedRows: 0,
        placeholderNames: 0,
        error: null,
      });
    }
  }

  ran(key: string, rows: number, skippedRows: number, placeholderNames = 0): void {
    this.map.set(key, {
      extractor: key,
      status: 'ran',
      rows,
      skippedRows,
      placeholderNames,
      error: null,
    });
  }

  failed(key: string, err: unknown): void {
    const existing = this.map.get(key);
    this.map.set(key, {
      extractor: key,
      status: 'ran',
      rows: existing?.rows ?? 0,
      skippedRows: existing?.skippedRows ?? 0,
      placeholderNames: existing?.placeholderNames ?? 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  records(): ExtractorResultRecord[] {
    return [...this.map.values()];
  }
}

/** Item / Equip extractors share the `item` skipWz key (Item.wz drives both). */
function equivWzKey(extractor: string): string {
  return extractor === 'equip' ? 'item' : extractor;
}
