// Sort, filter, paginate all happen in SQL — `data` is one server-rendered page;
// `total` is the count under the same WHERE clause. The table just renders.
import { useEffect, useMemo, type ReactNode } from 'react';
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
import { Checkbox, EmptyState, Pagination, Segmented, Skeleton } from '@scrolled/design';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@scrolled/design';
import { DisplayOptionsMenu } from './DisplayOptionsMenu';
import { ListFilterBar } from './ListFilterBar';
import { ListMetaRow } from './ListMetaRow';
import { collectFilterable } from './Filterable';
import { isFilterActive } from './filterSummary';
import type { FacetDef } from './presets';
import { useMatchCounts } from './useFacetQueries';
import { CardGrid } from './CardGrid';
import { MobileCards } from './MobileCards';
import type {
  TableUrlState,
  TableUrlStatePatch,
  TableSortDir,
  TableView,
} from './useTableUrlState';
import { useTableStatePersistence } from './useTableStatePersistence';
import type { ColumnFilter, FacetSource } from '@/db';
import type { CollectionEntityType } from '@/db/user';
import { useIsMobile } from '@/hooks/useIsMobile';

const DEFAULT_PAGE_SIZES = [25, 50, 100] as const;
const NO_FACETS: readonly FacetDef[] = [];
const UNFILTERED = [{}];

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
  /** Identifies the page's entity for Save (writes to pinned_searches).
   *  Required when the filter UI's Save button needs to function. */
  entity?: CollectionEntityType;
  /** The list's rows for facet counts and histograms. */
  source: FacetSource;
  /** Columns pinned to the facet bar, in order. */
  facets?: readonly FacetDef[];
  /** Lowercase plural for the result count, e.g. "weapons". */
  entityPlural: string;
  /** Extra controls rendered on the left side of the toolbar, immediately
   *  after the search input. Use for selection-contextual controls (e.g.
   *  bulk add). */
  toolbarExtra?: ReactNode;
  /** Extra controls at the right of the result-count row, before the view
   *  toggle. Use for page-level global controls (e.g. saved searches). */
  toolbarRightExtra?: ReactNode;
  /** Render a sticky checkbox column for bulk selection. Selection is
   *  scoped to the current page — paging / sorting / resizing clears it
   *  via the effect below. */
  selectable?: boolean;
  /** Controlled set of selected row ids (as returned by `getRowId`). */
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (next: Set<string>) => void;
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
  entity,
  source,
  facets = NO_FACETS,
  entityPlural,
  toolbarExtra,
  toolbarRightExtra,
  selectable = false,
  selectedIds,
  onSelectionChange,
  mobileCard,
}: DataTableProps<TData>) {
  const isMobile = useIsMobile();
  const showCards = isMobile && !!mobileCard;
  const showCardGrid = !isMobile && !!mobileCard && state.view === 'cards';
  useTableStatePersistence(entity);

  const filterable = useMemo(
    () => collectFilterable(columns, enumOptions, enumLabels),
    [columns, enumOptions, enumLabels],
  );
  const filtersActive = Object.values(columnFilters ?? {}).some(isFilterActive);
  const unfilteredQ = useMatchCounts(source, UNFILTERED);

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

  // Clear selection whenever the visible page changes underneath the user
  // (paging, sort, size, search). Without this, a "5 selected" indicator
  // would persist across rows the user can no longer see.
  useEffect(() => {
    if (!selectable || !onSelectionChange) return;
    if (selectedIds && selectedIds.size === 0) return;
    onSelectionChange(new Set());
    // Intentionally exclude `selectedIds` / `onSelectionChange` from deps —
    // we only want to fire when the visible window itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.page, state.size, state.sort, state.dir, state.q, selectable]);

  const pageRowIds = useMemo(
    () => (selectable ? data.map((row) => getRowId(row)) : []),
    [selectable, data, getRowId],
  );

  const selectedOnPageCount = useMemo(() => {
    if (!selectable || !selectedIds) return 0;
    let n = 0;
    for (const id of pageRowIds) if (selectedIds.has(id)) n++;
    return n;
  }, [selectable, selectedIds, pageRowIds]);

  const allOnPageSelected =
    selectable && pageRowIds.length > 0 && selectedOnPageCount === pageRowIds.length;
  const someOnPageSelected = selectable && selectedOnPageCount > 0 && !allOnPageSelected;

  const toggleAllOnPage = () => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (allOnPageSelected) {
      for (const id of pageRowIds) next.delete(id);
    } else {
      for (const id of pageRowIds) next.add(id);
    }
    onSelectionChange(next);
  };

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const columnCount = table.getVisibleLeafColumns().length + (selectable ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Selection-active row sits above the search/controls when present so
       *  bulk-add affordances don't push the main toolbar to wrap. */}
      {toolbarExtra && <div className="flex flex-wrap items-center gap-2">{toolbarExtra}</div>}
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
        onClear={() => onClearFilters?.()}
        entity={entity}
      >
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
          selectedIds={selectedIds}
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
          selectedIds={selectedIds}
          toggleRow={toggleRow}
        />
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {selectable && (
                  <TableHead className="w-9 pr-0">
                    <Checkbox
                      size="sm"
                      checked={allOnPageSelected}
                      indeterminate={someOnPageSelected && !allOnPageSelected}
                      onChange={toggleAllOnPage}
                      aria-label={allOnPageSelected ? 'Deselect all on page' : 'Select all on page'}
                    />
                  </TableHead>
                )}
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
                const isSelected = selectable && (selectedIds?.has(rowId) ?? false);
                return (
                  <TableRow
                    key={row.id}
                    className={isSelected ? 'bg-accent/40 relative' : 'relative'}
                  >
                    {selectable && (
                      <TableCell className="w-9 pr-0">
                        <span className="relative z-10 inline-flex">
                          <Checkbox
                            size="sm"
                            checked={isSelected}
                            onChange={() => toggleRow(rowId)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={isSelected ? 'Deselect row' : 'Select row'}
                          />
                        </span>
                      </TableCell>
                    )}
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
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
