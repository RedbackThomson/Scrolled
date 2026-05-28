// Hook that owns the home page's persisted layout.
//
// Reads `home.layout` out of the user DB (via useUiPref), reconciles it
// against the canonical id list, and exposes the small set of mutations
// the edit-mode UI needs. Writes go straight back through to the DB —
// no debounce; reorders are user-paced, not animation-paced.

import { useCallback, useMemo } from 'react';
import { useUiPref } from '@/hooks/useUiPref';
import {
  DEFAULT_HOME_LAYOUT,
  homeLayoutSchema,
  moveEntry,
  reconcileLayout,
  type HomeLayoutEntry,
  type HomeSectionId,
} from './layout';

const PREF_KEY = 'home.layout';

export interface UseHomeLayoutResult {
  /** Reconciled layout entries in current order. */
  entries: HomeLayoutEntry[];
  /** True while the initial read is in flight; consumers can render the
   *  default layout in the meantime. */
  loading: boolean;
  setOrder(ids: HomeSectionId[]): Promise<void>;
  setVisibility(id: HomeSectionId, visible: boolean): Promise<void>;
  moveToIndex(id: HomeSectionId, to: number): Promise<void>;
  reset(): Promise<void>;
}

export function useHomeLayout(): UseHomeLayoutResult {
  const pref = useUiPref(PREF_KEY, homeLayoutSchema, { entries: DEFAULT_HOME_LAYOUT });

  const entries = useMemo(() => reconcileLayout(pref.value), [pref.value]);

  const persist = useCallback(
    async (next: HomeLayoutEntry[]) => {
      await pref.set({ entries: next });
    },
    [pref],
  );

  const setOrder = useCallback(
    async (ids: HomeSectionId[]) => {
      // Preserve each entry's visibility through the reorder by looking
      // it up in the current entry list.
      const byId = new Map(entries.map((e) => [e.id, e]));
      const next: HomeLayoutEntry[] = [];
      const seen = new Set<HomeSectionId>();
      for (const id of ids) {
        const e = byId.get(id);
        if (!e || seen.has(id)) continue;
        seen.add(id);
        next.push(e);
      }
      // Anything not in the input order keeps its prior position at the
      // tail — defensive against partial drag lists.
      for (const e of entries) {
        if (!seen.has(e.id)) next.push(e);
      }
      await persist(next);
    },
    [entries, persist],
  );

  const setVisibility = useCallback(
    async (id: HomeSectionId, visible: boolean) => {
      const next = entries.map((e) => (e.id === id ? { ...e, visible } : e));
      await persist(next);
    },
    [entries, persist],
  );

  const moveToIndex = useCallback(
    async (id: HomeSectionId, to: number) => {
      const from = entries.findIndex((e) => e.id === id);
      if (from === -1) return;
      await persist(moveEntry(entries, from, to));
    },
    [entries, persist],
  );

  const reset = useCallback(async () => {
    await pref.reset();
  }, [pref]);

  return {
    entries,
    loading: pref.query.isPending,
    setOrder,
    setVisibility,
    moveToIndex,
    reset,
  };
}
