import { useState } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface NavItemProps {
  icon?: LucideIcon;
  label: string;
  active?: boolean;
  /** Has children (Items, Equips, Quests, Collections) */
  chevron?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function NavItem({ icon, label, active, chevron, onClick, size = 'md' }: NavItemProps) {
  const [hovered, setHovered] = useState(false);
  const sm = size === 'sm';
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: sm ? 30 : 36,
        padding: sm ? '0 10px' : '0 14px',
        borderRadius: 999,
        cursor: 'pointer',
        font: `600 ${sm ? 13 : 14}px var(--font-body)`,
        background: active ? 'var(--surface-card)' : 'transparent',
        color: active || hovered ? 'var(--text-1)' : 'var(--text-2)',
        boxShadow: active ? 'var(--shadow-float)' : 'none',
        transition: 'transform var(--dur-base) var(--ease-spring), color var(--dur-fast)',
        transform: hovered && !active ? 'scale(1.04)' : 'none',
      }}
    >
      {icon && <Icon icon={icon} size={sm ? 13 : 16} />}
      <span style={{ flex: 1 }}>{label}</span>
      {chevron && <Icon icon={ChevronRight} size={13} style={{ opacity: 0.55 }} />}
    </div>
  );
}
