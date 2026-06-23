// runExtraction — the headless extract → persist pipeline.
//
// The sequential driver for the build CLI: run each extractor against one
// source and persist via the shared `store*` functions (./storeResults). The web
// app's `useExtractAll` (single worker) and `useWizardExtract` (parallel pool)
// drive their own control flow but funnel results through those same `store*`
// functions, so the persistence sequence is identical across all three.
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
  extractConsumableSpecs,
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
import {
  storeItems,
  storeChairs,
  storeConsumableSpecs,
  storeEquips,
  storeMobs,
  storeNpcs,
  storeMaps,
  storeWorldMaps,
  storeQuests,
  storeJobs,
  storeSkills,
  storeQuestChains,
} from './storeResults';

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
    const items = await storeItems(db, await extractItems(source, { onProgress }));
    tracker.ran('item', items.rows, items.skipped);
    skippedTotal += items.skipped;

    // Chairs FK into items.id, so they have to land after storeItems.
    stage('Extracting chairs');
    const chairs = await storeChairs(db, await extractChairs(source, { onProgress }));
    tracker.ran('chair', chairs.rows, chairs.skipped);
    skippedTotal += chairs.skipped;

    // Consumable specs are a sidecar of items (same Item.wz), and also FK into
    // items.id — store after items. Tracked like the other item-relation
    // sidecars (mob drops, map life): folded into its parent, no separate key.
    stage('Extracting consumable specs');
    const specs = await storeConsumableSpecs(db, await extractConsumableSpecs(source, { onProgress }));
    skippedTotal += specs.skipped;

    stage('Extracting equips');
    const equips = await storeEquips(db, await extractEquips(source, { onProgress }));
    tracker.ran('equip', equips.rows, equips.skipped);
    skippedTotal += equips.skipped;
  } catch (err) {
    tracker.failed('item', err);
    tracker.failed('chair', err);
    tracker.failed('equip', err);
    throw err;
  }

  try {
    stage('Extracting mobs');
    const r = await storeMobs(db, await extractMobs(source, { onProgress }));
    tracker.ran('mob', r.rows, r.skipped);
    skippedTotal += r.skipped;
  } catch (err) {
    tracker.failed('mob', err);
    throw err;
  }

  try {
    stage('Extracting NPCs');
    const r = await storeNpcs(db, await extractNpcs(source, { onProgress }));
    tracker.ran('npc', r.rows, r.skipped);
    skippedTotal += r.skipped;
  } catch (err) {
    tracker.failed('npc', err);
    throw err;
  }

  try {
    stage('Extracting maps');
    const r = await storeMaps(db, await extractMaps(source, { onProgress }));
    tracker.ran('map', r.rows, r.skipped);
    skippedTotal += r.skipped;
  } catch (err) {
    tracker.failed('map', err);
    throw err;
  }

  try {
    stage('Extracting world maps');
    const r = await storeWorldMaps(db, await extractWorldMaps(source, { onProgress }));
    tracker.ran('worldMap', r.rows, r.skipped);
    skippedTotal += r.skipped;
  } catch (err) {
    tracker.failed('worldMap', err);
    throw err;
  }

  try {
    stage('Extracting quests');
    const r = await storeQuests(db, await extractQuests(source, { onProgress }));
    tracker.ran('quest', r.rows, r.skipped, r.placeholderNames);
    skippedTotal += r.skipped;
  } catch (err) {
    tracker.failed('quest', err);
    throw err;
  }

  try {
    // Jobs first so skill rows can resolve to a job name.
    stage('Extracting jobs');
    const j = await storeJobs(db, await extractJobs(source, { onProgress }));
    tracker.ran('job', j.rows, j.skipped);
    skippedTotal += j.skipped;
  } catch (err) {
    tracker.failed('job', err);
    throw err;
  }

  try {
    stage('Extracting skills');
    const r = await storeSkills(db, await extractSkills(source, { onProgress }));
    tracker.ran('skill', r.rows, r.skipped);
    skippedTotal += r.skipped;
  } catch (err) {
    tracker.failed('skill', err);
    throw err;
  }

  // Quest chains are a pure DB derivation, not an extraction. Always run.
  try {
    stage('Deriving quest chains');
    const chains = await storeQuestChains(db);
    tracker.ran('questChain', chains.rows, 0);
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
