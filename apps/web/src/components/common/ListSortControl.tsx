import { ArrowDown, ArrowDownUp, ArrowUp } from 'lucide-react';
import { cn } from '@scrolled/design';
import { PopoverPanel } from '@/components/common/PopoverPanel';
import { usePopover } from '@/hooks/usePopover';
import type { SortDir, SortState } from '@/hooks/useListSort';

interface ListSortControlProps {
  fields: { id: string; label: string }[];
  value: SortState;
  onChange: (s: SortState) => void;
}

export function ListSortControl({ fields, value, onChange }: ListSortControlProps) {
  const { open, setOpen, close, coords, triggerRef, popoverRef } = usePopover();
  if (fields.length === 0) return null;

  const Icon = value.dir === 'asc' ? ArrowUp : value.dir === 'desc' ? ArrowDown : ArrowDownUp;
  const currentLabel = fields.find((f) => f.id === value.field)?.label ?? fields[0].label;
  const summaryTitle =
    value.dir === null
      ? 'Sort'
      : `Sorted by ${currentLabel} (${value.dir === 'asc' ? 'A→Z' : 'Z→A'})`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'border-input bg-background hover:bg-accent inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs font-medium normal-case tracking-normal max-md:h-11 max-md:px-3',
          value.dir !== null && 'border-primary/40 text-primary',
        )}
        aria-label={summaryTitle}
        title={summaryTitle}
      >
        <Icon className="h-3.5 w-3.5" />
        Sort
      </button>
      {open && (
        <PopoverPanel
          label="Sort"
          onClose={close}
          panelRef={popoverRef}
          coords={coords}
          widthClassName="min-w-[14rem]"
          align="right"
          className="p-2 max-md:px-4"
        >
          <label className="text-muted-foreground block px-1 pb-1 text-xs uppercase tracking-wide">
            Sort by
          </label>
          <select
            className="border-input bg-background mb-3 block w-full rounded-md border px-2 py-1 text-base sm:text-sm"
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
        </PopoverPanel>
      )}
    </>
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
        'inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs max-md:min-h-12',
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
