// runExtraction — the headless extract → persist pipeline.
//
// This is the same sequence the web app's `useExtractAll` drives, factored out
// of React/comlink so the build CLI can reuse it verbatim. The app keeps its
// worker-pool path (`useWizardExtract`) for the in-browser wizard; both
// ultimately run the same extractors and the same `db.upsert*` calls.
//
// Callers pass an already-`init`/`load`ed `GameDataSource` (browser worker or
// Node fs source) and an already-`open`ed `GameDatabase`. The function runs
// every extractor sequentially against the one source, persists each batch,
// derives quest chains, and records the dataset row (which stamps the data
// revision).

import type { GameDataSource } from '../parser';
import type { DatasetFileRef, GameDatabase } from '@scrolled/game-db/db';
import { createLogger, describeError } from '@scrolled/game-db/lib/logger';
import type { ProgressFn, ProgressUpdate } from '@scrolled/game-db/lib/progress';
import {
  extractItems,
  extractChairs,
  extractEquips,
  extractMobs,
  extractNpcs,
  extractMaps,
  extractWorldMaps,
  extractQuests,
  extractSkills,
  extractJobs,
} from '../extractors';
import {
  ExtractorTracker,
  buildExtractStats,
  mergeFileStatuses,
  type ExtractStats,
} from './extractStats';

const log = createLogger('run-extraction');

export interface RunExtractionOptions {
  /** Human-readable label for the dataset record. */
  label: string;
  /** WZ encryption version, e.g. 'GMS'. Recorded on the dataset row. */
  wzVersion: string;
  /** Which on-disk format the source reads. Defaults to 'wz'. */
  sourceKind?: 'wz' | 'img';
  /** File refs to record into `datasets` / `dataset_files`. */
  files?: DatasetFileRef[];
  /** Per-file load errors, merged into the recorded file refs. */
  loadErrors?: { name: string; message: string }[];
  /** Fine-grained per-item progress from the extractors. */
  onProgress?: ProgressFn;
  /** Coarse per-stage callback (e.g. for CLI logging). */
  onStage?: (stage: string) => void;
}

/**
 * Run the full extraction pipeline against a loaded source and an open
 * database. Returns the rolled-up stats; throws if any extractor fails (the
 * partial dataset is still recorded with the failure noted, mirroring the app).
 */
export async function runExtraction(
  source: GameDataSource,
  db: GameDatabase,
  opts: RunExtractionOptions,
): Promise<ExtractStats> {
  const started = performance.now();
  const tracker = new ExtractorTracker();
  let skippedTotal = 0;

  const stage = (s: string) => {
    log.info(s);
    opts.onStage?.(s);
  };
  const progress = (p: ProgressUpdate) => opts.onProgress?.(p);
  const onProgress: ProgressFn | undefined = opts.onProgress ? progress : undefined;

  try {
    stage('Extracting items');
    const items = await extractItems(source, { onProgress });
    const itemCount = items.items.length > 0 ? await db.upsertItems(items.items) : 0;
    tracker.ran('item', itemCount, items.skipped.length);
    skippedTotal += items.skipped.length;

    // Chairs FK into items.id, so they have to land after upsertItems.
    stage('Extracting chairs');
    const chairs = await extractChairs(source, { onProgress });
    const chairCount = chairs.chairs.length > 0 ? await db.upsertChairs(chairs.chairs) : 0;
    tracker.ran('chair', chairCount, chairs.skipped.length);
    skippedTotal += chairs.skipped.length;

    stage('Extracting equips');
    const equips = await extractEquips(source, { onProgress });
    const equipCount = equips.equips.length > 0 ? await db.upsertEquips(equips.equips) : 0;
    tracker.ran('equip', equipCount, equips.skipped.length);
    skippedTotal += equips.skipped.length;
  } catch (err) {
    tracker.failed('item', err);
    tracker.failed('chair', err);
    tracker.failed('equip', err);
    throw err;
  }

  try {
    stage('Extracting mobs');
    const r = await extractMobs(source, { onProgress });
    const mobCount = r.mobs.length > 0 ? await db.upsertMobs(r.mobs) : 0;
    if (r.drops.length > 0) await db.replaceMobDrops(r.drops);
    tracker.ran('mob', mobCount, r.skipped.length);
    skippedTotal += r.skipped.length;
  } catch (err) {
    tracker.failed('mob', err);
    throw err;
  }

  try {
    stage('Extracting NPCs');
    const r = await extractNpcs(source, { onProgress });
    const npcCount = r.npcs.length > 0 ? await db.upsertNpcs(r.npcs) : 0;
    tracker.ran('npc', npcCount, r.skipped.length);
    skippedTotal += r.skipped.length;
  } catch (err) {
    tracker.failed('npc', err);
    throw err;
  }

  try {
    stage('Extracting maps');
    const r = await extractMaps(source, { onProgress });
    const mapCount = r.maps.length > 0 ? await db.upsertMaps(r.maps) : 0;
    if (r.mapMarks.length > 0) await db.upsertMapMarks(r.mapMarks);
    if (
      r.mapNpcs.length > 0 ||
      r.mapMobs.length > 0 ||
      r.mapPortals.length > 0 ||
      r.mapMobSpawns.length > 0
    ) {
      await db.replaceMapLife({
        npcs: r.mapNpcs,
        mobs: r.mapMobs,
        portals: r.mapPortals,
        mobSpawns: r.mapMobSpawns,
      });
    }
    tracker.ran('map', mapCount, r.skipped.length);
    skippedTotal += r.skipped.length;
  } catch (err) {
    tracker.failed('map', err);
    throw err;
  }

  try {
    stage('Extracting world maps');
    const r = await extractWorldMaps(source, { onProgress });
    const worldMapCount = r.worldMaps.length > 0 ? await db.upsertWorldMaps(r.worldMaps) : 0;
    if (r.markers.length > 0) await db.upsertWorldMapMarkers(r.markers);
    if (r.markerMaps.length > 0) await db.upsertWorldMapMarkerMaps(r.markerMaps);
    if (r.links.length > 0) await db.upsertWorldMapLinks(r.links);
    tracker.ran('worldMap', worldMapCount, r.skipped.length);
    skippedTotal += r.skipped.length;
  } catch (err) {
    tracker.failed('worldMap', err);
    throw err;
  }

  try {
    stage('Extracting quests');
    const r = await extractQuests(source, { onProgress });
    const questCount = r.quests.length > 0 ? await db.upsertQuests(r.quests) : 0;
    tracker.ran('quest', questCount, r.skipped.length, r.placeholderNames);
    skippedTotal += r.skipped.length;
    if (r.requirements.length > 0 || r.rewards.length > 0) {
      await db.replaceQuestRelations({ requirements: r.requirements, rewards: r.rewards });
    }
  } catch (err) {
    tracker.failed('quest', err);
    throw err;
  }

  try {
    // Jobs first so skill rows can resolve to a job name.
    stage('Extracting jobs');
    const j = await extractJobs(source, { onProgress });
    const jobCount = j.jobs.length > 0 ? await db.upsertJobs(j.jobs) : 0;
    tracker.ran('job', jobCount, j.skipped.length);
    skippedTotal += j.skipped.length;
  } catch (err) {
    tracker.failed('job', err);
    throw err;
  }

  try {
    stage('Extracting skills');
    const r = await extractSkills(source, { onProgress });
    const skillCount = r.skills.length > 0 ? await db.upsertSkills(r.skills) : 0;
    if (r.levels.length > 0 || r.prerequisites.length > 0) {
      await db.replaceSkillRelations({ levels: r.levels, prerequisites: r.prerequisites });
    }
    tracker.ran('skill', skillCount, r.skipped.length);
    skippedTotal += r.skipped.length;
  } catch (err) {
    tracker.failed('skill', err);
    throw err;
  }

  // Quest chains are a pure DB derivation, not an extraction. Always run.
  try {
    stage('Deriving quest chains');
    const chainCount = await db.computeAndStoreQuestChains();
    tracker.ran('questChain', chainCount, 0);
  } catch (err) {
    tracker.failed('questChain', err);
    log.error('quest-chain derivation failed', describeError(err));
  }

  const ms = Math.round(performance.now() - started);
  const perExtractor = tracker.records();

  // Record the dataset row. This stamps the data revision via recordDataset.
  stage('Recording dataset');
  const errorByName = new Map((opts.loadErrors ?? []).map((e) => [e.name, e.message]));
  const filesWithStatus = mergeFileStatuses(opts.files ?? [], errorByName);
  await db.recordDataset({
    label: opts.label,
    wzVersion: opts.wzVersion,
    sourceKind: opts.sourceKind ?? 'wz',
    files: filesWithStatus,
    totalMs: ms,
    ok: perExtractor.every((e) => !e.error),
    extractors: perExtractor,
  });

  const result = buildExtractStats(perExtractor, skippedTotal, ms);
  log.info('extract+persist complete', result);
  return result;
}
