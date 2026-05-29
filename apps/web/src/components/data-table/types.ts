import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { RowData } from '@tanstack/react-table';

export type FilterType = 'string' | 'number' | 'enum' | 'boolean';

/** Display labels for boolean filter columns (DB stores 0/1). */
export interface BooleanFilterLabels {
  /** Label for the "matches 1" option (e.g. `Cash`). */
  trueLabel: string;
  /** Label for the "matches 0" option (e.g. `Regular`). */
  falseLabel: string;
}

/** How a column renders as a labeled row on the mobile card. Surfaced
 *  only when the user enables this column beyond the entity's
 *  `defaultVisible` — the hand-written card already covers defaults. */
export interface MobileCardField<TData> {
  label: string;
  render: (row: TData) => ReactNode;
}

declare module '@tanstack/react-table' {
  // ColumnMeta is the documented augmentation point for ColumnDef metadata.
  // We use it to mark which columns expose a filter UI and what kind.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    filter?: FilterType;
    /** Required when `filter === 'boolean'`. */
    booleanLabels?: BooleanFilterLabels;
    /** Icon shown next to the property name in the Filter and Display
     *  Options dropdowns. */
    icon?: LucideIcon;
    /** Appended to the mobile card when the user enables this column
     *  beyond the entity's default-visible set. */
    card?: MobileCardField<TData>;
  }
}
