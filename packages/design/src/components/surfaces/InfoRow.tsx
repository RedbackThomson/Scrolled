import type { ReactNode } from 'react';

export interface InfoRowProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  last?: boolean;
}

export function InfoRow({ label, value, mono, last }: InfoRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        padding: '6px 2px',
        borderBottom: last ? 'none' : '1.5px solid var(--surface-sunken)',
      }}
    >
      <span style={{ font: '600 12.5px var(--font-body)', color: 'var(--text-2)' }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          fontSize: mono ? 12.5 : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
