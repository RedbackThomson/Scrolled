import type { ReactNode } from 'react';
import { Scrolly } from '../brand/Scrolly';

export interface HopLoaderProps {
  /** Visible and announced; three bouncing dots follow it. */
  label?: string;
  /** Height of the hopping figure in px. */
  size?: number;
  /** Figure to hop instead of Scrolly, e.g. the entity's own sprite. */
  children?: ReactNode;
}

// Waits before appearing so loads that finish quickly never flash a loader.
const APPEAR = 'sc-fade 200ms ease-out 150ms both';

/** Loading state: a figure hopping over its shadow, with "Loading…" dots. */
export function HopLoader({ label = 'Loading', size = 64, children }: HopLoaderProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        animation: APPEAR,
      }}
    >
      <div aria-hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="sc-hop" style={{ transformOrigin: '50% 100%' }}>
          {children ?? <Scrolly pose="read" size={size} animate={false} shadow={false} />}
        </div>
        <span
          className="sc-hop-shadow"
          style={{
            width: size * 0.6,
            height: Math.max(6, size * 0.1),
            marginTop: 4,
            borderRadius: '50%',
            background: 'var(--shadow-color)',
          }}
        />
      </div>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          font: '600 13px var(--font-body)',
          color: 'var(--text-2)',
        }}
      >
        {label}
        <span aria-hidden style={{ display: 'inline-flex', gap: 2, marginLeft: 3 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="sc-dot"
              style={{
                display: 'inline-block',
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'currentColor',
              }}
            />
          ))}
        </span>
      </span>
    </div>
  );
}
