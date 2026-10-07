import { Fragment, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { NavItem } from './NavItem';
import { Logo } from '../brand/Logo';
import { StatusDot } from '../feedback/StatusDot';

export interface SidebarChild {
  key: string;
  icon?: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export interface SidebarItem {
  key: string;
  icon: LucideIcon;
  label: string;
  chevron?: boolean;
  children?: SidebarChild[];
}

export interface SidebarProps {
  items: SidebarItem[];
  active?: string;
  onSelect?: (key: string) => void;
  /** Dataset name under the wordmark */
  subtitle?: string;
  children?: ReactNode;
  status?: 'ok' | 'offline' | 'warn' | 'danger';
  statusLabel?: string;
}

export function Sidebar({
  items,
  active = 'home',
  onSelect,
  subtitle,
  children,
  status = 'ok',
  statusLabel = 'Database OK',
}: SidebarProps) {
  return (
    <aside
      style={{
        position: 'relative',
        width: 'var(--sidebar-width)',
        flex: 'none',
        padding: '16px 12px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ padding: '2px 8px' }}>
        <Logo size={34} subtitle={subtitle} />
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it) => (
          <Fragment key={it.key}>
            <NavItem
              icon={it.icon}
              label={it.label}
              chevron={it.chevron}
              active={it.key === active}
              onClick={() => onSelect?.(it.key)}
            />
            {it.key === active && it.children && (
              <div
                style={{
                  margin: '2px 0 2px 26px',
                  paddingLeft: 12,
                  borderLeft: '2px solid var(--border-1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {it.children.map((c) => (
                  <NavItem
                    key={c.key}
                    size="sm"
                    icon={c.icon}
                    label={c.label}
                    active={c.active}
                    onClick={c.onClick}
                  />
                ))}
              </div>
            )}
          </Fragment>
        ))}
      </nav>
      {children}
      <div style={{ flex: 1 }} />
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 18,
          background: 'var(--surface-card)',
          boxShadow: 'var(--shadow-float)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <StatusDot status={status} label={statusLabel} />
        <span style={{ flex: 1 }} />
        <span style={{ font: '400 10.5px var(--font-body)', color: 'var(--text-2)' }}>
          Pre-alpha
        </span>
      </div>
    </aside>
  );
}
