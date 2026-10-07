import { useMemo } from 'react';
import type { ColumnFilter, FacetSource } from '@/db';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { FilterableCol } from './Filterable';
import type { FacetDef } from './presets';
import {
  NAME_COLUMN,
  buildParsers,
  filterHints,
  suggest,
  type FilterSuggestion,
} from './smartQuery';
import { useMatchCounts, withoutColumn } from './useFacetQueries';

/** The filters a suggestion would leave active; enum values add to the column's existing ones. */
export function withSuggestion(
  filters: Record<string, ColumnFilter>,
  s: FilterSuggestion,
): Record<string, ColumnFilter> {
  const existing = filters[s.columnId];
  const next =
    s.filter.kind === 'enum' && existing?.kind === 'enum'
      ? { kind: 'enum' as const, values: [...new Set([...existing.values, ...s.filter.values])] }
      : s.filter;
  // A typed token isn't also a name search, so structured counts ignore the name filter.
  const base = s.columnId === NAME_COLUMN ? filters : withoutColumn(filters, NAME_COLUMN);
  return { ...base, [s.columnId]: next };
}

interface Options {
  filterable: readonly FilterableCol[];
  facets: readonly FacetDef[];
  source: FacetSource;
  filters: Record<string, ColumnFilter>;
}

/** Suggestions for the facet bar's text, with live counts once typing settles. */
export function useFacetSuggestions(
  text: string,
  { filterable, facets, source, filters }: Options,
) {
  const parsers = useMemo(() => buildParsers(filterable, facets), [filterable, facets]);
  const hints = useMemo(() => filterHints(filterable, facets), [filterable, facets]);
  const items = useMemo(() => suggest(text, parsers), [text, parsers]);

  const settled = useDebouncedValue(text, 150);
  const settledItems = useMemo(() => suggest(settled, parsers), [settled, parsers]);
  const sets = useMemo(
    () => settledItems.map((s) => withSuggestion(filters, s)),
    [settledItems, filters],
  );
  const countsQ = useMatchCounts(source, sets);
  const counts = useMemo(() => {
    const out = new Map<string, number>();
    // Placeholder data belongs to the previous text's suggestions.
    if (countsQ.isPlaceholderData) return out;
    countsQ.data?.forEach((n, i) => {
      const s = settledItems[i];
      if (s) out.set(s.id, n);
    });
    return out;
  }, [countsQ.data, countsQ.isPlaceholderData, settledItems]);

  return { items, counts, hints, parsers };
}
