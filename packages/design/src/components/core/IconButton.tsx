import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';
import { cn } from '../../lib/cn';
import { SPRING, useHoverPress } from '../../lib/interaction';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'style' | 'title'
> {
  icon: LucideIcon;
  /** Accessible label, and the tooltip unless `title` says otherwise */
  label: string;
  title?: string;
  /** sunken = muted fill for controls inside cards and toolbars */
  variant?: 'secondary' | 'ghost' | 'float' | 'sunken';
  size?: number;
  /** Fully round instead of the variant's rounded square */
  round?: boolean;
  /** Rotates 90° on hover instead of lifting, for close and clear buttons */
  spin?: boolean;
  /** Shows the accent ring, e.g. while its popover is open */
  active?: boolean;
}

export function IconButton({
  icon,
  label,
  title,
  variant = 'secondary',
  size = 36,
  round,
  spin,
  active,
  disabled,
  className,
  ...rest
}: IconButtonProps) {
  const { hovered, pressed, bind } = useHoverPress();
  const live = !disabled;
  const base: CSSProperties = {
    width: size,
    height: size,
    flex: 'none',
    display: 'grid',
    placeItems: 'center',
    cursor: live ? 'pointer' : 'default',
    opacity: live ? 1 : 0.4,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    color: 'var(--text-1)',
    transition: SPRING,
    transform: !live
      ? 'none'
      : pressed
        ? 'scale(.94)'
        : hovered
          ? spin
            ? 'rotate(90deg)'
            : 'translateY(-2px)'
          : 'none',
  };
  const v: CSSProperties = {
    secondary: {
      borderRadius: 12,
      background: 'var(--surface-card)',
      borderWidth: 2,
      borderStyle: 'solid',
      boxShadow: active
        ? 'inset 0 -2px 0 var(--accent-lo), var(--focus-ring)'
        : 'var(--shadow-btn-secondary)',
      borderColor: active ? 'var(--accent)' : 'var(--border-1)',
    },
    ghost: {
      borderRadius: 10,
      background: hovered && live ? 'var(--surface-sunken)' : 'transparent',
      color: hovered && live ? 'var(--text-1)' : 'var(--text-2)',
    },
    float: {
      borderRadius: 999,
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-float)',
      color: 'var(--text-2)',
    },
    sunken: {
      borderRadius: 9,
      background: 'var(--surface-sunken)',
      color: hovered && live ? 'var(--text-1)' : 'var(--text-2)',
    },
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      className={cn('sc-focus-ring', className)}
      aria-label={label}
      title={title ?? label}
      {...bind}
      style={{ ...base, ...v, ...(round ? { borderRadius: 999 } : {}) }}
    >
      <Icon icon={icon} size={Math.round(size * 0.45)} />
    </button>
  );
}
