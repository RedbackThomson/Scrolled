import { useState, type ReactNode } from 'react';
import { BookmarkPlus } from 'lucide-react';
import type { CollectionEntityType } from '@/db/user';
import { SaveSearchPrompt } from './SaveSearchPrompt';

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
  entity?: CollectionEntityType;
  /** Right-aligned controls, e.g. the view toggle */
  children?: ReactNode;
}

/** "38 of 1,269 weapons" with Clear and Save search, above the table. */
export function ListMetaRow({
  total,
  unfilteredTotal,
  entityPlural,
  filtered,
  onClear,
  entity,
  children,
}: ListMetaRowProps) {
  const [saving, setSaving] = useState(false);
  const showOf = filtered && unfilteredTotal != null;
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-3.5 gap-y-2">
      <p className="text-muted-foreground text-[13px]" aria-live="polite">
        <b className="text-foreground font-bold tabular-nums">{total.toLocaleString()}</b>
        {showOf ? ` of ${unfilteredTotal.toLocaleString()} ` : ' '}
        {entityPlural}
      </p>
      {filtered && !saving && (
        <button type="button" className={textButton} onClick={onClear}>
          Clear
        </button>
      )}
      {filtered &&
        entity &&
        (saving ? (
          <SaveSearchPrompt entity={entity} onDone={() => setSaving(false)} />
        ) : (
          <button type="button" className={textButton} onClick={() => setSaving(true)}>
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save search
          </button>
        ))}
      <div className="ml-auto flex items-center gap-1.5">{children}</div>
    </div>
  );
}
