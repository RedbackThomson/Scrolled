export type Status = 'ok' | 'offline' | 'warn' | 'danger';

const COLORS: Record<Status, string> = {
  ok: 'var(--ok)',
  offline: 'var(--text-2)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

export interface StatusDotProps {
  status?: Status;
  label?: string;
}

export function StatusDot({ status = 'ok', label }: StatusDotProps) {
  const c = COLORS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        font: '600 12.5px var(--font-body)',
        color: 'var(--text-1)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: c,
          boxShadow: `0 0 0 3px color-mix(in oklab, ${c} 25%, transparent)`,
        }}
      />
      {label}
    </span>
  );
}
