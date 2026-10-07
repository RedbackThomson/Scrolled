import type { ReactNode } from 'react';
import { RollingNumber } from './RollingNumber';
import { isRollable } from './rollingDigits';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Use the stat tokens: var(--stat-hp), var(--stat-mp), var(--stat-exp) */
  color?: string;
  /** soft = tinted tile (grids, mobile strip); pill = colored label + value row (sidebars) */
  variant?: 'soft' | 'pill';
  /** Delays the number's roll; stagger tiles in a group by 30ms each. */
  rollDelayMs?: number;
}

export function StatTile({
  label,
  value,
  color = 'var(--text-2)',
  variant = 'soft',
  rollDelayMs,
}: StatTileProps) {
  const shown =
    (typeof value === 'string' || typeof value === 'number') && isRollable(String(value)) ? (
      <RollingNumber text={String(value)} delayMs={rollDelayMs} />
    ) : (
      value
    );
  if (variant === 'pill')
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 2px' }}>
        <span
          style={{
            width: 38,
            textAlign: 'center',
            font: '700 10.5px var(--font-body)',
            padding: '2px 0',
            borderRadius: 999,
            background: color,
            color: '#fff',
            boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.18)',
          }}
        >
          {label}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
      </div>
    );
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '9px 12px',
        borderRadius: 16,
        background: `color-mix(in oklab, ${color} 13%, transparent)`,
      }}
    >
      <span style={{ font: '800 11px var(--font-body)', color, letterSpacing: '.02em' }}>
        {label}
      </span>
      <span
        style={{ font: '600 19px/1.1 var(--font-display)', fontVariantNumeric: 'tabular-nums' }}
      >
        {shown}
      </span>
    </div>
  );
}
