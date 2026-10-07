import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getDbClient, type ColumnFilter, type FacetSource } from '@/db';

const HISTOGRAM_BINS = 14;

export function withoutColumn(
  filters: Record<string, ColumnFilter>,
  columnId: string,
): Record<string, ColumnFilter> {
  const { [columnId]: _omitted, ...rest } = filters;
  return rest;
}

/** Rows matching each filter set, in order. */
export function useMatchCounts(
  source: FacetSource,
  filterSets: readonly Record<string, ColumnFilter>[],
  enabled = true,
) {
  const client = useMemo(() => getDbClient(), []);
  return useQuery({
    queryKey: ['db', 'facets', 'count', source, filterSets],
    queryFn: () => client.countMatchingMany(source, filterSets),
    enabled: enabled && filterSets.length > 0,
    placeholderData: keepPreviousData,
  });
}

/** A number column's distribution under every filter except its own. */
export function useColumnHistogram(
  source: FacetSource,
  columnId: string,
  filters: Record<string, ColumnFilter>,
  bins = HISTOGRAM_BINS,
) {
  const client = useMemo(() => getDbClient(), []);
  const others = useMemo(() => withoutColumn(filters, columnId), [filters, columnId]);
  return useQuery({
    queryKey: ['db', 'facets', 'histogram', source, columnId, bins, others],
    queryFn: () => client.columnHistogram(source, columnId, bins, others),
  });
}

/** Per-value counts for an enum column, ignoring its own filter so every option shows what it would add. */
export function useEnumValueCounts(
  source: FacetSource,
  columnId: string,
  values: readonly string[],
  filters: Record<string, ColumnFilter>,
) {
  const sets = useMemo(() => {
    const others = withoutColumn(filters, columnId);
    return values.map((v) => ({
      ...others,
      [columnId]: { kind: 'enum', values: [v] } as ColumnFilter,
    }));
  }, [filters, columnId, values]);
  const q = useMatchCounts(source, sets);
  return useMemo(() => {
    const out = new Map<string, number>();
    q.data?.forEach((n, i) => out.set(values[i]!, n));
    return out;
  }, [q.data, values]);
}
