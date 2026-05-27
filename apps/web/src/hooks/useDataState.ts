import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDbClient, evaluateDataState, type DataState } from '@/db';
import { useFeatures } from '@/hooks/useFeatures';

export interface DataStateResult {
  /**
   * Classification of the stored library against this build's data contract, or
   * `null` while still resolving or when the library is empty (first run, which
   * the setup redirect owns). See db/dataVersion.ts.
   */
  state: DataState | null;
  /** True once the underlying queries have settled and `state` is safe to use. */
  ready: boolean;
}

/**
 * Whether the user's stored library is current, can be refreshed for new
 * features, or is too old to read and must be rebuilt. Returns `null` until the
 * status is known and only classifies when data actually exists — an empty
 * library is first-run, handled by the setup redirect, not here.
 */
export function useDataState(): DataStateResult {
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();

  const statusQ = useQuery({
    queryKey: ['db', 'status'],
    queryFn: () => client.status(),
  });

  const ready = features.ready && !features.isFetching && !!statusQ.data;

  const state = useMemo<DataState | null>(() => {
    if (!ready || !statusQ.data) return null;
    // A destructive reset leaves empty tables that look like a first run, so the
    // explicit rebuild flag takes precedence over the first-run shortcut.
    if (statusQ.data.pendingRebuild) return 'reinitialize-required';
    if (features.isFirstRun) return null;
    return evaluateDataState(statusQ.data.dataRevision);
  }, [ready, statusQ.data, features.isFirstRun]);

  return { state, ready };
}
