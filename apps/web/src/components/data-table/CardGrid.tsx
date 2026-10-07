import type { ReactNode } from 'react';
import { SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { cn, EmptyState, Skeleton } from '@scrolled/design';
import { popIn } from '@/lib/popIn';
import { ListCardLayoutContext } from './listCardLayout';

interface Props<TData> {
  data: readonly TData[];
  rowLinkTo: (row: TData) => string;
  getRowId: (row: TData) => string;
  /** The entity table's card body; renders its tall layout here. */
  card: (row: TData) => ReactNode;
  columns: ColumnDef<TData>[];
  visibleColumns: string[];
  /** Columns the card body already covers; extra stats skip them. */
  defaultVisible: readonly string[];
  emptyMessage: string;
  loading?: boolean;
  fetching?: boolean;
  selectable: boolean;
  isSelected: (id: string) => boolean;
  toggleRow: (id: string, range?: boolean) => void;
}

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
  isSelected,
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
      <div role="status">
        <span className="sr-only">Loading…</span>
        <Skeleton rows={6} />
      </div>
    );
  }
  if (data.length === 0) {
    return <EmptyState icon={SearchX} title="No results" body={emptyMessage} />;
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
        const selected = isSelected(rowId);
        return (
          <li
            key={rowId}
            style={pop.style}
            className={cn(
              pop.className,
              'ease-spring relative transition-transform duration-300 hover:-translate-y-1 hover:-rotate-[.4deg]',
            )}
          >
            <ListCardLayoutContext.Provider
              value={{
                variant: 'tall',
                selected,
                onToggleSelect: selectable ? (e) => toggleRow(rowId, e.shiftKey) : undefined,
                extraStats: statCols.map((col) => ({
                  label: col.meta!.card!.label,
                  value: col.meta!.card!.render(row),
                })),
              }}
            >
              <div className="pointer-events-none h-full [&>*]:h-full">{card(row)}</div>
            </ListCardLayoutContext.Provider>
            <Link
              to={href}
              aria-label={`Open ${href}`}
              className="focus-visible:ring-primary/30 absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-4"
            />
          </li>
        );
      })}
    </ul>
  );
}
