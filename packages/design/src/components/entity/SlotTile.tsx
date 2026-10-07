import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';
import type { SlotTint } from '../../lib/interaction';

const TINTS: Record<SlotTint, string> = {
  etc: 'var(--tint-etc)',
  use: 'var(--tint-use)',
  equip: 'var(--tint-equip)',
  cash: 'var(--tint-cash)',
  mob: 'var(--tint-mob)',
  neutral: 'var(--surface-sunken)',
};

export interface SlotTileProps {
  /** Sprite URL (item/mob/npc icon) */
  src?: string;
  /** Lucide icon when there's no sprite (maps, quests, collections) */
  icon?: LucideIcon;
  /** Item category tint behind the sprite */
  tint?: SlotTint;
  /** Entity hue (use --hue-* values) for icon tiles; overrides tint */
  hue?: number;
  size?: number;
  /** Radial highlight for page-header sprites */
  spotlight?: boolean;
  rimmed?: boolean;
  alt?: string;
  /** Custom content (e.g. a lazily loaded sprite); takes precedence over `src` and `icon` */
  children?: ReactNode;
}

export function SlotTile({
  src,
  icon,
  tint = 'neutral',
  hue,
  size = 36,
  spotlight,
  rimmed,
  alt = '',
  children,
}: SlotTileProps) {
  const r = Math.round(size * 0.28);
  const bg =
    hue != null
      ? `oklch(0.72 0.12 ${hue} / .2)`
      : spotlight
        ? `radial-gradient(circle at 50% 35%, var(--surface-card), ${TINTS[tint]} 70%)`
        : TINTS[tint];
  return (
    <div
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: r,
        background: bg,
        boxShadow: 'var(--shadow-slot)',
        border: rimmed ? 'var(--border-rim)' : 'none',
        boxSizing: 'border-box',
        display: 'grid',
        placeItems: 'center',
        color: hue != null ? `oklch(0.56 0.14 ${hue})` : 'var(--text-2)',
      }}
    >
      {children ??
        (src ? (
          <img
            src={src}
            alt={alt}
            style={{ width: size * 0.84, height: size * 0.84, objectFit: 'contain' }}
          />
        ) : icon ? (
          <Icon icon={icon} size={Math.round(size * 0.46)} />
        ) : null)}
    </div>
  );
}
