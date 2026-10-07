import { useState, type ReactNode } from 'react';
import { Checkbox } from '../forms/Checkbox';

export interface DataTableColumn<Row> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: Row) => ReactNode;
}

function cell(row: object, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

export interface DataTableProps<Row extends object> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey?: string;
  selectable?: boolean;
  selected?: unknown[];
  /** Usually <Pagination /> */
  footer?: ReactNode;
}

export function DataTable<Row extends object>({
  columns,
  rows,
  rowKey = 'id',
  selectable,
  selected = [],
  footer,
}: DataTableProps<Row>) {
  const template =
    (selectable ? '30px ' : '') + columns.map((c) => c.width || 'minmax(0,1fr)').join(' ');
  return (
    <div
      style={{
        borderRadius: 16,
        background: 'var(--surface-card)',
        border: 'var(--border-rim)',
        boxShadow: 'var(--shadow-rim)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: template,
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          background: 'var(--surface-sunken)',
          font: '700 11.5px var(--font-body)',
          color: 'var(--text-2)',
          letterSpacing: '.04em',
          textTransform: 'uppercase',
        }}
      >
        {selectable && <Checkbox />}
        {columns.map((c) => (
          <span key={c.key} style={{ textAlign: c.align }}>
            {c.label}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <DataTableRow
          key={String(cell(row, rowKey))}
          row={row}
          template={template}
          columns={columns}
          selectable={selectable}
          isSelected={selected.includes(cell(row, rowKey))}
        />
      ))}
      {footer && (
        <div style={{ padding: '10px 14px', borderTop: '1.5px solid var(--surface-sunken)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

interface DataTableRowProps<Row extends object> {
  row: Row;
  template: string;
  columns: DataTableColumn<Row>[];
  selectable?: boolean;
  isSelected: boolean;
}

function DataTableRow<Row extends object>({
  row,
  template,
  columns,
  selectable,
  isSelected,
}: DataTableRowProps<Row>) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: template,
        alignItems: 'center',
        gap: 8,
        padding: '5px 14px',
        minHeight: 46,
        borderTop: '1.5px solid var(--surface-sunken)',
        fontSize: 13.5,
        background: hovered || isSelected ? 'var(--surface-sunken)' : 'transparent',
        transition: 'background var(--dur-fast)',
      }}
    >
      {selectable && <Checkbox checked={isSelected} />}
      {columns.map((c) => (
        <span key={c.key} style={{ textAlign: c.align, minWidth: 0 }}>
          {c.render ? c.render(row) : String(cell(row, c.key) ?? '')}
        </span>
      ))}
    </div>
  );
}
