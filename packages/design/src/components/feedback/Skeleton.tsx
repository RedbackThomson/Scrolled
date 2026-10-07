export interface SkeletonProps {
  rows?: number;
}

export function Skeleton({ rows = 4 }: SkeletonProps) {
  const bar = (w: number | string, h: number, r: number) => (
    <span
      style={{
        width: w,
        height: h,
        borderRadius: r,
        flex: w === '100%' ? 1 : 'none',
        background:
          'linear-gradient(90deg, var(--surface-sunken) 0%, var(--surface-page-top) 50%, var(--surface-sunken) 100%)',
        backgroundSize: '200% 100%',
        animation: 'sc-shimmer 1.4s linear infinite',
      }}
    />
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 46,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 12px',
            borderRadius: 14,
            background: 'var(--surface-card)',
            border: 'var(--border-rim)',
          }}
        >
          {bar(36, 36, 10)}
          {bar('100%', 10, 6)}
          {bar(40, 10, 6)}
        </div>
      ))}
    </div>
  );
}
