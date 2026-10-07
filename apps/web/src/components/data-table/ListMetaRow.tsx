import type { ReactNode } from 'react';
import { BookmarkPlus, Pencil } from 'lucide-react';
import { Button } from '@scrolled/design';
import { countLabel } from './filterSummary';

const textButton =
  'sc-focus-ring inline-flex items-center gap-1 rounded-md text-[13px] font-bold text-[color:var(--accent-text)] hover:underline';

interface ListMetaRowProps {
  total: number;
  /** Rows before any filter; omitted while it loads */
  unfilteredTotal?: number;
  entityPlural: string;
  filtered: boolean;
  onClear: () => void;
  /** Omit to hide Save search */
  onSave?: () => void;
  /** Set when the loaded saved search no longer matches the filters */
  changed?: { name: string; onUpdate: () => void; onRevert: () => void; updating: boolean };
  /** Right-aligned controls, e.g. the view toggle */
  children?: ReactNode;
  /** Phone layout: "38 of 1,269" and a short Save */
  compact?: boolean;
}

/** "38 of 1,269 weapons" with Clear, Save search and the changed-from-saved actions, above the table. */
export function ListMetaRow({
  total,
  unfilteredTotal,
  entityPlural,
  filtered,
  onClear,
  onSave,
  changed,
  children,
  compact,
}: ListMetaRowProps) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-3.5 gap-y-2 max-md:[&>button]:min-h-11">
      <p className="text-muted-foreground text-[13px]" aria-live="polite">
        <b className="text-foreground font-bold tabular-nums">{total.toLocaleString()}</b>
        {filtered && unfilteredTotal != null
          ? compact
            ? ` of ${unfilteredTotal.toLocaleString()}`
            : ` of ${countLabel(unfilteredTotal, entityPlural)}`
          : ` ${total === 1 ? entityPlural.replace(/s$/, '') : entityPlural}`}
      </p>
      {filtered && (
        <button type="button" className={textButton} onClick={onClear}>
          Clear
        </button>
      )}
      {changed ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[color:var(--gold-edge)] bg-[var(--gold-glow)] px-2.5 py-0.5 text-[12.5px] font-bold">
            <Pencil className="h-[11px] w-[11px] text-[color:var(--gold-edge)]" />
            Changed from saved
          </span>
          <Button size="sm" onClick={changed.onUpdate} disabled={changed.updating}>
            Update “{changed.name}”
          </Button>
          <button type="button" className={textButton} onClick={changed.onRevert}>
            Revert
          </button>
        </>
      ) : (
        onSave && (
          <button type="button" className={textButton} onClick={onSave}>
            <BookmarkPlus className="h-3.5 w-3.5" />
            {compact ? 'Save' : 'Save search'}
          </button>
        )
      )}
      <div className="ml-auto flex items-center gap-1.5">{children}</div>
    </div>
  );
}
