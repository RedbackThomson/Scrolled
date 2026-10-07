import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { cn, Input } from '@scrolled/design';
import { popIn } from '@/lib/popIn';

interface Props<TData> {
  data: readonly TData[];
  rowLinkTo: (row: TData) => string;
  getRowId: (row: TData) => string;
  /** The entity table's card body (sprite, name, meta line). */
  card: (row: TData) => ReactNode;
  columns: ColumnDef<TData>[];
  visibleColumns: string[];
  /** Columns the card body already covers; the stat grid skips them. */
  defaultVisible: readonly string[];
  emptyMessage: string;
  loading?: boolean;
  fetching?: boolean;
  selectable: boolean;
  selectedIds?: ReadonlySet<string>;
  toggleRow: (id: string) => void;
}

const PANEL = 'border-border bg-card shadow-rim rounded-lg border-2';

/** Desktop card view: the same rows as the table, as a 4-up grid of entity cards. */
export function CardGrid<TData>({
  data,
  rowLinkTo,
  getRowId,
  card,
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
  const statCols = columns.filter(
    (col) =>
      col.id !== undefined &&
      visibleColumns.includes(col.id) &&
      !defaultVisible.includes(col.id) &&
      col.meta?.card !== undefined,
  );

  if (loading && data.length === 0) {
    return (
      <div className={cn(PANEL, 'text-muted-foreground px-3 py-6 text-center text-sm')}>
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div className={cn(PANEL, 'text-muted-foreground px-3 py-6 text-center text-sm')}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul
      className={cn(
        'grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-3 xl:grid-cols-4',
        fetching && 'opacity-60',
      )}
    >
      {data.map((row, i) => {
        const rowId = getRowId(row);
        const pop = popIn(i);
        const href = rowLinkTo(row);
        const isSelected = selectable && (selectedIds?.has(rowId) ?? false);
        return (
          <li
            key={rowId}
            style={pop.style}
            className={cn(
              PANEL,
              pop.className,
              'ease-spring relative flex flex-col gap-2.5 p-3 transition-transform duration-300 hover:-translate-y-1 hover:-rotate-[.4deg]',
              isSelected && 'border-primary',
            )}
          >
            <Link
              to={href}
              aria-label={`Open ${href}`}
              className="focus-visible:ring-primary/30 absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-4"
            />
            {selectable && (
              <label className="absolute right-2 top-2 z-10">
                <Input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleRow(rowId)}
                  aria-label={isSelected ? 'Deselect' : 'Select'}
                  className="accent-primary h-4 w-4 cursor-pointer rounded-sm"
                />
              </label>
            )}
            <div className="pointer-events-none">{card(row)}</div>
            {statCols.length > 0 && (
              <dl className="pointer-events-none grid grid-cols-2 gap-1.5 text-xs">
                {statCols.map((col) => {
                  const meta = col.meta!.card!;
                  return (
                    <div
                      key={col.id}
                      className="bg-muted flex min-w-0 justify-between gap-1.5 rounded-sm px-2 py-1"
                    >
                      <dt className="text-muted-foreground truncate font-bold">{meta.label}</dt>
                      <dd className="truncate font-bold">{meta.render(row)}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
