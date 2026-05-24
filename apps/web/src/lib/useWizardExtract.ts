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
//   3. Once every active worker reports loadDone, kick off extractors in
//      parallel — one extractor call per worker. The items worker does
//      extractItems then extractEquips back-to-back since they share the
//      same WZ files.
//   4. Aggregate per-extractor outcomes + load errors into one
//      `recordDataset` call. The Settings extraction-report panel reads
//      from there.

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { proxy } from 'comlink';
import {
  getPoolWorker,
  POOL_WORKER_FILES,
  POOL_WORKER_NAMES,
  WORKER_EXTRACTORS,
  type PoolWorkerName,
} from '@/parser/pool';
import type { WzMapleVersionName } from '@/parser';
import {
  getDbClient,
  type DatasetFileRef,
  type ExtractorResultRecord,
} from '@/db';
import { createLogger, describeError } from '@/lib/logger';
import type { ProgressUpdate } from '@/lib/progress';

const log = createLogger('wizard-extract');

export interface WorkerStatus {
  /** False when the worker isn't part of this run at all. */
  active: boolean;
  phase: 'idle' | 'loading' | 'extracting' | 'done' | 'failed';
  /** Latest progress update reported from inside the worker. */
  progress: ProgressUpdate | null;
  /** Human-readable error if anything threw. */
  error: string | null;
  /** Files this worker is responsible for loading. */
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

const INITIAL_STATUSES: Record<PoolWorkerName, WorkerStatus> = {
  items: { active: false, phase: 'idle', progress: null, error: null, files: [] },
  mobs: { active: false, phase: 'idle', progress: null, error: null, files: [] },
  npcs: { active: false, phase: 'idle', progress: null, error: null, files: [] },
  maps: { active: false, phase: 'idle', progress: null, error: null, files: [] },
  quests: { active: false, phase: 'idle', progress: null, error: null, files: [] },
};

export function useWizardExtract(opts: UseWizardExtractOptions) {
  const db = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();
  const [workers, setWorkers] = useState<Record<PoolWorkerName, WorkerStatus>>(INITIAL_STATUSES);
  const [stats, setStats] = useState<ExtractStats | null>(null);

  const patchWorker = useCallback(
    (name: PoolWorkerName, patch: Partial<WorkerStatus>) => {
      setWorkers((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const started = performance.now();
      setStats(null);
      const droppedByName = new Map(opts.droppedFiles.map((f) => [f.name, f.source]));
      const willRun = opts.willRunKeys;

      // Figure out which workers are active and what files each needs.
      const activeWorkers: PoolWorkerName[] = [];
      const nextStatuses: Record<PoolWorkerName, WorkerStatus> = {
        ...INITIAL_STATUSES,
      };
      for (const name of POOL_WORKER_NAMES) {
        const extractorsHere = WORKER_EXTRACTORS[name];
        const willAnyRun = extractorsHere.some((e) => willRun.has(e));
        if (!willAnyRun) continue;
        const required = POOL_WORKER_FILES[name];
        const primary = required[0];
        if (!droppedByName.has(primary)) continue;
        const files = required.filter((f) => droppedByName.has(f));
        activeWorkers.push(name);
        nextStatuses[name] = {
          active: true,
          phase: 'loading',
          progress: null,
          error: null,
          files,
        };
      }
      setWorkers(nextStatuses);
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
          const files = nextStatuses[name].files.map((fname) => ({
            name: fname,
            source: droppedByName.get(fname)!,
          }));
          const onProgress = proxy((p: ProgressUpdate) => patchWorker(name, { progress: p }));
          try {
            const result = await worker.load(files, onProgress);
            loadResults[name] = result;
            patchWorker(name, { phase: 'extracting', progress: null });
          } catch (e) {
            log.error('pool worker load failed', { worker: name, ...describeError(e) });
            patchWorker(name, {
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
          const onProgress = proxy((p: ProgressUpdate) => patchWorker(name, { progress: p }));
          try {
            await runWorkerExtractors(name, worker, willRun, onProgress, db, perExtractor, (n) => {
              skippedTotal += n;
            });
            patchWorker(name, { phase: 'done', progress: null });
          } catch (e) {
            log.error('pool worker extract failed', { worker: name, ...describeError(e) });
            patchWorker(name, {
              phase: 'failed',
              progress: null,
              error: (e as Error).message,
            });
            throw e;
          }
        }),
      );

      // Add 'skipped' entries for extractors that didn't run at all so
      // the dataset record carries the full picture.
      const ranKeys = new Set(perExtractor.map((e) => e.extractor));
      for (const k of ['item', 'equip', 'mob', 'npc', 'map', 'quest']) {
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
    workers,
    stats,
    /** Per-file load errors aggregated across the pool. */
    loadErrors: useMemo(() => {
      const out: { name: string; message: string }[] = [];
      // Currently surfaced only via the dataset record; the wizard can
      // also derive them from `workers[name].error` for the failed
      // panel without needing this list. Reserved.
      return out;
    }, []),
  };
}

async function runWorkerExtractors(
  name: PoolWorkerName,
  worker: import('comlink').Remote<import('@/parser').ParserWorkerApi>,
  willRun: Set<string>,
  onProgress: import('@/lib/progress').ProgressFn,
  db: import('comlink').Remote<import('@/db').GameDatabase>,
  out: ExtractorResultRecord[],
  bumpSkipped: (n: number) => void,
): Promise<void> {
  // Each branch runs sequentially within its worker (single JS thread per
  // worker), but Promise.all at the caller level lets different workers
  // make progress concurrently on different threads.
  if (name === 'items' && (willRun.has('item') || willRun.has('equip'))) {
    if (willRun.has('item')) {
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
    }
    if (willRun.has('equip')) {
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
    }
    return;
  }

  if (name === 'mobs' && willRun.has('mob')) {
    const r = await worker.extractMobs(onProgress);
    const rows = r.mobs.length > 0 ? await db.upsertMobs(r.mobs) : 0;
    out.push({
      extractor: 'mob',
      status: 'ran',
      rows,
      skippedRows: r.skipped.length,
      placeholderNames: 0,
      error: null,
    });
    bumpSkipped(r.skipped.length);
    return;
  }

  if (name === 'npcs' && willRun.has('npc')) {
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
    return;
  }

  if (name === 'maps' && willRun.has('map')) {
    const r = await worker.extractMaps(onProgress);
    const rows = r.maps.length > 0 ? await db.upsertMaps(r.maps) : 0;
    if (r.mapNpcs.length > 0 || r.mapMobs.length > 0 || r.mapPortals.length > 0) {
      await db.replaceMapLife({
        npcs: r.mapNpcs,
        mobs: r.mapMobs,
        portals: r.mapPortals,
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
    return;
  }

  if (name === 'quests' && willRun.has('quest')) {
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
    return;
  }
}

function rowsFor(records: ExtractorResultRecord[], key: string): number {
  return records.find((r) => r.extractor === key)?.rows ?? 0;
}
