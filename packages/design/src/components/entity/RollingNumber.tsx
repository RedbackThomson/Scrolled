import type { CSSProperties } from 'react';
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
// Digit row height, in em so the strip matches whatever font size it sits in.
const ROW = 1.1;

export interface RollingNumberProps {
  text: string;
  /** Extra start delay, e.g. 30ms per tile when several roll together. */
  delayMs?: number;
}

/**
 * Odometer number: each digit is a 0–9 strip that rolls to its value once, on
 * mount. Kept brief so the value is readable almost at once. Remount (key by
 * entity) to roll again; refetches don't replay it.
 */
export function RollingNumber({ text, delayMs = 0 }: RollingNumberProps) {
  let seen = 0;
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span style={SR_ONLY}>{text}</span>
      <span
        aria-hidden="true"
        style={{ display: 'inline-flex', fontVariantNumeric: 'tabular-nums' }}
      >
        {splitDigits(text).map((c, i) => {
          if (c.kind === 'static') return <span key={i}>{c.char}</span>;
          const order = seen++;
          const to = `${-c.digit * ROW}em`;
          return (
            <span
              key={i}
              style={{ display: 'inline-block', height: `${ROW}em`, overflow: 'hidden' }}
            >
              <span
                className="sc-roll-digit"
                style={
                  {
                    '--to': to,
                    '--roll-delay': `${delayMs + order * 15}ms`,
                    transform: `translateY(${to})`,
                  } as CSSProperties
                }
              >
                {DIGITS.map((d) => (
                  <span key={d} style={{ height: `${ROW}em`, lineHeight: `${ROW}em` }}>
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
