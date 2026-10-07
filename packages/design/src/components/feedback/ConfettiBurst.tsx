import { useEffect, useState, type CSSProperties } from 'react';
import { usePrefersMotion } from '../../lib/motion';
import { burstPieces, type BurstVariant } from './burstPieces';

export interface ConfettiBurstProps {
  /** Plays once each time this changes to a new non-zero value. */
  trigger: number;
  /** save = Save to collection; celebrate = setup finished */
  variant?: BurstVariant;
}

const TIMING: Record<BurstVariant, { durationMs: number; easing: string; top: string }> = {
  save: { durationMs: 700, easing: 'var(--ease-burst)', top: '50%' },
  celebrate: { durationMs: 900, easing: 'var(--ease-celebrate)', top: '46%' },
};

/** Decorative burst centred on its nearest positioned ancestor. */
export function ConfettiBurst({ trigger, variant = 'save' }: ConfettiBurstProps) {
  const motion = usePrefersMotion();
  const [playing, setPlaying] = useState(0);
  const { durationMs, easing, top } = TIMING[variant];

  // Unmount once the last piece lands, so pieces never linger over content.
  useEffect(() => {
    if (!trigger || !motion) return;
    setPlaying(trigger);
    const t = window.setTimeout(() => setPlaying(0), durationMs + 500);
    return () => window.clearTimeout(t);
  }, [trigger, motion, durationMs]);

  if (!playing) return null;
  return (
    <span
      key={playing}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '50%',
        top,
        width: 0,
        height: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {burstPieces(variant).map((p, i) => (
        <span
          key={i}
          style={
            {
              position: 'absolute',
              left: -p.size / 2,
              top: -p.size / 2,
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: p.shape === 'dot' ? '50%' : 2,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': p.shape === 'diamond' ? '45deg' : '0deg',
              animation: `sc-burst ${durationMs}ms ${easing} ${p.delayMs}ms both`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
