import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export interface RangeSliderQuickRange {
  label: string;
  value: [number, number];
}

export interface RangeSliderProps {
  min?: number;
  max?: number;
  value?: [number, number];
  /** Makes the thumbs and MIN/MAX fields editable; without it the slider is display-only */
  onChange?: (value: [number, number]) => void;
  step?: number;
  /** Preset ranges shown as chips under the fields; the matching one highlights */
  quickRanges?: readonly RangeSliderQuickRange[];
  /** Accessible names for the two thumbs */
  label?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function RangeSlider({
  min = 0,
  max = 200,
  value = [30, 50],
  onChange,
  step = 1,
  quickRanges,
  label = 'Range',
}: RangeSliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<0 | 1 | null>(null);
  const span = Math.max(1, max - min);
  const pct = (v: number) => ((clamp(v, min, max) - min) / span) * 100;
  const [a, b] = value;

  const snap = (v: number) => clamp(Math.round((v - min) / step) * step + min, min, max);
  const set = (thumb: 0 | 1, v: number) => {
    if (!onChange) return;
    const next = snap(v);
    onChange(thumb === 0 ? [Math.min(next, b), b] : [a, Math.max(next, a)]);
  };
  const valueAt = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return min;
    return min + ((clientX - rect.left) / rect.width) * span;
  };

  const onTrackDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onChange) return;
    const v = valueAt(e.clientX);
    const thumb = Math.abs(v - a) <= Math.abs(v - b) && !(a === b && v > b) ? 0 : 1;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(thumb);
    set(thumb, v);
  };
  const onTrackMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging != null) set(dragging, valueAt(e.clientX));
  };

  const onThumbKey = (thumb: 0 | 1) => (e: KeyboardEvent) => {
    const current = thumb === 0 ? a : b;
    const big = Math.max(step, Math.round(span / 10));
    const next: Record<string, number> = {
      ArrowLeft: current - step,
      ArrowDown: current - step,
      ArrowRight: current + step,
      ArrowUp: current + step,
      PageDown: current - big,
      PageUp: current + big,
      Home: min,
      End: max,
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    set(thumb, next[e.key]);
  };

  const box = (lbl: string, v: number, thumb: 0 | 1) => (
    <label
      className={onChange ? 'sc-focus-within-ring' : undefined}
      style={{
        height: 34,
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        padding: '0 10px',
        borderRadius: 11,
        border: 'var(--border-rim)',
        background: 'var(--surface-card)',
        boxShadow: 'var(--shadow-input)',
      }}
    >
      <span style={{ font: '700 11px var(--font-body)', color: 'var(--text-2)' }}>{lbl}</span>
      {onChange ? (
        <BoundInput
          aria-label={`${label} ${lbl.toLowerCase()}`}
          value={v}
          onCommit={(n) => set(thumb, n)}
        />
      ) : (
        <b>{v}</b>
      )}
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        ref={track}
        onPointerDown={onTrackDown}
        onPointerMove={onTrackMove}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
        style={{
          position: 'relative',
          height: 28,
          touchAction: 'none',
          cursor: onChange ? 'pointer' : undefined,
        }}
      >
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
        {([a, b] as const).map((v, i) => (
          <div
            key={i}
            role={onChange ? 'slider' : undefined}
            tabIndex={onChange ? 0 : undefined}
            aria-label={onChange ? `${label} ${i === 0 ? 'minimum' : 'maximum'}` : undefined}
            aria-valuemin={onChange ? min : undefined}
            aria-valuemax={onChange ? max : undefined}
            aria-valuenow={onChange ? v : undefined}
            onKeyDown={onChange ? onThumbKey(i as 0 | 1) : undefined}
            className={onChange ? 'sc-focus-ring' : undefined}
            style={{
              position: 'absolute',
              left: `calc(${pct(v)}% - 11px)`,
              top: 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 0 0 2px var(--accent), 0 2px 5px rgba(0,0,0,.2)',
              zIndex: dragging === i ? 2 : 1,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {box('MIN', a, 0)}
        <span style={{ color: 'var(--text-2)' }}>–</span>
        {box('MAX', b, 1)}
      </div>
      {quickRanges && quickRanges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {quickRanges.map((q) => {
            const on = q.value[0] === a && q.value[1] === b;
            return (
              <button
                key={q.label}
                type="button"
                aria-pressed={on}
                disabled={!onChange}
                onClick={() => onChange?.([q.value[0], q.value[1]])}
                className="sc-focus-ring"
                style={{
                  padding: '5px 11px',
                  border: '2px solid transparent',
                  borderRadius: 999,
                  font: '700 12.5px var(--font-body)',
                  background: on ? 'var(--accent-glow)' : 'var(--surface-sunken)',
                  color: on ? 'var(--accent-text)' : 'var(--text-2)',
                  cursor: onChange ? 'pointer' : 'default',
                }}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BoundInput({
  value,
  onCommit,
  'aria-label': ariaLabel,
}: {
  value: number;
  onCommit: (value: number) => void;
  'aria-label': string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Clamping each keystroke would fight the user mid-number, so the draft commits on blur or Enter.
  const commit = () => {
    const n = Number(draft);
    if (draft !== null && draft.trim() !== '' && Number.isFinite(n)) onCommit(n);
    setDraft(null);
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      className="sc-input-text"
      style={{
        width: '100%',
        minWidth: 0,
        border: 'none',
        outline: 'none',
        padding: 0,
        background: 'transparent',
        textAlign: 'right',
        color: 'var(--text-1)',
        font: '700 14px var(--font-body)',
      }}
    />
  );
}
