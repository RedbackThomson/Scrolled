const SPEC: [top: number, scale: number, dur: number, phase: number, opacity: number][] = [
  [60, 1.1, 120, 0.15, 0.9],
  [210, 0.7, 90, 0.55, 0.7],
  [360, 1.4, 150, 0.8, 1],
  [520, 0.8, 100, 0.3, 0.8],
  [650, 1.2, 135, 0.65, 0.9],
  [130, 0.6, 75, 0.9, 0.6],
];

export interface CloudBackdropProps {
  count?: number;
}

/** Pausing is global: <html data-clouds="paused"> stops every cloud where it is. */
export function CloudBackdrop({ count = 6 }: CloudBackdropProps) {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {SPEC.slice(0, count).map(([top, s, dur, f, op], i) => {
        const W = 240 * s;
        const puff = (l: number, b: number, w: number, h: number, r: number | string) => (
          <div
            style={{
              position: 'absolute',
              left: l * W,
              bottom: b * W,
              width: w * W,
              height: h * W,
              borderRadius: r,
              background: 'var(--cloud)',
            }}
          />
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top,
              width: W,
              height: W * 0.5,
              opacity: op,
              animation: `sc-drift ${dur}s linear ${-dur * f}s infinite`,
            }}
            className="sc-cloud"
          >
            {puff(0, 0, 1, 0.2, 999)}
            {puff(0.12, 0.08, 0.34, 0.34, '50%')}
            {puff(0.34, 0.1, 0.4, 0.4, '50%')}
            {puff(0.62, 0.06, 0.28, 0.28, '50%')}
          </div>
        );
      })}
    </div>
  );
}
