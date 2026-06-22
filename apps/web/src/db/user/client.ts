import type { Remote } from 'comlink';
import type { UserDatabase } from './types';
import {
  connectMultiTab,
  connectSingleTab,
  multiTabSupported,
  type DbConnection,
} from '../multiTab/connect';

let cached: DbConnection<UserDatabase> | null = null;

function makeEngine(): Worker {
  return new Worker(new URL('@/workers/userDbWorker.ts', import.meta.url), {
    type: 'module',
    name: 'scrolled-user-db-engine',
  });
}

/**
 * Lazily connect to the user DB engine and return a comlink-wrapped proxy.
 * Mirrors `getDbClient()` — shared across tabs via the broker where supported,
 * otherwise a per-tab dedicated worker. See `multiTab/connect`.
 */
export function getUserDbClient(): Remote<UserDatabase> {
  if (!cached) {
    cached = multiTabSupported()
      ? connectMultiTab<UserDatabase>('user', makeEngine)
      : connectSingleTab<UserDatabase>(makeEngine);
  }
  return cached.proxy;
}

export function terminateUserDbClient(): void {
  if (cached) {
    cached.dispose();
    cached = null;
  }
}
