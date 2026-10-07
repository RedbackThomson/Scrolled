// Sort, filter, paginate all happen in SQL — `data` is one server-rendered page;
// `total` is the count under the same WHERE clause. The table just renders.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { LayoutGrid, SearchX, Table2 } from 'lucide-react';
import {
  EmptyState,
  Kbd,
  Pagination,
  Segmented,
  SelectableSlot,
  Skeleton,
} from '@scrolled/design';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@scrolled/design';
import { DisplayOptionsMenu } from './DisplayOptionsMenu';
import { ListFilterBar } from './ListFilterBar';
import { ListMetaRow } from './ListMetaRow';
import { collectFilterable } from './Filterable';
import { isFilterActive } from './filterSummary';
import { presetMatches, type FacetDef, type ListPreset } from './presets';
import { useMatchCounts } from './useFacetQueries';
import { paramsToFilters } from './filterParams';
import { SavedSearchShelf, type ShelfTab } from './SavedSearchShelf';
import { useSavedSearch } from './useSavedSearch';
import { SaveSearchDialog } from '@/components/pinned-searches/SaveSearchDialog';
import { ManageSavedSearchesDialog } from '@/components/pinned-searches/ManageSavedSearchesDialog';
import { useUserSetting } from '@/hooks/useUserSetting';
import { useRowSelection } from './useRowSelection';
import { SelectionDockHost } from './SelectionDockHost';
import { CardGrid } from './CardGrid';
import { MobileCards } from './MobileCards';
import type {
  TableUrlState,
  TableUrlStatePatch,
  TableSortDir,
  TableView,
} from './useTableUrlState';
import { useTableStatePersistence } from './useTableStatePersistence';
import { getDbClient, type ColumnFilter, type FacetSource } from '@/db';
import type { CollectionEntityType } from '@/db/user';
import { useIsMobile } from '@/hooks/useIsMobile';

const DEFAULT_PAGE_SIZES = [25, 50, 100] as const;
const NO_FACETS: readonly FacetDef[] = [];
const NO_PRESETS: readonly ListPreset[] = [];
const UNFILTERED: Record<string, ColumnFilter>[] = [{}];
const shelfTabSchema = z.enum(['suggested', 'yours']).nullable();
/** The sprite column, whose slot doubles as the row's checkbox. */
const SLOT_COLUMN = 'icon';

export interface DataTableProps<TData> {
  data: readonly TData[];
  total: number;
  columns: ColumnDef<TData>[];
  state: TableUrlState;
  setState: (patch: TableUrlStatePatch) => void;
  /** Entity default — header click cycles asc → desc → back to this. */
  defaultSort: { id: string; dir: TableSortDir };
  visibleColumns: string[];
  defaultVisible: readonly string[];
  /** Column ids the user cannot hide (e.g. icon). */
  pinnedColumns?: readonly string[];
  pageSizes?: readonly number[];
  rowLinkTo: (row: TData) => string;
  getRowId: (row: TData) => string;
  emptyMessage: string;
  loading?: boolean;
  /** True when react-query is showing the previous page while the next fetches. */
  fetching?: boolean;
  /** Per-column filter values keyed by column id. */
  columnFilters?: Record<string, ColumnFilter>;
  /** Setter for a single column's filter (null clears). */
  onColumnFilterChange?: (columnId: string, value: ColumnFilter | null) => void;
  /** Clears every column filter at once. Drives the badge row's "Clear"
   *  button. The route owns the hook that produces this, so it can also
   *  reset the search query in the same callback. */
  onClearFilters?: () => void;
  /** Options for `meta.filter === 'enum'` columns, keyed by column id. */
  enumOptions?: Record<string, readonly string[]>;
  /** Optional per-column label formatter for `enum` filter dropdowns. The
   *  raw value still drives the URL/filter; only the option text changes. */
  enumLabels?: Record<string, (value: string) => string>;
  /** The collection entity rows belong to; set it to let rows be selected and added to collections. */
  entity?: CollectionEntityType;
  /** The list's rows for facet counts and histograms. */
  source: FacetSource;
  /** Columns pinned to the facet bar, in order. */
  facets?: readonly FacetDef[];
  /** Lowercase plural for the result count, e.g. "weapons". */
  entityPlural: string;
  /** Suggested filter sets shown as tiles above the list. */
  presets?: readonly ListPreset[];
  /** Extra controls at the right of the result-count row, before the view
   *  toggle. Use for page-level global controls (e.g. saved searches). */
  toolbarRightExtra?: ReactNode;
  /**
   * Render a row as a card: a compact row on viewports below `md`, and a tall
   * card in the desktop card view. When supplied, mobile viewports always
   * render cards — the table layout (with its horizontal scroll and
   * absolute-overlay row links) is desktop-only. Callers that don't supply a
   * card fall through to the table layout; all production entity tables
   * provide one.
   */
  mobileCard?: (row: TData) => ReactNode;
}

export function DataTable<TData>({
  data,
  total,
  columns,
  state,
  setState,
  defaultSort,
  visibleColumns,
  defaultVisible,
  pinnedColumns,
  pageSizes = DEFAULT_PAGE_SIZES,
  rowLinkTo,
  getRowId,
  emptyMessage,
  loading,
  fetching,
  columnFilters,
  onColumnFilterChange,
  onClearFilters,
  enumOptions,
  enumLabels,
  source,
  facets = NO_FACETS,
  entityPlural,
  presets = NO_PRESETS,
  toolbarRightExtra,
  entity,
  mobileCard,
}: DataTableProps<TData>) {
  const isMobile = useIsMobile();
  const showCards = isMobile && !!mobileCard;
  const showCardGrid = !isMobile && !!mobileCard && state.view === 'cards';
  useTableStatePersistence(source);

  const filterable = useMemo(
    () => collectFilterable(columns, enumOptions, enumLabels),
    [columns, enumOptions, enumLabels],
  );
  const filters = useMemo(() => columnFilters ?? {}, [columnFilters]);
  const filtersActive = Object.values(filters).some(isFilterActive);
  const unfilteredQ = useMatchCounts(source, UNFILTERED);

  const savedSearch = useSavedSearch({
    scope: source,
    filterable,
    filters,
    savedId: state.saved,
  });
  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const tabSetting = useUserSetting(`shelfTab:${source}`, shelfTabSchema, null);
  const shelfTab: ShelfTab =
    tabSetting.value ?? (savedSearch.saved.length > 0 ? 'yours' : 'suggested');

  const presetSets = useMemo(() => presets.map((p) => p.filters), [presets]);
  const presetCountsQ = useMatchCounts(source, presetSets);
  const savedSets = useMemo(
    () => savedSearch.saved.map((s) => paramsToFilters(s.params, filterable)),
    [savedSearch.saved, filterable],
  );
  const savedCountsQ = useMatchCounts(source, savedSets);
  const matchesPreset = presets.some((p) => presetMatches(p, filters));
  const canSave = filtersActive && !matchesPreset && (!savedSearch.loaded || savedSearch.dirty);

  const clearFilters = () => {
    onClearFilters?.();
    if (state.saved != null) setState({ saved: null });
  };
  const applyFilters = (next: Record<string, ColumnFilter>) => {
    onClearFilters?.();
    for (const [id, filter] of Object.entries(next)) onColumnFilterChange?.(id, filter);
    setState({ saved: null, page: 1 });
  };

  const pinned = useMemo(() => new Set(pinnedColumns ?? []), [pinnedColumns]);
  const defaultVisibleKey = useMemo(() => [...defaultVisible].sort().join(','), [defaultVisible]);

  const columnVisibility: VisibilityState = useMemo(() => {
    const v: VisibilityState = {};
    for (const col of columns) {
      const id = col.id;
      if (!id) continue;
      if (pinned.has(id)) {
        v[id] = true;
        continue;
      }
      v[id] = visibleColumns.includes(id);
    }
    return v;
  }, [columns, visibleColumns, pinned]);

  const sorting: SortingState = useMemo(
    () => [{ id: state.sort, desc: state.dir === 'desc' }],
    [state.sort, state.dir],
  );

  const pageIndex = Math.max(state.page - 1, 0);
  const pagination = useMemo(() => ({ pageIndex, pageSize: state.size }), [pageIndex, state.size]);

  const table = useReactTable<TData>({
    data: data as TData[],
    columns,
    state: {
      sorting,
      pagination,
      columnVisibility,
      columnSizing: {} as ColumnSizingState,
    },
    getRowId: (row) => getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      if (!first) {
        // Third click on a header clears TanStack's sorting state. Snap back
        // to the entity default — clearOnDefault then strips sort/dir from
        // the URL so the unspecified state is shareable.
        setState({ sort: defaultSort.id, dir: defaultSort.dir, page: 1 });
        return;
      }
      setState({
        sort: first.id,
        dir: (first.desc ? 'desc' : 'asc') as TableSortDir,
        page: 1,
      });
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      setState({ page: next.pageIndex + 1, size: next.pageSize });
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnVisibility) : updater;
      const visible: string[] = [];
      for (const col of columns) {
        const id = col.id;
        if (!id) continue;
        if (pinned.has(id)) {
          visible.push(id);
          continue;
        }
        if (next[id]) visible.push(id);
      }
      const key = [...visible].sort().join(',');
      setState({ cols: key === defaultVisibleKey ? null : [...visible].sort() });
    },
  });

  const totalPages = Math.max(Math.ceil(total / state.size), 1);

  const selectable = entity != null;
  const resolveAll = useCallback(
    () => getDbClient().matchingIds(source, filters).then((ids) => ids.map(String)),
    [source, filters],
  );
  const selection = useRowSelection(JSON.stringify(filters), resolveAll);
  const pageRowIds = useMemo(() => data.map((row) => getRowId(row)), [data, getRowId]);
  const toggleRow = (id: string, range = false) => selection.toggle(id, range, pageRowIds);
  const isSelected = (id: string) => selectable && selection.isSelected(id);
  const nothingSelected = !selection.allMatching && selection.ids.size === 0;

  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <div className="space-y-3">
      {onColumnFilterChange && (presets.length > 0 || savedSearch.saved.length > 0) && (
        <SavedSearchShelf
          tab={shelfTab}
          onTab={(t) => void tabSetting.set(t)}
          presets={presets}
          presetCounts={Object.fromEntries(presets.map((p, i) => [p.id, presetCountsQ.data?.[i]]))}
          saved={savedSearch.saved}
          savedCounts={Object.fromEntries(
            savedSearch.saved.map((s, i) => [s.id, savedCountsQ.data?.[i]]),
          )}
          loadedId={savedSearch.loaded?.id ?? null}
          dirty={savedSearch.dirty}
          filters={filters}
          canSaveNew={canSave}
          onApplyPreset={(p) => (p ? applyFilters(p.filters) : clearFilters())}
          onLoadSaved={(s) => (s ? savedSearch.load(s) : clearFilters())}
          onSaveNew={() => setSaveOpen(true)}
          onManage={() => setManageOpen(true)}
        />
      )}
      {onColumnFilterChange && (
        <ListFilterBar
          filterable={filterable}
          facets={facets}
          source={source}
          filters={columnFilters ?? {}}
          onChange={onColumnFilterChange}
          entityPlural={entityPlural}
        />
      )}
      <ListMetaRow
        total={total}
        unfilteredTotal={unfilteredQ.data?.[0]}
        entityPlural={entityPlural}
        filtered={filtersActive}
        onClear={clearFilters}
        onSave={canSave ? () => setSaveOpen(true) : undefined}
        changed={
          savedSearch.loaded && savedSearch.dirty
            ? {
                name: savedSearch.loaded.name,
                onUpdate: () => void savedSearch.update(),
                onRevert: savedSearch.revert,
                updating: savedSearch.updating,
              }
            : undefined
        }
      >
        {selectable && nothingSelected && !isMobile && data.length > 0 && (
          <span className="text-muted-foreground mr-1.5 text-xs">
            Click a sprite to select · <Kbd>⇧</Kbd> for a range
          </span>
        )}
        {toolbarRightExtra}
        {mobileCard && (
          <span className="hidden md:inline-flex">
            <Segmented
              size="sm"
              value={state.view}
              onChange={(v) => setState({ view: v as TableView })}
              options={[
                { value: 'table', icon: Table2, title: 'Table view' },
                { value: 'cards', icon: LayoutGrid, title: 'Card view' },
              ]}
            />
          </span>
        )}
        <DisplayOptionsMenu table={table} state={state} setState={setState} />
      </ListMetaRow>

      {showCards ? (
        <MobileCards
          data={data}
          rowLinkTo={rowLinkTo}
          getRowId={getRowId}
          mobileCard={mobileCard!}
          columns={columns}
          visibleColumns={visibleColumns}
          defaultVisible={defaultVisible}
          emptyMessage={emptyMessage}
          loading={loading}
          fetching={fetching}
          selectable={selectable}
          isSelected={isSelected}
          toggleRow={toggleRow}
        />
      ) : showCardGrid ? (
        <CardGrid
          data={data}
          rowLinkTo={rowLinkTo}
          getRowId={getRowId}
          card={mobileCard!}
          columns={columns}
          visibleColumns={visibleColumns}
          defaultVisible={defaultVisible}
          emptyMessage={emptyMessage}
          loading={loading}
          fetching={fetching}
          selectable={selectable}
          isSelected={isSelected}
          toggleRow={toggleRow}
        />
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  if (header.isPlaceholder) return <TableHead key={header.id} />;
                  return (
                    <TableHead key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={fetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {loading && data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="p-3" role="status">
                  <span className="sr-only">Loading…</span>
                  <Skeleton rows={6} />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount}>
                  <EmptyState icon={SearchX} title="No results" body={emptyMessage} />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const href = rowLinkTo(row.original);
                const rowId = row.id;
                const selected = isSelected(rowId);
                return (
                  <TableRow
                    key={row.id}
                    className={
                      selected
                        ? 'relative bg-[var(--accent-glow)] hover:bg-[var(--accent-glow)]'
                        : 'relative'
                    }
                  >
                    {row.getVisibleCells().map((cell, idx) => (
                      <TableCell key={cell.id}>
                        {idx === 0 && (
                          <Link
                            to={href}
                            className="focus-visible:ring-ring absolute inset-0 rounded focus-visible:outline-none focus-visible:ring-2"
                            aria-label={`Open ${href}`}
                          />
                        )}
                        <span className="relative">
                          {selectable && cell.column.id === SLOT_COLUMN ? (
                            <SelectableSlot
                              tile={flexRender(cell.column.columnDef.cell, cell.getContext())}
                              size={36}
                              selected={selected}
                              label={String(row.getValue('name') ?? rowId)}
                              onToggle={(e) => toggleRow(rowId, e.shiftKey)}
                            />
                          ) : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                          )}
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}

      {saveOpen && (
        <SaveSearchDialog
          open
          scope={source}
          params={savedSearch.paramsToSave()}
          onClose={() => setSaveOpen(false)}
          onSaved={(s) => setState({ saved: s.id })}
        />
      )}
      {selectable && (
        <SelectionDockHost
          selection={selection}
          entity={entity}
          total={total}
          resolveAll={resolveAll}
        />
      )}
      <ManageSavedSearchesDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        scope={source}
      />

      <Pagination
        page={state.page}
        pageSize={state.size}
        total={total}
        onPage={(page) => setState({ page: Math.min(Math.max(page, 1), totalPages) })}
        pageSizeControl={
          <label className="flex items-center gap-1.5">
            Rows
            <select
              value={state.size}
              onChange={(e) => setState({ size: Number(e.target.value), page: 1 })}
              className="border-border bg-card h-8 rounded-[10px] border-2 px-1.5 text-base font-semibold sm:text-xs"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        }
      />
    </div>
  );
}
