import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, SearchX } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { cn, EmptyState, Skeleton } from '@scrolled/design';
import { ListCardLayoutContext } from './listCardLayout';

const LONG_PRESS_MS = 450;
const HINT_KEY = 'scrolled.seenSelectHint';

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
  isSelected: (id: string) => boolean;
  toggleRow: (id: string, range?: boolean) => void;
  /** Rows are being picked: a tap toggles a card instead of opening it */
  selecting?: boolean;
}

function readSeenHint(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * Mobile-only replacement for the desktop `<Table>` body: one compact card per
 * row. A full-cover link opens the row; the picture sits above it as the
 * row's checkbox, and a long press anywhere starts selecting.
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
  isSelected,
  toggleRow,
  selecting,
}: Props<TData>) {
  const press = useRef<{ timer: number; fired: boolean } | null>(null);
  const [showHint, setShowHint] = useState(() => selectable && !readSeenHint());

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Without storage the hint just shows again next visit.
    }
  };

  useEffect(() => {
    if (selecting && showHint) dismissHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only entering selection retires the hint
  }, [selecting]);

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
      <div role="status">
        <span className="sr-only">Loading…</span>
        <Skeleton rows={6} />
      </div>
    );
  }
  if (data.length === 0) {
    return <EmptyState icon={SearchX} title="No results" body={emptyMessage} />;
  }

  const longPress = (rowId: string) =>
    selectable
      ? {
          onPointerDown: () => {
            const timer = window.setTimeout(() => {
              if (press.current) press.current.fired = true;
              navigator.vibrate?.(10);
              toggleRow(rowId);
            }, LONG_PRESS_MS);
            press.current = { timer, fired: false };
          },
          onPointerUp: () => press.current && window.clearTimeout(press.current.timer),
          onPointerMove: () => press.current && window.clearTimeout(press.current.timer),
          onPointerCancel: () => press.current && window.clearTimeout(press.current.timer),
          // The browser's own long-press menu would cover the selection.
          onContextMenu: (e: MouseEvent) => e.preventDefault(),
          onClickCapture: (e: MouseEvent) => {
            if (!press.current?.fired) return;
            press.current = null;
            e.preventDefault();
            e.stopPropagation();
          },
        }
      : {};

  return (
    <div className="relative">
      {showHint && !selecting && (
        <button
          type="button"
          onClick={dismissHint}
          data-surface="tooltip"
          className="animate-pop absolute left-2 top-[74px] z-20 rounded-xl bg-[var(--surface-tooltip)] px-3 py-2 text-[13px] font-bold text-[color:var(--text-on-tooltip)] shadow-[var(--shadow-tooltip)]"
        >
          Long-press to select
          <span
            aria-hidden
            className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 bg-[var(--surface-tooltip)]"
          />
        </button>
      )}
      <ul
        className={cn(
          'border-border bg-card shadow-rim divide-muted divide-y-[1.5px] overflow-hidden rounded-lg border-2 transition-opacity',
          fetching && 'opacity-60',
        )}
      >
        {data.map((row) => {
          const rowId = getRowId(row);
          const href = rowLinkTo(row);
          const selected = isSelected(rowId);
          return (
            <li
              key={rowId}
              className={cn(
                'relative flex min-h-[44px] items-center gap-3 px-3 py-2.5',
                selected && 'bg-[var(--accent-glow)] shadow-[inset_0_0_0_2px_var(--accent)]',
              )}
            >
              {selecting ? (
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${selected ? 'Deselect' : 'Select'} ${href}`}
                  onClick={() => toggleRow(rowId)}
                  className="focus-visible:ring-primary/30 absolute inset-0 focus-visible:outline-none focus-visible:ring-2"
                />
              ) : (
                <Link
                  to={href}
                  aria-label={`Open ${href}`}
                  {...longPress(rowId)}
                  className="focus-visible:ring-primary/30 active:bg-muted absolute inset-0 focus-visible:outline-none focus-visible:ring-2"
                />
              )}
              <div className="pointer-events-none relative min-w-0 flex-1">
                <ListCardLayoutContext.Provider
                  value={{
                    variant: 'compact',
                    selected,
                    selecting,
                    onToggleSelect: selectable ? () => toggleRow(rowId) : undefined,
                  }}
                >
                  {mobileCard(row)}
                </ListCardLayoutContext.Provider>
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
              {!selecting && (
                <ChevronRight
                  className="text-muted-foreground pointer-events-none relative h-4 w-4 shrink-0"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
