// useWizardExtract — pool-driven extraction for the first-run wizard.
//
// `useExtractAll` (legacy) still drives the /debug page where everything
// runs in a single shared worker. This hook is the wizard's path: it
// shards files across the parser pool so the I/O-bound load phase
// overlaps with itself and the CPU-bound extract phase can use multiple
// cores.
//
// Lifecycle:
//   1. Pick the pool workers we need based on which primaries are dropped.
//   2. Load each worker's files in parallel (parser.load is itself
//      sequential within a worker, but a different worker can be loading
//      Mob.wz at the same time a third is loading Map.wz).
//   3. Once a worker reports loadDone, kick off its extractors. The items
//      worker runs extractItems then extractEquips sequentially within
//      its thread; the wizard surfaces those as two separate status rows
//      so the UI can show progress per extractor.
//   4. Aggregate per-extractor outcomes + load errors into one
//      `recordDataset` call. The Settings extraction-report panel reads
//      from there.

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proxy, type Remote } from 'comlink';
import {
  getPoolWorker,
  POOL_WORKER_FILES,
  POOL_WORKER_NAMES,
  WORKER_EXTRACTORS,
  type PoolWorkerName,
} from '@/parser/pool';
import type { ParserWorkerApi, WzMapleVersionName } from '@/parser';
import {
  getDbClient,
  type DatasetFileRef,
  type ExtractorResultRecord,
  type GameDatabase,
} from '@/db';
import { createLogger, describeError } from '@/lib/logger';
import type { ProgressUpdate } from '@/lib/progress';

const log = createLogger('wizard-extract');

export const ALL_EXTRACTOR_KEYS = [
  'item',
  'equip',
  'mob',
  'npc',
  'map',
  'quest',
] as const;
export type ExtractorKey = (typeof ALL_EXTRACTOR_KEYS)[number];

export const EXTRACTOR_TO_WORKER: Record<ExtractorKey, PoolWorkerName> = {
  item: 'items',
  equip: 'items',
  mob: 'mobs',
  npc: 'npcs',
  map: 'maps',
  quest: 'quests',
};

export const EXTRACTOR_LABEL: Record<ExtractorKey, string> = {
  item: 'Items',
  equip: 'Equips',
  mob: 'Mobs',
  npc: 'NPCs',
  map: 'Maps',
  quest: 'Quests',
};

export interface ExtractorStatus {
  /** False when this extractor isn't part of the current run. */
  active: boolean;
  /**
   * - `loading`: the underlying worker is loading its files.
   * - `waiting`: load complete; an earlier extractor on the same worker is
   *    still running (only meaningful for `equip`, which runs after `item`
   *    on the shared items worker).
   * - `extracting`: this extractor is currently running.
   * - `done` / `failed`: terminal.
   */
  phase: 'idle' | 'loading' | 'waiting' | 'extracting' | 'done' | 'failed';
  progress: ProgressUpdate | null;
  error: string | null;
  /** Files the underlying worker is loading. */
  files: string[];
}

export interface ExtractStats {
  items: number;
  equips: number;
  mobs: number;
  npcs: number;
  maps: number;
  quests: number;
  skipped: number;
  ms: number;
  perExtractor: ExtractorResultRecord[];
}

export interface UseWizardExtractOptions {
  version: WzMapleVersionName;
  /**
   * Files the user dropped (or hash-matched). Each file is routed to the
   * worker(s) that need it; the same `File` is sent to multiple workers
   * when relevant (e.g. `String.wz` goes to every active worker).
   */
  droppedFiles: { name: string; source: File }[];
  /** Plan keys ('item', 'mob', 'npc', 'map', 'quest') that should run. */
  willRunKeys: Set<string>;
  /** Refs for the dataset row. Load status / errors get merged in. */
  recordFiles: DatasetFileRef[];
  label: string;
}

interface WorkerLoadResult {
  loaded: { name: string; rootDirectories: string[] }[];
  errors: { name: string; message: string }[];
}

function makeInitialStatuses(): Record<ExtractorKey, ExtractorStatus> {
  const out = {} as Record<ExtractorKey, ExtractorStatus>;
  for (const k of ALL_EXTRACTOR_KEYS) {
    out[k] = { active: false, phase: 'idle', progress: null, error: null, files: [] };
  }
  return out;
}

export function useWizardExtract(opts: UseWizardExtractOptions) {
  const db = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();
  const [extractors, setExtractors] = useState<Record<ExtractorKey, ExtractorStatus>>(
    () => makeInitialStatuses(),
  );
  const [stats, setStats] = useState<ExtractStats | null>(null);

  const patchExtractor = useCallback(
    (key: ExtractorKey, patch: Partial<ExtractorStatus>) => {
      setExtractors((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    },
    [],
  );

  /** Patch every active extractor that lives on a given worker. */
  const patchWorkerExtractors = useCallback(
    (worker: PoolWorkerName, patch: Partial<ExtractorStatus>) => {
      setExtractors((prev) => {
        const out = { ...prev };
        for (const k of ALL_EXTRACTOR_KEYS) {
          if (EXTRACTOR_TO_WORKER[k] === worker && prev[k].active) {
            out[k] = { ...prev[k], ...patch };
          }
        }
        return out;
      });
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const started = performance.now();
      setStats(null);
      const droppedByName = new Map(opts.droppedFiles.map((f) => [f.name, f.source]));
      const willRun = opts.willRunKeys;

      // Figure out which workers (and extractors) are active.
      const activeWorkers: PoolWorkerName[] = [];
      const workerFiles: Partial<Record<PoolWorkerName, string[]>> = {};
      const next = makeInitialStatuses();
      for (const name of POOL_WORKER_NAMES) {
        const extractorsHere = WORKER_EXTRACTORS[name] as readonly ExtractorKey[];
        const willAnyRun = extractorsHere.some((e) => willRun.has(e));
        if (!willAnyRun) continue;
        const required = POOL_WORKER_FILES[name];
        const primary = required[0];
        if (!droppedByName.has(primary)) continue;
        const files = required.filter((f) => droppedByName.has(f));
        activeWorkers.push(name);
        workerFiles[name] = files;
        for (const ek of extractorsHere) {
          if (!willRun.has(ek)) continue;
          next[ek] = {
            active: true,
            phase: 'loading',
            progress: null,
            error: null,
            files,
          };
        }
      }
      setExtractors(next);
      log.info('pool run start', {
        active: activeWorkers,
        willRun: [...willRun],
      });

      // --- Phase 1: parallel load --------------------------------------
      const loadResults: Partial<Record<PoolWorkerName, WorkerLoadResult>> = {};
      await Promise.all(
        activeWorkers.map(async (name) => {
          const worker = getPoolWorker(name);
          await worker.init(opts.version);
          const files = (workerFiles[name] ?? []).map((fname) => ({
            name: fname,
            source: droppedByName.get(fname)!,
          }));
          const onProgress = proxy((p: ProgressUpdate) =>
            patchWorkerExtractors(name, { progress: p }),
          );
          try {
            const result = await worker.load(files, onProgress);
            loadResults[name] = result;
            // Load done. Move each extractor on this worker to `waiting`.
            // The extract phase below promotes them to `extracting` one at
            // a time (so the items worker's `item` and `equip` rows show
            // sequential progress).
            patchWorkerExtractors(name, { phase: 'waiting', progress: null });
          } catch (e) {
            log.error('pool worker load failed', { worker: name, ...describeError(e) });
            patchWorkerExtractors(name, {
              phase: 'failed',
              progress: null,
              error: (e as Error).message,
            });
            throw e;
          }
        }),
      );

      // --- Phase 2: parallel extract -----------------------------------
      const perExtractor: ExtractorResultRecord[] = [];
      let skippedTotal = 0;

      await Promise.all(
        activeWorkers.map(async (name) => {
          const worker = getPoolWorker(name);
          try {
            await runWorkerExtractors(
              name,
              worker,
              willRun,
              patchExtractor,
              db,
              perExtractor,
              (n) => {
                skippedTotal += n;
              },
            );
          } catch (e) {
            log.error('pool worker extract failed', { worker: name, ...describeError(e) });
            // Any extractor on this worker that didn't already reach
            // `done` is marked `failed`. We patch via per-extractor so we
            // don't clobber the ones that finished cleanly.
            setExtractors((prev) => {
              const out = { ...prev };
              for (const k of ALL_EXTRACTOR_KEYS) {
                if (
                  EXTRACTOR_TO_WORKER[k] === name &&
                  prev[k].active &&
                  prev[k].phase !== 'done'
                ) {
                  out[k] = {
                    ...prev[k],
                    phase: 'failed',
                    progress: null,
                    error: (e as Error).message,
                  };
                }
              }
              return out;
            });
            throw e;
          }
        }),
      );

      // Add 'skipped' entries for extractors that didn't run at all so
      // the dataset record carries the full picture.
      const ranKeys = new Set(perExtractor.map((e) => e.extractor));
      for (const k of ALL_EXTRACTOR_KEYS) {
        if (!ranKeys.has(k)) {
          perExtractor.push({
            extractor: k,
            status: 'skipped',
            rows: 0,
            skippedRows: 0,
            placeholderNames: 0,
            error: null,
          });
        }
      }

      const ms = Math.round(performance.now() - started);

      // --- Phase 3: record dataset -------------------------------------
      const errorByName = new Map<string, string>();
      for (const [, r] of Object.entries(loadResults)) {
        for (const e of r?.errors ?? []) errorByName.set(e.name, e.message);
      }
      const filesWithStatus: DatasetFileRef[] = opts.recordFiles.map((f) => {
        const err = errorByName.get(f.name);
        return {
          ...f,
          loadStatus: err ? 'load_failed' : 'loaded',
          loadError: err ?? null,
        };
      });
      const allOk = perExtractor.every((e) => !e.error) && errorByName.size === 0;
      if (filesWithStatus.length > 0) {
        await db.recordDataset({
          label: opts.label,
          wzVersion: opts.version,
          files: filesWithStatus,
          totalMs: ms,
          ok: allOk,
          extractors: perExtractor,
        });
      }

      const result: ExtractStats = {
        items: rowsFor(perExtractor, 'item'),
        equips: rowsFor(perExtractor, 'equip'),
        mobs: rowsFor(perExtractor, 'mob'),
        npcs: rowsFor(perExtractor, 'npc'),
        maps: rowsFor(perExtractor, 'map'),
        quests: rowsFor(perExtractor, 'quest'),
        skipped: skippedTotal,
        ms,
        perExtractor,
      };
      log.info('pool extraction complete', result);
      return result;
    },
    onSuccess: (r) => {
      setStats(r);
      queryClient.invalidateQueries({ queryKey: ['db'] });
    },
    onError: (e) => {
      log.error('pool extraction failed', describeError(e));
    },
  });

  return {
    run: useCallback(() => mutation.mutate(), [mutation]),
    isRunning: mutation.isPending,
    error: mutation.error as Error | null,
    extractors,
    stats,
  };
}

async function runWorkerExtractors(
  name: PoolWorkerName,
  worker: Remote<ParserWorkerApi>,
  willRun: Set<string>,
  patchExtractor: (key: ExtractorKey, patch: Partial<ExtractorStatus>) => void,
  db: Remote<GameDatabase>,
  out: ExtractorResultRecord[],
  bumpSkipped: (n: number) => void,
): Promise<void> {
  // Each branch runs sequentially within its worker (single JS thread per
  // worker), but Promise.all at the caller level lets different workers
  // make progress concurrently on different threads.
  if (name === 'items' && (willRun.has('item') || willRun.has('equip'))) {
    if (willRun.has('item')) {
      patchExtractor('item', { phase: 'extracting' });
      const onProgress = proxy((p: ProgressUpdate) =>
        patchExtractor('item', { progress: p }),
      );
      const r = await worker.extractItems(onProgress);
      const rows = r.items.length > 0 ? await db.upsertItems(r.items) : 0;
      out.push({
        extractor: 'item',
        status: 'ran',
        rows,
        skippedRows: r.skipped.length,
        placeholderNames: 0,
        error: null,
      });
      bumpSkipped(r.skipped.length);
      patchExtractor('item', { phase: 'done', progress: null });
    }
    if (willRun.has('equip')) {
      patchExtractor('equip', { phase: 'extracting' });
      const onProgress = proxy((p: ProgressUpdate) =>
        patchExtractor('equip', { progress: p }),
      );
      const r = await worker.extractEquips(onProgress);
      const rows = r.equips.length > 0 ? await db.upsertEquips(r.equips) : 0;
      out.push({
        extractor: 'equip',
        status: 'ran',
        rows,
        skippedRows: r.skipped.length,
        placeholderNames: 0,
        error: null,
      });
      bumpSkipped(r.skipped.length);
      patchExtractor('equip', { phase: 'done', progress: null });
    }
    return;
  }

  if (name === 'mobs' && willRun.has('mob')) {
    patchExtractor('mob', { phase: 'extracting' });
    const onProgress = proxy((p: ProgressUpdate) =>
      patchExtractor('mob', { progress: p }),
    );
    const r = await worker.extractMobs(onProgress);
    const rows = r.mobs.length > 0 ? await db.upsertMobs(r.mobs) : 0;
    if (r.drops.length > 0) {
      await db.replaceMobDrops(r.drops);
    }
    out.push({
      extractor: 'mob',
      status: 'ran',
      rows,
      skippedRows: r.skipped.length,
      placeholderNames: 0,
      error: null,
    });
    bumpSkipped(r.skipped.length);
    patchExtractor('mob', { phase: 'done', progress: null });
    return;
  }

  if (name === 'npcs' && willRun.has('npc')) {
    patchExtractor('npc', { phase: 'extracting' });
    const onProgress = proxy((p: ProgressUpdate) =>
      patchExtractor('npc', { progress: p }),
    );
    const r = await worker.extractNpcs(onProgress);
    const rows = r.npcs.length > 0 ? await db.upsertNpcs(r.npcs) : 0;
    out.push({
      extractor: 'npc',
      status: 'ran',
      rows,
      skippedRows: r.skipped.length,
      placeholderNames: 0,
      error: null,
    });
    bumpSkipped(r.skipped.length);
    patchExtractor('npc', { phase: 'done', progress: null });
    return;
  }

  if (name === 'maps' && willRun.has('map')) {
    patchExtractor('map', { phase: 'extracting' });
    const onProgress = proxy((p: ProgressUpdate) =>
      patchExtractor('map', { progress: p }),
    );
    const r = await worker.extractMaps(onProgress);
    const rows = r.maps.length > 0 ? await db.upsertMaps(r.maps) : 0;
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
    out.push({
      extractor: 'map',
      status: 'ran',
      rows,
      skippedRows: r.skipped.length,
      placeholderNames: 0,
      error: null,
    });
    bumpSkipped(r.skipped.length);
    patchExtractor('map', { phase: 'done', progress: null });
    return;
  }

  if (name === 'quests' && willRun.has('quest')) {
    patchExtractor('quest', { phase: 'extracting' });
    const onProgress = proxy((p: ProgressUpdate) =>
      patchExtractor('quest', { progress: p }),
    );
    const r = await worker.extractQuests(onProgress);
    const rows = r.quests.length > 0 ? await db.upsertQuests(r.quests) : 0;
    if (r.requirements.length > 0 || r.rewards.length > 0) {
      await db.replaceQuestRelations({
        requirements: r.requirements,
        rewards: r.rewards,
      });
    }
    out.push({
      extractor: 'quest',
      status: 'ran',
      rows,
      skippedRows: r.skipped.length,
      placeholderNames: r.placeholderNames,
      error: null,
    });
    bumpSkipped(r.skipped.length);
    patchExtractor('quest', { phase: 'done', progress: null });
    return;
  }
}

function rowsFor(records: ExtractorResultRecord[], key: string): number {
  return records.find((r) => r.extractor === key)?.rows ?? 0;
}
