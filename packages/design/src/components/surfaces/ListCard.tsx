import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface ListCardProps {
  children?: ReactNode;
  /** `ul` when the children are list items. */
  as?: 'div' | 'ul' | 'ol';
  /** Separate rows with the sunken divider rule. */
  divided?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function ListCard({ children, as: Tag = 'div', divided, className, style }: ListCardProps) {
  return (
    <Tag
      className={cn(divided && 'divide-muted divide-y-[1.5px]', className)}
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
    </Tag>
  );
}
