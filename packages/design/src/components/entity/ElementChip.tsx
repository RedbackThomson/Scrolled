export interface ElementChipProps {
  element: 'ice' | 'lightning' | 'fire' | 'poison' | 'holy' | 'dark' | 'physical';
  /** e.g. "Weak", "Strong", "Immune"; omit when neutral */
  status?: string;
}

export function ElementChip({ element, status }: ElementChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
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
          height: 14,
          borderRadius: '50%',
          background: `var(--el-${element.toLowerCase()})`,
          boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.15)',
        }}
      />
      <span style={{ textTransform: 'capitalize' }}>{element}</span>
      {status && <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{status}</span>}
    </span>
  );
}
