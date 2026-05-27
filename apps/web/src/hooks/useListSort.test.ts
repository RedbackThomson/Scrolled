import { describe, expect, it } from 'vitest';
import { type SortField, sortItems } from './useListSort';

interface Row {
  name: string | null;
  level: number | null;
}

const fields: SortField<Row>[] = [
  { id: 'name', label: 'Name', get: (r) => r.name },
  { id: 'level', label: 'Level', get: (r) => r.level },
];

const rows: Row[] = [
  { name: 'Bain', level: 10 },
  { name: 'Aria', level: 30 },
  { name: 'caro', level: 20 },
  { name: null, level: 5 },
  { name: 'Drak', level: null },
];

describe('sortItems', () => {
  it('returns the input untouched when dir is null', () => {
    const out = sortItems(rows, fields, { field: 'name', dir: null });
    expect(out).toBe(rows);
  });

  it('sorts strings asc with case-insensitive locale compare', () => {
    const out = sortItems(rows, fields, { field: 'name', dir: 'asc' });
    expect(out.map((r) => r.name)).toEqual(['Aria', 'Bain', 'caro', 'Drak', null]);
  });

  it('sorts strings desc but still sinks missing values', () => {
    const out = sortItems(rows, fields, { field: 'name', dir: 'desc' });
    expect(out.map((r) => r.name)).toEqual(['Drak', 'caro', 'Bain', 'Aria', null]);
  });

  it('sorts numeric fields asc', () => {
    const out = sortItems(rows, fields, { field: 'level', dir: 'asc' });
    expect(out.map((r) => r.level)).toEqual([5, 10, 20, 30, null]);
  });

  it('sorts numeric fields desc with missing sunk to the bottom', () => {
    const out = sortItems(rows, fields, { field: 'level', dir: 'desc' });
    expect(out.map((r) => r.level)).toEqual([30, 20, 10, 5, null]);
  });

  it('returns input when the chosen field is not registered', () => {
    const out = sortItems(rows, fields, { field: 'missing', dir: 'asc' });
    expect(out).toBe(rows);
  });

  it('does not mutate the input array', () => {
    const copy = rows.slice();
    sortItems(copy, fields, { field: 'level', dir: 'asc' });
    expect(copy).toEqual(rows);
  });

  it('handles empty input', () => {
    const out = sortItems<Row>([], fields, { field: 'name', dir: 'asc' });
    expect(out).toEqual([]);
  });
});
