// Column filters ⇄ the `f_*` URL params `useColumnFilters` reads and writes.
// Saved searches store raw URL params, so comparing or counting them needs the
// same encoding in both directions.

import type { ColumnFilter } from '@/db';
import type { FilterType } from './types';

interface FilterSpec {
  id: string;
  type: FilterType;
}

export function isFilterParam(key: string): boolean {
  return key.startsWith('f_');
}

/** Just the filter params, for comparing two searches on what they filter. */
export function pickFilterParams(params: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).filter(([k]) => isFilterParam(k)));
}

export function filtersToParams(
  filters: Record<string, ColumnFilter>,
  specs: readonly FilterSpec[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { id, type } of specs) {
    const f = filters[id];
    if (!f) continue;
    if (type === 'string' && f.kind === 'string') {
      if (f.value) out[`f_${id}`] = f.value;
      if (f.mode !== 'contains') out[`f_${id}_mode`] = f.mode;
    } else if (type === 'enum' && f.kind === 'enum' && f.values.length > 0) {
      out[`f_${id}`] = f.values.join(',');
    } else if (type === 'boolean' && f.kind === 'range' && f.min === f.max) {
      if (f.min === 0 || f.min === 1) out[`f_${id}`] = String(f.min);
    } else if (type === 'number' && f.kind === 'range') {
      if (f.min !== undefined) out[`f_${id}_min`] = String(f.min);
      if (f.max !== undefined) out[`f_${id}_max`] = String(f.max);
    }
  }
  return out;
}

export function paramsToFilters(
  params: Record<string, string>,
  specs: readonly FilterSpec[],
): Record<string, ColumnFilter> {
  const out: Record<string, ColumnFilter> = {};
  const num = (v: string | undefined) => {
    if (v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  for (const { id, type } of specs) {
    const value = params[`f_${id}`];
    if (type === 'string') {
      const mode = params[`f_${id}_mode`];
      if (value) {
        out[id] = {
          kind: 'string',
          mode: mode === 'prefix' || mode === 'suffix' || mode === 'equals' ? mode : 'contains',
          value,
        };
      }
    } else if (type === 'enum') {
      const values = value?.split(',').filter(Boolean) ?? [];
      if (values.length > 0) out[id] = { kind: 'enum', values };
    } else if (type === 'boolean') {
      if (value === '1' || value === '0') out[id] = { kind: 'range', min: +value, max: +value };
    } else {
      const min = num(params[`f_${id}_min`]);
      const max = num(params[`f_${id}_max`]);
      if (min !== undefined || max !== undefined) out[id] = { kind: 'range', min, max };
    }
  }
  return out;
}

export function sameParams(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}
