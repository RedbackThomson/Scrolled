import type { ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface FilterChipProps {
  label?: string;
  value?: ReactNode;
  /** Edge color hue; vary per column */
  hue?: number;
  onRemove?: () => void;
  /** Render the dashed + "add filter" chip instead */
  add?: boolean;
  onClick?: () => void;
}

export function FilterChip({ label, value, hue = 235, onRemove, add, onClick }: FilterChipProps) {
  if (add)
    return (
      <button
        type="button"
        aria-label="Add filter"
        onClick={onClick}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          border: '2px dashed var(--border-1)',
          background: 'transparent',
          color: 'var(--text-2)',
          cursor: 'pointer',
        }}
      >
        <Icon icon={Plus} size={13} />
      </button>
    );
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 6px 4px 10px',
        borderRadius: 999,
        background: 'var(--surface-card)',
        border: `2px solid oklch(0.7 0.12 ${hue} / .6)`,
        fontSize: 12.5,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{label}</span>
      <b>{value}</b>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        style={{
          width: 18,
          height: 18,
          border: 'none',
          padding: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--surface-sunken)',
          color: 'var(--text-2)',
          cursor: 'pointer',
        }}
      >
        <Icon icon={X} size={11} />
      </button>
    </span>
  );
}
