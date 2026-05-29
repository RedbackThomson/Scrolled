import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils';

interface Props<TData> {
  data: readonly TData[];
  rowLinkTo: (row: TData) => string;
  getRowId: (row: TData) => string;
  /** Card-body renderer supplied by the entity table. */
  mobileCard: (row: TData) => ReactNode;
  /** All column definitions — needed to find ones with `meta.card` that the
   *  user has enabled beyond the entity's `defaultVisible`. */
  columns?: ColumnDef<TData>[];
  /** Current visible-columns set from URL state. */
  visibleColumns?: string[];
  /** Entity's hardcoded default-visible set. Columns inside this list are
   *  assumed to be covered by the entity's hand-written card body, so we
   *  don't append them as extras to avoid duplication. */
  defaultVisible?: readonly string[];
  emptyMessage: string;
  loading?: boolean;
  fetching?: boolean;
  selectable: boolean;
  selectedIds?: ReadonlySet<string>;
  toggleRow: (id: string) => void;
}

/**
 * Mobile-only replacement for the desktop `<Table>` body. Renders each row as
 * a tappable card with a real `<a>` (no absolute-overlay link tricks), so
 * touch hit-testing is per-row by construction. The toolbar and pagination
 * footer above/below are still rendered by `DataTable`.
 */
export function MobileCards<TData>({
  data,
  rowLinkTo,
  getRowId,
  mobileCard,
  columns,
  visibleColumns,
  defaultVisible,
  emptyMessage,
  loading,
  fetching,
  selectable,
  selectedIds,
  toggleRow,
}: Props<TData>) {
  // Pre-compute the card-tagged columns the user has opted into beyond the
  // entity's defaults. The hand-written `mobileCard` already covers
  // defaults — anything in that set would just duplicate.
  const extraCardCols =
    columns && visibleColumns && defaultVisible
      ? columns.filter(
          (col) =>
            col.id !== undefined &&
            visibleColumns.includes(col.id) &&
            !defaultVisible.includes(col.id) &&
            col.meta?.card !== undefined,
        )
      : [];
  if (loading && data.length === 0) {
    return (
      <div className="border-border bg-card text-muted-foreground rounded-md border px-3 py-6 text-center text-sm">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div className="border-border bg-card text-muted-foreground rounded-md border px-3 py-6 text-center text-sm">
        {emptyMessage}
      </div>
    );
  }
  return (
    <ul
      className={cn(
        'border-border bg-card divide-border divide-y overflow-hidden rounded-md border transition-opacity',
        fetching && 'opacity-60',
      )}
    >
      {data.map((row) => {
        const rowId = getRowId(row);
        const href = rowLinkTo(row);
        const isSelected = selectable && (selectedIds?.has(rowId) ?? false);
        return (
          <li
            key={rowId}
            className={cn('relative flex items-stretch', isSelected && 'bg-accent/40')}
          >
            {selectable && (
              <label className="z-10 flex shrink-0 items-center pl-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleRow(rowId)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={isSelected ? 'Deselect row' : 'Select row'}
                  className="accent-primary h-4 w-4 cursor-pointer rounded-sm"
                />
              </label>
            )}
            <Link
              to={href}
              aria-label={`Open ${href}`}
              className="focus-visible:ring-ring active:bg-accent flex min-h-[44px] min-w-0 flex-1 items-center gap-3 px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2"
            >
              <div className="min-w-0 flex-1">
                {mobileCard(row)}
                {extraCardCols.length > 0 && (
                  <dl className="text-muted-foreground mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-xs">
                    {extraCardCols.map((col) => {
                      const card = col.meta!.card!;
                      return (
                        <Fragment key={col.id}>
                          <dt>{card.label}</dt>
                          <dd className="text-foreground truncate">{card.render(row)}</dd>
                        </Fragment>
                      );
                    })}
                  </dl>
                )}
              </div>
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
