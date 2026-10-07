import type { ReactNode } from 'react';

export type ElementKey = 'ice' | 'lightning' | 'fire' | 'poison' | 'holy' | 'dark' | 'physical';

export interface ElementChipProps {
  element: ElementKey;
  /** e.g. "Weak", "Strong", "Immune"; omit when neutral */
  status?: ReactNode;
  /** Fill the container's width, with the status pushed to the right edge. */
  stretch?: boolean;
}

export function ElementChip({ element, status, stretch }: ElementChipProps) {
  return (
    <span
      style={{
        display: stretch ? 'flex' : 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px 4px 5px',
        borderRadius: 999,
        background: 'var(--surface-sunken)',
        font: '600 12px var(--font-body)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 14,
          flex: 'none',
          height: 14,
          borderRadius: '50%',
          background: `var(--el-${element.toLowerCase()})`,
          boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.15)',
        }}
      />
      <span style={{ textTransform: 'capitalize' }}>{element}</span>
      {status && (
        <span style={{ color: 'var(--text-2)', fontWeight: 500, marginLeft: stretch ? 'auto' : 0 }}>
          {status}
        </span>
      )}
    </span>
  );
}
