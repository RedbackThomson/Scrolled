import { wrap, type Remote } from 'comlink';
import type { UserDatabase } from './types';

let cached: { worker: Worker; proxy: Remote<UserDatabase> } | null = null;

/**
 * Lazily create the user DB worker and return a comlink-wrapped proxy.
 * Mirrors `getDbClient()` for the game DB — the second worker holds the
 * connection to `/user.sqlite3` so it can run concurrently with game data
 * queries.
 */
export function getUserDbClient(): Remote<UserDatabase> {
  if (!cached) {
    const worker = new Worker(new URL('@/workers/userDbWorker.ts', import.meta.url), {
      type: 'module',
      name: 'scrolled-user-db',
    });
    cached = { worker, proxy: wrap<UserDatabase>(worker) };
  }
  return cached.proxy;
}

export function terminateUserDbClient(): void {
  if (cached) {
    cached.worker.terminate();
    cached = null;
  }
}
