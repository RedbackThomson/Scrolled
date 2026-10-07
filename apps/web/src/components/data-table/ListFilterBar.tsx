import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { SlidersHorizontal } from 'lucide-react';
import {
  FacetBar,
  FacetPill,
  SuggestionList,
  type FacetBarChip,
  type FacetBarFacet,
} from '@scrolled/design';
import type { ColumnFilter, FacetSource } from '@/db';
import type { CollectionEntityType } from '@/db/user';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useListChrome } from '@/stores/listChrome';
import { usePopover } from '@/hooks/usePopover';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PopoverPanel } from '@/components/common/PopoverPanel';
import type { FilterableCol } from './Filterable';
import { FilterMenuContent } from './FilterMenu';
import { FilterValuePanel } from './FilterValuePanel';
import {
  activeFilterChips,
  columnHue,
  countLabel,
  filterValueLabel,
  isFilterActive,
} from './filterSummary';
import type { FacetDef } from './presets';
import { NAME_COLUMN, suggest, type FilterSuggestion } from './smartQuery';
import { useFacetSuggestions, withSuggestion } from './useFacetSuggestions';
import { AllFiltersSheet } from './AllFiltersSheet';
import { MobileListSearch } from './MobileListSearch';

const MORE = 'more';
const LIST_ID = 'facet-suggestions';

interface ListFilterBarProps {
  filterable: readonly FilterableCol[];
  facets: readonly FacetDef[];
  source: FacetSource;
  filters: Record<string, ColumnFilter>;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  /** Lowercase plural for suggestion counts, e.g. "weapons" */
  entityPlural: string;
  /** Rows matching the current filters */
  total: number;
  onClearAll: () => void;
  /** Lets phone search results show avatars and link to rows */
  entity?: CollectionEntityType;
}

/** The list page's search field and facet pills, each pill opening its column's value panel. */
export function ListFilterBar({
  filterable,
  facets,
  source,
  filters,
  onChange,
  entityPlural,
  total,
  onClearAll,
  entity,
}: ListFilterBarProps) {
  const isMobile = useIsMobile();
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

  const commitName = (value: string) => {
    if (value === lastSent.current) return;
    lastSent.current = value;
    onChange(NAME_COLUMN, value ? { kind: 'string', mode: 'contains', value } : null);
  };

  const { items, counts, hints, parsers } = useFacetSuggestions(query, {
    filterable,
    facets,
    source,
    filters,
  });
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const [active, setActive] = useState(0);

  // Text that reads as a filter waits for ↵ rather than searching names as it's typed.
  useEffect(() => {
    const value = settledQuery.trim();
    if (suggest(value, parsers).some((s) => s.columnId !== NAME_COLUMN)) return;
    commitName(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed value drives this
  }, [settledQuery]);

  const apply = (s: FilterSuggestion, keepOpen: boolean) => {
    if (s.filter.kind === 'string') {
      commitName(s.filter.value);
      setMenuOpen(false);
      return;
    }
    onChange(s.columnId, withSuggestion(filters, s)[s.columnId]!);
    setQuery(s.remainder);
    setActive(0);
    // Stay open while text is left so "thief 30-50" takes two ↵ presses.
    setMenuOpen(keepOpen || s.remainder.trim() !== '');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const showing = menuOpen && items.length > 0;
    if (e.key === 'Escape' && menuOpen) {
      setMenuOpen(false);
    } else if (!showing) {
      if (e.key === 'ArrowDown') setMenuOpen(true);
      return;
    } else if (e.key === 'ArrowDown') {
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      apply(items[Math.min(active, items.length - 1)]!, e.key === 'Tab');
    } else {
      return;
    }
    e.preventDefault();
  };

  const showMenu =
    focused && menuOpen && (items.length > 0 || (query === '' && hints.examples.length > 0));
  const activeIndex = Math.min(active, items.length - 1);

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
  const [allOpen, setAllOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const setChromeSearch = useListChrome((s) => s.setSearch);

  useEffect(() => {
    if (!isMobile) return;
    setChromeSearch({ placeholder: `Filter ${entityPlural}…`, open: () => setSearchOpen(true) });
    return () => setChromeSearch(null);
  }, [isMobile, entityPlural, setChromeSearch]);

  const activeChips: FacetBarChip[] = activeFilterChips(filterable, facets, filters).filter(
    (c) => !(c.id === NAME_COLUMN && typedName),
  );

  const valuePanel = (
    <>
      {shownId && (
        <PopoverPanel
          label={openCol ? `${openCol.label} filter` : 'Filter'}
          onClose={close}
          panelRef={popoverRef}
          coords={coords}
          widthClassName={openCol ? 'w-[330px]' : 'w-80'}
          arrowLeft={coords ? coords.anchorX - coords.left : undefined}
          className={isMobile ? undefined : 'rounded-[18px]'}
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
              entityPlural={entityPlural}
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

  if (isMobile) {
    return (
      <>
        {/* The fade hints that the row scrolls sideways. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [mask-image:linear-gradient(90deg,#000_85%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            data-surface="tooltip"
            className="sc-focus-ring inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface-tooltip)] px-3.5 text-[13px] font-bold text-[color:var(--text-on-tooltip)]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            All filters{activeChips.length > 0 ? ` · ${activeChips.length}` : ''}
          </button>
          {pills.map((p) => (
            <FacetPill
              key={p.id}
              size="lg"
              label={p.label}
              valueLabel={p.valueLabel}
              hue={p.hue}
              open={shownId === p.id}
              onClick={(e) => toggle(p.id, e.currentTarget)}
            />
          ))}
        </div>
        {valuePanel}
        {allOpen && (
          <AllFiltersSheet
            filterable={filterable}
            facets={facets}
            source={source}
            filters={filters}
            onChange={onChange}
            onClearAll={() => {
              setQuery('');
              onClearAll();
            }}
            total={total}
            entityPlural={entityPlural}
            onClose={() => setAllOpen(false)}
          />
        )}
        {searchOpen && (
          <MobileListSearch
            query={query}
            onQueryChange={(q) => {
              setQuery(q);
              setActive(0);
            }}
            onClose={() => {
              commitName(query.trim());
              setSearchOpen(false);
            }}
            chips={activeChips}
            onRemoveChip={(id) => {
              if (id === NAME_COLUMN) setQuery('');
              onChange(id, null);
            }}
            suggestions={items}
            counts={counts}
            examples={hints.examples}
            onApply={(s) => apply(s, true)}
            source={source}
            filters={filters}
            entity={entity}
            entityPlural={entityPlural}
          />
        )}
      </>
    );
  }

  return (
    <>
      <FacetBar
        facets={pills}
        chips={chips}
        query={query}
        onQueryChange={(q) => {
          setQuery(q);
          setActive(0);
          setMenuOpen(true);
        }}
        onOpenFacet={toggle}
        onOpenMore={(anchor) => toggle(MORE, anchor)}
        onClear={(id) => {
          if (id === NAME_COLUMN) setQuery('');
          onChange(id, null);
        }}
        openId={shownId}
        inputRef={inputRef}
        placeholder={hints.placeholder}
        shortcut="/"
        inputProps={{
          'aria-label': 'Filter by name',
          'aria-keyshortcuts': '/ F',
          role: 'combobox',
          'aria-autocomplete': 'list',
          'aria-expanded': showMenu && items.length > 0,
          'aria-controls': `${LIST_ID}-list`,
          'aria-activedescendant':
            showMenu && items.length > 0 ? `${LIST_ID}-${activeIndex}` : undefined,
          onKeyDown,
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
        }}
      >
        {showMenu && (
          <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(460px,100%)]">
            <SuggestionList
              idPrefix={LIST_ID}
              aria-label="Filter suggestions"
              items={items.map((s) => {
                const n = counts.get(s.id);
                return {
                  id: s.id,
                  icon: s.icon,
                  hue: s.hue,
                  label: s.columnLabel,
                  value: s.valueLabel,
                  count: n == null ? undefined : countLabel(n, entityPlural),
                };
              })}
              activeIndex={activeIndex}
              onHighlight={setActive}
              onSelect={(_, i) => apply(items[i]!, false)}
              examples={query === '' ? hints.examples : undefined}
              onExample={(ex) => {
                setQuery(ex);
                setActive(0);
              }}
            />
          </div>
        )}
      </FacetBar>
      {valuePanel}
    </>
  );
}
