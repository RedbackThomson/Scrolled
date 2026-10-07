import type { MouseEvent, ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { Icon } from '../core/Icon';

const BOX = { sm: { box: 16, radius: 5, icon: 10 }, md: { box: 20, radius: 7, icon: 12 } };

export interface CheckboxIndicatorProps {
  checked?: boolean;
  indeterminate?: boolean;
  size?: keyof typeof BOX;
}

/**
 * The glossy box on its own, for a row or button that is itself the toggle and
 * carries the checked semantics (e.g. `aria-pressed`).
 */
export function CheckboxIndicator({ checked, indeterminate, size = 'md' }: CheckboxIndicatorProps) {
  const s = BOX[size];
  const on = checked || indeterminate;
  return (
    <span
      aria-hidden
      style={{
        width: s.box,
        height: s.box,
        flex: 'none',
        borderRadius: s.radius,
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
        transition: 'transform var(--dur-base) var(--ease-spring)',
        transform: on ? 'scale(1)' : 'scale(.96)',
        ...(on
          ? {
              background: 'var(--gradient-accent)',
              color: 'var(--accent-fg)',
              boxShadow: 'inset 0 -2px 0 var(--accent-lo)',
            }
          : { border: '2px solid var(--border-1)', background: 'var(--surface-card)' }),
      }}
    >
      {indeterminate ? (
        <Icon icon={Minus} size={s.icon} />
      ) : (
        checked && <Icon icon={Check} size={s.icon} />
      )}
    </span>
  );
}

export interface CheckboxProps extends CheckboxIndicatorProps {
  label?: ReactNode;
  onChange?: (checked: boolean) => void;
  /** Accessible name when there's no visible `label`. */
  'aria-label'?: string;
  title?: string;
  disabled?: boolean;
  /** Runs before toggling, e.g. to stop a click reaching a row link underneath. */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function Checkbox({
  checked,
  indeterminate,
  size = 'md',
  label,
  onChange,
  'aria-label': ariaLabel,
  title,
  disabled,
  onClick,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : !!checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      className="sc-focus-ring"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: 0,
        border: 'none',
        borderRadius: 8,
        background: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        font: '600 13.5px var(--font-body)',
        color: 'var(--text-1)',
        textAlign: 'left',
      }}
      onClick={(e) => {
        onClick?.(e);
        onChange?.(!checked);
      }}
    >
      <CheckboxIndicator checked={checked} indeterminate={indeterminate} size={size} />
      {label}
    </button>
  );
}
