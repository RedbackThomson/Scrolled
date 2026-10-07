import { describe, expect, it } from 'vitest';
import { asGroupId } from '@scrolled/nav-graph';
import { regionHue } from './regionHue';

describe('regionHue', () => {
  it('is stable and in range', () => {
    const id = asGroupId('victoria-island');
    expect(regionHue(id)).toBe(regionHue(id));
    expect(regionHue(id)).toBeGreaterThanOrEqual(0);
    expect(regionHue(id)).toBeLessThan(360);
  });

  it('spreads different regions apart', () => {
    expect(regionHue(asGroupId('a'))).not.toBe(regionHue(asGroupId('b')));
  });
});
