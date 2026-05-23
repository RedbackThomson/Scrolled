import { wrap, type Remote } from 'comlink';
import type { GameDataSource } from './types';
import type { ExtractItemsResult, ExtractEquipsResult } from '@/extractors';
import type { ProgressFn } from '@/lib/progress';

/**
 * The full worker surface. Extends the public `GameDataSource` with
 * worker-only methods that run extractors in-process to avoid one comlink hop
 * per node read.
 *
 * `onProgress` callbacks must be wrapped in comlink's `proxy()` on the caller
 * side so they survive the worker boundary.
 */
export interface ParserWorkerApi extends GameDataSource {
  extractItems(onProgress?: ProgressFn): Promise<ExtractItemsResult>;
  extractEquips(onProgress?: ProgressFn): Promise<ExtractEquipsResult>;
}

let cached: { worker: Worker; proxy: Remote<ParserWorkerApi> } | null = null;

/**
 * Lazily create the parser worker and return a comlink-wrapped proxy. Reuses
 * the same worker for the lifetime of the page so caches inside the parser
 * are preserved.
 */
export function getParserClient(): Remote<ParserWorkerApi> {
  if (!cached) {
    const worker = new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
      type: 'module',
      name: 'mge-parser',
    });
    cached = { worker, proxy: wrap<ParserWorkerApi>(worker) };
  }
  return cached.proxy;
}

export function terminateParserClient(): void {
  if (cached) {
    cached.worker.terminate();
    cached = null;
  }
}
