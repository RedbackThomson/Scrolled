export interface BurstPiece {
  dx: number;
  dy: number;
  shape: 'dot' | 'diamond';
  color: string;
  delayMs: number;
}

const COLORS = ['var(--accent)', 'var(--gold)', 'var(--accent-hi)', 'var(--gold-hi)'];

/**
 * Evenly spread pieces with a fixed wobble in angle and reach, so every burst
 * looks the same and nothing depends on Math.random during render.
 */
export function burstPieces(
  count: number,
  radius: number,
  shapes: 'mixed' | 'diamonds',
): BurstPiece[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((i / count) * 360 + (i % 2 ? 14 : -9)) * (Math.PI / 180);
    const reach = radius * (i % 3 === 0 ? 1 : i % 3 === 1 ? 0.78 : 0.9);
    return {
      dx: Math.round(Math.cos(angle) * reach),
      dy: Math.round(Math.sin(angle) * reach),
      shape: shapes === 'diamonds' || i % 2 ? 'diamond' : 'dot',
      color: COLORS[i % COLORS.length]!,
      delayMs: (i % 3) * 25,
    };
  });
}
