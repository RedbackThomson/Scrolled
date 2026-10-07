export interface StatRangeProps {
  label: string;
  base: number;
  /** Possible dropped-stat range from the server profile */
  min: number;
  max: number;
  scaleMax?: number;
  color?: string;
}

export function StatRange({
  label,
  base,
  min,
  max,
  scaleMax,
  color = 'var(--stat-hp)',
}: StatRangeProps) {
  const S = scaleMax || max * 1.6 || 1;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '5px 2px',
        borderBottom: '1.5px solid var(--surface-sunken)',
      }}
    >
      <span style={{ width: 78, font: '700 12.5px var(--font-body)', color }}>{label}</span>
      <span
        style={{
          flex: 1,
          height: 8,
          borderRadius: 999,
          background: 'var(--surface-sunken)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: (min / S) * 100 + '%',
            width: ((max - min) / S) * 100 + '%',
            top: 0,
            bottom: 0,
            borderRadius: 999,
            background: `color-mix(in oklab, ${color} 55%, transparent)`,
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: (base / S) * 100 + '%',
            top: -1,
            bottom: -1,
            width: 3,
            borderRadius: 2,
            background: 'var(--text-1)',
          }}
        />
      </span>
      <span
        style={{
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 22,
          textAlign: 'right',
        }}
      >
        {base}
      </span>
      <span style={{ font: 'var(--type-meta)', color: 'var(--text-2)', minWidth: 44 }}>
        {min} ~ {max}
      </span>
    </div>
  );
}
