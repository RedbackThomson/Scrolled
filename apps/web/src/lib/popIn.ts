import type { CSSProperties } from 'react';

// Past this many items the tail would wait seconds, so later items skip the entrance.
const STAGGER_CAP = 12;
// Lets the page's title rise first.
const STAGGER_BASE_MS = 120;

/**
 * Staggered pop-in for the `index`th item of a grid. Fill is `backwards` so the
 * item's own hover transforms apply once the entrance ends.
 */
export function popIn(index: number): { className?: string; style?: CSSProperties } {
  if (index >= STAGGER_CAP) return {};
  return {
    className: 'animate-pop [animation-fill-mode:backwards]',
    style: { animationDelay: `calc(${STAGGER_BASE_MS}ms + var(--stagger) * ${index})` },
  };
}
