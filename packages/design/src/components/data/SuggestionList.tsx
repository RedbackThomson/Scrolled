import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';
import { Kbd } from '../core/Kbd';

export interface SuggestionItem {
  id: string;
  icon: LucideIcon;
  hue: number;
  /** "Weak against" */
  label: string;
  /** "Fire" */
  value: ReactNode;
  /** Right-aligned, e.g. "14 weapons" */
  count?: ReactNode;
}

export interface SuggestionListProps {
  items: readonly SuggestionItem[];
  /** Highlighted row; shows the ↵ keycap */
  activeIndex?: number;
  onSelect?: (item: SuggestionItem, index: number) => void;
  onHighlight?: (index: number) => void;
  /** Mono examples in a "Try:" footer */
  examples?: readonly string[];
  onExample?: (example: string) => void;
  /** Row ids become `${idPrefix}-${index}` for aria-activedescendant */
  idPrefix?: string;
  /** lg = 52px touch rows for mobile */
  size?: 'md' | 'lg';
  /** Drop the popover surface to embed the rows in another panel */
  bare?: boolean;
  'aria-label'?: string;
}

/** Rows of "Column value" suggestions under a search field. The field keeps focus; rows are options. */
export function SuggestionList({
  items,
  activeIndex = -1,
  onSelect,
  onHighlight,
  examples,
  onExample,
  idPrefix = 'sc-suggestion',
  size = 'md',
  bare,
  'aria-label': ariaLabel = 'Suggestions',
}: SuggestionListProps) {
  const lg = size === 'lg';
  const tile = lg ? 32 : 26;
  const rows = items.length > 0 && (
    <div
      role="listbox"
      id={`${idPrefix}-list`}
      aria-label={ariaLabel}
      style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: bare ? 0 : 6 }}
    >
      {items.map((item, i) => {
        const active = i === activeIndex;
        return (
          <div
            key={item.id}
            id={`${idPrefix}-${i}`}
            role="option"
            aria-selected={active}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHighlight?.(i)}
            onClick={() => onSelect?.(item, i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: lg ? 12 : 10,
              minHeight: lg ? 52 : undefined,
              padding: lg ? '0 12px' : '6px 10px',
              borderRadius: lg ? 14 : 12,
              cursor: 'pointer',
              background: active ? 'var(--surface-row-hover)' : 'transparent',
              boxShadow: active ? 'inset 0 0 0 2px var(--border-1)' : 'none',
            }}
          >
            <span
              aria-hidden
              style={{
                width: tile,
                height: tile,
                flex: 'none',
                borderRadius: lg ? 10 : 8,
                display: 'grid',
                placeItems: 'center',
                background: `oklch(0.72 0.12 ${item.hue} / .22)`,
                color: `oklch(0.56 0.14 ${item.hue})`,
                boxShadow: 'var(--shadow-slot)',
              }}
            >
              <Icon icon={item.icon} size={lg ? 15 : 12} />
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: lg ? 15 : 13.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: 'var(--text-2)' }}>{item.label}</span>{' '}
              <b style={{ fontWeight: 700 }}>{item.value}</b>
            </span>
            {item.count != null && (
              <span style={{ fontSize: lg ? 13 : 11.5, color: 'var(--text-2)', flex: 'none' }}>
                {item.count}
              </span>
            )}
            {active && !lg && <Kbd>↵</Kbd>}
          </div>
        );
      })}
    </div>
  );
  const footer = examples && examples.length > 0 && (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 14,
        padding: '8px 14px',
        borderTop: items.length > 0 ? '2px solid var(--surface-sunken)' : 'none',
        background: 'var(--surface-sunken)',
        borderRadius: bare ? 14 : '0 0 16px 16px',
        fontSize: 12,
        color: 'var(--text-2)',
      }}
    >
      <span>Try:</span>
      {examples.map((ex) =>
        onExample ? (
          <button
            key={ex}
            type="button"
            className="sc-focus-ring"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExample(ex)}
            style={{
              border: 'none',
              padding: 0,
              borderRadius: 4,
              background: 'none',
              color: 'var(--text-1)',
              font: '500 11.5px var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            {ex}
          </button>
        ) : (
          <span key={ex} style={{ color: 'var(--text-1)', font: '500 11.5px var(--font-mono)' }}>
            {ex}
          </span>
        ),
      )}
    </div>
  );
  if (!rows && !footer) return null;
  if (bare)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows}
        {footer}
      </div>
    );
  return (
    <div
      className="animate-tip"
      style={{
        borderRadius: 18,
        border: 'var(--border-rim)',
        background: 'var(--surface-card)',
        color: 'var(--text-1)',
        boxShadow: 'var(--shadow-pop)',
        overflow: 'hidden',
        transformOrigin: '40px 0',
      }}
    >
      {rows}
      {footer}
    </div>
  );
}
