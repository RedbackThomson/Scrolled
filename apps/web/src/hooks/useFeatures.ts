import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDbClient, type DbStatus } from '@/db';

/**
 * Per-WZ-file -> entity-type(s) mapping used to decide which feature is
 * gated on which dropped file. A single file can light up multiple
 * features (Item.wz drives both items and equips in the current pipeline,
 * since the equip extractor piggybacks on the items pool worker).
 */
const WZ_FILE_FEATURE: Record<string, (keyof FeatureFlags)[]> = {
  'String.wz': ['hasItems'], // String.wz alone enables items category names
  'Item.wz': ['hasItems', 'hasEquips'],
  'Mob.wz': ['hasMobs'],
  'Npc.wz': ['hasNpcs'],
  'Map.wz': ['hasMaps'],
  'Quest.wz': ['hasQuests'],
};

export interface FeatureFlags {
  hasItems: boolean;
  hasEquips: boolean;
  hasMobs: boolean;
  hasNpcs: boolean;
  hasMaps: boolean;
  hasQuests: boolean;
}

export interface Features extends FeatureFlags {
  /** Both queries have resolved at least once. */
  ready: boolean;
  /**
   * Either query is currently fetching. When true, `counts` / `loadedFiles`
   * may reflect stale cached data — callers making routing decisions should
   * wait for a non-fetching state before acting on `isFirstRun`.
   */
  isFetching: boolean;
  /** No datasets recorded AND every entity table empty. */
  isFirstRun: boolean;
  /** Distinct WZ file names ever recorded into a dataset. */
  loadedFiles: Set<string>;
  /** Convenience: true if any of the feature flags are true. */
  hasAny: boolean;
  /** Raw DB counts surfaced for places that already render counts. */
  counts: DbStatus['counts'] | null;
}

const EMPTY_SET = new Set<string>();

/**
 * Returns the canonical "what's available" state for UI gating.
 *
 * A feature is enabled when **both**:
 *   - the relevant `.wz` file was recorded into at least one dataset, AND
 *   - the corresponding entity table has rows.
 *
 * This cleanly distinguishes "user excluded this file" from "extraction
 * succeeded but produced no rows" while still letting partial / additive
 * runs light up features as they're loaded.
 */
export function useFeatures(): Features {
  const client = useMemo(() => getDbClient(), []);

  const statusQ = useQuery({
    queryKey: ['db', 'status'],
    queryFn: () => client.status(),
  });

  const filesQ = useQuery({
    queryKey: ['db', 'loaded-files'],
    queryFn: () => client.listLoadedFileNames(),
  });

  const ready = !!statusQ.data && !!filesQ.data;
  const isFetching = statusQ.isFetching || filesQ.isFetching;
  const counts = statusQ.data?.counts ?? null;
  const loadedFiles = useMemo(() => {
    if (!filesQ.data) return EMPTY_SET;
    return new Set(filesQ.data);
  }, [filesQ.data]);

  const flags = useMemo<FeatureFlags>(() => {
    const fileFlags: FeatureFlags = {
      hasItems: false,
      hasEquips: false,
      hasMobs: false,
      hasNpcs: false,
      hasMaps: false,
      hasQuests: false,
    };
    for (const file of loadedFiles) {
      const keys = WZ_FILE_FEATURE[file];
      if (keys) for (const k of keys) fileFlags[k] = true;
    }
    return {
      hasItems: fileFlags.hasItems && (counts?.items ?? 0) > 0,
      hasEquips: fileFlags.hasEquips && (counts?.equips ?? 0) > 0,
      hasMobs: fileFlags.hasMobs && (counts?.mobs ?? 0) > 0,
      hasNpcs: fileFlags.hasNpcs && (counts?.npcs ?? 0) > 0,
      hasMaps: fileFlags.hasMaps && (counts?.maps ?? 0) > 0,
      hasQuests: fileFlags.hasQuests && (counts?.quests ?? 0) > 0,
    };
  }, [loadedFiles, counts]);

  const hasAny =
    flags.hasItems ||
    flags.hasEquips ||
    flags.hasMobs ||
    flags.hasNpcs ||
    flags.hasMaps ||
    flags.hasQuests;

  // First run: no datasets have ever been recorded *and* every entity table
  // is empty. The first condition alone would already imply "no setup", but
  // checking counts too means a developer who manually inserts data via
  // /debug doesn't get bounced to /setup.
  const isFirstRun = ready && (counts?.datasets ?? 0) === 0 && !hasAny;

  return {
    ready,
    isFetching,
    isFirstRun,
    loadedFiles,
    ...flags,
    hasAny,
    counts,
  };
}
