import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';
import { cn } from '../../lib/cn';

const VARIANTS = {
  primary:
    'bg-[image:var(--gradient-accent)] text-primary-foreground font-bold shadow-[var(--shadow-btn)]',
  secondary:
    'border-2 border-border bg-card text-foreground font-semibold shadow-[var(--shadow-btn-secondary)]',
  ghost: 'font-semibold hover:bg-muted hover:text-foreground',
  danger:
    'bg-[image:linear-gradient(180deg,var(--danger-hi),var(--danger))] text-white font-bold shadow-[inset_0_-3px_0_var(--danger-lo),inset_0_1px_0_rgba(255,255,255,.4)]',
};

const SIZES = {
  sm: { className: 'h-8 rounded-[10px] px-[11px] text-[12.5px]', icon: 13 },
  md: { className: 'h-9 rounded-md px-3.5 text-[13px]', icon: 14 },
  lg: { className: 'h-11 rounded-[14px] px-5 text-[15px]', icon: 16 },
  icon: { className: 'h-9 w-9 rounded-md', icon: 16 },
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = glossy accent with a pressable lip; secondary = rimmed card; ghost; danger */
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', icon, iconRight, fullWidth, children, ...props },
    ref,
  ) => {
    const s = SIZES[size];
    return (
      <button
        ref={ref}
        className={cn(
          'ease-spring focus-visible:border-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-[transform,background-color,box-shadow,color] duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent-glow)] active:translate-y-px active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
          VARIANTS[variant],
          s.className,
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {icon && <Icon icon={icon} size={s.icon} />}
        {children}
        {iconRight && <Icon icon={iconRight} size={s.icon} />}
      </button>
    );
  },
);
Button.displayName = 'Button';
