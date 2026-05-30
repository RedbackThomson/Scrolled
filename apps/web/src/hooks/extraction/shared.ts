// Shared result types + aggregation for the two extraction drivers.
//
// `useExtractAll` (sequential, single shared worker) and `useWizardExtract`
// (parallel pool) keep their own control flow and progress models — those
// genuinely differ. What they share is the *shape of the outcome*: the
// per-extractor records, the rolled-up ExtractStats, and how load errors get
// merged into the recorded dataset files. That's all here.

import type { DatasetFileRef, ExtractorResultRecord } from '@/db';

export const ALL_EXTRACTOR_KEYS = [
  'item',
  'equip',
  'mob',
  'npc',
  'map',
  'quest',
  'job',
  'skill',
] as const;
export type ExtractorKey = (typeof ALL_EXTRACTOR_KEYS)[number];

/** Post-pass keys that run after the parser workers but get persisted in
 *  the same `extraction_extractors` table for the Settings report. They're
 *  separate from `ExtractorKey` because they don't belong to a parser
 *  worker and don't take part in the worker-routing tables. */
export const POST_EXTRACTOR_KEYS = ['questChain'] as const;
export type PostExtractorKey = (typeof POST_EXTRACTOR_KEYS)[number];

export interface ExtractStats {
  items: number;
  equips: number;
  mobs: number;
  npcs: number;
  maps: number;
  quests: number;
  questChains: number;
  skills: number;
  jobs: number;
  skipped: number;
  ms: number;
  /** Per-extractor outcome rows persisted into `extraction_extractors`. */
  perExtractor: ExtractorResultRecord[];
}

export function rowsFor(records: ExtractorResultRecord[], key: string): number {
  return records.find((r) => r.extractor === key)?.rows ?? 0;
}

/** Roll per-extractor records + skipped/elapsed totals into UI-facing stats. */
export function buildExtractStats(
  perExtractor: ExtractorResultRecord[],
  skipped: number,
  ms: number,
): ExtractStats {
  return {
    items: rowsFor(perExtractor, 'item'),
    equips: rowsFor(perExtractor, 'equip'),
    mobs: rowsFor(perExtractor, 'mob'),
    npcs: rowsFor(perExtractor, 'npc'),
    maps: rowsFor(perExtractor, 'map'),
    quests: rowsFor(perExtractor, 'quest'),
    questChains: rowsFor(perExtractor, 'questChain'),
    skills: rowsFor(perExtractor, 'skill'),
    jobs: rowsFor(perExtractor, 'job'),
    skipped,
    ms,
    perExtractor,
  };
}

/** Stamp each recorded file with its load outcome from a name→error map. */
export function mergeFileStatuses(
  recordFiles: DatasetFileRef[],
  errorByName: Map<string, string>,
): DatasetFileRef[] {
  return recordFiles.map((f) => {
    const err = errorByName.get(f.name);
    return { ...f, loadStatus: err ? 'load_failed' : 'loaded', loadError: err ?? null };
  });
}

export function shouldSkip(skipWz: Set<string> | undefined, wz: string): boolean {
  return !!skipWz && skipWz.has(wz);
}

/** Item / Equip extractors share the `item` skipWz key (Item.wz drives both).
 *  Jobs piggy-back on the skills run (Skill.wz being unchanged means the
 *  job table doesn't need re-extracting either), so they share the `skill`
 *  skipWz key. */
function equivWzKey(extractor: string): string {
  if (extractor === 'equip') return 'item';
  if (extractor === 'job') return 'skill';
  return extractor;
}

/**
 * Accumulates per-extractor results as the sequential pipeline runs. Every
 * known extractor key starts as `skipped` and is upgraded to `ran` when its
 * stage actually executes — that way `extraction_extractors` records the full
 * picture even for extractors that didn't run, which keeps the Settings panel
 * from leaving question marks in its breakdown.
 */
export class ExtractorTracker {
  private readonly map = new Map<string, ExtractorResultRecord>();

  constructor(skipWz?: Set<string>) {
    for (const k of ALL_EXTRACTOR_KEYS) {
      this.map.set(k, {
        extractor: k,
        status: shouldSkip(skipWz, equivWzKey(k)) ? 'skipped' : 'skipped',
        rows: 0,
        skippedRows: 0,
        placeholderNames: 0,
        error: null,
      });
    }
    // Post-pass keys default to `skipped` like everything else — `ran`
    // upgrades them after their stage executes.
    for (const k of POST_EXTRACTOR_KEYS) {
      this.map.set(k, {
        extractor: k,
        status: 'skipped',
        rows: 0,
        skippedRows: 0,
        placeholderNames: 0,
        error: null,
      });
    }
  }

  ran(key: string, rows: number, skippedRows: number, placeholderNames = 0): void {
    this.map.set(key, {
      extractor: key,
      status: 'ran',
      rows,
      skippedRows,
      placeholderNames,
      error: null,
    });
  }

  failed(key: string, err: unknown): void {
    const existing = this.map.get(key);
    this.map.set(key, {
      extractor: key,
      status: 'ran',
      rows: existing?.rows ?? 0,
      skippedRows: existing?.skippedRows ?? 0,
      placeholderNames: existing?.placeholderNames ?? 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  records(): ExtractorResultRecord[] {
    return [...this.map.values()];
  }
}
