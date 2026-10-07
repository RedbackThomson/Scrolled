import { describe, expect, it } from 'vitest';
import { popIn } from './popIn';

describe('popIn', () => {
  it('staggers by index after the base delay', () => {
    expect(popIn(3).style?.animationDelay).toBe('calc(120ms + var(--stagger) * 3)');
  });

  it('skips the entrance past the cap so long grids do not wait', () => {
    expect(popIn(11).className).toBeDefined();
    expect(popIn(12)).toEqual({});
  });
});
