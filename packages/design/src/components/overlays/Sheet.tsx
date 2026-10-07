import type { ReactNode } from 'react';

export interface SheetProps {
  title?: string;
  action?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Sheet({ title, action, children, footer }: SheetProps) {
  return (
    <div
      style={{
        borderRadius: '30px 30px 0 0',
        background: 'var(--surface-card)',
        boxShadow: '0 -12px 40px rgba(10,20,50,.25)',
        padding: '8px 16px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'sc-toast 520ms var(--ease-spring) both',
      }}
    >
      <span
        style={{
          alignSelf: 'center',
          width: 44,
          height: 5,
          borderRadius: 999,
          background: 'var(--border-1)',
        }}
      />
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ font: '600 20px var(--font-display)' }}>{title}</span>
          {action}
        </div>
      )}
      {children}
      {footer}
    </div>
  );
}
