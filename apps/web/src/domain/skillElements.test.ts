// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decodeRequiredWeapon, decodeSkillElement } from './skillElements';

describe('decodeSkillElement', () => {
  it('maps each known code to its display name', () => {
    expect(decodeSkillElement('F')).toBe('Fire');
    expect(decodeSkillElement('I')).toBe('Ice');
    expect(decodeSkillElement('L')).toBe('Lightning');
    expect(decodeSkillElement('S')).toBe('Poison');
    expect(decodeSkillElement('H')).toBe('Holy');
    expect(decodeSkillElement('D')).toBe('Dark');
    expect(decodeSkillElement('P')).toBe('Physical');
  });

  it('uppercases the input so lowercase codes still resolve', () => {
    expect(decodeSkillElement('f')).toBe('Fire');
    expect(decodeSkillElement('  i  ')).toBe('Ice');
  });

  it('returns null for null, empty, or unknown codes', () => {
    expect(decodeSkillElement(null)).toBeNull();
    expect(decodeSkillElement(undefined)).toBeNull();
    expect(decodeSkillElement('')).toBeNull();
    expect(decodeSkillElement('   ')).toBeNull();
    expect(decodeSkillElement('X')).toBeNull();
  });
});

describe('decodeRequiredWeapon', () => {
  it('maps known weapon codes to labels', () => {
    expect(decodeRequiredWeapon('30')).toBe('One-handed sword');
    expect(decodeRequiredWeapon('43')).toBe('Spear');
    expect(decodeRequiredWeapon('45')).toBe('Bow');
    expect(decodeRequiredWeapon('49')).toBe('Gun');
  });

  it('strips leading zeros and surrounding whitespace', () => {
    expect(decodeRequiredWeapon(' 030 ')).toBe('One-handed sword');
    expect(decodeRequiredWeapon('00045')).toBe('Bow');
  });

  it('returns null for unknown or empty codes', () => {
    expect(decodeRequiredWeapon(null)).toBeNull();
    expect(decodeRequiredWeapon(undefined)).toBeNull();
    expect(decodeRequiredWeapon('')).toBeNull();
    expect(decodeRequiredWeapon('99')).toBeNull();
  });
});
