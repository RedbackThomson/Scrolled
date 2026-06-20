// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { unescapeWzString } from './wzText';

describe('unescapeWzString', () => {
  it('replaces literal \\n with a newline', () => {
    expect(unescapeWzString('Improves helmet def.\\nSuccess Rate:10%')).toBe(
      'Improves helmet def.\nSuccess Rate:10%',
    );
  });

  it('handles \\r, \\t, and \\\\', () => {
    expect(unescapeWzString('a\\rb\\tc\\\\d')).toBe('a\rb\tc\\d');
  });

  it('preserves \\\\n as a literal backslash followed by n, not a newline', () => {
    // `\\\\n` is the JS source representation of two chars: `\` then `n`,
    // preceded by an escaped backslash → input is `\\n` in the file. We
    // expect output of `\n` (backslash + n), NOT a newline.
    expect(unescapeWzString('a\\\\nb')).toBe('a\\nb');
  });

  it('leaves strings without backslashes untouched (fast path)', () => {
    const s = 'Improves helmet def. Success Rate:10%, weapon def.+5';
    expect(unescapeWzString(s)).toBe(s);
  });

  it('returns null and empty string unchanged', () => {
    expect(unescapeWzString(null)).toBeNull();
    expect(unescapeWzString('')).toBe('');
  });

  it('leaves unrecognized escapes as-is (e.g. \\x)', () => {
    // Conservative: only normalize the well-known set. Unknown sequences
    // pass through verbatim so we don't corrupt MapleStory color codes or
    // future additions.
    expect(unescapeWzString('a\\xb')).toBe('a\\xb');
  });

  it('handles a trailing lone backslash without throwing', () => {
    expect(unescapeWzString('hello\\')).toBe('hello\\');
  });
});
