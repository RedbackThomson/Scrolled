import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type Variant = 'default' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'icon';

const variantStyles: Record<Variant, string> = {
  default:
    'bg-[image:var(--gradient-accent)] text-primary-foreground font-bold shadow-[var(--shadow-btn)]',
  secondary: 'bg-secondary text-secondary-foreground font-semibold hover:bg-accent',
  ghost: 'font-semibold hover:bg-muted hover:text-foreground',
  outline:
    'border-2 border-border bg-card text-foreground font-semibold shadow-[var(--shadow-btn-secondary)]',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 rounded-[10px] px-[11px] text-[12.5px]',
  md: 'h-9 rounded-md px-3.5 text-[13px]',
  icon: 'h-9 w-9 rounded-md',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'ease-spring focus-visible:border-primary focus-visible:ring-primary/30 inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-[transform,background-color,box-shadow,color] duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 active:translate-y-px active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
