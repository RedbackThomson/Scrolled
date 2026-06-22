import type { Remote } from 'comlink';
import type { UserDatabase } from './types';
import { connectWorker, type WorkerConnection } from '../connectWorker';

let cached: WorkerConnection<UserDatabase> | null = null;

/**
 * Lazily connect to the user DB engine and return a comlink-wrapped proxy.
 * Mirrors `getDbClient()` for the game DB — a separate engine holds the
 * connection to `/user.sqlite3`, shared across tabs via the broker (see
 * `connectWorker`).
 */
export function getUserDbClient(): Remote<UserDatabase> {
  if (!cached) {
    cached = connectWorker<UserDatabase>({
      makeBroker: () =>
        new SharedWorker(new URL('@/workers/userDbBroker.ts', import.meta.url), {
          type: 'module',
          name: 'scrolled-user-db',
        }),
      makeEngine: () =>
        new Worker(new URL('@/workers/userDbWorker.ts', import.meta.url), {
          type: 'module',
          name: 'scrolled-user-db-engine',
        }),
    });
  }
  return cached.proxy;
}

export function terminateUserDbClient(): void {
  if (cached) {
    cached.dispose();
    cached = null;
  }
}
