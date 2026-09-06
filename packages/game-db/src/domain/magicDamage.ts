// Minimum magic attack a magic user needs to defeat a monster in one hit.
//
// Uses the pre-Big-Bang magician *minimum* spell-damage formula (independently
// corroborated against community references and a reference spreadsheet). MIN is
// the right bound: a guaranteed one-hit kill needs the worst damage roll to still
// exceed the monster's HP.
//
//   minDamage(magic) = ( (magic² / 1000 + magic × mastery × 0.9) / 30
//                        + INT / 200 )
//                      × basePower × amp × wandBonus × mobElementModifier
//
// `Req. Magic 1-Hit` is the smallest integer `magic` with `minDamage ≥ HP`
// (HP split across hit count for multi-hit spells), found by inverting the
// quadratic in `magic`.

import type { EquipRecord, MobRecord } from '../db/types';
import { parseMobElements, type ElementName, type ElementStatus } from './mobElements';

/** Damage multiplier a monster's `elemAttr` status applies to a matching spell. */
export const ELEMENT_DAMAGE_MULTIPLIER: Record<ElementStatus, number> = {
  neutral: 1,
  weak: 1.5,
  resistant: 0.5,
  immune: 0,
};

/** Fixed spell mastery for 4th-job mage attack skills (60%). */
export const FOURTH_JOB_SPELL_MASTERY = 0.6;

type WeaponBonusFields = Pick<
  EquipRecord,
  | 'elementBonusDefault'
  | 'elementBonusFire'
  | 'elementBonusIce'
  | 'elementBonusLightning'
  | 'elementBonusPoison'
>;

const WEAPON_ELEMENT_BONUS_FIELD: Partial<Record<ElementName, keyof WeaponBonusFields>> = {
  Fire: 'elementBonusFire',
  Ice: 'elementBonusIce',
  Lightning: 'elementBonusLightning',
  Poison: 'elementBonusPoison',
};

/**
 * The elemental-weapon multiplier for a spell of `spellElement`. Elemental
 * wands/staves store per-element values ×100 (`incRMA{F,I,L,S}`) plus a baseline
 * (`elemDefault`); everything else has none → ×1. Fields hold resistance values
 * on armour, so only pass a weapon here.
 */
export function weaponElementBonus(
  weapon: WeaponBonusFields | null | undefined,
  spellElement: ElementName | null,
): number {
  if (!weapon) return 1;
  const field = spellElement ? WEAPON_ELEMENT_BONUS_FIELD[spellElement] : undefined;
  const specific = field ? weapon[field] : null;
  const value = specific ?? weapon.elementBonusDefault;
  return value == null ? 1 : value / 100;
}

export interface MagicLoadout {
  /** Total INT (the character's INT stat, all sources). */
  totalInt: number;
  /** Spell attack of the chosen skill at the chosen level (`mad`). */
  basePower: number;
  /** Spell mastery as a fraction (0.6 = 60%). */
  masteryFraction: number;
  /** Element Amplification as a fraction (1 = none, 1.3 = 130%). */
  amplificationFraction: number;
  /** Elemental-weapon multiplier for the spell element (1 = none). */
  wandBonus: number;
  /** The spell's element, or null for non-elemental spells. */
  spellElement: ElementName | null;
  /** Hits per cast (`attackCount`); HP is split across them. */
  hits: number;
}

/** Minimum magic damage for a given total magic attack against `mobModifier`. */
export function magicMinDamage(magic: number, loadout: MagicLoadout, mobModifier: number): number {
  const core =
    ((magic * magic) / 1000 + magic * loadout.masteryFraction * 0.9) / 30 + loadout.totalInt / 200;
  return (
    core * loadout.basePower * loadout.amplificationFraction * loadout.wandBonus * mobModifier
  );
}

type OneShotMob = Pick<MobRecord, 'hp' | 'elementAttack'>;

export interface OneShotOptions {
  /**
   * Subtract monster magic defense and a level-gap penalty. Off by default to
   * match the reference spreadsheet; the term is not yet wired up.
   */
  applyDefense?: boolean;
}

/**
 * Smallest total magic attack that guarantees a one-hit kill, or null when the
 * monster is immune to the spell's element or its HP is unknown. `0` means the
 * character already one-shots on INT alone.
 */
export function minMagicToOneShot(
  mob: OneShotMob,
  loadout: MagicLoadout,
  _opts: OneShotOptions = {},
): number | null {
  if (mob.hp == null || mob.hp <= 0) return null;

  const status: ElementStatus = loadout.spellElement
    ? parseMobElements(mob.elementAttack)[loadout.spellElement]
    : 'neutral';
  const mobModifier = ELEMENT_DAMAGE_MULTIPLIER[status];
  if (mobModifier === 0) return null;

  const hits = Math.max(1, Math.floor(loadout.hits) || 1);
  const scale = loadout.basePower * loadout.amplificationFraction * loadout.wandBonus * mobModifier;
  if (scale <= 0) return null;

  // minDamage(m) ≥ perHitHp, with minDamage = (m²/1000 + m·b)/30·scale·… :
  //   m²/1000 + m·b ≥ 30·(perHitHp/scale − INT/200)
  const perHitHp = mob.hp / hits;
  const rhs = 30 * (perHitHp / scale - loadout.totalInt / 200);
  if (rhs <= 0) return 0;

  const a = 1 / 1000;
  const b = loadout.masteryFraction * 0.9;
  const magic = (-b + Math.sqrt(b * b + 4 * a * rhs)) / (2 * a);
  return Math.max(0, Math.ceil(magic));
}
