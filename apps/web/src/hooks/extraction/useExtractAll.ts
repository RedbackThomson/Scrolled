import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proxy } from 'comlink';
import { getParserClient } from '@/parser';
import { getDbClient, type DatasetFileRef } from '@/db';
import { createLogger, describeError } from '@scrolled/game-db/lib/logger';
import type { ProgressUpdate } from '@scrolled/game-db/lib/progress';
import {
  ExtractorTracker,
  buildExtractStats,
  mergeFileStatuses,
  shouldSkip,
  type ExtractStats,
} from '@scrolled/extractor/builder/extractStats';
import {
  storeItems,
  storeChairs,
  storeEquips,
  storeMobs,
  storeNpcs,
  storeMaps,
  storeWorldMaps,
  storeQuests,
  storeJobs,
  storeSkills,
  storeQuestChains,
} from '@scrolled/extractor/builder/storeResults';

export type { ExtractStats } from '@scrolled/extractor/builder/extractStats';

const log = createLogger('extract-ui');

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

      // The upsert sequencing + FK ordering lives in
      // @scrolled/extractor/builder/storeResults, shared with the headless
      // build and the wizard pool. This hook keeps the single-worker extract
      // order, the hash-skip gating, and the progress phase text.
      if (!shouldSkip(opts.skipWz, 'item')) {
        try {
          setProgress({ phase: 'Saving items to database', current: 0 });
          const items = await storeItems(db, await parser.extractItems(onProgress));
          tracker.ran('item', items.rows, items.skipped);
          skippedTotal += items.skipped;

          // Chairs FK into items.id, so they have to land after items.
          setProgress({ phase: 'Saving chairs to database', current: 0 });
          const chairs = await storeChairs(db, await parser.extractChairs(onProgress));
          tracker.ran('chair', chairs.rows, chairs.skipped);
          skippedTotal += chairs.skipped;

          setProgress({ phase: 'Saving equips to database', current: 0 });
          const equips = await storeEquips(db, await parser.extractEquips(onProgress));
          tracker.ran('equip', equips.rows, equips.skipped);
          skippedTotal += equips.skipped;
        } catch (err) {
          tracker.failed('item', err);
          tracker.failed('chair', err);
          tracker.failed('equip', err);
          throw err;
        }
      } else {
        log.info('skipping items+chairs+equips (Item.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'mob')) {
        try {
          setProgress({ phase: 'Saving mobs to database', current: 0 });
          const r = await storeMobs(db, await parser.extractMobs(onProgress));
          tracker.ran('mob', r.rows, r.skipped);
          skippedTotal += r.skipped;
        } catch (err) {
          tracker.failed('mob', err);
          throw err;
        }
      } else {
        log.info('skipping mobs (Mob.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'npc')) {
        try {
          setProgress({ phase: 'Saving NPCs to database', current: 0 });
          const r = await storeNpcs(db, await parser.extractNpcs(onProgress));
          tracker.ran('npc', r.rows, r.skipped);
          skippedTotal += r.skipped;
        } catch (err) {
          tracker.failed('npc', err);
          throw err;
        }
      } else {
        log.info('skipping npcs (Npc.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'map')) {
        try {
          setProgress({ phase: 'Saving maps to database', current: 0 });
          const r = await storeMaps(db, await parser.extractMaps(onProgress));
          tracker.ran('map', r.rows, r.skipped);
          skippedTotal += r.skipped;
        } catch (err) {
          tracker.failed('map', err);
          throw err;
        }
      } else {
        log.info('skipping maps (Map.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'map')) {
        try {
          setProgress({ phase: 'Saving world maps to database', current: 0 });
          const r = await storeWorldMaps(db, await parser.extractWorldMaps(onProgress));
          tracker.ran('worldMap', r.rows, r.skipped);
          skippedTotal += r.skipped;
        } catch (err) {
          tracker.failed('worldMap', err);
          throw err;
        }
      } else {
        log.info('skipping world maps (Map.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'quest')) {
        try {
          setProgress({ phase: 'Saving quests to database', current: 0 });
          const r = await storeQuests(db, await parser.extractQuests(onProgress));
          tracker.ran('quest', r.rows, r.skipped, r.placeholderNames);
          skippedTotal += r.skipped;
        } catch (err) {
          tracker.failed('quest', err);
          throw err;
        }
      } else {
        log.info('skipping quests (Quest.wz hash unchanged)');
      }

      if (!shouldSkip(opts.skipWz, 'skill')) {
        try {
          setProgress({ phase: 'Saving jobs to database', current: 0 });
          const j = await storeJobs(db, await parser.extractJobs(onProgress));
          tracker.ran('job', j.rows, j.skipped);
          skippedTotal += j.skipped;
        } catch (err) {
          tracker.failed('job', err);
          throw err;
        }
        try {
          setProgress({ phase: 'Saving skills to database', current: 0 });
          const r = await storeSkills(db, await parser.extractSkills(onProgress));
          tracker.ran('skill', r.rows, r.skipped);
          skippedTotal += r.skipped;
        } catch (err) {
          tracker.failed('skill', err);
          throw err;
        }
      } else {
        log.info('skipping skills (Skill.wz hash unchanged)');
      }

      // Quest chains are a pure DB derivation, not an extraction. Always run
      // — when WZ files are hash-skipped we still want chains populated on
      // the first run of a build that ships them.
      try {
        setProgress({ phase: 'Deriving quest chains', current: 0 });
        const chains = await storeQuestChains(db);
        tracker.ran('questChain', chains.rows, 0);
      } catch (err) {
        tracker.failed('questChain', err);
        // Non-fatal: the chain pages will read empty, but the rest of the
        // library is fine. Log and move on.
        log.error('quest-chain derivation failed', describeError(err));
      }

      const ms = Math.round(performance.now() - started);
      const perExtractor = tracker.records();

      // Persist the run. Merge load errors into the file refs so the
      // recorded dataset knows which files made it into the parser.
      if (opts.recordFiles && opts.recordFiles.length > 0) {
        setProgress({ phase: 'Recording dataset', current: 0 });
        const errorByName = new Map((opts.loadErrors ?? []).map((e) => [e.name, e.message]));
        const filesWithStatus = mergeFileStatuses(opts.recordFiles, errorByName);
        await db.recordDataset({
          label: opts.label ?? `WZ load · ${new Date().toLocaleString()}`,
          wzVersion: opts.wzVersion ?? 'GMS',
          files: filesWithStatus,
          totalMs: ms,
          ok: perExtractor.every((e) => !e.error),
          extractors: perExtractor,
        });
      }

      const result: ExtractStats = buildExtractStats(perExtractor, skippedTotal, ms);
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
