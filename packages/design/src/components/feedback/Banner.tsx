import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface BannerProps {
  /** warn = data update, danger = sync blocked, dark = editing mode / update prompt */
  tone?: 'info' | 'warn' | 'danger' | 'dark';
  icon?: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}

export function Banner({ tone = 'info', icon, title, body, action }: BannerProps) {
  const [background, iconColor, edge] = {
    info: ['var(--surface-card)', 'var(--text-2)', 'var(--border-1)'],
    warn: [
      'linear-gradient(90deg, oklch(0.82 0.13 80 / .22), transparent)',
      'oklch(0.62 0.14 70)',
      'oklch(0.78 0.12 80 / .5)',
    ],
    danger: ['oklch(0.75 0.15 25 / .08)', 'var(--danger)', 'oklch(0.7 0.15 25 / .35)'],
    dark: ['var(--surface-tooltip)', 'var(--accent-hi)', 'transparent'],
  }[tone];
  const dark = tone === 'dark';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 18,
        background,
        border: `2px solid ${edge}`,
        color: dark ? 'var(--text-on-tooltip)' : 'var(--text-1)',
        boxShadow: dark ? '0 14px 30px rgba(10,20,50,.3)' : 'none',
      }}
    >
      {icon && (
        <span style={{ color: iconColor }}>
          <Icon icon={icon} size={18} />
        </span>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
        <span style={{ fontWeight: 700 }}>{title}</span>
        {body && (
          <span
            style={{
              fontSize: 12.5,
              color: dark ? 'inherit' : 'var(--text-2)',
              opacity: dark ? 0.8 : 1,
            }}
          >
            {body}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}
