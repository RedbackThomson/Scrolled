import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface ToastProps {
  icon?: LucideIcon;
  children?: ReactNode;
  /** e.g. "Undo" */
  action?: string;
  onAction?: () => void;
  /** ms the toast stays up once its entrance settles; 0 keeps it until dismissed */
  duration?: number;
  /** Called when `duration` runs out. Hovering or focusing the toast pauses it. */
  onExpire?: () => void;
}

// The countdown bar starts draining once the entrance has settled.
const BAR_DELAY_MS = 700;

export function Toast({
  icon = Check,
  children,
  action,
  onAction,
  duration = 4200,
  onExpire,
}: ToastProps) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration + BAR_DELAY_MS);
  const startedAt = useRef(0);

  // A timer rather than the bar's animationend: with motion off the bar's
  // animation collapses to nothing, but the toast must still stay readable.
  useEffect(() => {
    if (duration <= 0 || paused || !onExpire) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(onExpire, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [duration, paused, onExpire]);

  return (
    <div
      role="status"
      className="sc-toast"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
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
        minWidth: 280,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          flex: 'none',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--accent)',
          color: 'var(--accent-fg)',
          animation: 'sc-pop 500ms var(--ease-spring) 400ms both',
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
          aria-hidden
          className="sc-toast-bar"
          style={
            {
              position: 'absolute',
              left: 0,
              bottom: 0,
              height: 3,
              width: '100%',
              background: 'var(--accent-hi)',
              '--toast-ms': `${duration}ms`,
              animationPlayState: paused ? 'paused' : 'running',
            } as CSSProperties
          }
        />
      )}
    </div>
  );
}
