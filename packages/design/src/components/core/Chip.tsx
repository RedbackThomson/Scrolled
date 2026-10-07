import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { Icon } from './Icon';

export interface ChipProps {
  /** gold = Boss badge; hue = entity-colored with `hue` (0–360) */
  tone?: 'neutral' | 'accent' | 'gold' | 'danger' | 'ok' | 'hue';
  hue?: number;
  icon?: LucideIcon;
  children?: ReactNode;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function Chip({ tone = 'neutral', hue, icon, children, onRemove, size = 'sm' }: ChipProps) {
  const [background, color] = {
    neutral: ['var(--surface-sunken)', 'var(--text-2)'],
    accent: ['var(--accent-glow)', 'var(--accent-text)'],
    gold: ['var(--gradient-gold)', 'var(--gold-fg)'],
    danger: ['oklch(0.7 0.18 25 / .14)', 'oklch(var(--chip-fg-l) 0.17 25)'],
    ok: ['var(--ok-halo)', 'oklch(var(--chip-fg-l) 0.14 148)'],
    hue: [`oklch(0.72 0.12 ${hue} / .2)`, `oklch(var(--chip-fg-l) 0.14 ${hue})`],
  }[tone];
  const fs = size === 'md' ? 12.5 : 11.5;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
        padding: onRemove ? '2px 4px 2px 9px' : '2px 9px',
        borderRadius: 999,
        font: `700 ${fs}px var(--font-body)`,
        background,
        color,
        boxShadow:
          tone === 'gold'
            ? 'inset 0 -2px 0 rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.6)'
            : 'none',
      }}
    >
      {icon && <Icon icon={icon} size={fs - 0.5} />}
      {children}
      {onRemove && (
        <button
          type="button"
          className="sc-focus-ring"
          onClick={onRemove}
          aria-label="Remove"
          style={{
            width: 16,
            height: 16,
            border: 'none',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--surface-card)',
            color: 'var(--text-2)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Icon icon={X} size={10} />
        </button>
      )}
    </span>
  );
}
