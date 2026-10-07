import type { ReactNode } from 'react';
import { BookmarkPlus, type LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';

export interface HoverCardProps {
  src?: string;
  icon?: LucideIcon;
  title: string;
  badge?: ReactNode;
  children?: ReactNode;
  /** null hides the "Save to collection" footer */
  onSave?: (() => void) | null;
  width?: number;
}

export function HoverCard({
  src,
  icon,
  title,
  badge,
  children,
  onSave,
  width = 300,
}: HoverCardProps) {
  return (
    <div
      style={{
        width,
        borderRadius: 18,
        background: 'var(--surface-tooltip)',
        color: 'var(--text-on-tooltip)',
        boxShadow: 'var(--shadow-tooltip)',
        overflow: 'hidden',
        animation: 'sc-tip 460ms var(--ease-spring) both',
        transformOrigin: '20px 0',
      }}
    >
      <div style={{ display: 'flex', gap: 12, padding: 12 }}>
        <div
          style={{
            width: 64,
            height: 64,
            flex: 'none',
            borderRadius: 14,
            background: 'var(--surface-tooltip-tile)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {src ? (
            <img
              src={src}
              alt=""
              style={{
                width: 54,
                height: 54,
                objectFit: 'contain',
                animation: 'sc-bob 1.8s ease-in-out 600ms infinite',
              }}
            />
          ) : (
            icon && <Icon icon={icon} size={26} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ font: '600 17px var(--font-display)' }}>{title}</span>
            {badge}
          </div>
          {children}
        </div>
      </div>
      {onSave !== null && (
        <div
          onClick={onSave}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderTop: '1px solid var(--tooltip-line)',
            fontSize: 12,
            opacity: 0.85,
            cursor: 'pointer',
          }}
        >
          <Icon icon={BookmarkPlus} size={13} />
          Save to collection
        </div>
      )}
    </div>
  );
}
