// Display options popover — the right-hand toolbar control that holds
// ordering, column visibility, and (eventually) grouping. Replaces the
// old `ColumnVisibility` `<details>` button and folds the sort picker
// out of the column headers.
//
// The popover body is portaled to <body> so it escapes the table
// wrapper's overflow clip — same pattern as the other toolbar popovers.

import { createPortal } from 'react-dom';
import type { Table } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Settings2 } from 'lucide-react';
import { usePopover } from '@/hooks/usePopover';
import { cn } from '@/lib/utils';
import type { TableUrlState, TableUrlStatePatch, TableSortDir } from './useTableUrlState';

interface DisplayOptionsMenuProps<TData> {
  table: Table<TData>;
  state: TableUrlState;
  setState: (patch: TableUrlStatePatch) => void;
}

function headerLabel(id: string, header: unknown): string {
  if (typeof header === 'string' && header.length > 0) return header;
  return id;
}

export function DisplayOptionsMenu<TData>({
  table,
  state,
  setState,
}: DisplayOptionsMenuProps<TData>) {
  const { open, setOpen, coords, triggerRef, popoverRef } = usePopover<
    HTMLButtonElement,
    HTMLDivElement
  >();

  const sortableColumns = table
    .getAllLeafColumns()
    .filter((c) => c.getCanSort());
  const hideableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide());

  const setOrdering = (sort: string, dir: TableSortDir) => {
    setState({ sort, dir, page: 1 });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-input bg-background hover:bg-accent inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Display options"
        title="Display options"
      >
        <Settings2 className="h-4 w-4" />
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Display options"
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="border-border bg-card text-card-foreground z-50 w-72 rounded-md border p-3 shadow-md"
          >
            {/* Grouping stubs — not URL-wired yet; the plan calls these out
             *  as placeholders that will gain real options in a follow-up. */}
            <Row label="Grouping">
              <select
                disabled
                className="border-input bg-background text-muted-foreground h-7 w-32 rounded-md border px-2 text-xs"
              >
                <option>No grouping</option>
              </select>
            </Row>
            <Row label="Sub-grouping">
              <select
                disabled
                className="border-input bg-background text-muted-foreground h-7 w-32 rounded-md border px-2 text-xs"
              >
                <option>No grouping</option>
              </select>
            </Row>

            <Row label="Ordering">
              <div className="flex items-center gap-1.5">
                <select
                  value={state.sort}
                  onChange={(e) => setOrdering(e.target.value, state.dir)}
                  className="border-input bg-background h-7 w-32 rounded-md border px-2 text-xs"
                  aria-label="Sort column"
                >
                  {sortableColumns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {headerLabel(col.id, col.columnDef.header)}
                    </option>
                  ))}
                </select>
                <DirectionToggle
                  dir={state.dir}
                  onChange={(d) => setOrdering(state.sort, d)}
                />
              </div>
            </Row>

            {hideableColumns.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                  Display properties
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hideableColumns.map((col) => {
                    const Icon = col.columnDef.meta?.icon;
                    const visible = col.getIsVisible();
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => col.toggleVisibility(!visible)}
                        className={cn(
                          'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs transition-colors',
                          visible
                            ? 'border-primary/40 bg-primary/10 text-foreground'
                            : 'border-input bg-background text-muted-foreground hover:bg-accent',
                        )}
                        aria-pressed={visible}
                      >
                        {Icon && <Icon className="h-3 w-3" />}
                        <span>{headerLabel(col.id, col.columnDef.header)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function DirectionToggle({
  dir,
  onChange,
}: {
  dir: TableSortDir;
  onChange: (next: TableSortDir) => void;
}) {
  return (
    <div className="border-input bg-background inline-flex h-7 items-center rounded-md border">
      <button
        type="button"
        onClick={() => onChange('asc')}
        aria-label="Ascending"
        aria-pressed={dir === 'asc'}
        className={cn(
          'inline-flex h-full w-7 items-center justify-center rounded-l-md',
          dir === 'asc' ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-accent',
        )}
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange('desc')}
        aria-label="Descending"
        aria-pressed={dir === 'desc'}
        className={cn(
          'inline-flex h-full w-7 items-center justify-center rounded-r-md',
          dir === 'desc' ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-accent',
        )}
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
