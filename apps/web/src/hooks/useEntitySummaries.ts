import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDbClient, type EntityKind } from '@/db';

/**
 * Batch-fetch display names for a set of entity ids and return an
 * `id → name` lookup. Cached per (entityType, sorted-id-set) so re-renders
 * with the same ids don't re-issue. Pass an already-deduped, stably-ordered
 * `ids` array (e.g. via `useMemo`) to keep the query key stable.
 */
export function useEntitySummaryNames(entityType: EntityKind, ids: number[]): Map<number, string> {
  const client = useMemo(() => getDbClient(), []);
  const q = useQuery({
    queryKey: ['db', `${entityType}-summaries`, ids],
    queryFn: () => client.getEntitySummariesByIds(entityType, ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const m = new Map<number, string>();
    for (const s of q.data ?? []) m.set(s.id, s.name);
    return m;
  }, [q.data]);
}
