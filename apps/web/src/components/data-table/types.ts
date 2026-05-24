import type { RowData } from '@tanstack/react-table';

export type FilterType = 'string' | 'number' | 'enum' | 'boolean';

/** Display labels for boolean filter columns (DB stores 0/1). */
export interface BooleanFilterLabels {
  /** Label for the "matches 1" option (e.g. `Cash`). */
  trueLabel: string;
  /** Label for the "matches 0" option (e.g. `Regular`). */
  falseLabel: string;
}

declare module '@tanstack/react-table' {
  // ColumnMeta is the documented augmentation point for ColumnDef metadata.
  // We use it to mark which columns expose a filter UI and what kind.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    filter?: FilterType;
    /** Required when `filter === 'boolean'`. */
    booleanLabels?: BooleanFilterLabels;
  }
}
