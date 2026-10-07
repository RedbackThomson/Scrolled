import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface PresetTileProps {
  icon: LucideIcon;
  label: string;
  count?: number;
  hue?: number;
  active?: boolean;
  onClick?: () => void;
  /** Pill form for mobile / tight rows */
  compact?: boolean;
}

export function PresetTile({
  icon,
  label,
  count,
  hue = 148,
  active,
  onClick,
  compact,
}: PresetTileProps) {
  const [hovered, setHovered] = useState(false);
  const edge = active ? `oklch(0.66 0.14 ${hue})` : 'var(--border-1)';
  const shadow = active
    ? `0 0 0 3px oklch(0.66 0.14 ${hue} / .2), inset 0 -2px 0 oklch(0.66 0.14 ${hue} / .5)`
    : 'inset 0 -2px 0 var(--border-1)';
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
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
      }}
    >
      <div
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
      </div>
      {compact ? (
        <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{label}</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.2 }}>
          <span style={{ font: '600 14px var(--font-display)' }}>{label}</span>
          {count != null && (
            <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{count} results</span>
          )}
        </div>
      )}
    </div>
  );
}
