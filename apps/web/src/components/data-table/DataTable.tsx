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
import { ChevronDown, ChevronUp, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ColumnVisibility } from './ColumnVisibility';
import { ColumnFilterPopover } from './ColumnFilter';
import { MobileCards } from './MobileCards';
import type { TableUrlState, TableUrlStatePatch, TableSortDir } from './useTableUrlState';
import type { ColumnFilter } from '@/db';
import { useIsMobile } from '@/hooks/useIsMobile';

const DEFAULT_PAGE_SIZES = [25, 50, 100] as const;

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
  /** Options for `meta.filter === 'enum'` columns, keyed by column id. */
  enumOptions?: Record<string, readonly string[]>;
  /** Optional per-column label formatter for `enum` filter dropdowns. The
   *  raw value still drives the URL/filter; only the option text changes. */
  enumLabels?: Record<string, (value: string) => string>;
  /** Bound to the table's search input. Omit to hide the input. */
  searchValue?: string;
  onSearchChange?: (next: string) => void;
  searchPlaceholder?: string;
  /** Extra controls rendered on the left side of the toolbar, immediately
   *  after the search input. Use for selection-contextual controls (e.g.
   *  bulk add). */
  toolbarExtra?: ReactNode;
  /** Extra controls rendered on the right side of the toolbar, before
   *  the Columns visibility button. Use for page-level global controls
   *  (e.g. saved searches). */
  toolbarRightExtra?: ReactNode;
  /** Render a sticky checkbox column for bulk selection. Selection is
   *  scoped to the current page — paging / sorting / resizing clears it
   *  via the effect below. */
  selectable?: boolean;
  /** Controlled set of selected row ids (as returned by `getRowId`). */
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (next: Set<string>) => void;
  /**
   * Render a row as a tappable card on viewports below `md`. When supplied,
   * mobile viewports always render cards — the table layout (with its
   * horizontal scroll and absolute-overlay row links) is desktop-only.
   * Callers that don't supply a card fall through to the table layout as a
   * last resort; all production entity tables provide one.
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
  enumOptions,
  enumLabels,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search',
  toolbarExtra,
  toolbarRightExtra,
  selectable = false,
  selectedIds,
  onSelectionChange,
  mobileCard,
}: DataTableProps<TData>) {
  const isMobile = useIsMobile();
  const showCards = isMobile && !!mobileCard;

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
  const rangeStart = total === 0 ? 0 : pageIndex * state.size + 1;
  const rangeEnd = Math.min(rangeStart + data.length - 1, total);

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
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange && (
          // `flex-1 min-w-0` lets the search share the row with the right-hand
          // controls on narrow viewports (shrinking to whatever space remains
          // after them) while `sm:max-w-xs` keeps it from sprawling on desktop.
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              // Right padding makes room for the clear button so a long
              // query doesn't slide under it. `type="search"` ships its
              // own native clear in some browsers, but it's inconsistent
              // and uses the OS chrome rather than our token palette —
              // override it with `appearance-none` is overkill; the
              // explicit button below is what the user sees.
              className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border pl-9 pr-8 text-base focus-visible:outline-none focus-visible:ring-2 sm:text-sm"
            />
            {(searchValue ?? '').length > 0 && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                title="Clear search"
                className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {toolbarRightExtra}
          {!showCards && <ColumnVisibility table={table} />}
        </div>
      </div>

      {showCards ? (
        <MobileCards
          data={data}
          rowLinkTo={rowLinkTo}
          getRowId={getRowId}
          mobileCard={mobileCard!}
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
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPageSelected;
                    }}
                    onChange={toggleAllOnPage}
                    aria-label={allOnPageSelected ? 'Deselect all on page' : 'Select all on page'}
                    className="accent-primary h-3.5 w-3.5 cursor-pointer rounded-sm"
                  />
                </TableHead>
              )}
              {group.headers.map((header) => {
                if (header.isPlaceholder) return <TableHead key={header.id} />;
                const canSort = header.column.getCanSort();
                const isActive = state.sort === header.column.id;
                const filterType = header.column.columnDef.meta?.filter;
                const headerNode = flexRender(header.column.columnDef.header, header.getContext());
                const labelText =
                  typeof header.column.columnDef.header === 'string'
                    ? header.column.columnDef.header
                    : header.column.id;
                return (
                  <TableHead key={header.id}>
                    <div className="inline-flex items-center gap-1">
                      {canSort ? (
                        <button
                          type="button"
                          onClick={() => header.column.toggleSorting()}
                          className="hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5"
                        >
                          {headerNode}
                          {isActive ? (
                            state.dir === 'desc' ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronUp className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        headerNode
                      )}
                      {filterType && onColumnFilterChange && (
                        <ColumnFilterPopover
                          columnId={header.column.id}
                          columnLabel={labelText}
                          type={filterType}
                          value={columnFilters?.[header.column.id]}
                          onChange={onColumnFilterChange}
                          enumOptions={enumOptions?.[header.column.id]}
                          enumLabel={enumLabels?.[header.column.id]}
                          booleanLabels={header.column.columnDef.meta?.booleanLabels}
                        />
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className={fetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {loading && data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="text-muted-foreground py-6 text-center">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Loading…
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="text-muted-foreground py-6 text-center">
                {emptyMessage}
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
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(rowId)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={isSelected ? 'Deselect row' : 'Select row'}
                          className="accent-primary h-3.5 w-3.5 cursor-pointer rounded-sm"
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

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          {total === 0
            ? 'No results'
            : `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString()}`}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            Rows
            <select
              value={state.size}
              onChange={(e) => setState({ size: Number(e.target.value), page: 1 })}
              className="border-input bg-background h-7 rounded-md border px-1 text-base sm:text-xs"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setState({ page: Math.max(state.page - 1, 1) })}
            disabled={state.page <= 1}
          >
            Prev
          </Button>
          <span className="tabular-nums">
            Page {state.page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setState({ page: Math.min(state.page + 1, totalPages) })}
            disabled={state.page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
