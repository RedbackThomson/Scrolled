import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface SectionHeaderProps {
  title: ReactNode;
  icon?: LucideIcon;
  count?: number | string;
  action?: ReactNode;
  /** Heading level: 1 = page title (36px), 2 = section, 3 = sub-section. */
  level?: 1 | 2 | 3;
  /** section (17px) for main content, panel (15px) for asides and sub-groups; level 3 defaults to panel. */
  size?: 'section' | 'panel';
  className?: string;
}

export function SectionHeader({
  title,
  icon,
  count,
  action,
  level = 2,
  size = level === 3 ? 'panel' : 'section',
  className,
}: SectionHeaderProps) {
  const H = (['h1', 'h2', 'h3'] as const)[level - 1];
  const font =
    level === 1
      ? 'var(--type-page-title)'
      : size === 'panel'
        ? 'var(--type-panel-title)'
        : 'var(--type-section)';
  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
    >
      <H style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, font }}>
        {icon && <Icon icon={icon} size={size === 'panel' ? 16 : 18} />}
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
