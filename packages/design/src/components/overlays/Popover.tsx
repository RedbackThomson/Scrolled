import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface PopoverProps extends HTMLAttributes<HTMLDivElement> {
  /** Fixed width in px; leave unset to size with `className`. */
  width?: number;
  /** Notch pointing at the trigger */
  arrow?: 'top';
  /** Notch centre, in px from the panel's left edge. */
  arrowLeft?: number;
  footer?: ReactNode;
}

/** The rimmed floating panel behind menus and pickers. Positioning is the caller's. */
export const Popover = forwardRef<HTMLDivElement, PopoverProps>(function Popover(
  { children, width, arrow, arrowLeft = 37, footer, className, style, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'border-border bg-card text-card-foreground shadow-pop animate-tip relative rounded-xl border-2',
        className,
      )}
      style={{ width, transformOrigin: arrow === 'top' ? `${arrowLeft}px 0` : undefined, ...style }}
      {...props}
    >
      {arrow === 'top' && (
        <span
          aria-hidden
          className="border-border bg-card absolute -top-[9px] h-3.5 w-3.5 rotate-45 border-l-2 border-t-2"
          style={{ left: arrowLeft - 7 }}
        />
      )}
      {children}
      {footer && (
        <div className="bg-muted flex items-center justify-end gap-2 rounded-b-[16px] border-t-2 border-[var(--surface-sunken)] px-3 py-2.5">
          {footer}
        </div>
      )}
    </div>
  );
});

export interface PopoverItemProps {
  icon?: ReactNode;
  children?: ReactNode;
  trailing?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function PopoverItem({ icon, children, trailing, active, onClick }: PopoverItemProps) {
  return (
    <button
      type="button"
      className="sc-focus-ring"
      onClick={onClick}
      style={{
        width: '100%',
        border: 'none',
        color: 'inherit',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 10px',
        borderRadius: 12,
        cursor: 'pointer',
        background: active ? 'var(--surface-sunken)' : 'transparent',
        font: '600 13.5px var(--font-body)',
      }}
    >
      {icon}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {children}
      </span>
      {trailing}
    </button>
  );
}
