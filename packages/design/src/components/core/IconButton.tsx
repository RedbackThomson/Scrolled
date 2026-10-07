import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';
import { SPRING, useHoverPress } from '../../lib/interaction';

export interface IconButtonProps {
  icon: LucideIcon;
  /** Accessible label (also the tooltip) */
  label: string;
  variant?: 'secondary' | 'ghost' | 'float';
  size?: number;
  /** Shows the accent ring, e.g. while its popover is open */
  active?: boolean;
  onClick?: () => void;
}

export function IconButton({
  icon,
  label,
  variant = 'secondary',
  size = 36,
  active,
  onClick,
}: IconButtonProps) {
  const { hovered, pressed, bind } = useHoverPress();
  const base: CSSProperties = {
    width: size,
    height: size,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    color: 'var(--text-1)',
    transition: SPRING,
    transform: pressed ? 'scale(.94)' : hovered ? 'translateY(-2px)' : 'none',
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
      background: hovered ? 'var(--surface-sunken)' : 'transparent',
      color: 'var(--text-2)',
    },
    float: {
      borderRadius: 999,
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-float)',
      color: 'var(--text-2)',
    },
  }[variant];
  return (
    <button
      type="button"
      className="sc-focus-ring"
      aria-label={label}
      title={label}
      onClick={onClick}
      {...bind}
      style={{ ...base, ...v }}
    >
      <Icon icon={icon} size={Math.round(size * 0.45)} />
    </button>
  );
}
