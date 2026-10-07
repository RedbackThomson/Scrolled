export type BurstVariant = 'save' | 'celebrate';

export interface BurstPiece {
  dx: number;
  dy: number;
  shape: 'dot' | 'diamond';
  color: string;
  size: number;
  delayMs: number;
}

const HUES = [148, 80, 20, 240, 300];

/** Pieces for a burst: evenly spaced, deterministic, so every burst looks the same. */
export function burstPieces(variant: BurstVariant): BurstPiece[] {
  const celebrate = variant === 'celebrate';
  const count = celebrate ? 14 : 10;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const reach = celebrate ? 70 + (i % 3) * 14 : 62;
    return {
      dx: Math.round(Math.cos(angle) * reach),
      dy: Math.round(Math.sin(angle) * reach),
      shape: celebrate || i % 2 ? 'diamond' : 'dot',
      color: celebrate
        ? `oklch(0.8 0.15 ${HUES[i % HUES.length]})`
        : `oklch(0.75 0.16 ${HUES[i % HUES.length]})`,
      size: celebrate ? 10 : 8,
      delayMs: celebrate ? 250 + (i % 4) * 40 : 140,
    };
  });
}
