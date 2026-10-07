import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  count?: number | string;
  action?: ReactNode;
  /** 1 = page title (36px), 2 = section (17px) */
  level?: 1 | 2;
}

export function SectionHeader({ title, icon, count, action, level = 2 }: SectionHeaderProps) {
  const H = level === 1 ? 'h1' : 'h2';
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
    >
      <H
        style={{
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          font: level === 1 ? 'var(--type-page-title)' : 'var(--type-section)',
        }}
      >
        {icon && <Icon icon={icon} size={18} />}
        {title}
        {count != null && (
          <span
            style={{
              font: '500 12px var(--font-body)',
              color: 'var(--text-2)',
              padding: '1px 8px',
              borderRadius: 999,
              background: 'var(--surface-sunken)',
            }}
          >
            {count}
          </span>
        )}
      </H>
      {action}
    </div>
  );
}
