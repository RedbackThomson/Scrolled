import { useEffect, useState, type CSSProperties } from 'react';
import { usePrefersMotion } from '../../lib/motion';
import { burstPieces } from './burstPieces';

export interface ConfettiBurstProps {
  /** Plays once each time this changes to a new non-zero value. */
  trigger: number;
  count?: number;
  radius?: number;
  shapes?: 'mixed' | 'diamonds';
  durationMs?: number;
}

/** Decorative burst centred on its nearest positioned ancestor. */
export function ConfettiBurst({
  trigger,
  count = 10,
  radius = 62,
  shapes = 'mixed',
  durationMs = 700,
}: ConfettiBurstProps) {
  const motion = usePrefersMotion();
  const [playing, setPlaying] = useState(0);

  useEffect(() => {
    if (!trigger || !motion) return;
    setPlaying(trigger);
    const t = window.setTimeout(() => setPlaying(0), durationMs + 100);
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
        top: '50%',
        width: 0,
        height: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {burstPieces(count, radius, shapes).map((p, i) => (
        <span
          key={i}
          style={
            {
              position: 'absolute',
              left: -4,
              top: -4,
              width: 8,
              height: 8,
              background: p.color,
              borderRadius: p.shape === 'dot' ? '50%' : 2,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': p.shape === 'diamond' ? '45deg' : '0deg',
              animation: `sc-burst ${durationMs}ms var(--ease-out) ${p.delayMs}ms both`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
