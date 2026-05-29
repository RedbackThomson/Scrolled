// Linear-style filter dropdown.
//
// The popover runs a two-stage cmdk flow:
//
//   stage = 'columns' → searchable column list. Typing filters columns by
//     label; for any enum column whose label OR any of its values match
//     the query, the matched values are also surfaced as inline shortcut
//     items (e.g. typing "fire" surfaces "Weak against → Fire"). Picking
//     a shortcut toggles that value on the existing filter and closes.
//     Picking a column transitions to value-stage.
//
//   stage = { value: columnId } → per-type value picker. Enum columns are
//     a multi-select checkbox list with a sticky Apply footer; booleans
//     are two items that apply on click; strings are a single text input;
//     numbers are min/max inputs. Backspace at an empty input pops back.
//
// Two visual variants share the same popover content:
//   - 'button': the main "Filter" toolbar button.
//   - 'plus':   the small "+" affordance inside the filter-badges row.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { useHotkey } from '@tanstack/react-hotkeys';
import { ArrowLeft, Check, Filter, ListFilter, Plus } from 'lucide-react';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { usePopover } from '@/hooks/usePopover';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { ColumnFilter } from '@/db';
import { cn } from '@/lib/utils';

type Variant = 'button' | 'plus';

type Stage = { kind: 'columns' } | { kind: 'value'; columnId: string };

interface FilterMenuProps<TData> {
  columns: ColumnDef<TData>[];
  filters: Record<string, ColumnFilter>;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  /** Per-enum-column allowed values (drives shortcuts and value-stage picker). */
  enumOptions?: Record<string, readonly string[]>;
  /** Per-enum-column display label for option values. */
  enumLabels?: Record<string, (value: string) => string>;
  variant?: Variant;
}

interface FilterableCol {
  id: string;
  label: string;
  type: 'string' | 'number' | 'enum' | 'boolean';
  icon?: React.ComponentType<{ className?: string }>;
  enumOptions?: readonly string[];
  enumLabel?: (value: string) => string;
  booleanLabels?: { trueLabel: string; falseLabel: string };
}

function collectFilterable<TData>(
  columns: ColumnDef<TData>[],
  enumOptions?: Record<string, readonly string[]>,
  enumLabels?: Record<string, (value: string) => string>,
): FilterableCol[] {
  const out: FilterableCol[] = [];
  for (const col of columns) {
    const id = col.id;
    const ftype = col.meta?.filter;
    if (!id || !ftype) continue;
    const label = typeof col.header === 'string' && col.header.length > 0 ? col.header : id;
    out.push({
      id,
      label,
      type: ftype,
      icon: col.meta?.icon,
      enumOptions: ftype === 'enum' ? enumOptions?.[id] : undefined,
      enumLabel: ftype === 'enum' ? enumLabels?.[id] : undefined,
      booleanLabels: ftype === 'boolean' ? col.meta?.booleanLabels : undefined,
    });
  }
  return out;
}

export function FilterMenu<TData>({
  columns,
  filters,
  onChange,
  enumOptions,
  enumLabels,
  variant = 'button',
}: FilterMenuProps<TData>) {
  const { open, setOpen, close, coords, triggerRef, popoverRef } = usePopover<
    HTMLButtonElement,
    HTMLDivElement
  >();
  const [stage, setStage] = useState<Stage>({ kind: 'columns' });
  const [query, setQuery] = useState('');

  // Reset stage + query whenever the popover closes so reopening starts
  // from the column list with no carried-over input.
  useEffect(() => {
    if (!open) {
      setStage({ kind: 'columns' });
      setQuery('');
    }
  }, [open]);

  // Global "F" shortcut opens the toolbar Filter menu — only the main
  // button variant claims it; the inline `+` in the badge row stays
  // mouse-driven. Gating via a child component (rather than the hook's
  // `enabled` flag) avoids the hotkey-manager registering twice when both
  // instances mount, which would otherwise warn about duplicate handlers.
  // `useHotkey` already skips events from inputs / textareas /
  // contenteditable for single-key shortcuts.

  const filterable = useMemo(
    () => collectFilterable(columns, enumOptions, enumLabels),
    [columns, enumOptions, enumLabels],
  );

  return (
    <>
      {variant === 'button' && <FilterHotkey onTrigger={() => setOpen(true)} />}
      {variant === 'button' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="border-input bg-background hover:bg-accent inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Filter (F)"
          title="Filter (F)"
        >
          <ListFilter className="h-4 w-4" />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded-md"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Add filter"
          title="Add filter"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Filter"
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="border-border bg-card text-card-foreground z-50 w-80 max-w-[calc(100vw-1rem)] rounded-md border shadow-md"
          >
            {stage.kind === 'columns' ? (
              <ColumnStage
                filterable={filterable}
                filters={filters}
                onChange={onChange}
                query={query}
                onQueryChange={setQuery}
                onPickColumn={(id) => {
                  setStage({ kind: 'value', columnId: id });
                  setQuery('');
                }}
                onClose={close}
              />
            ) : (
              <ValueStage
                col={filterable.find((c) => c.id === stage.columnId)}
                filter={filters[stage.columnId]}
                onChange={onChange}
                onBack={() => setStage({ kind: 'columns' })}
                onClose={close}
              />
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

interface ColumnStageProps {
  filterable: FilterableCol[];
  filters: Record<string, ColumnFilter>;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  query: string;
  onQueryChange: (next: string) => void;
  onPickColumn: (columnId: string) => void;
  onClose: () => void;
}

function ColumnStage({
  filterable,
  filters,
  onChange,
  query,
  onQueryChange,
  onPickColumn,
  onClose,
}: ColumnStageProps) {
  // Mobile users tap-and-scroll the list more often than they type — auto-
  // focusing the input would pop the on-screen keyboard and cover the list.
  const isMobile = useIsMobile();
  const q = query.toLowerCase().trim();

  // Build a flat item list: each filterable column once, plus inline value
  // shortcuts for enum columns whose label OR option label matches the query.
  type Item =
    | { kind: 'col'; col: FilterableCol }
    | { kind: 'shortcut'; col: FilterableCol; value: string };
  const items: Item[] = [];
  for (const col of filterable) {
    const labelMatch = q.length === 0 || col.label.toLowerCase().includes(q);
    if (labelMatch) items.push({ kind: 'col', col });
    if (col.type === 'enum' && col.enumOptions) {
      for (const v of col.enumOptions) {
        const vlabel = col.enumLabel?.(v) ?? v;
        if (q.length === 0) continue;
        if (vlabel.toLowerCase().includes(q) || v.toLowerCase().includes(q)) {
          items.push({ kind: 'shortcut', col, value: v });
        }
      }
    }
  }

  const applyShortcut = (col: FilterableCol, value: string) => {
    const existing = filters[col.id];
    const current = existing?.kind === 'enum' ? existing.values : [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange(col.id, next.length === 0 ? null : { kind: 'enum', values: next });
    onClose();
  };

  return (
    <Command shouldFilter={false} label="Filter columns">
      <CommandInput
        autoFocus={!isMobile}
        placeholder="Filter…"
        value={query}
        onValueChange={onQueryChange}
      />
      <CommandList className="max-h-80">
        {items.length === 0 ? (
          <CommandEmpty>No matches</CommandEmpty>
        ) : (
          items.map((item) =>
            item.kind === 'col' ? (
              <CommandItem
                key={`c:${item.col.id}`}
                value={`c:${item.col.id}`}
                onSelect={() => onPickColumn(item.col.id)}
              >
                {item.col.icon ? (
                  <item.col.icon className="text-muted-foreground h-3.5 w-3.5" />
                ) : (
                  <Filter className="text-muted-foreground h-3.5 w-3.5" />
                )}
                <span>{item.col.label}</span>
              </CommandItem>
            ) : (
              <CommandItem
                key={`s:${item.col.id}:${item.value}`}
                value={`s:${item.col.id}:${item.value}`}
                onSelect={() => applyShortcut(item.col, item.value)}
              >
                {item.col.icon ? (
                  <item.col.icon className="text-muted-foreground h-3.5 w-3.5" />
                ) : (
                  <Filter className="text-muted-foreground h-3.5 w-3.5" />
                )}
                <span className="text-muted-foreground">{item.col.label}</span>
                <span className="text-muted-foreground">›</span>
                <span>{item.col.enumLabel?.(item.value) ?? item.value}</span>
              </CommandItem>
            ),
          )
        )}
      </CommandList>
    </Command>
  );
}

interface ValueStageProps {
  col: FilterableCol | undefined;
  filter: ColumnFilter | undefined;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  onBack: () => void;
  onClose: () => void;
}

function ValueStage({ col, filter, onChange, onBack, onClose }: ValueStageProps) {
  if (!col) {
    return (
      <div className="p-3 text-sm">
        Unknown column.{' '}
        <button onClick={onBack} className="underline">
          Back
        </button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-6 w-6 items-center justify-center rounded"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        {col.icon ? (
          <col.icon className="text-muted-foreground h-3.5 w-3.5" />
        ) : (
          <Filter className="text-muted-foreground h-3.5 w-3.5" />
        )}
        <span className="text-sm font-medium">{col.label}</span>
      </div>
      <ValueEditorBody col={col} filter={filter} onChange={onChange} onClose={onClose} onBack={onBack} />
    </div>
  );
}

/** Pure form body for one column's value editor. Used by FilterMenu's
 *  value stage AND by per-badge edit popovers. */
export function ValueEditorBody({
  col,
  filter,
  onChange,
  onClose,
  onBack,
}: {
  col: FilterableCol;
  filter: ColumnFilter | undefined;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  onClose: () => void;
  /** Optional: typing Backspace at the start of an empty input invokes this. */
  onBack?: () => void;
}) {
  if (col.type === 'enum') {
    return (
      <EnumMultiPicker
        col={col}
        filter={filter}
        onChange={(v) => onChange(col.id, v)}
        onBack={onBack}
      />
    );
  }
  if (col.type === 'boolean') {
    return (
      <BooleanPicker
        col={col}
        filter={filter}
        onChange={(v) => {
          onChange(col.id, v);
          onClose();
        }}
        onBack={onBack}
      />
    );
  }
  if (col.type === 'string') {
    return (
      <StringEditor
        col={col}
        filter={filter}
        onApply={(v) => {
          onChange(col.id, v);
          onClose();
        }}
        onBack={onBack}
      />
    );
  }
  return (
    <NumberEditor
      filter={filter}
      onApply={(v) => {
        onChange(col.id, v);
        onClose();
      }}
      onBack={onBack}
    />
  );
}

function EnumMultiPicker({
  col,
  filter,
  onChange,
  onBack,
}: {
  col: FilterableCol;
  filter: ColumnFilter | undefined;
  onChange: (next: ColumnFilter | null) => void;
  /** Optional: Backspace at an empty search input invokes this so the
   *  value stage rewinds to the columns stage in FilterMenu. */
  onBack?: () => void;
}) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const current = filter?.kind === 'enum' ? filter.values : [];
  const options = col.enumOptions ?? [];

  // Commit on each toggle so the user sees the table react immediately.
  // The popover stays open until the user clicks outside or presses Esc —
  // matches Linear's multi-select behavior.
  const toggle = (v: string) => {
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    onChange(next.length === 0 ? null : { kind: 'enum', values: next });
  };

  const q = query.toLowerCase();
  const visible = options.filter((v) => {
    if (q.length === 0) return true;
    const label = (col.enumLabel?.(v) ?? v).toLowerCase();
    return label.includes(q) || v.toLowerCase().includes(q);
  });

  return (
    <Command shouldFilter={false} label={`Filter ${col.label}`}>
      <CommandInput
        autoFocus={!isMobile}
        placeholder={`Filter ${col.label.toLowerCase()}…`}
        value={query}
        onValueChange={setQuery}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' && query.length === 0 && onBack) {
            e.preventDefault();
            onBack();
          }
        }}
      />
      <CommandList className="max-h-72">
        {visible.length === 0 ? (
          <CommandEmpty>No matches</CommandEmpty>
        ) : (
          visible.map((v) => {
            const isSelected = current.includes(v);
            return (
              <CommandItem key={v} value={v} onSelect={() => toggle(v)}>
                <span
                  className={cn(
                    'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input',
                  )}
                >
                  {isSelected && <Check className="h-2.5 w-2.5" />}
                </span>
                <span>{col.enumLabel?.(v) ?? v}</span>
              </CommandItem>
            );
          })
        )}
      </CommandList>
    </Command>
  );
}

function BooleanPicker({
  col,
  filter,
  onChange,
  onBack,
}: {
  col: FilterableCol;
  filter: ColumnFilter | undefined;
  onChange: (next: ColumnFilter | null) => void;
  /** Optional: Backspace at an empty search input invokes this. */
  onBack?: () => void;
}) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');

  // The boolean shim writes a range with min === max ∈ {0, 1}; null clears.
  const current =
    filter?.kind === 'range' && filter.min === filter.max && (filter.min === 0 || filter.min === 1)
      ? (filter.min as 0 | 1)
      : null;
  const labels = col.booleanLabels ?? { trueLabel: 'Yes', falseLabel: 'No' };

  // Selecting the already-active option clears the filter; selecting the
  // other option swaps to it. Either way the parent commits + closes.
  const pick = (val: 0 | 1) => {
    if (current === val) onChange(null);
    else onChange({ kind: 'range', min: val, max: val });
  };

  const options: { value: 0 | 1; label: string }[] = [
    { value: 1, label: labels.trueLabel },
    { value: 0, label: labels.falseLabel },
  ];
  const q = query.toLowerCase();
  const visible = options.filter((o) => q.length === 0 || o.label.toLowerCase().includes(q));

  return (
    <Command shouldFilter={false} label={`Filter ${col.label}`}>
      <CommandInput
        autoFocus={!isMobile}
        placeholder={`Filter ${col.label.toLowerCase()}…`}
        value={query}
        onValueChange={setQuery}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' && query.length === 0 && onBack) {
            e.preventDefault();
            onBack();
          }
        }}
      />
      <CommandList className="max-h-72">
        {visible.length === 0 ? (
          <CommandEmpty>No matches</CommandEmpty>
        ) : (
          visible.map((o) => {
            const isSelected = current === o.value;
            return (
              <CommandItem key={o.value} value={o.label} onSelect={() => pick(o.value)}>
                <span
                  className={cn(
                    'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input',
                  )}
                >
                  {isSelected && <Check className="h-2.5 w-2.5" />}
                </span>
                <span>{o.label}</span>
              </CommandItem>
            );
          })
        )}
      </CommandList>
    </Command>
  );
}

function StringEditor({
  col,
  filter,
  onApply,
  onBack,
}: {
  col: FilterableCol;
  filter: ColumnFilter | undefined;
  onApply: (next: ColumnFilter | null) => void;
  onBack?: () => void;
}) {
  const initial = filter?.kind === 'string' ? filter.value : '';
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = value.trim();
      onApply(trimmed ? { kind: 'string', mode: 'contains', value: trimmed } : null);
    } else if (e.key === 'Backspace' && value.length === 0 && onBack) {
      e.preventDefault();
      onBack();
    }
  };

  return (
    <div className="space-y-2 p-2">
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        placeholder={`${col.label}…`}
        className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-2 text-base focus-visible:outline-none focus-visible:ring-2 sm:text-sm"
      />
      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => onApply(null)}>
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const trimmed = value.trim();
            onApply(trimmed ? { kind: 'string', mode: 'contains', value: trimmed } : null);
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

function NumberEditor({
  filter,
  onApply,
  onBack,
}: {
  filter: ColumnFilter | undefined;
  onApply: (next: ColumnFilter | null) => void;
  onBack?: () => void;
}) {
  const initialMin = filter?.kind === 'range' ? filter.min : undefined;
  const initialMax = filter?.kind === 'range' ? filter.max : undefined;
  const [minStr, setMinStr] = useState(initialMin === undefined ? '' : String(initialMin));
  const [maxStr, setMaxStr] = useState(initialMax === undefined ? '' : String(initialMax));

  const apply = () => {
    const min = parseBound(minStr);
    const max = parseBound(maxStr);
    if (min === undefined && max === undefined) {
      onApply(null);
    } else {
      onApply({ kind: 'range', min, max });
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, isMin: boolean) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      apply();
    } else if (e.key === 'Backspace' && isMin && minStr.length === 0 && onBack) {
      e.preventDefault();
      onBack();
    }
  };

  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          value={minStr}
          onChange={(e) => setMinStr(e.target.value)}
          onKeyDown={(e) => handleKey(e, true)}
          placeholder="Min"
          aria-label="Minimum"
          className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-2 text-base focus-visible:outline-none focus-visible:ring-2 sm:text-sm"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <input
          type="number"
          inputMode="numeric"
          value={maxStr}
          onChange={(e) => setMaxStr(e.target.value)}
          onKeyDown={(e) => handleKey(e, false)}
          placeholder="Max"
          aria-label="Maximum"
          className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-2 text-base focus-visible:outline-none focus-visible:ring-2 sm:text-sm"
        />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => onApply(null)}>
          Clear
        </Button>
        <Button type="button" size="sm" onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

function parseBound(s: string): number | undefined {
  if (s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Renders nothing — exists to register the global "F" hotkey only when
 *  the toolbar Filter button is mounted. */
function FilterHotkey({ onTrigger }: { onTrigger: () => void }) {
  useHotkey('F', () => onTrigger());
  return null;
}

/** Re-export so FilterBadges can reach into it for inline edit popovers. */
export { collectFilterable, type FilterableCol };
