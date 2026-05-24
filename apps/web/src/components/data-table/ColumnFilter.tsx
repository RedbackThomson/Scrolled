// Per-column filter popover rendered inline in the table header.
//
// String columns get a text input plus a mode picker (contains / prefix /
// suffix / equals) — `contains` is the default. Number columns get two
// inputs (min/max) committed on blur or Enter; empty inputs clear that
// bound. All edits go straight through the parent hook's `setFilter`,
// which mirrors to the URL.
//
// The popover body is portaled to <body> with position:fixed because the
// table wrapper uses `overflow-x: auto`, which per CSS spec also clips the
// vertical axis — a popover anchored inside a header cell would be cut off
// on tables with few rows.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Filter } from 'lucide-react';
import type { ColumnFilter, StringFilterMode } from '@/db';
import { cn } from '@/lib/utils';
import type { BooleanFilterLabels, FilterType } from './types';

const STRING_MODES: { value: StringFilterMode; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'prefix', label: 'Starts with' },
  { value: 'suffix', label: 'Ends with' },
  { value: 'equals', label: 'Equals' },
];

interface ColumnFilterPopoverProps {
  columnId: string;
  columnLabel: string;
  type: FilterType;
  value: ColumnFilter | undefined;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  /** Available choices for `type === 'enum'` columns. Ignored otherwise. */
  enumOptions?: readonly string[];
  /** Required when `type === 'boolean'` — labels for the two choices. */
  booleanLabels?: BooleanFilterLabels;
}

export function ColumnFilterPopover({
  columnId,
  columnLabel,
  type,
  value,
  onChange,
  enumOptions,
  booleanLabels,
}: ColumnFilterPopoverProps) {
  const active = isActive(value);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Position the popover under the trigger. useLayoutEffect avoids a flash
  // at (0, 0) on open. Recompute on resize so the popover follows.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = triggerRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Outside click + Escape close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        // Stop the click from bubbling into the sortable header button.
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-sm',
          active
            ? 'text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Filter ${columnLabel}`}
        title={`Filter ${columnLabel}`}
      >
        <Filter className="h-3.5 w-3.5" />
      </button>
      {open && coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`Filter ${columnLabel}`}
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="border-border bg-card text-card-foreground z-50 min-w-[14rem] rounded-md border p-2 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-muted-foreground mb-1.5 px-1 text-xs uppercase tracking-wide">
              Filter {columnLabel}
            </div>
            {type === 'string' ? (
              <StringFilterInput
                columnId={columnId}
                value={value?.kind === 'string' ? value.value : ''}
                mode={value?.kind === 'string' ? value.mode : 'contains'}
                onChange={onChange}
              />
            ) : type === 'enum' ? (
              <EnumFilterSelect
                columnId={columnId}
                options={enumOptions ?? []}
                value={value?.kind === 'string' ? value.value : ''}
                onChange={onChange}
              />
            ) : type === 'boolean' ? (
              <BooleanFilterSelect
                columnId={columnId}
                labels={booleanLabels ?? { trueLabel: 'Yes', falseLabel: 'No' }}
                value={
                  value?.kind === 'range' &&
                  (value.min === 1 || value.min === 0) &&
                  value.min === value.max
                    ? (value.min as 0 | 1)
                    : null
                }
                onChange={onChange}
              />
            ) : (
              <NumberFilterInputs
                columnId={columnId}
                min={value?.kind === 'range' ? value.min : undefined}
                max={value?.kind === 'range' ? value.max : undefined}
                onChange={onChange}
              />
            )}
            {active && (
              <button
                type="button"
                onClick={() => {
                  onChange(columnId, null);
                  close();
                }}
                className="text-muted-foreground hover:text-foreground mt-2 w-full rounded px-2 py-1 text-left text-xs"
              >
                Clear
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function isActive(v: ColumnFilter | undefined): boolean {
  if (!v) return false;
  if (v.kind === 'string') return v.value.length > 0;
  return v.min !== undefined || v.max !== undefined;
}

interface StringInputProps {
  columnId: string;
  value: string;
  mode: StringFilterMode;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
}

function StringFilterInput({ columnId, value, mode, onChange }: StringInputProps) {
  const placeholder = STRING_MODES.find((m) => m.value === mode)?.label ?? 'Contains';
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {STRING_MODES.map((m) => {
          const active = m.value === mode;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() =>
                onChange(
                  columnId,
                  value ? { kind: 'string', mode: m.value, value } : { kind: 'string', mode: m.value, value: '' },
                )
              }
              className={cn(
                'rounded px-1.5 py-0.5 text-[11px] capitalize',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <input
        type="search"
        autoFocus
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(columnId, next ? { kind: 'string', mode, value: next } : null);
        }}
        placeholder={`${placeholder}…`}
        className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
      />
    </div>
  );
}

interface NumberInputProps {
  columnId: string;
  min: number | undefined;
  max: number | undefined;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
}

function NumberFilterInputs({ columnId, min, max, onChange }: NumberInputProps) {
  // Mirror the URL bounds locally so typing doesn't bind on every keystroke;
  // commit on blur or Enter. Keep in sync if URL changes from elsewhere.
  const [localMin, setLocalMin] = useState(min === undefined ? '' : String(min));
  const [localMax, setLocalMax] = useState(max === undefined ? '' : String(max));

  useEffect(() => {
    setLocalMin(min === undefined ? '' : String(min));
  }, [min]);
  useEffect(() => {
    setLocalMax(max === undefined ? '' : String(max));
  }, [max]);

  const commit = (nextMinStr: string, nextMaxStr: string) => {
    const nextMin = parseBound(nextMinStr);
    const nextMax = parseBound(nextMaxStr);
    if (nextMin === undefined && nextMax === undefined) {
      onChange(columnId, null);
    } else {
      onChange(columnId, { kind: 'range', min: nextMin, max: nextMax });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        autoFocus
        inputMode="numeric"
        value={localMin}
        onChange={(e) => setLocalMin(e.target.value)}
        onBlur={() => commit(localMin, localMax)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(localMin, localMax);
          }
        }}
        placeholder="Min"
        aria-label="Minimum"
        className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
      />
      <span className="text-muted-foreground text-xs">–</span>
      <input
        type="number"
        inputMode="numeric"
        value={localMax}
        onChange={(e) => setLocalMax(e.target.value)}
        onBlur={() => commit(localMin, localMax)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(localMin, localMax);
          }
        }}
        placeholder="Max"
        aria-label="Maximum"
        className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
      />
    </div>
  );
}

function parseBound(s: string): number | undefined {
  if (s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

interface EnumInputProps {
  columnId: string;
  options: readonly string[];
  value: string;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
}

function EnumFilterSelect({ columnId, options, value, onChange }: EnumInputProps) {
  return (
    <select
      autoFocus
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        onChange(
          columnId,
          next ? { kind: 'string', mode: 'equals', value: next } : null,
        );
      }}
      className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
    >
      <option value="">Any</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

interface BooleanInputProps {
  columnId: string;
  labels: BooleanFilterLabels;
  value: 0 | 1 | null;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
}

function BooleanFilterSelect({ columnId, labels, value, onChange }: BooleanInputProps) {
  return (
    <select
      autoFocus
      value={value === null ? '' : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') return onChange(columnId, null);
        const n = raw === '1' ? 1 : 0;
        onChange(columnId, { kind: 'range', min: n, max: n });
      }}
      className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
    >
      <option value="">Any</option>
      <option value="1">{labels.trueLabel}</option>
      <option value="0">{labels.falseLabel}</option>
    </select>
  );
}
