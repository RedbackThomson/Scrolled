import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SlotTile } from '../entity/SlotTile';
import { Scrolly, type ScrollyPose } from '../brand/Scrolly';

export interface EmptyStateProps {
  icon?: LucideIcon;
  hue?: number;
  title: string;
  body?: ReactNode;
  actions?: ReactNode;
  /** Use Scrolly instead of the slot trio: 'sleepy' for empty/offline, 'wave' for 404 */
  mascot?: ScrollyPose;
}

export function EmptyState({ icon, hue = 235, title, body, actions, mascot }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
        maxWidth: 420,
        margin: '0 auto',
        padding: '24px 0',
      }}
    >
      {mascot ? (
        <Scrolly pose={mascot} size={90} />
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ opacity: 0.6 }}>
            <SlotTile size={44} />
          </div>
          <SlotTile icon={icon} hue={hue} size={64} />
          <div style={{ opacity: 0.6 }}>
            <SlotTile size={44} />
          </div>
        </div>
      )}
      <span style={{ font: '600 20px var(--font-display)' }}>{title}</span>
      {body && (
        <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{body}</span>
      )}
      {actions && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
