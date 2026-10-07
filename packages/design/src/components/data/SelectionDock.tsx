import { BookmarkPlus, ChevronUp, GitCompare, X } from 'lucide-react';
import { Button } from '../core/Button';
import { Icon } from '../core/Icon';

export interface SelectionDockProps {
  /** Rows selected; with `allMatching` this is the total that matches */
  count: number;
  /** Rows matching the current filters */
  total: number;
  /** "Select all" is in effect rather than an explicit set of rows */
  allMatching?: boolean;
  onSelectAll: () => void;
  /** Opens the collection picker anchored above the dock */
  onAdd: (anchor: HTMLElement) => void;
  /** The picker is showing */
  addOpen?: boolean;
  /** Omit to hide Compare */
  onCompare?: () => void;
  onClear: () => void;
}

/** The floating bar that acts on selected table rows. Renders nothing with no selection. */
export function SelectionDock({
  count,
  total,
  allMatching,
  onSelectAll,
  onAdd,
  addOpen,
  onCompare,
  onClear,
}: SelectionDockProps) {
  if (count === 0) return null;
  const everything = allMatching || count >= total;
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 20,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        role="toolbar"
        aria-label="Selection"
        data-surface="tooltip"
        className="sc-toast"
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          whiteSpace: 'nowrap',
          padding: '8px 8px 8px 14px',
          borderRadius: 18,
          background: 'var(--surface-tooltip)',
          color: 'var(--text-on-tooltip)',
          boxShadow: '0 18px 40px rgba(10,20,50,.35)',
        }}
      >
        <span aria-live="polite" style={{ font: '600 15px var(--font-display)' }}>
          {allMatching
            ? `All ${count.toLocaleString()} selected`
            : `${count.toLocaleString()} selected`}
        </span>
        {!everything && (
          <button
            type="button"
            onClick={onSelectAll}
            className="sc-focus-ring"
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '2px 4px',
              background: 'none',
              color: 'inherit',
              opacity: 0.8,
              font: '700 12.5px var(--font-body)',
              cursor: 'pointer',
            }}
          >
            Select all {total.toLocaleString()}
          </button>
        )}
        <span aria-hidden style={{ width: 1, height: 22, background: 'var(--tooltip-line)' }} />
        {onCompare && (
          <button
            type="button"
            onClick={onCompare}
            className="sc-focus-ring"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 12px',
              border: 'none',
              borderRadius: 10,
              background: 'rgba(255,255,255,.1)',
              color: 'inherit',
              font: '700 13px var(--font-body)',
              cursor: 'pointer',
            }}
          >
            <Icon icon={GitCompare} size={14} />
            Compare
          </button>
        )}
        <Button
          size="sm"
          icon={BookmarkPlus}
          iconRight={ChevronUp}
          aria-haspopup="dialog"
          aria-expanded={addOpen ?? false}
          onClick={(e) => onAdd(e.currentTarget)}
        >
          Add to collection
        </Button>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={onClear}
          className="sc-focus-ring"
          style={{
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            border: 'none',
            borderRadius: 10,
            background: 'rgba(255,255,255,.1)',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          <Icon icon={X} size={14} />
        </button>
      </div>
    </div>
  );
}
