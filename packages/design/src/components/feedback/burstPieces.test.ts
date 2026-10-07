import { describe, expect, it } from 'vitest';
import { burstPieces } from './burstPieces';

describe('burstPieces', () => {
  it('spreads the requested number of pieces within the radius', () => {
    const pieces = burstPieces(10, 62, 'mixed');
    expect(pieces).toHaveLength(10);
    for (const p of pieces) expect(Math.hypot(p.dx, p.dy)).toBeLessThanOrEqual(63);
  });

  it('mixes dots and diamonds unless asked for diamonds only', () => {
    expect(new Set(burstPieces(10, 62, 'mixed').map((p) => p.shape))).toEqual(
      new Set(['dot', 'diamond']),
    );
    expect(burstPieces(10, 62, 'diamonds').every((p) => p.shape === 'diamond')).toBe(true);
  });

  it('is deterministic', () => {
    expect(burstPieces(10, 62, 'mixed')).toEqual(burstPieces(10, 62, 'mixed'));
  });
});
