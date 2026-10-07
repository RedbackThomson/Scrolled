import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePrefersMotion } from '../../lib/motion';
import { splitDigits } from './rollingDigits';

const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Odometer-style number: digit columns roll up from 0 the first time it scrolls into view. */
export function RollingNumber({ text }: { text: string }) {
  const motion = usePrefersMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [rolled, setRolled] = useState(!motion);

  useEffect(() => {
    const el = ref.current;
    if (rolled || !el) return;
    if (!motion || typeof IntersectionObserver === 'undefined') {
      setRolled(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setRolled(true);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [motion, rolled]);

  const chars = splitDigits(text);
  let seen = 0;
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <span style={SR_ONLY}>{text}</span>
      <span
        aria-hidden="true"
        style={{ display: 'inline-flex', fontVariantNumeric: 'tabular-nums' }}
      >
        {chars.map((c, i) => {
          if (c.kind === 'static') return <span key={i}>{c.char}</span>;
          const order = seen++;
          return (
            <span key={i} style={{ display: 'inline-block', height: '1.1em', overflow: 'hidden' }}>
              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  transform: `translateY(${rolled ? -c.digit * 1.1 : 0}em)`,
                  transition: `transform 600ms var(--ease-spring) ${order * 60}ms`,
                }}
              >
                {DIGITS.map((d) => (
                  <span key={d} style={{ height: '1.1em', lineHeight: '1.1em' }}>
                    {d}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
