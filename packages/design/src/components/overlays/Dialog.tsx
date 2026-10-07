import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface DialogProps {
  open?: boolean;
  title?: string;
  subtitle?: string;
  /** Usually a SlotTile */
  icon?: ReactNode;
  children?: ReactNode;
  /** Buttons; footer sits on a sunken fill */
  footer?: ReactNode;
  width?: number;
  /** null hides the close button */
  onClose?: (() => void) | null;
  /** Render without the fixed scrim (docs, nesting) */
  inline?: boolean;
}

export function Dialog({
  open = true,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = 500,
  onClose,
  inline,
}: DialogProps) {
  if (!open) return null;
  const card = (
    <div
      role="dialog"
      aria-label={title}
      style={{
        width,
        maxWidth: '100%',
        borderRadius: 22,
        background: 'var(--surface-card)',
        border: 'var(--border-rim)',
        boxShadow: 'var(--shadow-pop)',
        overflow: 'hidden',
        animation: 'sc-modal var(--dur-modal) var(--ease-spring) both',
      }}
    >
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px 14px 18px',
            borderBottom: '2px solid var(--surface-sunken)',
          }}
        >
          {icon}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ font: '600 19px var(--font-display)' }}>{title}</span>
            {subtitle && <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{subtitle}</span>}
          </div>
          {onClose !== null && (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                border: 'none',
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--surface-sunken)',
                color: 'var(--text-2)',
                cursor: 'pointer',
                transition: 'transform var(--dur-base) var(--ease-spring)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'rotate(90deg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
              }}
            >
              <Icon icon={X} size={16} />
            </button>
          )}
        </div>
      )}
      <div style={{ padding: '16px 18px' }}>{children}</div>
      {footer && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 16px',
            borderTop: '2px solid var(--surface-sunken)',
            background: 'var(--surface-sunken)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
  if (inline) return card;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 80,
        background: 'var(--surface-scrim)',
        animation: 'sc-fade 260ms ease-out both',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {card}
    </div>
  );
}
