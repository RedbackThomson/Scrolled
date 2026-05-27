import { ArrowDown, ArrowDownUp, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortDir, SortState } from '@/hooks/useListSort';

interface ListSortControlProps {
  fields: { id: string; label: string }[];
  value: SortState;
  onChange: (s: SortState) => void;
}

export function ListSortControl({ fields, value, onChange }: ListSortControlProps) {
  if (fields.length === 0) return null;

  const Icon = value.dir === 'asc' ? ArrowUp : value.dir === 'desc' ? ArrowDown : ArrowDownUp;
  const currentLabel = fields.find((f) => f.id === value.field)?.label ?? fields[0].label;
  const summaryTitle =
    value.dir === null
      ? 'Sort'
      : `Sorted by ${currentLabel} (${value.dir === 'asc' ? 'A→Z' : 'Z→A'})`;

  return (
    <details className="relative">
      <summary
        className={cn(
          'border-input bg-background hover:bg-accent inline-flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2 text-xs font-medium normal-case tracking-normal',
          value.dir !== null && 'border-primary/40 text-primary',
        )}
        style={{ listStyle: 'none' }}
        aria-label={summaryTitle}
        title={summaryTitle}
      >
        <Icon className="h-3.5 w-3.5" />
        Sort
      </summary>
      <div className="border-border bg-card text-card-foreground absolute right-0 z-20 mt-1 min-w-[14rem] rounded-md border p-2 shadow-md">
        <label className="text-muted-foreground block px-1 pb-1 text-xs uppercase tracking-wide">
          Sort by
        </label>
        <select
          className="border-input bg-background mb-3 block w-full rounded-md border px-2 py-1 text-sm"
          value={value.field}
          onChange={(e) => onChange({ field: e.target.value, dir: value.dir ?? 'asc' })}
        >
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <div className="text-muted-foreground px-1 pb-1 text-xs uppercase tracking-wide">
          Direction
        </div>
        <div className="grid grid-cols-3 gap-1">
          <DirButton
            current={value.dir}
            dir="asc"
            onChange={(d) => onChange({ field: value.field, dir: d })}
            label="Asc"
            icon={ArrowUp}
          />
          <DirButton
            current={value.dir}
            dir="desc"
            onChange={(d) => onChange({ field: value.field, dir: d })}
            label="Desc"
            icon={ArrowDown}
          />
          <DirButton
            current={value.dir}
            dir={null}
            onChange={(d) => onChange({ field: value.field, dir: d })}
            label="None"
            icon={ArrowDownUp}
          />
        </div>
      </div>
    </details>
  );
}

interface DirButtonProps {
  current: SortDir;
  dir: SortDir;
  label: string;
  icon: typeof ArrowUp;
  onChange: (d: SortDir) => void;
}

function DirButton({ current, dir, label, icon: Icon, onChange }: DirButtonProps) {
  const active = current === dir;
  return (
    <button
      type="button"
      onClick={() => onChange(dir)}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-input bg-background hover:bg-accent',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
