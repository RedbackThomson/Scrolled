import type { Remote } from 'comlink';
import type { GameDatabase } from '@scrolled/game-db/db/types';
import { connectWorker, type WorkerConnection } from './connectWorker';

let cached: WorkerConnection<GameDatabase> | null = null;

/**
 * Lazily connect to the game DB engine and return a comlink-wrapped proxy.
 * Reuses the connection for the lifetime of the page so the SQLite connection
 * stays open and prepared-statement caches persist. See `connectWorker` for how
 * the engine is shared across tabs.
 */
export function getDbClient(): Remote<GameDatabase> {
  if (!cached) {
    cached = connectWorker<GameDatabase>({
      makeBroker: () =>
        new SharedWorker(new URL('@/workers/dbBroker.ts', import.meta.url), {
          type: 'module',
          name: 'scrolled-db',
        }),
      makeEngine: () =>
        new Worker(new URL('@/workers/dbWorker.ts', import.meta.url), {
          type: 'module',
          name: 'scrolled-db-engine',
        }),
    });
  }
  return cached.proxy;
}

export function terminateDbClient(): void {
  if (cached) {
    cached.dispose();
    cached = null;
  }
}
