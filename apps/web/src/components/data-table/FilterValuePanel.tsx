import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import {
  Button,
  CheckboxIndicator,
  Histogram,
  RangeSlider,
  Skeleton,
  TextField,
  type RangeSliderQuickRange,
} from '@scrolled/design';
import { JOB_LEVEL_BRACKETS } from '@scrolled/game-db/domain/jobs';
import type { ColumnFilter, FacetSource } from '@/db';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { FilterableCol } from './Filterable';
import type { FacetDef } from './presets';
import { countLabel, isFilterActive } from './filterSummary';
import {
  useColumnHistogram,
  useEnumValueCounts,
  useMatchCounts,
  withoutColumn,
} from './useFacetQueries';

const SEARCHABLE_OPTIONS = 8;
const LEVEL_QUICK_RANGES = JOB_LEVEL_BRACKETS.map((b) => ({
  label: b.max == null ? `${b.name} (${b.min}+)` : `${b.name} (${b.min}–${b.max})`,
  value: [b.min, b.max ?? Infinity] as [number, number],
}));

export interface FilterValuePanelProps {
  col: FilterableCol;
  source: FacetSource;
  filters: Record<string, ColumnFilter>;
  onChange: (columnId: string, value: ColumnFilter | null) => void;
  onClose: () => void;
  facet?: FacetDef;
  /** Rendered before the title, e.g. a back button */
  leading?: ReactNode;
  /** Lowercase plural for the phone sheet's "Show 38 weapons" */
  entityPlural?: string;
}

/** One column's value editor: a live match count, a type-specific body and Clear / Apply. */
export function FilterValuePanel({
  col,
  source,
  filters,
  onChange,
  onClose,
  facet,
  leading,
  entityPlural = 'results',
}: FilterValuePanelProps) {
  const isMobile = useIsMobile();
  const current = filters[col.id];
  const [draft, setDraft] = useState<ColumnFilter | null>(isFilterActive(current) ? current : null);

  const others = useMemo(() => withoutColumn(filters, col.id), [filters, col.id]);
  const candidate = useMemo(
    () => (draft && isFilterActive(draft) ? { ...others, [col.id]: draft } : others),
    [others, draft, col.id],
  );
  const settled = useDebouncedValue(candidate, 150);
  const countSets = useMemo(() => [settled], [settled]);
  const count = useMatchCounts(source, countSets).data?.[0];

  const apply = (next: ColumnFilter | null = draft) => {
    onChange(col.id, next && isFilterActive(next) ? next : null);
    onClose();
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        {leading}
        <h3 className="font-display flex-1 text-base font-semibold max-md:text-xl">{col.label}</h3>
        {count != null && (
          <span className="text-muted-foreground text-[12.5px] tabular-nums">
            {count.toLocaleString()} {count === 1 ? 'match' : 'matches'}
          </span>
        )}
      </div>
      <div className="px-4 pb-3.5">
        {col.type === 'enum' ? (
          <EnumBody col={col} source={source} filters={filters} draft={draft} setDraft={setDraft} />
        ) : col.type === 'boolean' ? (
          <BooleanBody
            col={col}
            source={source}
            others={others}
            draft={draft}
            setDraft={setDraft}
          />
        ) : col.type === 'number' ? (
          <RangeBody
            col={col}
            source={source}
            filters={filters}
            draft={draft}
            setDraft={setDraft}
            facet={facet}
            touch={isMobile}
          />
        ) : (
          <StringBody col={col} draft={draft} setDraft={setDraft} onSubmit={apply} />
        )}
      </div>
      {isMobile ? (
        // Changes only count toward the live total until Show commits them.
        <div className="flex gap-2 px-4 pb-1 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="h-12 rounded-2xl"
            onClick={() => apply(null)}
          >
            Clear
          </Button>
          <Button type="button" className="h-12 flex-1 rounded-2xl" onClick={() => apply()}>
            {count == null ? 'Show results' : `Show ${countLabel(count, entityPlural)}`}
          </Button>
        </div>
      ) : (
        <div className="bg-muted flex items-center justify-end gap-2 rounded-b-[16px] border-t-2 border-[var(--surface-sunken)] px-3 py-2.5">
          <Button type="button" variant="secondary" size="sm" onClick={() => apply(null)}>
            Clear
          </Button>
          <Button type="button" size="sm" onClick={() => apply()}>
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}

interface BodyProps {
  col: FilterableCol;
  draft: ColumnFilter | null;
  setDraft: (next: ColumnFilter | null) => void;
}

function EnumBody({
  col,
  source,
  filters,
  draft,
  setDraft,
}: BodyProps & { source: FacetSource; filters: Record<string, ColumnFilter> }) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const options = col.enumOptions ?? [];
  const counts = useEnumValueCounts(source, col.id, options, filters);
  const selected = draft?.kind === 'enum' ? draft.values : [];

  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    setDraft(next.length > 0 ? { kind: 'enum', values: next } : null);
  };

  const q = query.trim().toLowerCase();
  const visible = options.filter(
    (v) => !q || (col.enumLabel?.(v) ?? v).toLowerCase().includes(q) || v.toLowerCase().includes(q),
  );

  return (
    <div className="flex flex-col gap-2">
      {options.length > SEARCHABLE_OPTIONS && (
        <TextField
          icon={Search}
          size={isMobile ? 'lg' : 'md'}
          autoFocus={!isMobile}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Find ${col.label.toLowerCase()}…`}
          aria-label={`Find ${col.label.toLowerCase()}`}
        />
      )}
      <ul className="-ml-1.5 -mr-3 flex max-h-72 flex-col gap-0.5 overflow-y-auto pr-1.5 [scrollbar-gutter:stable]">
        {visible.length === 0 ? (
          <li className="text-muted-foreground px-2 py-3 text-center text-sm">No matches</li>
        ) : (
          visible.map((v) => {
            const on = selected.includes(v);
            const n = counts.get(v);
            return (
              <li key={v}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(v)}
                  className="sc-focus-ring hover:bg-accent flex min-h-9 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[13.5px] font-semibold max-md:min-h-[52px] max-md:text-[15px]"
                >
                  <CheckboxIndicator size="sm" checked={on} />
                  <span className={n === 0 && !on ? 'text-muted-foreground flex-1' : 'flex-1'}>
                    {col.enumLabel?.(v) ?? v}
                  </span>
                  {n != null && (
                    <span className="text-muted-foreground text-xs font-medium tabular-nums">
                      {n.toLocaleString()}
                    </span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function BooleanBody({
  col,
  source,
  others,
  draft,
  setDraft,
}: BodyProps & { source: FacetSource; others: Record<string, ColumnFilter> }) {
  const labels = col.booleanLabels ?? { trueLabel: 'Yes', falseLabel: 'No' };
  const current = draft?.kind === 'range' && draft.min === draft.max ? draft.min : undefined;
  const sets = useMemo(
    () =>
      [1, 0].map((n) => ({
        ...others,
        [col.id]: { kind: 'range', min: n, max: n } as ColumnFilter,
      })),
    [others, col.id],
  );
  const counts = useMatchCounts(source, sets).data;
  const options = [
    { value: 1, label: labels.trueLabel, count: counts?.[0] },
    { value: 0, label: labels.falseLabel, count: counts?.[1] },
  ];
  return (
    <ul role="radiogroup" aria-label={col.label} className="-mx-1.5 flex flex-col gap-0.5">
      {options.map((o) => {
        const on = current === o.value;
        return (
          <li key={o.value}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setDraft(on ? null : { kind: 'range', min: o.value, max: o.value })}
              className="sc-focus-ring hover:bg-accent flex min-h-9 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[13.5px] font-semibold max-md:min-h-[52px] max-md:text-[15px]"
            >
              <CheckboxIndicator size="sm" checked={on} />
              <span className="flex-1">{o.label}</span>
              {o.count != null && (
                <span className="text-muted-foreground text-xs font-medium tabular-nums">
                  {o.count.toLocaleString()}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type RangeBodyProps = BodyProps & {
  source: FacetSource;
  filters: Record<string, ColumnFilter>;
  facet?: FacetDef;
  /** Phone sheet sizing */
  touch?: boolean;
};

function RangeBody({ col, source, filters, draft, setDraft, facet, touch }: RangeBodyProps) {
  const histogram = useColumnHistogram(source, col.id, filters);
  const h = histogram.data;
  const cur = draft?.kind === 'range' ? draft : undefined;

  if (histogram.isLoading) return <Skeleton rows={3} />;
  if (!h) {
    return (
      <p className="text-muted-foreground py-2 text-[13px]">
        Nothing on this page has a {col.label} value.
      </p>
    );
  }

  const integral = Number.isInteger(h.binWidth);
  const value: [number, number] = [cur?.min ?? h.min, cur?.max ?? h.max];
  const set = ([a, b]: [number, number]) =>
    setDraft(
      a <= h.min && b >= h.max
        ? null
        : { kind: 'range', min: a <= h.min ? undefined : a, max: b >= h.max ? undefined : b },
    );

  const quickRanges: RangeSliderQuickRange[] = [
    ...(facet?.level ? LEVEL_QUICK_RANGES : []),
    ...(facet?.quickRanges ?? []),
  ]
    .filter((q) => q.value[0] <= h.max && q.value[1] >= h.min)
    // Clamped so a picked range matches the slider's value and shows as pressed.
    .map((q) => ({
      label: q.label,
      value: [Math.max(q.value[0], h.min), Math.min(q.value[1], h.max)],
    }));

  return (
    <div className="flex flex-col gap-1">
      <Histogram
        bins={h.bins}
        min={h.min}
        max={h.min + h.binWidth * h.bins.length}
        range={cur ? value : undefined}
        height={touch ? 70 : 54}
      />
      <RangeSlider
        min={h.min}
        max={h.max}
        step={integral ? 1 : (h.max - h.min) / 100 || 1}
        value={value}
        onChange={set}
        quickRanges={quickRanges}
        label={col.label}
        size={touch ? 'lg' : 'md'}
      />
    </div>
  );
}

function StringBody({
  col,
  draft,
  setDraft,
  onSubmit,
}: BodyProps & { onSubmit: (next: ColumnFilter | null) => void }) {
  const value = draft?.kind === 'string' ? draft.value : '';
  const mode = draft?.kind === 'string' ? draft.mode : 'contains';
  const toFilter = (v: string): ColumnFilter | null =>
    v.trim() ? { kind: 'string', mode, value: v.trim() } : null;
  return (
    <TextField
      autoFocus
      type="search"
      value={value}
      onChange={(e) =>
        setDraft(e.target.value ? { kind: 'string', mode, value: e.target.value } : null)
      }
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        onSubmit(toFilter(value));
      }}
      placeholder={`${col.label} contains…`}
      aria-label={`${col.label} contains`}
    />
  );
}
