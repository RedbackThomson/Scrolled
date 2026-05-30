import type { GameDataSource } from '@/parser';
import { scalarToString } from './wzCoerce';
import type { JobRecord } from '@/db';
import { JOB_NAMES_FALLBACK } from '@/domain/jobs';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';

const log = createLogger('extract-jobs');

export interface ExtractJobsResult {
  jobs: JobRecord[];
  /**
   * Source the names came from. `'wz'` — `String.wz/Job.img` had usable
   * entries. `'fallback'` — Job.img was absent or empty, so the canonical
   * English names from `domain/jobs.ts` were used instead.
   */
  source: 'wz' | 'fallback';
  skipped: { reason: string; path: string }[];
}

/** Materialise the hardcoded fallback as a list of `JobRecord`s. */
function fallbackJobs(): JobRecord[] {
  return Object.entries(JOB_NAMES_FALLBACK)
    .map(([id, name]) => {
      const jobId = Number(id);
      return { id: jobId, name, baseJobId: getBaseJobId(jobId) };
    })
    .sort((a, b) => a.id - b.id);
}

/**
 * Derive the base (1st-advancement) job id from any job id. Ids below 100
 * are Beginner variants; otherwise it's the leading-hundreds digit times
 * 100 (e.g. 522 → 500 Pirate, 232 → 200 Magician).
 */
export function getBaseJobId(jobId: number): number {
  if (jobId < 100) return 0;
  return Math.floor(jobId / 100) * 100;
}

/**
 * Walk `String.wz/Job.img` and emit one `JobRecord` per id. Two layouts
 * are observed across dumps — the standard one puts the name on the
 * `<id>` leaf directly (`String.wz/Job.img/522 = "Corsair"`), and a
 * variant nests it under `<id>/name`. We try both so the extractor works
 * on either.
 */
export async function extractJobs(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractJobsResult> {
  const jobs: JobRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const children = await source.listChildren('String.wz/Job.img');
  if (children.length === 0) {
    // Many v83-era dumps (KMS-derived repacks, some private servers) ship
    // String.wz without a Job.img. We backfill from the canonical English
    // names in `domain/jobs.ts` so the skills UI still resolves ids — the
    // tradeoff is no localisation, but the rest of the table reads fine.
    const fallback = fallbackJobs();
    log.info('String.wz/Job.img absent — using hardcoded fallback', {
      jobs: fallback.length,
    });
    return { jobs: fallback, source: 'fallback', skipped };
  }

  const total = children.length;
  let processed = 0;
  for (const child of children) {
    const id = Number(child.name);
    if (!Number.isFinite(id) || id < 0) {
      processed += 1;
      continue;
    }
    opts.onProgress?.({
      phase: 'Extracting jobs',
      current: processed,
      total,
      detail: child.name,
    });

    let name = scalarToString(child.scalar);
    if (!name) {
      // Fall back to nested layout: String.wz/Job.img/<id>/name = "Hero".
      const nameNode = await source.getNode(`${child.fullPath}/name`);
      name = scalarToString(nameNode?.scalar);
    }
    if (!name) {
      skipped.push({ reason: 'no job name', path: child.fullPath });
      processed += 1;
      continue;
    }

    jobs.push({ id, name, baseJobId: getBaseJobId(id) });
    processed += 1;
  }

  opts.onProgress?.({ phase: 'Extracting jobs', current: processed, total });

  // If Job.img existed but every entry was unusable (no name on the leaf
  // and no /name child either), still backfill — the user shouldn't see
  // an empty jobs table just because the file is malformed.
  if (jobs.length === 0) {
    const fallback = fallbackJobs();
    log.info('String.wz/Job.img yielded no usable entries — using fallback', {
      jobs: fallback.length,
      skipped: skipped.length,
    });
    return { jobs: fallback, source: 'fallback', skipped };
  }

  log.info('extraction complete', { jobs: jobs.length, skipped: skipped.length });
  return { jobs, source: 'wz', skipped };
}
