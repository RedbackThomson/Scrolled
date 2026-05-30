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
  logicalToImgFolder,
  POOL_WORKER_FILES,
  POOL_WORKER_NAMES,
  WORKER_EXTRACTORS,
  type PoolWorkerName,
} from '@/parser/pool';
import type { DataSourceKind, LoadFileSpec, ParserWorkerApi, WzMapleVersionName } from '@/parser';
import {
  getDbClient,
  type DatasetFileRef,
  type ExtractorResultRecord,
  type GameDatabase,
} from '@/db';
import { createLogger, describeError } from '@/lib/logger';
import type { ProgressUpdate } from '@/lib/progress';
import {
  ALL_EXTRACTOR_KEYS,
  POST_EXTRACTOR_KEYS,
  buildExtractStats,
  mergeFileStatuses,
  type ExtractorKey,
  type ExtractStats,
} from './shared';

const log = createLogger('wizard-extract');

export { ALL_EXTRACTOR_KEYS, type ExtractorKey } from './shared';

export const EXTRACTOR_TO_WORKER: Record<ExtractorKey, PoolWorkerName> = {
  item: 'items',
  equip: 'items',
  mob: 'mobs',
  npc: 'npcs',
  map: 'maps',
  quest: 'quests',
  job: 'skills',
  skill: 'skills',
};

export const EXTRACTOR_LABEL: Record<ExtractorKey, string> = {
  item: 'Items',
  equip: 'Equips',
  mob: 'Mobs',
  npc: 'NPCs',
  map: 'Maps',
  quest: 'Quests',
  job: 'Jobs',
  skill: 'Skills',
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

export type { ExtractStats } from './shared';

export interface UseWizardExtractOptions {
  version: WzMapleVersionName;
  /** Whether the dataset is a WZ archive or a folder of `.img` files. */
  kind: DataSourceKind;
  /**
   * Files the user dropped (or hash-matched). Each file is routed to the
   * worker(s) that need it; the same `File` is sent to multiple workers
   * when relevant (e.g. `String.wz` / the `String/` folder goes to every
   * active worker).
   *
   * For WZ, `name` is the logical file name (`Item.wz`). For IMG, `name` is
   * the file's relative path within the dropped folder (`Item/Consume/.../x.img`);
   * routing matches on the first path segment.
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
  const [extractors, setExtractors] = useState<Record<ExtractorKey, ExtractorStatus>>(() =>
    makeInitialStatuses(),
  );
  const [stats, setStats] = useState<ExtractStats | null>(null);

  const patchExtractor = useCallback((key: ExtractorKey, patch: Partial<ExtractorStatus>) => {
    setExtractors((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

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
      const willRun = opts.willRunKeys;
      const routeFiles = makeFileRouter(opts.kind, opts.droppedFiles);

      // Figure out which workers (and extractors) are active.
      const activeWorkers: PoolWorkerName[] = [];
      const workerSpecs: Partial<Record<PoolWorkerName, LoadFileSpec[]>> = {};
      const next = makeInitialStatuses();
      for (const name of POOL_WORKER_NAMES) {
        const extractorsHere = WORKER_EXTRACTORS[name] as readonly ExtractorKey[];
        const willAnyRun = extractorsHere.some((e) => willRun.has(e));
        if (!willAnyRun) continue;
        const routing = routeFiles(name);
        if (!routing.primaryPresent) continue;
        activeWorkers.push(name);
        workerSpecs[name] = routing.specs;
        for (const ek of extractorsHere) {
          if (!willRun.has(ek)) continue;
          next[ek] = {
            active: true,
            phase: 'loading',
            progress: null,
            error: null,
            files: routing.display,
          };
        }
      }
      setExtractors(next);
      log.info('pool run start', {
        active: activeWorkers,
        willRun: [...willRun],
      });

      // --- Step 1: parallel load --------------------------------------
      const loadResults: Partial<Record<PoolWorkerName, WorkerLoadResult>> = {};
      await Promise.all(
        activeWorkers.map(async (name) => {
          const worker = getPoolWorker(name);
          await worker.init(opts.version, opts.kind);
          const files = workerSpecs[name] ?? [];
          const onProgress = proxy((p: ProgressUpdate) =>
            patchWorkerExtractors(name, { progress: p }),
          );
          try {
            const result = await worker.load(files, onProgress);
            loadResults[name] = result;
            // Load done. Move each extractor on this worker to `waiting`.
            // The extract step below promotes them to `extracting` one at
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

      // --- Step 2: parallel extract -----------------------------------
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
                if (EXTRACTOR_TO_WORKER[k] === name && prev[k].active && prev[k].phase !== 'done') {
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

      // Quest chains are a pure DB derivation — always run after the
      // pool finishes so they're populated even when Quest.wz was hash-
      // skipped (e.g. first run on a build that ships chains). Errors here
      // are logged, not fatal: the rest of the dataset record persists.
      try {
        const chainCount = await db.computeAndStoreQuestChains();
        perExtractor.push({
          extractor: 'questChain',
          status: 'ran',
          rows: chainCount,
          skippedRows: 0,
          placeholderNames: 0,
          error: null,
        });
      } catch (err) {
        log.error('quest-chain derivation failed', describeError(err));
        perExtractor.push({
          extractor: 'questChain',
          status: 'ran',
          rows: 0,
          skippedRows: 0,
          placeholderNames: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Add 'skipped' entries for extractors that didn't run at all so
      // the dataset record carries the full picture. Post-pass keys are
      // always pushed above (chain compute runs unconditionally), so
      // they're already in `ranKeys` here.
      const ranKeys = new Set(perExtractor.map((e) => e.extractor));
      for (const k of [...ALL_EXTRACTOR_KEYS, ...POST_EXTRACTOR_KEYS]) {
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

      // --- Step 3: record dataset -------------------------------------
      const errorByName = new Map<string, string>();
      for (const [, r] of Object.entries(loadResults)) {
        for (const e of r?.errors ?? []) errorByName.set(e.name, e.message);
      }
      const filesWithStatus = mergeFileStatuses(opts.recordFiles, errorByName);
      const allOk = perExtractor.every((e) => !e.error) && errorByName.size === 0;
      if (filesWithStatus.length > 0) {
        await db.recordDataset({
          label: opts.label,
          wzVersion: opts.version,
          sourceKind: opts.kind,
          files: filesWithStatus,
          totalMs: ms,
          ok: allOk,
          extractors: perExtractor,
        });
      }

      const result: ExtractStats = buildExtractStats(perExtractor, skippedTotal, ms);
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

interface WorkerRouting {
  /** Files (as LoadFileSpec) this worker should load. */
  specs: LoadFileSpec[];
  /** Short display list for the status UI (logical names / folder names). */
  display: string[];
  /** Whether the worker's primary input is present (else it doesn't run). */
  primaryPresent: boolean;
}

/**
 * Build a per-worker file router for the dataset kind. WZ matches dropped
 * files by exact logical name (`Item.wz`); IMG matches each file's first path
 * segment against the worker's folders (`Item.wz` → folder `Item`).
 */
function makeFileRouter(
  kind: DataSourceKind,
  droppedFiles: { name: string; source: File }[],
): (name: PoolWorkerName) => WorkerRouting {
  if (kind === 'img') {
    return (name) => {
      const folders = POOL_WORKER_FILES[name].map(logicalToImgFolder);
      const primaryFolder = logicalToImgFolder(POOL_WORKER_FILES[name][0]!);
      const specs: LoadFileSpec[] = [];
      const present = new Set<string>();
      for (const f of droppedFiles) {
        const top = f.name.split('/')[0] ?? f.name;
        if (folders.includes(top)) {
          specs.push({ name: f.name, source: f.source });
          present.add(top);
        }
      }
      return { specs, display: [...present], primaryPresent: present.has(primaryFolder) };
    };
  }
  const byName = new Map(droppedFiles.map((f) => [f.name, f.source]));
  return (name) => {
    const required = POOL_WORKER_FILES[name];
    const display = required.filter((f) => byName.has(f));
    const specs = display.map((f) => ({ name: f, source: byName.get(f)! }));
    return { specs, display, primaryPresent: byName.has(required[0]!) };
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
      const onProgress = proxy((p: ProgressUpdate) => patchExtractor('item', { progress: p }));
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
      const onProgress = proxy((p: ProgressUpdate) => patchExtractor('equip', { progress: p }));
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
    const onProgress = proxy((p: ProgressUpdate) => patchExtractor('mob', { progress: p }));
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
    const onProgress = proxy((p: ProgressUpdate) => patchExtractor('npc', { progress: p }));
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
    const onProgress = proxy((p: ProgressUpdate) => patchExtractor('map', { progress: p }));
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
    const onProgress = proxy((p: ProgressUpdate) => patchExtractor('quest', { progress: p }));
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

  if (name === 'skills' && (willRun.has('job') || willRun.has('skill'))) {
    // Jobs first so skill rows can resolve to a job name immediately, even
    // before the page reads from the DB. Both extractors share the skills
    // worker since both consume `String.wz/Job.img` (jobs) or
    // `Skill.wz/<jobId>.img` (skills, joined against String.wz).
    if (willRun.has('job')) {
      patchExtractor('job', { phase: 'extracting' });
      const onProgress = proxy((p: ProgressUpdate) => patchExtractor('job', { progress: p }));
      const r = await worker.extractJobs(onProgress);
      const rows = r.jobs.length > 0 ? await db.upsertJobs(r.jobs) : 0;
      out.push({
        extractor: 'job',
        status: 'ran',
        rows,
        skippedRows: r.skipped.length,
        placeholderNames: 0,
        error: null,
      });
      bumpSkipped(r.skipped.length);
      patchExtractor('job', { phase: 'done', progress: null });
    }
    if (willRun.has('skill')) {
      patchExtractor('skill', { phase: 'extracting' });
      const onProgress = proxy((p: ProgressUpdate) => patchExtractor('skill', { progress: p }));
      const r = await worker.extractSkills(onProgress);
      const rows = r.skills.length > 0 ? await db.upsertSkills(r.skills) : 0;
      if (r.levels.length > 0 || r.prerequisites.length > 0) {
        await db.replaceSkillRelations({
          levels: r.levels,
          prerequisites: r.prerequisites,
        });
      }
      out.push({
        extractor: 'skill',
        status: 'ran',
        rows,
        skippedRows: r.skipped.length,
        placeholderNames: 0,
        error: null,
      });
      bumpSkipped(r.skipped.length);
      patchExtractor('skill', { phase: 'done', progress: null });
    }
    return;
  }
}
