import type { LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface SegmentedOption {
  value: string;
  label?: string;
  icon?: LucideIcon;
  title?: string;
}

export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange?: (v: string) => void;
  size?: 'sm' | 'md';
}

export function Segmented({ options, value, onChange, size = 'md' }: SegmentedProps) {
  const pad = size === 'sm' ? '4px 10px' : '5px 14px';
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 3,
        borderRadius: 12,
        background: 'var(--surface-sunken)',
        gap: 2,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.title || o.label}
            onClick={() => onChange?.(o.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: o.label ? pad : '6px 9px',
              border: 'none',
              borderRadius: 9,
              cursor: 'pointer',
              font: '700 13px var(--font-body)',
              color: on ? 'var(--text-1)' : 'var(--text-2)',
              background: on ? 'var(--surface-card)' : 'transparent',
              boxShadow: on ? '0 1px 0 var(--border-1), 0 2px 6px var(--shadow-color)' : 'none',
              transition: 'background var(--dur-fast)',
            }}
          >
            {o.icon && <Icon icon={o.icon} size={15} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
