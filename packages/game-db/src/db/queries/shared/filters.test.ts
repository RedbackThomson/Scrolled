import { describe, expect, it } from 'vitest';
import { QUEST_FILTER, applyFilters } from './filters';

describe('applyFilters — presence', () => {
  function runRepeatable(filter: { kind: 'range'; min?: number; max?: number }) {
    const where: string[] = [];
    const params: (string | number)[] = [];
    applyFilters(QUEST_FILTER, { repeatable: filter }, where, params);
    return { where, params };
  }

  it('maps {min:1,max:1} to IS NOT NULL', () => {
    const { where, params } = runRepeatable({ kind: 'range', min: 1, max: 1 });
    expect(where).toEqual(['repeat_wait IS NOT NULL']);
    expect(params).toEqual([]);
  });

  it('maps {min:0,max:0} to IS NULL', () => {
    const { where, params } = runRepeatable({ kind: 'range', min: 0, max: 0 });
    expect(where).toEqual(['repeat_wait IS NULL']);
    expect(params).toEqual([]);
  });

  it('drops range shapes that arent the boolean shim', () => {
    expect(runRepeatable({ kind: 'range', min: 1 }).where).toEqual([]);
    expect(runRepeatable({ kind: 'range', max: 0 }).where).toEqual([]);
    expect(runRepeatable({ kind: 'range', min: 0, max: 1 }).where).toEqual([]);
  });
});
