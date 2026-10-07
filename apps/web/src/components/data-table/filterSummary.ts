import type { ColumnFilter } from '@/db';
import type { FilterableCol } from './Filterable';
import type { FacetDef } from './presets';

const MAX_VALUES = 2;

export function isFilterActive(f: ColumnFilter | undefined): f is ColumnFilter {
  if (!f) return false;
  if (f.kind === 'string') return f.value.length > 0;
  if (f.kind === 'enum') return f.values.length > 0;
  return f.min !== undefined || f.max !== undefined;
}

/** The short value shown in a facet pill or chip, e.g. "30 – 50", "Thief +2", "≥ 20". */
export function filterValueLabel(col: FilterableCol, filter: ColumnFilter): string {
  if (filter.kind === 'string') return `“${filter.value}”`;
  if (filter.kind === 'enum') {
    const labels = filter.values.map((v) => col.enumLabel?.(v) ?? v);
    if (labels.length <= MAX_VALUES) return labels.join(', ');
    return `${labels.slice(0, MAX_VALUES).join(', ')} +${labels.length - MAX_VALUES}`;
  }
  if (col.booleanLabels && filter.min === filter.max && (filter.min === 0 || filter.min === 1)) {
    return filter.min === 1 ? col.booleanLabels.trueLabel : col.booleanLabels.falseLabel;
  }
  if (filter.min !== undefined && filter.max !== undefined) {
    return filter.min === filter.max ? String(filter.min) : `${filter.min} – ${filter.max}`;
  }
  if (filter.min !== undefined) return `≥ ${filter.min}`;
  return `≤ ${filter.max}`;
}

// Stable per-column hue so a chip keeps its colour as filters come and go.
const CHIP_HUES = [185, 260, 20];
export function columnHue(columnId: string): number {
  let h = 0;
  for (const c of columnId) h = (h * 31 + c.charCodeAt(0)) | 0;
  return CHIP_HUES[Math.abs(h) % CHIP_HUES.length]!;
}

/** "1 weapon", "1,269 weapons" from a lowercase plural ("NPCs", "quest chains"). */
export function countLabel(n: number, plural: string): string {
  return `${n.toLocaleString()} ${n === 1 ? plural.replace(/s$/, '') : plural}`;
}

export interface ActiveFilterChip {
  id: string;
  label: string;
  value: string;
  hue: number;
}

/** Every active filter as a labelled, coloured chip, in column order. */
export function activeFilterChips(
  filterable: readonly FilterableCol[],
  facets: readonly FacetDef[],
  filters: Record<string, ColumnFilter>,
): ActiveFilterChip[] {
  return filterable.flatMap((col) => {
    const filter = filters[col.id];
    if (!isFilterActive(filter)) return [];
    const facet = facets.find((f) => f.columnId === col.id);
    return [
      {
        id: col.id,
        label: facet?.label ?? col.label,
        value: filterValueLabel(col, filter),
        hue: facet?.hue ?? columnHue(col.id),
      },
    ];
  });
}
