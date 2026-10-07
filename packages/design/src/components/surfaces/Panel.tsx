import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface PanelProps {
  title?: string;
  icon?: LucideIcon;
  count?: number | string;
  action?: ReactNode;
  children?: ReactNode;
  padding?: number;
  /** rim = default card; float = on the backdrop without a border; sunken = inset group */
  variant?: 'rim' | 'float' | 'sunken';
  style?: CSSProperties;
}

export function Panel({
  title,
  icon,
  count,
  action,
  children,
  padding = 16,
  variant = 'rim',
  style,
}: PanelProps) {
  const v: CSSProperties = {
    rim: {
      background: 'var(--surface-card)',
      border: 'var(--border-rim)',
      boxShadow: 'var(--shadow-rim)',
    },
    float: { background: 'var(--surface-card)', boxShadow: 'var(--shadow-float)' },
    sunken: { background: 'var(--surface-sunken)' },
  }[variant];
  return (
    <section
      style={{
        borderRadius: 16,
        ...v,
        padding,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <Icon icon={icon} size={16} />}
          <h3 style={{ margin: 0, font: 'var(--type-panel-title)', flex: 1 }}>
            {title}
            {count != null && (
              <span style={{ font: 'var(--type-meta)', color: 'var(--text-2)', marginLeft: 6 }}>
                {count}
              </span>
            )}
          </h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
