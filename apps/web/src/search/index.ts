import MiniSearch, { type SearchResult } from 'minisearch';
import { getDbClient } from '@/db';
import type { SearchEntry } from '@/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('search');

export interface SearchHit {
  id: number;
  entity: SearchEntry['entity'];
  name: string;
  category: string | null;
  score: number;
}

let cached: MiniSearch<SearchEntry> | null = null;
let cacheEpoch = '';
let buildPromise: Promise<MiniSearch<SearchEntry>> | null = null;

/**
 * Build / refresh the in-memory MiniSearch index from the DB. `epoch` is a
 * stable fingerprint of the DB contents (e.g. concatenated entity counts) —
 * passing a different value than the last build forces a refresh.
 */
export function getSearchIndex(epoch: string): Promise<MiniSearch<SearchEntry>> {
  if (cached && cacheEpoch === epoch) return Promise.resolve(cached);
  if (buildPromise && cacheEpoch === epoch) return buildPromise;
  buildPromise = (async () => {
    const started = performance.now();
    const db = getDbClient();
    const entries = await db.listSearchEntries();
    const idx = new MiniSearch<SearchEntry>({
      idField: 'searchKey',
      fields: ['name'],
      storeFields: ['id', 'entity', 'name', 'category'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { name: 2 },
      },
      extractField: (doc, field) => {
        if (field === 'searchKey') return `${doc.entity}:${doc.id}`;
        return (doc as unknown as Record<string, string>)[field];
      },
    });
    idx.addAll(entries);
    cached = idx;
    cacheEpoch = epoch;
    log.info('search index built', {
      entries: entries.length,
      ms: Math.round(performance.now() - started),
    });
    return idx;
  })();
  return buildPromise;
}

export function querySearch(idx: MiniSearch<SearchEntry>, q: string, limit = 12): SearchHit[] {
  if (!q.trim()) return [];
  const results = idx.search(q.trim()) as (SearchResult & SearchEntry)[];
  return results.slice(0, limit).map((r) => ({
    id: r.id,
    entity: r.entity,
    name: r.name,
    category: r.category,
    score: r.score,
  }));
}
