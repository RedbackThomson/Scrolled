import { describe, expect, it } from 'vitest';
import { isRollable, splitDigits } from './rollingDigits';

describe('isRollable', () => {
  it('accepts formatted numbers', () => {
    expect(isRollable('12,345')).toBe(true);
    expect(isRollable('7')).toBe(true);
    expect(isRollable('1.5')).toBe(true);
  });

  it('rejects placeholders and mixed text', () => {
    expect(isRollable('—')).toBe(false);
    expect(isRollable('12 HP')).toBe(false);
    expect(isRollable('')).toBe(false);
  });
});

describe('splitDigits', () => {
  it('keeps separators in place between digit columns', () => {
    expect(splitDigits('1,20')).toEqual([
      { kind: 'digit', digit: 1 },
      { kind: 'static', char: ',' },
      { kind: 'digit', digit: 2 },
      { kind: 'digit', digit: 0 },
    ]);
  });
});
