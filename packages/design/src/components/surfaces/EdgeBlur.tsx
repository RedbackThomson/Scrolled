import type { CSSProperties } from 'react';

export interface EdgeBlurProps {
  /** Height of the ramp in px; the blur is strongest at the top edge and gone at the bottom */
  height: number;
  className?: string;
  style?: CSSProperties;
}

const LAYERS = [1, 2, 4, 8];

/**
 * Frosts whatever scrolls beneath a top bar, heaviest at the screen edge and
 * fading out below it. Position it behind the bar's controls.
 */
export function EdgeBlur({ height, className, style }: EdgeBlurProps) {
  return (
    <div
      aria-hidden
      className={className}
      style={{ position: 'absolute', insetInline: 0, top: 0, height, pointerEvents: 'none', ...style }}
    >
      {/* One backdrop-filter can't vary its radius, so each layer blurs harder over a shorter band. */}
      {LAYERS.map((px, i) => {
        const solid = ((LAYERS.length - i - 1) / LAYERS.length) * 100;
        const end = ((LAYERS.length - i) / LAYERS.length) * 100;
        const mask = `linear-gradient(to bottom, #000 ${solid}%, transparent ${end}%)`;
        return (
          <div
            key={px}
            style={{
              position: 'absolute',
              inset: 0,
              backdropFilter: `blur(${px}px)`,
              WebkitBackdropFilter: `blur(${px}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, color-mix(in srgb, var(--surface-page-top) 72%, transparent), transparent)',
        }}
      />
    </div>
  );
}
