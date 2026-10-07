import type { ReactNode } from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface ToastProps {
  icon?: LucideIcon;
  children?: ReactNode;
  /** e.g. "Undo" */
  action?: string;
  onAction?: () => void;
  /** ms the action stays available; 0 hides the bar */
  duration?: number;
}

export function Toast({ icon = Check, children, action, onAction, duration = 4200 }: ToastProps) {
  return (
    <div
      role="status"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px 12px 10px',
        borderRadius: 16,
        background: 'var(--surface-tooltip)',
        color: 'var(--text-on-tooltip)',
        boxShadow: '0 14px 30px rgba(10,20,50,.35)',
        overflow: 'hidden',
        animation: 'sc-toast 600ms var(--ease-spring) both',
        minWidth: 280,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--accent)',
          color: 'var(--accent-fg)',
          animation: 'sc-pop 500ms var(--ease-spring) 300ms both',
        }}
      >
        <Icon icon={icon} size={15} />
      </span>
      <span style={{ flex: 1, font: '600 13.5px var(--font-body)' }}>{children}</span>
      {action && (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: 'none',
            background: 'none',
            font: '700 13px var(--font-body)',
            color: 'var(--accent-hi)',
            cursor: 'pointer',
          }}
        >
          {action}
        </button>
      )}
      {duration > 0 && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: 3,
            width: '100%',
            background: 'var(--accent-hi)',
            transformOrigin: 'left',
            animation: `sc-toastbar ${duration}ms linear 700ms both`,
          }}
        />
      )}
    </div>
  );
}
