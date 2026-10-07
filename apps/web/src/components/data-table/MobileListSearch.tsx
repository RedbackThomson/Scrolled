import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FilterChip,
  FullScreenSearch,
  FullScreenSearchSection,
  SuggestionList,
  type FacetBarChip,
} from '@scrolled/design';
import { getDbClient, type ColumnFilter, type FacetSource } from '@/db';
import type { CollectionEntityType } from '@/db/user';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { routeForEntity } from '@/lib/entityRoutes';
import { countLabel } from './filterSummary';
import { NAME_COLUMN, type FilterSuggestion } from './smartQuery';

const RESULT_LIMIT = 8;

interface MobileListSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  /** Active filters, shown as removable chips */
  chips: readonly FacetBarChip[];
  onRemoveChip: (id: string) => void;
  suggestions: readonly FilterSuggestion[];
  counts: ReadonlyMap<string, number>;
  examples: readonly string[];
  onApply: (suggestion: FilterSuggestion) => void;
  source: FacetSource;
  filters: Record<string, ColumnFilter>;
  entity?: CollectionEntityType;
  entityPlural: string;
}

/** The phone list search: the field takes the screen, with filter suggestions above matching rows. */
export function MobileListSearch({
  query,
  onQueryChange,
  onClose,
  chips,
  onRemoveChip,
  suggestions,
  counts,
  examples,
  onApply,
  source,
  filters,
  entity,
  entityPlural,
}: MobileListSearchProps) {
  const settled = useDebouncedValue(query.trim(), 150);
  const resultFilters = useMemo(
    () =>
      settled
        ? { ...filters, [NAME_COLUMN]: { kind: 'string', mode: 'contains', value: settled } as ColumnFilter }
        : null,
    [filters, settled],
  );
  const resultsQ = useQuery({
    queryKey: ['db', 'facets', 'names', source, resultFilters],
    queryFn: () => getDbClient().matchingNames(source, resultFilters!, RESULT_LIMIT),
    enabled: resultFilters != null,
  });

  return (
    <FullScreenSearch
      aria-label={`Filter ${entityPlural}`}
      value={query}
      onChange={onQueryChange}
      onClose={onClose}
      placeholder={`Filter ${entityPlural}…`}
      enterKeyHint="done"
      onSubmit={() => (suggestions[0] ? onApply(suggestions[0]) : onClose())}
      chips={
        chips.length > 0
          ? chips.map((c) => (
              <FilterChip
                key={c.id}
                label={c.label}
                value={c.value}
                hue={c.hue}
                onRemove={() => onRemoveChip(c.id)}
              />
            ))
          : undefined
      }
    >
      {(suggestions.length > 0 || query === '') && (
        <FullScreenSearchSection title="Filter by">
          <SuggestionList
            bare
            size="lg"
            aria-label="Filter suggestions"
            items={suggestions.map((s) => {
              const n = counts.get(s.id);
              return {
                id: s.id,
                icon: s.icon,
                hue: s.hue,
                label: s.columnLabel,
                value: s.valueLabel,
                count: n == null ? undefined : n.toLocaleString(),
              };
            })}
            onSelect={(_, i) => onApply(suggestions[i]!)}
            examples={query === '' ? examples : undefined}
            onExample={onQueryChange}
          />
        </FullScreenSearchSection>
      )}
      {resultFilters && (resultsQ.data?.length ?? 0) > 0 && (
        <FullScreenSearchSection title="Results">
          <ul className="flex flex-col">
            {resultsQ.data!.map((r) => (
              <li key={r.id}>
                <Link
                  to={entity ? routeForEntity(entity, r.id) : '#'}
                  onClick={onClose}
                  className="sc-focus-ring flex min-h-[52px] items-center gap-3 rounded-xl px-1"
                >
                  {entity && <EntityAvatar entity={entity} id={r.id} size={34} alt={r.name} />}
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          {resultsQ.data!.length === RESULT_LIMIT && (
            <p className="text-muted-foreground text-xs">
              Showing the first {countLabel(RESULT_LIMIT, entityPlural)}.
            </p>
          )}
        </FullScreenSearchSection>
      )}
    </FullScreenSearch>
  );
}
