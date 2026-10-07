import type { CSSProperties, ReactNode } from 'react';

export interface ListCardProps {
  children?: ReactNode;
  style?: CSSProperties;
}

export function ListCard({ children, style }: ListCardProps) {
  return (
    <div
      style={{
        borderRadius: 16,
        background: 'var(--surface-card)',
        border: 'var(--border-rim)',
        boxShadow: 'var(--shadow-rim)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
