import { describe, it, expect } from 'vitest';
import {
  magicMinDamage,
  minMagicToOneShot,
  weaponElementBonus,
  ELEMENT_DAMAGE_MULTIPLIER,
  type MagicLoadout,
} from './magicDamage';

const baseLoadout: MagicLoadout = {
  totalInt: 500,
  basePower: 400,
  masteryFraction: 0.6,
  amplificationFraction: 1,
  wandBonus: 1,
  spellElement: null,
  hits: 1,
};

/** Recompute delivered damage for the returned magic, using the neutral modifier. */
function damageAt(magic: number, loadout: MagicLoadout, modifier = 1): number {
  return magicMinDamage(magic, loadout, modifier);
}

describe('minMagicToOneShot', () => {
  it('returns the smallest magic whose min damage clears HP (boundary is tight)', () => {
    const mob = { hp: 60_000, elementAttack: null };
    const magic = minMagicToOneShot(mob, baseLoadout);
    expect(magic).not.toBeNull();
    const m = magic as number;
    // At the answer the guaranteed hit clears HP; one point lower it does not.
    expect(damageAt(m, baseLoadout)).toBeGreaterThanOrEqual(mob.hp);
    expect(damageAt(m - 1, baseLoadout)).toBeLessThan(mob.hp);
  });

  it('needs less magic against a weak monster than a neutral one', () => {
    const loadout = { ...baseLoadout, spellElement: 'Fire' as const };
    const weak = minMagicToOneShot({ hp: 60_000, elementAttack: 'F3' }, loadout);
    const neutral = minMagicToOneShot({ hp: 60_000, elementAttack: null }, loadout);
    expect(weak).not.toBeNull();
    expect(neutral).not.toBeNull();
    expect(weak as number).toBeLessThan(neutral as number);
  });

  it('returns null when the monster is immune to the spell element', () => {
    const loadout = { ...baseLoadout, spellElement: 'Fire' as const };
    expect(minMagicToOneShot({ hp: 60_000, elementAttack: 'F1' }, loadout)).toBeNull();
  });

  it('returns null when HP is unknown', () => {
    expect(minMagicToOneShot({ hp: null, elementAttack: null }, baseLoadout)).toBeNull();
  });

  it('splits HP across hits — a 3-hit spell needs less magic per hit', () => {
    const single = minMagicToOneShot({ hp: 90_000, elementAttack: null }, baseLoadout);
    const triple = minMagicToOneShot({ hp: 90_000, elementAttack: null }, {
      ...baseLoadout,
      hits: 3,
    });
    expect(triple as number).toBeLessThan(single as number);
  });

  it('returns 0 when INT alone already one-shots', () => {
    const loadout = { ...baseLoadout, totalInt: 100_000 };
    expect(minMagicToOneShot({ hp: 100, elementAttack: null }, loadout)).toBe(0);
  });

  it('an elemental-wand bonus lowers the required magic', () => {
    const mob = { hp: 60_000, elementAttack: null };
    const plain = minMagicToOneShot(mob, baseLoadout);
    const boosted = minMagicToOneShot(mob, { ...baseLoadout, wandBonus: 1.25 });
    expect(boosted as number).toBeLessThan(plain as number);
  });
});

describe('weaponElementBonus', () => {
  const wand = {
    elementBonusDefault: 100,
    elementBonusFire: 125,
    elementBonusIce: null,
    elementBonusLightning: null,
    elementBonusPoison: 110,
  };

  it('reads the matching element multiplier', () => {
    expect(weaponElementBonus(wand, 'Fire')).toBe(1.25);
    expect(weaponElementBonus(wand, 'Poison')).toBeCloseTo(1.1);
  });

  it('falls back to the baseline for an unlisted element', () => {
    expect(weaponElementBonus(wand, 'Ice')).toBe(1);
  });

  it('is neutral for a non-elemental weapon or no weapon', () => {
    const plain = {
      elementBonusDefault: null,
      elementBonusFire: null,
      elementBonusIce: null,
      elementBonusLightning: null,
      elementBonusPoison: null,
    };
    expect(weaponElementBonus(plain, 'Fire')).toBe(1);
    expect(weaponElementBonus(null, 'Fire')).toBe(1);
  });
});

describe('ELEMENT_DAMAGE_MULTIPLIER', () => {
  it('matches the classic weak/resistant/immune multipliers', () => {
    expect(ELEMENT_DAMAGE_MULTIPLIER).toEqual({
      neutral: 1,
      weak: 1.5,
      resistant: 0.5,
      immune: 0,
    });
  });
});
