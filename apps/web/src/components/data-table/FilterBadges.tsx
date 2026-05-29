// Row of active filter chips rendered below the toolbar.
//
// Each badge shows `[icon] {column} is {value}` with an inline X. Clicking
// the badge body reopens the column's value editor anchored to the chip.
// Trailing `+` reuses FilterMenu in `'plus'` variant to add another. The
// right cluster has Clear (drops every filter + the search query) and
// Save (toggles SaveSearchPrompt, which writes through the same
// pinned_searches store as the toolbar's Saved Searches dropdown).

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePopover } from '@/hooks/usePopover';
import type { ColumnDef } from '@tanstack/react-table';
import type { ColumnFilter } from '@/db';
import type { CollectionEntityType } from '@/db/user';
import { cn } from '@/lib/utils';
import { FilterMenu, ValueEditorBody } from './FilterMenu';
import { SaveSearchPrompt } from './SaveSearchPrompt';
import type { FilterableCol } from './Filterable';
import { collectFilterable } from './Filterable';

interface FilterBadgesProps<TData> {
  columns: ColumnDef<TData>[];
  filters: Record<string, ColumnFilter>;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  onClearAll: () => void;
  enumOptions?: Record<string, readonly string[]>;
  enumLabels?: Record<string, (value: string) => string>;
  entity: CollectionEntityType;
}

const MAX_BADGE_VALUES = 3;

export function FilterBadges<TData>({
  columns,
  filters,
  onChange,
  onClearAll,
  enumOptions,
  enumLabels,
  entity,
}: FilterBadgesProps<TData>) {
  const [savingOpen, setSavingOpen] = useState(false);
  const filterable = collectFilterable(columns, enumOptions, enumLabels);

  // Iterate in column-definition order so the badge sequence stays stable
  // across reorderings of the filters object.
  const active = filterable
    .map((col) => ({ col, filter: filters[col.id] }))
    .filter((x) => isActive(x.filter));

  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {active.map(({ col, filter }) => (
          <Badge key={col.id} col={col} filter={filter!} onChange={onChange} />
        ))}
        <FilterMenu
          columns={columns}
          filters={filters}
          onChange={onChange}
          enumOptions={enumOptions}
          enumLabels={enumLabels}
          variant="plus"
        />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {savingOpen ? (
          <SaveSearchPrompt entity={entity} onDone={() => setSavingOpen(false)} />
        ) : (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
              Clear
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setSavingOpen(true)}>
              Save
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function isActive(f: ColumnFilter | undefined): boolean {
  if (!f) return false;
  if (f.kind === 'string') return f.value.length > 0;
  if (f.kind === 'enum') return f.values.length > 0;
  return f.min !== undefined || f.max !== undefined;
}

interface BadgeProps {
  col: FilterableCol;
  filter: ColumnFilter;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
}

function Badge({ col, filter, onChange }: BadgeProps) {
  const { open, setOpen, close, coords, triggerRef, popoverRef } = usePopover<
    HTMLButtonElement,
    HTMLDivElement
  >();

  const summary = badgeSummary(col, filter);
  const Icon = col.icon ?? Filter;

  return (
    <>
      <span className="border-input bg-background inline-flex h-7 items-center overflow-hidden rounded-md border text-xs">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="hover:bg-accent inline-flex h-full items-center gap-1.5 px-2"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Icon className="text-muted-foreground h-3 w-3" />
          <span>{col.label}</span>
          <span className="text-muted-foreground">{summary.connector}</span>
          <span className="font-medium">{summary.value}</span>
        </button>
        <button
          type="button"
          onClick={() => onChange(col.id, null)}
          aria-label={`Remove ${col.label} filter`}
          className={cn(
            'text-muted-foreground hover:bg-muted hover:text-foreground',
            'inline-flex h-full w-6 items-center justify-center border-l',
          )}
        >
          <X className="h-3 w-3" />
        </button>
      </span>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`Edit ${col.label} filter`}
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="border-border bg-card text-card-foreground z-50 w-72 max-w-[calc(100vw-1rem)] rounded-md border shadow-md"
          >
            <div className="flex items-center gap-1 border-b px-2 py-1.5">
              <Icon className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-sm font-medium">{col.label}</span>
            </div>
            <ValueEditorBody col={col} filter={filter} onChange={onChange} onClose={close} />
          </div>,
          document.body,
        )}
    </>
  );
}

interface Summary {
  connector: string;
  value: string;
}

function badgeSummary(col: FilterableCol, filter: ColumnFilter): Summary {
  if (filter.kind === 'string') {
    return { connector: 'contains', value: `"${filter.value}"` };
  }
  if (filter.kind === 'enum') {
    const labels = filter.values.map((v) => col.enumLabel?.(v) ?? v);
    if (labels.length <= MAX_BADGE_VALUES) {
      return {
        connector: filter.values.length === 1 ? 'is' : 'is any of',
        value: labels.join(', '),
      };
    }
    const shown = labels.slice(0, MAX_BADGE_VALUES).join(', ');
    return { connector: 'is any of', value: `${shown}, +${labels.length - MAX_BADGE_VALUES} more` };
  }
  // range — boolean shim shows the configured label
  if (filter.min === filter.max && (filter.min === 0 || filter.min === 1) && col.booleanLabels) {
    return {
      connector: 'is',
      value: filter.min === 1 ? col.booleanLabels.trueLabel : col.booleanLabels.falseLabel,
    };
  }
  if (filter.min !== undefined && filter.max !== undefined) {
    return { connector: '', value: `${filter.min}–${filter.max}` };
  }
  if (filter.min !== undefined) {
    return { connector: '≥', value: String(filter.min) };
  }
  if (filter.max !== undefined) {
    return { connector: '≤', value: String(filter.max) };
  }
  return { connector: '', value: '' };
}
