import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ColumnFilter } from '@/db';
import type { PinnedSearchRecord, SavedSearchScope } from '@/db/user';
import { usePinnedSearches, useUpdatePinnedSearch } from '@/hooks/usePinnedSearches';
import type { FilterableCol } from './Filterable';
import { filtersToParams, isFilterParam, pickFilterParams, sameParams } from './filterParams';

/** URL params that describe where you are rather than what you searched for. */
const TRANSIENT_PARAMS = ['saved', 'page'];

/** View params (sort, columns, view) from the URL. Read from `window.location`
 *  because nuqs writes through `history.replaceState` without updating the
 *  router location. */
function currentViewParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  for (const key of TRANSIENT_PARAMS) params.delete(key);
  return Object.fromEntries([...params].filter(([k]) => !isFilterParam(k)));
}

interface Options {
  scope: SavedSearchScope;
  filterable: readonly FilterableCol[];
  filters: Record<string, ColumnFilter>;
  savedId: number | null;
}

/** This page's saved searches, the one loaded via `?saved=`, and whether the filters have moved on from it. */
export function useSavedSearch({ scope, filterable, filters, savedId }: Options) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const allQ = usePinnedSearches();
  const updateM = useUpdatePinnedSearch();

  const saved = useMemo(
    () => (allQ.data ?? []).filter((s) => s.entity === scope),
    [allQ.data, scope],
  );
  const loaded = saved.find((s) => s.id === savedId) ?? null;
  const currentFilterParams = useMemo(
    () => filtersToParams(filters, filterable),
    [filters, filterable],
  );
  const matches = (s: PinnedSearchRecord) =>
    sameParams(pickFilterParams(s.params), currentFilterParams);
  const dirty = loaded != null && !matches(loaded);
  /** What saving now would store: the current view and filters. */
  const paramsToSave = () => ({ ...currentViewParams(), ...currentFilterParams });

  const load = (s: PinnedSearchRecord) => {
    const params = new URLSearchParams(s.params);
    for (const key of TRANSIENT_PARAMS) params.delete(key);
    params.set('saved', String(s.id));
    navigate(`${pathname}?${params.toString()}`);
  };

  return {
    saved,
    loaded,
    dirty,
    load,
    revert: () => loaded && load(loaded),
    paramsToSave,
    update: () =>
      loaded && updateM.mutateAsync({ id: loaded.id, patch: { params: paramsToSave() } }),
    updating: updateM.isPending,
  };
}
