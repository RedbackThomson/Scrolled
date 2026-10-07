import type { CSSProperties, ReactNode } from 'react';

export interface PopoverProps {
  children?: ReactNode;
  width?: number;
  /** Notch pointing at the trigger */
  arrow?: 'top';
  footer?: ReactNode;
  style?: CSSProperties;
}

export function Popover({ children, width = 320, arrow, footer, style }: PopoverProps) {
  return (
    <div
      style={{
        position: 'relative',
        width,
        borderRadius: 18,
        background: 'var(--surface-card)',
        border: 'var(--border-rim)',
        boxShadow: 'var(--shadow-pop)',
        animation: 'sc-tip 460ms var(--ease-spring) both',
        transformOrigin: arrow === 'top' ? '30px 0' : 'center top',
        ...style,
      }}
    >
      {arrow === 'top' && (
        <span
          style={{
            position: 'absolute',
            left: 30,
            top: -9,
            width: 14,
            height: 14,
            background: 'var(--surface-card)',
            borderLeft: '2px solid var(--border-1)',
            borderTop: '2px solid var(--border-1)',
            transform: 'rotate(45deg)',
          }}
        />
      )}
      {children}
      {footer && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderTop: '2px solid var(--surface-sunken)',
            background: 'var(--surface-sunken)',
            borderRadius: '0 0 16px 16px',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

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
