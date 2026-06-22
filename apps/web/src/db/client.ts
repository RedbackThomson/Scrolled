import type { Remote } from 'comlink';
import type { GameDatabase } from '@scrolled/game-db/db/types';
import {
  connectMultiTab,
  connectSingleTab,
  multiTabSupported,
  type DbConnection,
} from './multiTab/connect';

let cached: DbConnection<GameDatabase> | null = null;

function makeEngine(): Worker {
  return new Worker(new URL('@/workers/dbWorker.ts', import.meta.url), {
    type: 'module',
    name: 'scrolled-db-engine',
  });
}

/**
 * Lazily connect to the game DB engine and return a comlink-wrapped proxy.
 * Where SharedWorker + Web Locks exist, the engine is shared across all tabs
 * (one OPFS connection); otherwise it's a per-tab dedicated worker and a second
 * tab lands on the storage screen. See `multiTab/connect`.
 */
export function getDbClient(): Remote<GameDatabase> {
  if (!cached) {
    cached = multiTabSupported()
      ? connectMultiTab<GameDatabase>('game', makeEngine)
      : connectSingleTab<GameDatabase>(makeEngine);
  }
  return cached.proxy;
}

export function terminateDbClient(): void {
  if (cached) {
    cached.dispose();
    cached = null;
  }
}
