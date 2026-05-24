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
import { createLogger } from '@/lib/logger';

const log = createLogger('parser-pool');

/** Named slots in the pool. Each name maps to one Web Worker. */
export type PoolWorkerName = 'items' | 'mobs' | 'npcs' | 'maps' | 'quests';
export const POOL_WORKER_NAMES: readonly PoolWorkerName[] = [
  'items',
  'mobs',
  'npcs',
  'maps',
  'quests',
];

/**
 * The WZ files each worker needs in memory. The **first** entry is the
 * "primary" — if it isn't dropped by the user, the worker doesn't run.
 * Subsequent entries are companion files (overwhelmingly `String.wz` for
 * localized names).
 */
export const POOL_WORKER_FILES: Record<PoolWorkerName, readonly string[]> = {
  // `Character.wz` is loaded into the items worker so `extractEquips` can
  // pull stat blocks (info/incPAD, info/reqLevel, …) from its per-equip
  // `<Slot>/<id>.img` images. Item.wz remains the primary — without it the
  // worker doesn't spawn at all.
  items: ['Item.wz', 'String.wz', 'Character.wz'],
  mobs: ['Mob.wz', 'String.wz'],
  npcs: ['Npc.wz', 'String.wz'],
  maps: ['Map.wz', 'String.wz'],
  quests: ['Quest.wz', 'String.wz'],
};

/** Which extractor keys are owned by which worker. `useExtractAll`-style
 *  keys ('item', 'equip', ...) — `item` and `equip` share the items worker
 *  because they both read from `Item.wz` + `String.wz`. */
export const WORKER_EXTRACTORS: Record<PoolWorkerName, readonly string[]> = {
  items: ['item', 'equip'],
  mobs: ['mob'],
  npcs: ['npc'],
  maps: ['map'],
  quests: ['quest'],
};

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
        name: 'mge-parser-items',
      });
    case 'mobs':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'mge-parser-mobs',
      });
    case 'npcs':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'mge-parser-npcs',
      });
    case 'maps':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'mge-parser-maps',
      });
    case 'quests':
      return new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'mge-parser-quests',
      });
  }
}

/**
 * Terminate all live pool workers. Doesn't touch the singleton parser
 * worker used by `/debug`.
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
