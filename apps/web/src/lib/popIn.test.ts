import { describe, expect, it } from 'vitest';
import { popIn } from './popIn';

describe('popIn', () => {
  it('staggers by index', () => {
    expect(popIn(3).style.animationDelay).toBe('calc(var(--stagger) * 3)');
  });

  it('caps the stagger so long grids do not wait', () => {
    expect(popIn(40).style.animationDelay).toBe('calc(var(--stagger) * 12)');
  });
});
