import { describe, expect, it } from 'vitest';
import { burstPieces } from './burstPieces';

describe('burstPieces', () => {
  it('saves with ten alternating dots and diamonds on a 62px ring', () => {
    const pieces = burstPieces('save');
    expect(pieces).toHaveLength(10);
    expect(pieces.slice(0, 2).map((p) => p.shape)).toEqual(['dot', 'diamond']);
    for (const p of pieces) expect(Math.round(Math.hypot(p.dx, p.dy))).toBeCloseTo(62, -1);
  });

  it('celebrates with fourteen diamonds between 70 and 98px, staggered from 250ms', () => {
    const pieces = burstPieces('celebrate');
    expect(pieces).toHaveLength(14);
    expect(pieces.every((p) => p.shape === 'diamond')).toBe(true);
    for (const p of pieces) {
      const reach = Math.hypot(p.dx, p.dy);
      expect(reach).toBeGreaterThan(69);
      expect(reach).toBeLessThan(99);
    }
    expect(new Set(pieces.map((p) => p.delayMs))).toEqual(new Set([250, 290, 330, 370]));
  });
});
