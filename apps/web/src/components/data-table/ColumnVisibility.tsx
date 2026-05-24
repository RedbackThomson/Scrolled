import type { Table } from '@tanstack/react-table';
import { Columns3 } from 'lucide-react';

interface ColumnVisibilityProps<TData> {
  table: Table<TData>;
}

function headerLabel(id: string, header: unknown): string {
  if (typeof header === 'string') return header;
  return id;
}

export function ColumnVisibility<TData>({ table }: ColumnVisibilityProps<TData>) {
  const columns = table.getAllLeafColumns().filter((c) => c.getCanHide());
  if (columns.length === 0) return null;

  return (
    <details className="relative">
      <summary
        className="border-input bg-background hover:bg-accent inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
        // Prevent the summary marker on browsers that ignore list-style:none on summary.
        style={{ listStyle: 'none' }}
      >
        <Columns3 className="h-4 w-4" />
        Columns
      </summary>
      <div className="border-border bg-card text-card-foreground absolute right-0 z-20 mt-1 min-w-[12rem] rounded-md border p-2 shadow-md">
        <div className="text-muted-foreground px-1 pb-1 text-xs uppercase tracking-wide">
          Show columns
        </div>
        <ul className="space-y-0.5">
          {columns.map((col) => {
            const label = headerLabel(col.id, col.columnDef.header);
            return (
              <li key={col.id}>
                <label className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary h-3.5 w-3.5"
                    checked={col.getIsVisible()}
                    onChange={(e) => col.toggleVisibility(e.target.checked)}
                  />
                  <span className="capitalize">{label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
