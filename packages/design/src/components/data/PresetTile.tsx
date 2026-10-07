import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

const ELLIPSIS = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;

export interface PresetTileProps {
  icon: LucideIcon;
  label: string;
  count?: number;
  hue?: number;
  active?: boolean;
  onClick?: () => void;
  /** Pill form for mobile / tight rows; sized to a 44px touch target */
  compact?: boolean;
  /** Shown after the count, e.g. "pinned" */
  meta?: string;
  /** A loaded saved search whose filters have since changed: a gold dot */
  dirty?: boolean;
}

export function PresetTile({
  icon,
  label,
  count,
  hue = 148,
  active,
  onClick,
  compact,
  meta,
  dirty,
}: PresetTileProps) {
  const [hovered, setHovered] = useState(false);
  const edge = active ? `oklch(0.66 0.14 ${hue})` : 'var(--border-1)';
  const shadow = active
    ? `0 0 0 3px oklch(0.66 0.14 ${hue} / .2), inset 0 -2px 0 oklch(0.66 0.14 ${hue} / .5)`
    : 'inset 0 -2px 0 var(--border-1)';
  return (
    <button
      type="button"
      className="sc-focus-ring"
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: compact ? 'auto' : '100%',
        minHeight: compact ? 44 : undefined,
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 6 : 9,
        padding: compact ? '4px 12px 5px 5px' : '8px 9px',
        borderRadius: compact ? 999 : 16,
        background: 'var(--surface-card)',
        border: `2px solid ${edge}`,
        boxShadow: shadow,
        cursor: 'pointer',
        transition: 'transform var(--dur-base) var(--ease-spring)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        position: 'relative',
        minWidth: 0,
      }}
    >
      {dirty && (
        <span
          aria-hidden
          className="animate-pop"
          style={{
            position: 'absolute',
            top: compact ? -2 : 5,
            right: compact ? -2 : 5,
            width: compact ? 9 : 8,
            height: compact ? 9 : 8,
            borderRadius: '50%',
            background: 'var(--gold)',
            boxShadow: '0 0 0 3px var(--gold-hi)',
          }}
        />
      )}
      {dirty && <span className="sr-only">Changed. </span>}
      <span
        style={{
          width: compact ? 22 : 32,
          height: compact ? 22 : 32,
          flex: 'none',
          borderRadius: compact ? '50%' : 10,
          display: 'grid',
          placeItems: 'center',
          background: `oklch(0.72 0.12 ${hue} / .22)`,
          color: `oklch(0.58 0.15 ${hue})`,
        }}
      >
        <Icon icon={icon} size={compact ? 12 : 16} />
      </span>
      {compact ? (
        <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{label}</span>
      ) : (
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.2 }}>
          <span style={{ font: '600 14px var(--font-display)', ...ELLIPSIS }}>{label}</span>
          {(count != null || meta) && (
            <span style={{ fontSize: 11.5, color: 'var(--text-2)', ...ELLIPSIS }}>
              {[
                count != null && `${count.toLocaleString()} ${count === 1 ? 'result' : 'results'}`,
                meta,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
