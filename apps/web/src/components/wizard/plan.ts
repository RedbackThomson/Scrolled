// Wizard plan derivation.
//
// Single source of truth for "given a set of dropped files, what will the
// extraction run actually do?" StepReview surfaces the plan, StepRun
// consumes it to drive parser.load + useExtractAll, and Setup uses it to
// gate the Start button.

import type { DatasetFileRef } from '@/db';
import { wzKey } from '@/lib/useExtractAll';
import type { WizardFile } from './StepFiles';

/**
 * For each extractor, the WZ files that must be in the parser worker's
 * memory for it to do useful work.
 *
 *   - `primary` triggers the extractor. Its presence in `includedFiles`
 *     means "do this extraction"; its absence means "skip".
 *   - `needs` are companion files the extractor reads cross-references
 *     from (overwhelmingly `String.wz` for localized names). Without them
 *     the extractor still runs but produces empty/nameless rows.
 *
 * `item` and `equip` share `Item.wz` as the primary: dropping it triggers
 * both, and they're processed sequentially inside the items pool worker.
 * Equip stat blocks live in `Character.wz` (the per-equip `info` images);
 * without it the equip extractor can't populate attack/defense/requirements,
 * so it's a hard dep, not a "produces nameless rows" soft one.
 */
export const EXTRACTOR_DEPS = {
  item: { label: 'Items', primary: 'Item.wz', needs: ['String.wz'] },
  equip: { label: 'Equips', primary: 'Item.wz', needs: ['String.wz', 'Character.wz'] },
  mob: { label: 'Mobs', primary: 'Mob.wz', needs: ['String.wz'] },
  npc: { label: 'NPCs', primary: 'Npc.wz', needs: ['String.wz'] },
  map: { label: 'Maps', primary: 'Map.wz', needs: ['String.wz'] },
  quest: { label: 'Quests', primary: 'Quest.wz', needs: ['String.wz'] },
} as const;

export type ExtractorKey = keyof typeof EXTRACTOR_DEPS;
export const ALL_EXTRACTOR_KEYS: ExtractorKey[] = [
  'item',
  'equip',
  'mob',
  'npc',
  'map',
  'quest',
];

export interface PlannedExtractor {
  key: ExtractorKey;
  label: string;
  primary: string;
  /** True if the primary file was force-re-processed (vs. a fresh file). */
  forced: boolean;
}

export interface MissingDep {
  /** The primary file driving the extraction that needs this dep. */
  extractor: string;
  /** WZ file names that the user didn't drop. */
  missing: string[];
}

export interface WizardPlan {
  /** Extractors that will run on this wizard run. */
  willRun: PlannedExtractor[];
  /**
   * For each `willRun` entry, any companion files the extractor needs that
   * weren't dropped. A non-empty array gates the Start button.
   */
  missingDeps: MissingDep[];
  /**
   * Every file the user dropped, regardless of hash-match. parser.load is
   * called with all of these so a hash-matched String.wz still ends up in
   * worker memory for name lookups even when we're not re-extracting it.
   */
  filesToLoad: WizardFile[];
  /**
   * WZ keys (lowercase, no `.wz` suffix) to **skip** in useExtractAll. The
   * complement of `willRun`. Built as: every known extractor key except
   * the ones with a primary file in `includedFiles` AND a green light to
   * re-process.
   */
  skipWz: Set<string>;
  /** Per-file refs to persist into the `datasets` table on success. */
  recordFiles: DatasetFileRef[];
}

/**
 * Compute the wizard plan from the current file list. Pure function —
 * call freely from any component without worrying about stable references.
 */
export function buildPlan(files: WizardFile[]): WizardPlan {
  const included = files.filter((f) => f.include);
  const byName = new Map(included.map((f) => [f.file.name, f]));

  const willRun: PlannedExtractor[] = [];
  for (const key of ALL_EXTRACTOR_KEYS) {
    const dep = EXTRACTOR_DEPS[key];
    const file = byName.get(dep.primary);
    if (!file) continue;
    // Primary is dropped, but hash-matched without force → skip extraction.
    if (file.matchedExisting && !file.forceReprocess) continue;
    willRun.push({
      key,
      label: dep.label,
      primary: dep.primary,
      forced: file.forceReprocess,
    });
  }

  // Collect missing deps per primary file. Two extractor keys can share a
  // primary (item + equip both run off Item.wz); we union their missing
  // sets so the wizard surfaces one row per file rather than two with the
  // same heading.
  const missingByPrimary = new Map<string, Set<string>>();
  for (const run of willRun) {
    const needs = EXTRACTOR_DEPS[run.key].needs;
    for (const d of needs) {
      if (byName.has(d)) continue;
      let set = missingByPrimary.get(run.primary);
      if (!set) {
        set = new Set();
        missingByPrimary.set(run.primary, set);
      }
      set.add(d);
    }
  }
  const missingDeps: MissingDep[] = [...missingByPrimary.entries()].map(([extractor, missing]) => ({
    extractor,
    missing: [...missing],
  }));

  // skipWz starts with every key and we delete the ones we'll run. That
  // way an extractor whose primary file wasn't even dropped is correctly
  // skipped — previously this case fell through and the extractor ran
  // against an empty parser, silently producing zero rows.
  const skipWz = new Set<string>(ALL_EXTRACTOR_KEYS);
  for (const r of willRun) skipWz.delete(r.key);

  // Belt-and-braces: also map by wzKey so a future rename can't desync
  // (e.g. "Item.wz" → wzKey 'item' must match `ALL_EXTRACTOR_KEYS`).
  for (const r of willRun) skipWz.delete(wzKey(r.primary));

  // loadStatus / loadError land later — useExtractAll merges them in from
  // parser.load's LoadResult before writing the dataset row.
  const recordFiles: DatasetFileRef[] = included.map((f) => ({
    name: f.file.name,
    size: f.file.size,
    hash: f.hash,
    loadStatus: null,
    loadError: null,
  }));

  return {
    willRun,
    missingDeps,
    filesToLoad: included,
    skipWz,
    recordFiles,
  };
}
