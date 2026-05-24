import type { RowData } from '@tanstack/react-table';

export type FilterType = 'string' | 'number' | 'enum';

declare module '@tanstack/react-table' {
  // ColumnMeta is the documented augmentation point for ColumnDef metadata.
  // We use it to mark which columns expose a filter UI and what kind.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    filter?: FilterType;
  }
}
