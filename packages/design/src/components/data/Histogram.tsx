export interface HistogramProps {
  /** Row counts per equal-width bin, low to high */
  bins: readonly number[];
  /** Value domain the bins span */
  min: number;
  max: number;
  /** Selected range; bins overlapping it fill with the accent */
  range?: readonly [number | undefined, number | undefined];
  height?: number;
}

/** A column's value distribution, drawn above a range slider. Heights use a
 *  square-root scale so one crowded bin doesn't flatten the rest. */
export function Histogram({ bins, min, max, range, height = 54 }: HistogramProps) {
  const peak = Math.max(1, ...bins);
  const width = (max - min) / Math.max(1, bins.length);
  const lo = range?.[0] ?? -Infinity;
  const hi = range?.[1] ?? Infinity;
  const hasRange = range != null && (range[0] != null || range[1] != null);
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
      {bins.map((n, i) => {
        const start = min + i * width;
        const inside = hasRange && start + width > lo && start <= hi;
        return (
          <span
            key={i}
            style={{
              flex: 1,
              height: n > 0 ? Math.max(4, Math.round(Math.sqrt(n / peak) * height)) : 2,
              borderRadius: '4px 4px 2px 2px',
              background: inside ? 'var(--accent)' : 'var(--surface-sunken)',
              transition: 'background var(--dur-fast), height var(--dur-base) var(--ease-spring)',
            }}
          />
        );
      })}
    </div>
  );
}
