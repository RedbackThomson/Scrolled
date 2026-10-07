import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SlotTile } from './SlotTile';
import type { SlotTint } from '../../lib/interaction';

export interface EntityCardStat {
  label: string;
  value: ReactNode;
  color?: string;
}

export interface EntityCardProps {
  /** Custom slot, e.g. a lazily loaded sprite; replaces `src`/`icon`/`tint`/`hue` */
  media?: ReactNode;
  src?: string;
  icon?: LucideIcon;
  tint?: SlotTint;
  hue?: number;
  name: ReactNode;
  /** Tag beside the name, e.g. a Boss or Cash chip */
  badge?: ReactNode;
  subtitle?: ReactNode;
  /** 2×2 stat grid; color the headline stat (ATK = var(--stat-hp)) */
  stats?: EntityCardStat[];
  tags?: readonly string[];
  /** Accent border, for a card picked in a multi-select */
  selected?: boolean;
  onClick?: () => void;
  /** Lift on hover. Turn off when the card's container animates hover itself. */
  lift?: boolean;
}

export function EntityCard({
  media,
  src,
  icon,
  tint = 'equip',
  hue,
  name,
  badge,
  subtitle,
  stats = [],
  tags = [],
  selected,
  onClick,
  lift = true,
}: EntityCardProps) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        borderRadius: 16,
        background: 'var(--surface-card)',
        border: selected ? '2px solid var(--accent)' : 'var(--border-rim)',
        boxShadow: 'var(--shadow-rim)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform var(--dur-base) var(--ease-spring)',
        transform: lift && h ? 'translateY(-4px) rotate(-.4deg)' : 'none',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {media ?? <SlotTile src={src} icon={icon} tint={tint} hue={hue} size={60} spotlight />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ font: '600 15px/1.2 var(--font-display)', overflowWrap: 'anywhere' }}>
              {name}
            </span>
            {badge}
          </div>
          {subtitle && (
            <span style={{ font: 'var(--type-meta)', color: 'var(--text-2)' }}>{subtitle}</span>
          )}
        </div>
      </div>
      {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 9px',
                borderRadius: 9,
                fontSize: 12,
                background: s.color
                  ? `color-mix(in oklab, ${s.color} 12%, transparent)`
                  : 'var(--surface-sunken)',
              }}
            >
              <span style={{ fontWeight: 700, color: s.color || 'var(--text-2)' }}>{s.label}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{s.value}</b>
            </div>
          ))}
        </div>
      )}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <span
              key={t}
              style={{
                font: 'var(--type-meta)',
                color: 'var(--text-2)',
                padding: '1px 8px',
                borderRadius: 999,
                border: '1.5px solid var(--border-1)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
