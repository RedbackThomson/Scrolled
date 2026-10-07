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
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        font: '600 13.5px var(--font-body)',
        color: 'var(--text-1)',
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
    </label>
  );
}
