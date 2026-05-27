// Equip-stat-range calculator registry plus the built-in calculators.
//
// Calculators self-register on import. Profiles reference them by id, so a
// fork can add a native calculator without touching profile definitions or
// the rules-engine core.

import type { EquipStatCalculator, EquipStatKey, EquipStatRange } from '../types';

const REGISTRY = new Map<string, EquipStatCalculator>();

export function registerEquipStatCalculator(calc: EquipStatCalculator): void {
  REGISTRY.set(calc.id, calc);
}

export function getEquipStatCalculator(id: string | undefined | null): EquipStatCalculator | null {
  if (!id) return null;
  return REGISTRY.get(id) ?? null;
}

export function listEquipStatCalculatorIds(): string[] {
  return [...REGISTRY.keys()];
}

/**
 * Per-stat hard cap on the variance modifier. Defenses and HP/MP cap at +10;
 * combat and primary stats cap at +5.
 */
const VARIANCE_CAP: Record<EquipStatKey, number> = {
  attack: 5,
  magicAttack: 5,
  defense: 10,
  magicDefense: 10,
  accuracy: 5,
  avoidability: 5,
  incStr: 5,
  incDex: 5,
  incInt: 5,
  incLuk: 5,
  incHp: 10,
  incMp: 10,
};

/**
 * Dropped-equip stat variance: the stat rolls within base ± M, where M is 10%
 * of the base value rounded up, or the stat's hard cap, whichever is smaller.
 * The WZ data carries only the base value, so this models the range; the exact
 * per-roll outcome is server-side and unavailable to us.
 */
function variance(stat: EquipStatKey, base: number): number {
  const tenPercent = Math.ceil(Math.abs(base) * 0.1);
  return Math.min(tenPercent, VARIANCE_CAP[stat]);
}

/** A server "godly" roll can push a stat this far above its normal maximum. */
const GODLY_BONUS = 5;

registerEquipStatCalculator({
  id: 'vanilla-v83',
  range(stat: EquipStatKey, base: number): EquipStatRange | null {
    if (base === 0) return null;
    const v = variance(stat, base);
    return { base, min: base - v, max: base + v };
  },
});

registerEquipStatCalculator({
  id: 'mapleroyals-v1',
  range(stat: EquipStatKey, base: number): EquipStatRange | null {
    if (base === 0) return null;
    const v = variance(stat, base);
    return { base, min: base - v, max: base + v, godlyMax: base + v + GODLY_BONUS };
  },
});
