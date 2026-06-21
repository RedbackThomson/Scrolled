// Parser pool — one Web Worker per primary WZ file.
//
// The singleton in `client.ts` (`getParserClient`) stays around for the
// parser-debug page where a user loads arbitrary files into a single
// shared worker. The wizard's extraction flow uses this pool instead,
// so it can:
//
//   * load each WZ file into its own worker in parallel (each worker
//     buffers its own bytes — no shared-memory plumbing yet)
//   * run each extractor on its own thread in parallel
//   * report per-worker progress to the UI
//
// Memory tradeoff: every worker that touches names needs `String.wz`
// loaded too. That's ~5 MB × 5 workers = ~25 MB extra at peak, which is
// negligible next to Map.wz's ~880 MB.

import { wrap, type Remote } from 'comlink';
import type { ParserWorkerApi } from './client';
import { createLogger } from '@scrolled/game-db/lib/logger';
import type { ExtractorKey } from '@scrolled/extractor/builder/extractStats';
import { EXTRACTOR_DEPS } from '@scrolled/extractor/builder/extractorDeps';

const log = createLogger('parser-pool');

/**
 * Named slots in the pool. Each name maps to one Web Worker. `items`,
 * `chairs`, and `equips` all need `Item.wz` + `String.wz` loaded, so each
 * pays its own copy — the win is that they run on three threads instead
 * of sharing one, and chair WebP encoding no longer blocks items/equips.
 */
export type PoolWorkerName =
  | 'items'
  | 'chairs'
  | 'equips'
  | 'mobs'
  | 'npcs'
  | 'maps'
  | 'quests'
  | 'skills';
export const POOL_WORKER_NAMES: readonly PoolWorkerName[] = [
  'items',
  'chairs',
  'equips',
  'mobs',
  'npcs',
  'maps',
  'quests',
  'skills',
];

/**
 * Which extractor keys run in which worker — the pool topology. This is a
 * web-only parallelism decision (one Web Worker thread per slot): items / chairs
 * / equips each get their own worker so they run concurrently; maps also runs
 * worldMap (shared Map.wz), and skills also runs jobs (shared Skill.wz).
 */
export const WORKER_EXTRACTORS: Record<PoolWorkerName, readonly ExtractorKey[]> = {
  items: ['item'],
  chairs: ['chair'],
  equips: ['equip'],
  mobs: ['mob'],
  npcs: ['npc'],
  maps: ['map', 'worldMap'],
  quests: ['quest'],
  skills: ['job', 'skill'],
};

/** The inverse of WORKER_EXTRACTORS: which worker owns a given extractor. */
export const EXTRACTOR_TO_WORKER: Record<ExtractorKey, PoolWorkerName> = (() => {
  const out = {} as Record<ExtractorKey, PoolWorkerName>;
  for (const name of POOL_WORKER_NAMES) {
    for (const ek of WORKER_EXTRACTORS[name]) out[ek] = name;
  }
  return out;
})();

/**
 * The WZ files each worker must load, derived from its extractors' file
 * dependencies (`@scrolled/extractor` EXTRACTOR_DEPS) — one source of truth for
 * "what an extractor needs". The **first** entry is the worker's primary: if it
 * isn't dropped by the user, the worker doesn't run; the rest are companions
 * (overwhelmingly `String.wz`). Item.wz is duplicated across items/chairs/equips
 * so the three run on separate threads; each copy is negligible next to Map.wz.
 */
export const POOL_WORKER_FILES: Record<PoolWorkerName, readonly string[]> = (() => {
  const out = {} as Record<PoolWorkerName, string[]>;
  for (const name of POOL_WORKER_NAMES) {
    const files: string[] = [];
    for (const ek of WORKER_EXTRACTORS[name]) {
      for (const f of [EXTRACTOR_DEPS[ek].primary, ...EXTRACTOR_DEPS[ek].needs]) {
        if (!files.includes(f)) files.push(f);
      }
    }
    out[name] = files;
  }
  return out;
})();

/**
 * Map a logical WZ file name to its top-level folder in an IMG dataset
 * (`Item.wz` → `Item`). IMG routing selects a worker's files by matching each
 * dropped file's first path segment against these folders.
 */
export function logicalToImgFolder(logical: string): string {
  return logical.replace(/\.wz$/i, '');
}

interface PoolEntry {
  worker: Worker;
  proxy: Remote<ParserWorkerApi>;
}

const cache = new Map<PoolWorkerName, PoolEntry>();

/**
 * Get the comlink proxy for the named worker. Spawns the underlying
 * Worker lazily on first call. Calls after that return the cached
 * instance.
 */
export function getPoolWorker(name: PoolWorkerName): Remote<ParserWorkerApi> {
  let entry = cache.get(name);
  if (!entry) {
    const worker = spawnPoolWorker(name);
    entry = { worker, proxy: wrap<ParserWorkerApi>(worker) };
    cache.set(name, entry);
    log.info('pool worker spawned', { name });
  }
  return entry.proxy;
}

/**
 * Vite's worker plugin requires both the URL and the options object on
 * `new Worker(...)` to be statically analyzable at build time. A template
 * literal in `name` makes the options dynamic and trips
 * `vite:worker-import-meta-url`. So we spell each variant out by hand —
 * one `new Worker(...)` call per pool slot, each with a literal name.
 */
function spawnPoolWorker(name: PoolWorkerName): Worker {
  switch (name) {
    case 'items':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'scrolled-parser-items',
      });
    case 'chairs':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'scrolled-parser-chairs',
      });
    case 'equips':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'scrolled-parser-equips',
      });
    case 'mobs':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'scrolled-parser-mobs',
      });
    case 'npcs':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'scrolled-parser-npcs',
      });
    case 'maps':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'scrolled-parser-maps',
      });
    case 'quests':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'scrolled-parser-quests',
      });
    case 'skills':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'scrolled-parser-skills',
      });
  }
}

/**
 * Terminate all live pool workers. Doesn't touch the singleton parser
 * worker used by settings developer tools.
 */
export function terminatePool(): void {
  for (const [name, entry] of cache) {
    try {
      entry.worker.terminate();
      log.info('pool worker terminated', { name });
    } catch {
      // best effort
    }
  }
  cache.clear();
}

/** Names of workers that have been spawned at least once. Used by the
 *  orchestrator to know which ones to address without spawning new ones. */
export function poolHasWorker(name: PoolWorkerName): boolean {
  return cache.has(name);
}
