import { describe, expect, it } from 'vitest';
import { searchSettings } from './settingsGroups';

const ids = (q: string) => searchSettings(q).map((h) => h.section.id);

describe('searchSettings', () => {
  it('matches section labels and keywords', () => {
    expect(ids('dark')).toEqual(['appearance']);
    expect(ids('tooltip')).toEqual(['customization']);
  });

  it('requires every word to match', () => {
    expect(ids('theme tooltips')).toEqual([]);
  });

  it('returns nothing for a blank query', () => {
    expect(ids('  ')).toEqual([]);
  });
});
