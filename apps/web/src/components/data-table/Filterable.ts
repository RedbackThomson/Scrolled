import type { ColumnDef } from '@tanstack/react-table';

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

export { collectFilterable, type FilterableCol };
