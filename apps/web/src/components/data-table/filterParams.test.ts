import { describe, expect, it } from 'vitest';
import type { ColumnFilter } from '@/db';
import { filtersToParams, paramsToFilters, pickFilterParams, sameParams } from './filterParams';

const SPECS = [
  { id: 'name', type: 'string' as const },
  { id: 'type', type: 'enum' as const },
  { id: 'cash', type: 'boolean' as const },
  { id: 'level', type: 'number' as const },
];

describe('filter params', () => {
  it('round-trips every filter kind', () => {
    const filters: Record<string, ColumnFilter> = {
      name: { kind: 'string', mode: 'prefix', value: 'Red' },
      type: { kind: 'enum', values: ['claw', 'dagger'] },
      cash: { kind: 'range', min: 0, max: 0 },
      level: { kind: 'range', min: 30 },
    };
    const params = filtersToParams(filters, SPECS);
    expect(params).toEqual({
      f_name: 'Red',
      f_name_mode: 'prefix',
      f_type: 'claw,dagger',
      f_cash: '0',
      f_level_min: '30',
    });
    expect(paramsToFilters(params, SPECS)).toEqual({
      ...filters,
      level: { kind: 'range', min: 30, max: undefined },
    });
  });

  it('compares only filter params', () => {
    const saved = { f_type: 'claw', sort: 'name', page: '3' };
    expect(sameParams(pickFilterParams(saved), { f_type: 'claw' })).toBe(true);
    expect(sameParams(pickFilterParams(saved), { f_type: 'claw', f_level_min: '1' })).toBe(false);
  });
});
