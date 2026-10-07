import type { CSSProperties } from 'react';

// Past this many items the tail would wait seconds; later items pop together.
const STAGGER_CAP = 12;

/**
 * Staggered pop-in for the `index`th item of a grid. Fill is `backwards` so the
 * item's own hover transforms apply once the entrance ends.
 */
export function popIn(index: number): { className: string; style: CSSProperties } {
  return {
    className: 'animate-pop [animation-fill-mode:backwards]',
    style: { animationDelay: `calc(var(--stagger) * ${Math.min(index, STAGGER_CAP)})` },
  };
}
