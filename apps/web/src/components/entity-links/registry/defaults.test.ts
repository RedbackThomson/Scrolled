import { describe, expect, it } from 'vitest';
import { pruneOverrides, resolveModes, tooltipSettingsKey } from './defaults';
import type { AnyTooltipEntityConfig } from './types';

const config = {
  fields: [
    { key: 'a', defaultMode: 'always' },
    { key: 'b', defaultMode: 'whenPresent' },
    { key: 'c', defaultMode: 'never' },
  ],
} as unknown as AnyTooltipEntityConfig;

describe('tooltipSettingsKey', () => {
  it('namespaces by entity type', () => {
    expect(tooltipSettingsKey('mob')).toBe('tooltip.fields.mob');
  });
});

describe('resolveModes', () => {
  it('falls back to each field default when no override is stored', () => {
    expect(resolveModes(config, {})).toEqual({ a: 'always', b: 'whenPresent', c: 'never' });
  });

  it('applies overrides and ignores keys the config no longer defines', () => {
    expect(resolveModes(config, { b: 'always', gone: 'never' })).toEqual({
      a: 'always',
      b: 'always',
      c: 'never',
    });
  });
});

describe('pruneOverrides', () => {
  it('drops overrides equal to the default and keeps the rest', () => {
    expect(pruneOverrides(config, { a: 'always', b: 'never', c: 'never' })).toEqual({ b: 'never' });
  });

  it('discards keys absent from the config', () => {
    expect(pruneOverrides(config, { gone: 'always' })).toEqual({});
  });
});
