import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';
import { SPRING, useHoverPress } from '../../lib/interaction';

const SIZES = {
  sm: { pad: '4px 11px 5px', font: 12.5, icon: 13, r: 10 },
  md: { pad: '6px 14px 7px', font: 13, icon: 14, r: 12 },
  lg: { pad: '9px 20px 11px', font: 15, icon: 16, r: 14 },
};

export interface ButtonProps {
  /** primary = glossy accent with a pressable lip; secondary = rimmed card; ghost; danger */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  children,
  disabled,
  fullWidth,
  onClick,
  style,
}: ButtonProps) {
  const { hovered, pressed, bind } = useHoverPress();
  const s = SIZES[size];
  const v: CSSProperties & { fontWeight: number } = {
    primary: {
      background: 'var(--gradient-accent)',
      color: 'var(--accent-fg)',
      boxShadow: 'var(--shadow-btn)',
      fontWeight: 700,
    },
    secondary: {
      background: 'var(--surface-card)',
      color: 'var(--text-1)',
      border: 'var(--border-rim)',
      boxShadow: 'var(--shadow-btn-secondary)',
      fontWeight: 600,
    },
    ghost: {
      background: hovered ? 'var(--surface-sunken)' : 'transparent',
      color: 'var(--text-1)',
      fontWeight: 600,
    },
    danger: {
      background: 'linear-gradient(180deg,var(--danger-hi),var(--danger))',
      color: '#fff',
      boxShadow: 'inset 0 -3px 0 var(--danger-lo), inset 0 1px 0 rgba(255,255,255,.4)',
      fontWeight: 700,
    },
  }[variant];
  const transform = disabled
    ? 'none'
    : pressed
      ? 'translateY(1px) scale(.98)'
      : hovered
        ? 'translateY(-2px)'
        : 'none';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      {...bind}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        padding: s.pad,
        borderRadius: s.r,
        border: 'none',
        font: `${v.fontWeight} ${s.font}px var(--font-body)`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: SPRING,
        transform,
        ...v,
        ...style,
      }}
    >
      {icon && <Icon icon={icon} size={s.icon} />}
      {children}
      {iconRight && <Icon icon={iconRight} size={s.icon} />}
    </button>
  );
}
