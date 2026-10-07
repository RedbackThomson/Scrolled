export interface RangeSliderProps {
  min?: number;
  max?: number;
  value?: [number, number];
}

export function RangeSlider({ min = 0, max = 200, value = [30, 50] }: RangeSliderProps) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const [a, b] = value;
  const box = (lbl: string, v: number) => (
    <div
      style={{
        height: 34,
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        borderRadius: 11,
        border: 'var(--border-rim)',
        background: 'var(--surface-card)',
        boxShadow: 'var(--shadow-input)',
      }}
    >
      <span style={{ font: '700 11px var(--font-body)', color: 'var(--text-2)' }}>{lbl}</span>
      <b>{v}</b>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative', height: 28 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 11,
            height: 6,
            borderRadius: 999,
            background: 'var(--surface-sunken)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: pct(a) + '%',
            width: pct(b) - pct(a) + '%',
            top: 11,
            height: 6,
            borderRadius: 999,
            background: 'var(--gradient-accent)',
          }}
        />
        {[a, b].map((v, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `calc(${pct(v)}% - 11px)`,
              top: 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 0 0 2px var(--accent), 0 2px 5px rgba(0,0,0,.2)',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {box('MIN', a)}
        <span style={{ color: 'var(--text-2)' }}>–</span>
        {box('MAX', b)}
      </div>
    </div>
  );
}
