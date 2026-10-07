// The "More" filter menu: a searchable column list that steps into one
// column's value panel. Typing also surfaces enum values whose label matches
// (e.g. "fire" → "Weak against › Fire"); picking one toggles that value and
// closes.

import { useMemo, useState } from 'react';
import { ArrowLeft, Filter } from 'lucide-react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@scrolled/design';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { ColumnFilter, FacetSource } from '@/db';
import type { FilterableCol } from './Filterable';
import { FilterValuePanel } from './FilterValuePanel';
import type { FacetDef } from './presets';

interface FilterMenuContentProps {
  filterable: readonly FilterableCol[];
  source: FacetSource;
  filters: Record<string, ColumnFilter>;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  onClose: () => void;
  facets?: readonly FacetDef[];
}

export function FilterMenuContent({
  filterable,
  source,
  filters,
  onChange,
  onClose,
  facets,
}: FilterMenuContentProps) {
  const [columnId, setColumnId] = useState<string | null>(null);
  const col = columnId ? filterable.find((c) => c.id === columnId) : undefined;

  if (col) {
    return (
      <FilterValuePanel
        col={col}
        source={source}
        filters={filters}
        onChange={onChange}
        onClose={onClose}
        facet={facets?.find((f) => f.columnId === col.id)}
        leading={
          <button
            type="button"
            onClick={() => setColumnId(null)}
            aria-label="Back"
            className="sc-focus-ring text-muted-foreground hover:bg-accent hover:text-foreground -ml-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        }
      />
    );
  }
  return (
    <ColumnStage
      filterable={filterable}
      filters={filters}
      onChange={onChange}
      onPickColumn={setColumnId}
      onClose={onClose}
    />
  );
}

interface ColumnStageProps {
  filterable: readonly FilterableCol[];
  filters: Record<string, ColumnFilter>;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  onPickColumn: (columnId: string) => void;
  onClose: () => void;
}

function ColumnStage({ filterable, filters, onChange, onPickColumn, onClose }: ColumnStageProps) {
  // Mobile users tap-and-scroll the list more often than they type — auto-
  // focusing the input would pop the on-screen keyboard and cover the list.
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const q = query.toLowerCase().trim();

  type Item =
    | { kind: 'col'; col: FilterableCol }
    | { kind: 'shortcut'; col: FilterableCol; value: string };
  const items = useMemo(() => {
    const out: Item[] = [];
    for (const col of filterable) {
      if (q.length === 0 || col.label.toLowerCase().includes(q)) out.push({ kind: 'col', col });
      if (q.length === 0 || col.type !== 'enum' || !col.enumOptions) continue;
      for (const v of col.enumOptions) {
        const label = col.enumLabel?.(v) ?? v;
        if (label.toLowerCase().includes(q) || v.toLowerCase().includes(q)) {
          out.push({ kind: 'shortcut', col, value: v });
        }
      }
    }
    return out;
  }, [filterable, q]);

  const applyShortcut = (col: FilterableCol, value: string) => {
    const existing = filters[col.id];
    const current = existing?.kind === 'enum' ? existing.values : [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange(col.id, next.length === 0 ? null : { kind: 'enum', values: next });
    onClose();
  };

  return (
    <Command shouldFilter={false} label="Filter columns">
      <CommandInput
        autoFocus={!isMobile}
        placeholder="Filter by…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-80">
        {items.length === 0 ? (
          <CommandEmpty>No matches</CommandEmpty>
        ) : (
          items.map((item) => {
            const Icon = item.col.icon ?? Filter;
            return item.kind === 'col' ? (
              <CommandItem
                key={`c:${item.col.id}`}
                value={`c:${item.col.id}`}
                onSelect={() => onPickColumn(item.col.id)}
              >
                <Icon className="text-muted-foreground h-3.5 w-3.5" />
                <span>{item.col.label}</span>
              </CommandItem>
            ) : (
              <CommandItem
                key={`s:${item.col.id}:${item.value}`}
                value={`s:${item.col.id}:${item.value}`}
                onSelect={() => applyShortcut(item.col, item.value)}
              >
                <Icon className="text-muted-foreground h-3.5 w-3.5" />
                <span className="text-muted-foreground">{item.col.label}</span>
                <span className="text-muted-foreground">›</span>
                <span>{item.col.enumLabel?.(item.value) ?? item.value}</span>
              </CommandItem>
            );
          })
        )}
      </CommandList>
    </Command>
  );
}
