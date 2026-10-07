export interface SkeletonProps {
  rows?: number;
}

export function Skeleton({ rows = 4 }: SkeletonProps) {
  // Each row's shimmer trails the one above by 120ms.
  const bar = (w: number | string, h: number, r: number, row: number) => (
    <span
      className="sc-skeleton"
      style={{
        width: w,
        height: h,
        borderRadius: r,
        flex: w === '100%' ? 1 : 'none',
        animationDelay: `${row * 120}ms`,
      }}
    />
  );
  return (
    <div
      aria-hidden
      // Waits before appearing so loads that finish quickly never flash placeholders.
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        animation: 'sc-fade 200ms ease-out 150ms both',
      }}
    >
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
          {bar(36, 36, 10, i)}
          {bar('100%', 10, 6, i)}
          {bar(40, 10, 6, i)}
        </div>
      ))}
    </div>
  );
}
