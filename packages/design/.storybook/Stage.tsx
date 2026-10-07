import { useEffect, type ReactNode } from 'react';
import { CloudBackdrop } from '../src/components/surfaces/CloudBackdrop';

export type Mode = 'light' | 'dark';
export type Backdrop = 'sky' | 'clouds' | 'card';

function Frame({
  mode,
  backdrop,
  padded,
  children,
}: {
  mode: Mode;
  backdrop: Backdrop;
  padded: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={mode === 'dark' ? 'dark' : undefined}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: '100%',
        padding: padded ? 24 : 0,
        boxSizing: 'border-box',
        color: 'var(--text-1)',
        font: 'var(--type-body)',
        background: backdrop === 'card' ? 'var(--surface-card)' : 'var(--gradient-page)',
        backgroundColor: 'var(--surface-page)',
        overflow: 'hidden',
      }}
    >
      {backdrop === 'clouds' && <CloudBackdrop />}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}

export interface Globals {
  theme: Mode | 'side-by-side';
  accent: string;
  motion: string;
  backdrop: Backdrop;
}

export function Stage({
  globals,
  padded,
  children,
}: {
  globals: Globals;
  padded: boolean;
  children: ReactNode;
}) {
  const { theme, accent, motion, backdrop } = globals;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    root.dataset.motion = motion;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme, accent, motion]);
  const modes: Mode[] = theme === 'side-by-side' ? ['light', 'dark'] : [theme];
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {modes.map((mode) => (
        <Frame key={mode} mode={mode} backdrop={backdrop} padded={padded}>
          {children}
        </Frame>
      ))}
    </div>
  );
}
