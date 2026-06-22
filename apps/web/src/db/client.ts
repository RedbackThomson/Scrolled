import { wrap, type Remote } from 'comlink';
import type { GameDatabase } from '@scrolled/game-db/db/types';

let cached: { worker: Worker; proxy: Remote<GameDatabase> } | null = null;

/**
 * Lazily create the DB worker and return a comlink-wrapped proxy. Reuses the
 * same worker for the lifetime of the page so the SQLite connection stays
 * open and prepared-statement caches persist.
 *
 * One dedicated worker per tab: the OPFS SAHPool VFS needs
 * `FileSystemSyncAccessHandle`, which only exists in a dedicated worker, and
 * those handles are exclusive per file across the origin. A second tab can't
 * share this connection (see docs) — it falls back to in-memory and the storage
 * screen tells the user to close the other tab.
 */
export function getDbClient(): Remote<GameDatabase> {
  if (!cached) {
    const worker = new Worker(new URL('@/workers/dbWorker.ts', import.meta.url), {
      type: 'module',
      name: 'scrolled-db',
    });
    cached = { worker, proxy: wrap<GameDatabase>(worker) };
  }
  return cached.proxy;
}

export function terminateDbClient(): void {
  if (cached) {
    cached.worker.terminate();
    cached = null;
  }
}
