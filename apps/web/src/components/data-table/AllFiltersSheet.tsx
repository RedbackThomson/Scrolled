import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Filter, Plus } from 'lucide-react';
import { BottomSheet, Button, SlotTile } from '@scrolled/design';
import type { ColumnFilter, FacetSource } from '@/db';
import type { FilterableCol } from './Filterable';
import { FilterMenuContent } from './FilterMenu';
import { FilterValuePanel } from './FilterValuePanel';
import { countLabel, filterValueLabel, isFilterActive } from './filterSummary';
import type { FacetDef } from './presets';

type View = { kind: 'list' } | { kind: 'column'; id: string } | { kind: 'more' };

interface AllFiltersSheetProps {
  filterable: readonly FilterableCol[];
  facets: readonly FacetDef[];
  source: FacetSource;
  filters: Record<string, ColumnFilter>;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  onClearAll: () => void;
  /** Rows matching the current filters */
  total: number;
  entityPlural: string;
  onClose: () => void;
}

/** The phone sheet listing every facet with its value; a row pushes that facet's panel in place. */
export function AllFiltersSheet({
  filterable,
  facets,
  source,
  filters,
  onChange,
  onClearAll,
  total,
  entityPlural,
  onClose,
}: AllFiltersSheetProps) {
  const [view, setView] = useState<View>({ kind: 'list' });
  const back = () => setView({ kind: 'list' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const byId = new Map(filterable.map((c) => [c.id, c]));
  const pushed = view.kind === 'column' ? byId.get(view.id) : undefined;

  return createPortal(
    <BottomSheet
      label="All filters"
      onDismiss={onClose}
      onBack={view.kind === 'list' ? undefined : back}
      top={150}
      footer={
        view.kind === 'list' ? (
          <Button className="h-12 w-full rounded-2xl" onClick={onClose}>
            Show {countLabel(total, entityPlural)}
          </Button>
        ) : undefined
      }
    >
      {pushed ? (
        <FilterValuePanel
          key={pushed.id}
          col={pushed}
          source={source}
          filters={filters}
          onChange={onChange}
          onClose={back}
          facet={facets.find((f) => f.columnId === pushed.id)}
          entityPlural={entityPlural}
        />
      ) : view.kind === 'more' ? (
        <FilterMenuContent
          filterable={filterable}
          source={source}
          filters={filters}
          onChange={onChange}
          onClose={back}
          facets={facets}
        />
      ) : (
        <div className="flex flex-col gap-2 px-4 pb-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[22px] font-semibold">All filters</h2>
            <button
              type="button"
              onClick={onClearAll}
              className="sc-focus-ring min-h-11 rounded-md px-1 text-[13.5px] font-bold text-[color:var(--accent-text)]"
            >
              Clear all
            </button>
          </div>
          <h3 className="text-muted-foreground text-[13px] font-bold">Quick filters</h3>
          {facets.map((f) => {
            const col = byId.get(f.columnId);
            if (!col) return null;
            const filter = filters[col.id];
            return (
              <button
                key={f.columnId}
                type="button"
                onClick={() => setView({ kind: 'column', id: col.id })}
                className="sc-focus-ring border-border bg-card flex min-h-[52px] items-center gap-3 rounded-2xl border-2 px-2.5 text-left shadow-[inset_0_-2px_0_var(--border-1)]"
              >
                <SlotTile icon={col.icon ?? Filter} hue={f.hue} size={34} />
                <span className="flex-1 text-[15px] font-bold">{f.label}</span>
                {isFilterActive(filter) ? (
                  <span
                    className="max-w-[45%] truncate rounded-full px-2.5 py-0.5 text-[13px] font-bold"
                    style={{
                      background: `oklch(0.72 0.12 ${f.hue} / .18)`,
                      color: `oklch(0.5 0.14 ${f.hue})`,
                    }}
                  >
                    {filterValueLabel(col, filter)}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[13.5px]">Any</span>
                )}
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setView({ kind: 'more' })}
            className="sc-focus-ring border-border text-muted-foreground flex min-h-[52px] items-center gap-2 rounded-2xl border-2 border-dashed px-4 text-[15px] font-bold"
          >
            <Plus className="h-4 w-4" />
            More columns
          </button>
        </div>
      )}
    </BottomSheet>,
    document.body,
  );
}
