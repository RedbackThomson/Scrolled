import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SlotTile } from './SlotTile';
import type { SlotTint } from '../../lib/interaction';

export interface EntityRowProps {
  src?: string;
  icon?: LucideIcon;
  tint?: SlotTint;
  hue?: number;
  name: ReactNode;
  subtitle?: string;
  /** Right-aligned meta, e.g. "Lvl 45", "×3", "Etc" */
  meta?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  /** First row in a ListCard (drops the divider) */
  first?: boolean;
  onClick?: () => void;
}

export function EntityRow({
  src,
  icon,
  tint,
  hue,
  name,
  subtitle,
  meta,
  trailing,
  selected,
  first,
  onClick,
}: EntityRowProps) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 46,
        padding: `5px 12px 5px ${h ? 16 : 12}px`,
        boxSizing: 'border-box',
        borderTop: first ? 'none' : '1.5px solid var(--surface-sunken)',
        background: selected || h ? 'var(--surface-sunken)' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background var(--dur-fast), padding var(--dur-base) var(--ease-spring)',
      }}
    >
      <SlotTile src={src} icon={icon} tint={tint} hue={hue} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
        {subtitle && <span style={{ color: 'var(--text-2)' }}> · {subtitle}</span>}
      </span>
      {meta && <span style={{ font: 'var(--type-meta)', color: 'var(--text-2)' }}>{meta}</span>}
      {trailing}
    </div>
  );
}
