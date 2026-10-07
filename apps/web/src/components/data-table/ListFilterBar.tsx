import { useEffect, useMemo, useRef, useState } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { FacetBar, type FacetBarChip, type FacetBarFacet } from '@scrolled/design';
import type { ColumnFilter, FacetSource } from '@/db';
import { usePopover } from '@/hooks/usePopover';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PopoverPanel } from '@/components/common/PopoverPanel';
import type { FilterableCol } from './Filterable';
import { FilterMenuContent } from './FilterMenu';
import { FilterValuePanel } from './FilterValuePanel';
import { columnHue, filterValueLabel, isFilterActive } from './filterSummary';
import type { FacetDef } from './presets';

const NAME_COLUMN = 'name';
const MORE = 'more';

interface ListFilterBarProps {
  filterable: readonly FilterableCol[];
  facets: readonly FacetDef[];
  source: FacetSource;
  filters: Record<string, ColumnFilter>;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
}

/** The list page's search field and facet pills, each pill opening its column's value panel. */
export function ListFilterBar({
  filterable,
  facets,
  source,
  filters,
  onChange,
}: ListFilterBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { open, close, openAt, coords, popoverRef } = usePopover<HTMLButtonElement, HTMLDivElement>(
    { gap: 12 },
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const shownId = open ? openId : null;

  const focusField = () => inputRef.current?.focus();
  useHotkey('/', focusField);
  useHotkey('F', focusField);

  const nameFilter = filters[NAME_COLUMN];
  const typedName = nameFilter?.kind === 'string' && nameFilter.mode === 'contains';
  const [query, setQuery] = useState(typedName ? nameFilter.value : '');
  const settledQuery = useDebouncedValue(query, 250);

  // Follow the URL when the name filter changes from elsewhere (Clear, a preset, back/forward).
  const urlName = typedName ? nameFilter.value : '';
  const lastSent = useRef(urlName);
  useEffect(() => {
    if (urlName !== lastSent.current) {
      lastSent.current = urlName;
      setQuery(urlName);
    }
  }, [urlName]);

  useEffect(() => {
    const value = settledQuery.trim();
    if (value === lastSent.current) return;
    lastSent.current = value;
    onChange(NAME_COLUMN, value ? { kind: 'string', mode: 'contains', value } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed value drives this
  }, [settledQuery]);

  const byId = useMemo(() => new Map(filterable.map((c) => [c.id, c])), [filterable]);

  const pills: FacetBarFacet[] = facets.flatMap((f) => {
    const col = byId.get(f.columnId);
    if (!col) return [];
    const filter = filters[f.columnId];
    return [
      {
        id: f.columnId,
        label: f.label,
        hue: f.hue,
        valueLabel: isFilterActive(filter) ? filterValueLabel(col, filter) : undefined,
      },
    ];
  });

  const facetIds = new Set(facets.map((f) => f.columnId));
  const chips: FacetBarChip[] = filterable.flatMap((col) => {
    const filter = filters[col.id];
    if (facetIds.has(col.id) || !isFilterActive(filter)) return [];
    if (col.id === NAME_COLUMN && typedName) return [];
    return [
      {
        id: col.id,
        label: col.label,
        value: filterValueLabel(col, filter),
        hue: columnHue(col.id),
      },
    ];
  });

  const toggle = (id: string, anchor: HTMLElement) => {
    if (shownId === id) {
      close();
      return;
    }
    setOpenId(id);
    openAt(anchor);
  };

  const openCol = shownId && shownId !== MORE ? byId.get(shownId) : undefined;

  return (
    <>
      <FacetBar
        facets={pills}
        chips={chips}
        query={query}
        onQueryChange={setQuery}
        onOpenFacet={toggle}
        onOpenMore={(anchor) => toggle(MORE, anchor)}
        onClear={(id) => {
          if (id === NAME_COLUMN) setQuery('');
          onChange(id, null);
        }}
        openId={shownId}
        inputRef={inputRef}
        shortcut="/"
        inputProps={{ 'aria-label': 'Filter by name', 'aria-keyshortcuts': '/ F' }}
      />
      {shownId && (
        <PopoverPanel
          label={openCol ? `${openCol.label} filter` : 'Filter'}
          onClose={close}
          panelRef={popoverRef}
          coords={coords}
          widthClassName={openCol ? 'w-[330px]' : 'w-80'}
          arrowLeft={coords ? coords.anchorX - coords.left : undefined}
          className="rounded-[18px]"
        >
          {openCol ? (
            <FilterValuePanel
              key={openCol.id}
              col={openCol}
              source={source}
              filters={filters}
              onChange={onChange}
              onClose={close}
              facet={facets.find((f) => f.columnId === openCol.id)}
            />
          ) : (
            <FilterMenuContent
              filterable={filterable}
              source={source}
              filters={filters}
              onChange={onChange}
              onClose={close}
              facets={facets}
            />
          )}
        </PopoverPanel>
      )}
    </>
  );
}
