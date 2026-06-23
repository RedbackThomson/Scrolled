import { wrap, type Remote } from 'comlink';
import type { GameDataSource } from '@scrolled/extractor/parser/types';
import type {
  ExtractItemsResult,
  ExtractChairsResult,
  ExtractConsumableSpecsResult,
  ExtractEquipsResult,
  ExtractMobsResult,
  ExtractNpcsResult,
  ExtractMapsResult,
  ExtractWorldMapsResult,
  ExtractQuestsResult,
  ExtractSkillsResult,
  ExtractJobsResult,
} from '@scrolled/extractor/extractors';
import type { ProgressFn } from '@scrolled/game-db/lib/progress';

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
  extractChairs(onProgress?: ProgressFn): Promise<ExtractChairsResult>;
  extractConsumableSpecs(onProgress?: ProgressFn): Promise<ExtractConsumableSpecsResult>;
  extractEquips(onProgress?: ProgressFn): Promise<ExtractEquipsResult>;
  extractMobs(onProgress?: ProgressFn): Promise<ExtractMobsResult>;
  extractNpcs(onProgress?: ProgressFn): Promise<ExtractNpcsResult>;
  extractMaps(onProgress?: ProgressFn): Promise<ExtractMapsResult>;
  extractWorldMaps(onProgress?: ProgressFn): Promise<ExtractWorldMapsResult>;
  extractQuests(onProgress?: ProgressFn): Promise<ExtractQuestsResult>;
  extractSkills(onProgress?: ProgressFn): Promise<ExtractSkillsResult>;
  extractJobs(onProgress?: ProgressFn): Promise<ExtractJobsResult>;
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
      name: 'scrolled-parser',
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
