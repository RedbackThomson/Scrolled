import { describe, expect, it } from 'vitest';
import { buildFilterUrl, parseFilterQuery } from './filterGrammar';

describe('parseFilterQuery', () => {
  it('returns empty result for empty input', () => {
    const r = parseFilterQuery('');
    expect(r.entity).toBeNull();
    expect(r.params).toEqual({});
    expect(r.hasFilters).toBe(false);
  });

  it('requires an entity scope for any filter to be produced', () => {
    const r = parseFilterQuery('level:50 boss');
    expect(r.entity).toBeNull();
    expect(r.params).toEqual({});
    expect(r.hasFilters).toBe(false);
  });

  it('parses a mobs level range plus boss flag', () => {
    const r = parseFilterQuery('mobs level:50-70 boss:true');
    expect(r.entity).toBe('mob');
    expect(r.params).toEqual({
      f_level_min: '50',
      f_level_max: '70',
      boss: '1',
    });
    expect(r.hasFilters).toBe(true);
  });

  it('accepts the bare `boss` token as boss:true', () => {
    const r = parseFilterQuery('mobs boss');
    expect(r.params).toEqual({ boss: '1' });
  });

  it('parses comparison operators on numbers', () => {
    const r = parseFilterQuery('mobs level:>=80');
    expect(r.params).toEqual({ f_level_min: '80' });
  });

  it('treats free text as a name filter when scoped to an entity', () => {
    const r = parseFilterQuery('mobs gob');
    expect(r.entity).toBe('mob');
    expect(r.params).toEqual({ f_name: 'gob' });
    expect(r.freeText).toBe('gob');
  });

  it('parses items category enum', () => {
    const r = parseFilterQuery('items category:use');
    expect(r.params).toEqual({ f_category: 'use' });
  });

  it('falls back to free-text for unknown enum values', () => {
    const r = parseFilterQuery('items category:nonsense');
    expect(r.params).toEqual({ f_name: 'category:nonsense' });
    expect(r.freeText).toBe('category:nonsense');
  });

  it('parses equips slot + cash boolean', () => {
    const r = parseFilterQuery('equips slot:hat cash:false');
    expect(r.params).toEqual({ f_slot: 'hat', f_cash: '0' });
  });

  it('falls back to free-text for unknown keys', () => {
    const r = parseFilterQuery('mobs colour:blue');
    expect(r.params).toEqual({ f_name: 'colour:blue' });
  });

  it('builds a URL with sorted-ish params', () => {
    const r = parseFilterQuery('mobs level:50-70 boss');
    const url = buildFilterUrl(r.entity!, r.params);
    expect(url.startsWith('/mobs?')).toBe(true);
    expect(url).toContain('f_level_min=50');
    expect(url).toContain('f_level_max=70');
    expect(url).toContain('boss=1');
  });

  it('singular and plural entity aliases both work', () => {
    expect(parseFilterQuery('mob level:10').entity).toBe('mob');
    expect(parseFilterQuery('mobs level:10').entity).toBe('mob');
  });
});
