import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proxy } from 'comlink';
import { getParserClient } from '@/parser';
import { getDbClient, type DatasetFileRef } from '@/db';
import { createLogger, describeError } from '@/lib/logger';
import type { ProgressUpdate } from '@/lib/progress';
import {
  ExtractorTracker,
  buildExtractStats,
  mergeFileStatuses,
  shouldSkip,
  type ExtractStats,
} from './shared';

export type { ExtractStats } from './shared';

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
          if (r.drops.length > 0) {
            setProgress({
              phase: 'Saving mob drops',
              current: 0,
              total: r.drops.length,
            });
            await db.replaceMobDrops(r.drops);
          }
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
          if (
            r.mapNpcs.length > 0 ||
            r.mapMobs.length > 0 ||
            r.mapPortals.length > 0 ||
            r.mapMobSpawns.length > 0
          ) {
            setProgress({
              phase: 'Saving map life + portals',
              current: 0,
              total:
                r.mapNpcs.length + r.mapMobs.length + r.mapPortals.length + r.mapMobSpawns.length,
            });
            await db.replaceMapLife({
              npcs: r.mapNpcs,
              mobs: r.mapMobs,
              portals: r.mapPortals,
              mobSpawns: r.mapMobSpawns,
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

      if (!shouldSkip(opts.skipWz, 'skill')) {
        try {
          const j = await parser.extractJobs(onProgress);
          setProgress({
            phase: 'Saving jobs to database',
            current: 0,
            total: j.jobs.length,
          });
          const jobCount = j.jobs.length > 0 ? await db.upsertJobs(j.jobs) : 0;
          tracker.ran('job', jobCount, j.skipped.length);
          skippedTotal += j.skipped.length;
        } catch (err) {
          tracker.failed('job', err);
          throw err;
        }
        try {
          const r = await parser.extractSkills(onProgress);
          setProgress({
            phase: 'Saving skills to database',
            current: 0,
            total: r.skills.length,
          });
          const skillCount = r.skills.length > 0 ? await db.upsertSkills(r.skills) : 0;
          if (r.levels.length > 0 || r.prerequisites.length > 0) {
            setProgress({
              phase: 'Saving skill levels + prerequisites',
              current: 0,
              total: r.levels.length + r.prerequisites.length,
            });
            await db.replaceSkillRelations({
              levels: r.levels,
              prerequisites: r.prerequisites,
            });
          }
          tracker.ran('skill', skillCount, r.skipped.length);
          skippedTotal += r.skipped.length;
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
        const chainCount = await db.computeAndStoreQuestChains();
        tracker.ran('questChain', chainCount, 0);
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
