import { describe, expect, it } from 'vitest';
import { resolveMotion } from './motion';

describe('resolveMotion', () => {
  it('honours an explicit data-motion', () => {
    expect(resolveMotion('on', true)).toBe(true);
    expect(resolveMotion('off', false)).toBe(false);
  });

  it('follows reduced motion when data-motion is absent', () => {
    expect(resolveMotion(undefined, true)).toBe(false);
    expect(resolveMotion(undefined, false)).toBe(true);
  });
});
