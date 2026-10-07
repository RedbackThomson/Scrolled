import type { ReactNode } from 'react';

export interface KbdProps {
  children: ReactNode;
}

export function Kbd({ children }: KbdProps) {
  return (
    <kbd
      style={{
        font: '500 10.5px var(--font-mono)',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        display: 'inline-grid',
        placeItems: 'center',
        borderRadius: 6,
        background: 'var(--surface-card)',
        borderStyle: 'solid',
        borderColor: 'var(--border-1)',
        borderWidth: '1.5px 1.5px 2.5px',
        color: 'var(--text-2)',
      }}
    >
      {children}
    </kbd>
  );
}
