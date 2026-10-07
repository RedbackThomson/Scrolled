import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface InfoRowProps {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}

/** One label/value pair; place inside an `InfoList`. */
export function InfoRow({ label, value, mono }: InfoRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        padding: '6px 2px',
      }}
    >
      <dt style={{ font: '600 12.5px var(--font-body)', color: 'var(--text-2)' }}>{label}</dt>
      <dd
        style={{
          margin: 0,
          textAlign: 'right',
          fontWeight: 600,
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          fontSize: mono ? 12.5 : undefined,
        }}
      >
        {value}
      </dd>
    </div>
  );
}

export interface InfoListProps {
  children?: ReactNode;
  className?: string;
}

/** A description list of `InfoRow`s separated by the sunken divider rule. */
export function InfoList({ children, className }: InfoListProps) {
  return (
    <dl className={cn('divide-muted divide-y-[1.5px]', className)} style={{ margin: 0 }}>
      {children}
    </dl>
  );
}
