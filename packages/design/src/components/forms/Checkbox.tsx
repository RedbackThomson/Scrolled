import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface CheckboxProps {
  checked?: boolean;
  label?: ReactNode;
  onChange?: (checked: boolean) => void;
}

export function Checkbox({ checked, label, onChange }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!checked}
      className="sc-focus-ring"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: 0,
        border: 'none',
        borderRadius: 8,
        background: 'none',
        cursor: 'pointer',
        font: '600 13.5px var(--font-body)',
        color: 'var(--text-1)',
        textAlign: 'left',
      }}
      onClick={() => onChange?.(!checked)}
    >
      <span
        style={{
          width: 20,
          height: 20,
          flex: 'none',
          borderRadius: 7,
          display: 'grid',
          placeItems: 'center',
          boxSizing: 'border-box',
          transition: 'transform var(--dur-base) var(--ease-spring)',
          transform: checked ? 'scale(1)' : 'scale(.96)',
          ...(checked
            ? {
                background: 'var(--gradient-accent)',
                color: 'var(--accent-fg)',
                boxShadow: 'inset 0 -2px 0 var(--accent-lo)',
              }
            : { border: '2px solid var(--border-1)', background: 'var(--surface-card)' }),
        }}
      >
        {checked && <Icon icon={Check} size={12} />}
      </span>
      {label}
    </button>
  );
}
