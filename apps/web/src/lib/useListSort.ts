import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc' | null;

export interface SortField<T> {
  id: string;
  label: string;
  get: (row: T) => string | number | null | undefined;
}

export interface SortState {
  field: string;
  dir: SortDir;
}

export interface UseListSortResult<T> {
  sorted: T[];
  sort: SortState;
  setSort: (s: SortState) => void;
  fieldOptions: { id: string; label: string }[];
}

export function sortItems<T>(items: T[], fields: SortField<T>[], sort: SortState): T[] {
  if (items.length === 0 || sort.dir === null) return items;
  const field = fields.find((f) => f.id === sort.field);
  if (!field) return items;
  const dir = sort.dir;
  return [...items].sort((a, b) => compareValues(field.get(a), field.get(b), dir));
}

export function useListSort<T>(
  items: T[] | undefined,
  fields: SortField<T>[],
): UseListSortResult<T> {
  const [sort, setSort] = useState<SortState>({
    field: fields[0]?.id ?? '',
    dir: null,
  });

  const sorted = useMemo(() => (items ? sortItems(items, fields, sort) : []), [items, fields, sort]);
  const fieldOptions = useMemo(() => fields.map((f) => ({ id: f.id, label: f.label })), [fields]);

  return { sorted, sort, setSort, fieldOptions };
}

function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: 'asc' | 'desc',
): number {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing && bMissing) return 0;
  // Missing values always sink to the bottom, regardless of direction.
  if (aMissing) return 1;
  if (bMissing) return -1;
  const cmp =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
  return dir === 'asc' ? cmp : -cmp;
}
