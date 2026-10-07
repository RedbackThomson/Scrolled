import { Fragment } from 'react';
import { Search, type LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';
import { Kbd } from '../core/Kbd';
import { SlotTile } from '../entity/SlotTile';
import type { SlotTint } from '../../lib/interaction';

export interface PaletteItem {
  key: string;
  label: string;
  meta?: string;
  src?: string;
  icon?: LucideIcon;
  hue?: number;
  tint?: SlotTint;
}

export interface CommandPaletteProps {
  query?: string;
  /** e.g. This page, Recent, Results, Go to */
  groups?: { title: string; items: PaletteItem[] }[];
  selected?: string;
  width?: number;
}

const hint = { display: 'flex', gap: 4, alignItems: 'center' } as const;

export function CommandPalette({
  query = '',
  groups = [],
  selected,
  width = 600,
}: CommandPaletteProps) {
  return (
    <div
      style={{
        width,
        maxWidth: '100%',
        borderRadius: 22,
        background: 'var(--surface-card)',
        border: 'var(--border-rim)',
        boxShadow: 'var(--shadow-pop)',
        overflow: 'hidden',
        animation: 'sc-modal var(--dur-modal) var(--ease-spring) both',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          borderBottom: '2px solid var(--surface-sunken)',
        }}
      >
        <Icon icon={Search} size={20} />
        <span
          style={{
            flex: 1,
            fontSize: 17,
            fontWeight: 500,
            color: query ? 'var(--text-1)' : 'var(--text-2)',
          }}
        >
          {query || 'Search or jump to… (type ? for shortcuts)'}
        </span>
      </div>
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {groups.map((g) => (
          <Fragment key={g.title}>
            <div
              style={{
                padding: '8px 10px 4px',
                font: '600 13px var(--font-display)',
                color: 'var(--text-2)',
              }}
            >
              {g.title}
            </div>
            {g.items.map((it) => {
              const on = it.key === selected;
              return (
                <div
                  key={it.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px',
                    borderRadius: 12,
                    background: on ? 'var(--surface-sunken)' : 'transparent',
                    boxShadow: on ? 'inset 0 0 0 2px var(--border-1)' : 'none',
                  }}
                >
                  <SlotTile size={30} src={it.src} icon={it.icon} hue={it.hue} tint={it.tint} />
                  <span style={{ flex: 1, fontWeight: 600 }}>{it.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{it.meta}</span>
                  <span style={{ opacity: on ? 1 : 0 }}>
                    <Kbd>↵</Kbd>
                  </span>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '9px 16px',
          borderTop: '2px solid var(--surface-sunken)',
          background: 'var(--surface-sunken)',
          fontSize: 12,
          color: 'var(--text-2)',
        }}
      >
        <div style={{ display: 'flex', gap: 14 }}>
          <span style={hint}>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>navigate
          </span>
          <span style={hint}>
            <Kbd>↵</Kbd>select
          </span>
          <span style={hint}>
            <Kbd>esc</Kbd>close
          </span>
        </div>
        <span style={hint}>
          <Kbd>?</Kbd>shortcuts
        </span>
      </div>
    </div>
  );
}
