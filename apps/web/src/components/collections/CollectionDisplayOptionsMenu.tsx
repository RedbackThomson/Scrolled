// Display options popover for the collection detail page. Mirrors the
// `DisplayOptionsMenu` used above the table on listing pages — Settings2
// trigger, portaled popover, Row + DirectionToggle helpers, same
// "Grouping / Sub-grouping / Ordering" structure — so the two views feel
// like the same control.
//
// Like Linear's display settings, changes apply *locally* (per browser,
// stored in localStorage via `useCollectionDisplay`) until the user
// presses "Set as default", which flushes the current values into the
// `collections` row in the DB and drops the local override. "Reset"
// drops the override without writing, falling back to the DB default.

import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Settings2 } from 'lucide-react';
import { usePopover } from '@/hooks/usePopover';
import { cn } from '@scrolled/ui';
import { useSetDisplayOptions } from '@/hooks/useCollections';
import { useCollectionDisplay } from '@/stores/useCollectionDisplay';
import type {
  CollectionGrouping,
  CollectionRecord,
  CollectionSortDir,
  CollectionSortKey,
} from '@/db/user';

interface CollectionDisplayOptionsMenuProps {
  collection: CollectionRecord;
}

const GROUPING_OPTIONS: { value: CollectionGrouping; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'group', label: 'Group' },
  { value: 'type', label: 'Type' },
];

const SORT_OPTIONS: { value: CollectionSortKey; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'name', label: 'Name' },
  { value: 'added', label: 'Date added' },
  { value: 'done', label: 'Done' },
  { value: 'quantity', label: 'Quantity' },
];

export function CollectionDisplayOptionsMenu({ collection }: CollectionDisplayOptionsMenuProps) {
  const { open, setOpen, coords, triggerRef, popoverRef } = usePopover<
    HTMLButtonElement,
    HTMLDivElement
  >();
  const setDefaultM = useSetDisplayOptions();
  const { display, hasOverride, setLocal, reset } = useCollectionDisplay(collection);

  // Selecting the same value for outer and inner doesn't make sense —
  // bump the inner to 'none' so the two axes never collapse onto each
  // other (or, when the user picks the inner and it matches the outer,
  // swap the outer to whichever axis is left).
  const setGrouping = (next: CollectionGrouping) => {
    if (next === display.subgrouping && next !== 'none') {
      setLocal({ grouping: next, subgrouping: 'none' });
    } else {
      setLocal({ grouping: next });
    }
  };
  const setSubgrouping = (next: CollectionGrouping) => {
    if (next === display.grouping && next !== 'none') {
      const fallback: CollectionGrouping = display.grouping === 'group' ? 'type' : 'group';
      setLocal({ grouping: fallback, subgrouping: next });
    } else {
      setLocal({ subgrouping: next });
    }
  };

  const onSetAsDefault = async () => {
    await setDefaultM.mutateAsync({
      id: collection.id,
      patch: {
        grouping: display.grouping,
        subgrouping: display.subgrouping,
        sortKey: display.sortKey,
        sortDir: display.sortDir,
      },
    });
    // Override now matches the new default — drop it so the menu
    // returns to its un-overridden state.
    reset();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'border-input bg-background hover:bg-accent relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border',
          hasOverride && 'border-primary/50',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Display options"
        title={hasOverride ? 'Display options (local override active)' : 'Display options'}
      >
        <Settings2 className="h-4 w-4" />
        {hasOverride && (
          <span
            aria-hidden
            className="bg-primary absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
          />
        )}
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
            <Row label="Grouping">
              <select
                value={display.grouping}
                onChange={(e) => setGrouping(e.target.value as CollectionGrouping)}
                className="border-input bg-background h-7 w-32 rounded-md border px-2 text-xs"
                aria-label="Primary grouping"
              >
                {GROUPING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Sub-grouping">
              <select
                value={display.subgrouping}
                onChange={(e) => setSubgrouping(e.target.value as CollectionGrouping)}
                disabled={display.grouping === 'none'}
                className="border-input bg-background h-7 w-32 rounded-md border px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Secondary grouping"
              >
                {GROUPING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Row>

            <Row label="Ordering">
              <div className="flex items-center gap-1.5">
                <select
                  value={display.sortKey}
                  onChange={(e) => setLocal({ sortKey: e.target.value as CollectionSortKey })}
                  className="border-input bg-background h-7 w-28 rounded-md border px-2 text-xs"
                  aria-label="Sort key"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <DirectionToggle
                  dir={display.sortDir}
                  onChange={(d) => setLocal({ sortDir: d })}
                />
              </div>
            </Row>

            {display.sortKey !== 'manual' && (
              <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                Items are sorted by this key. Drag-to-reorder items is paused.
              </p>
            )}

            <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
              <button
                type="button"
                onClick={reset}
                disabled={!hasOverride}
                className={cn(
                  'text-xs',
                  hasOverride
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-muted-foreground/50 cursor-not-allowed',
                )}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onSetAsDefault}
                disabled={!hasOverride || setDefaultM.isPending}
                className={cn(
                  'text-xs font-medium',
                  hasOverride && !setDefaultM.isPending
                    ? 'text-primary hover:underline'
                    : 'text-primary/50 cursor-not-allowed',
                )}
              >
                Set as default
              </button>
            </div>
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
  dir: CollectionSortDir;
  onChange: (next: CollectionSortDir) => void;
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
