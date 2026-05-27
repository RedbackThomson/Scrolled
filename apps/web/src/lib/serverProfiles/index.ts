// Server Profile & Rules Engine — public API.
//
// Importing this module registers the built-in calculators (side effect of
// ./calculators/equipStats) so resolveServerProfile + calculateEquipRanges
// work without callers touching the registry directly.

import { getEquipStatCalculator } from './calculators/equipStats';
import { EQUIP_STAT_KEYS } from './types';
import type { EquipBaseStats, EquipStatKey, EquipStatRange, ServerProfile } from './types';

export type {
  EquipBaseStats,
  EquipStatCalculator,
  EquipStatKey,
  EquipStatRange,
  ServerFingerprint,
  ServerProfile,
} from './types';
export { EQUIP_STAT_KEYS } from './types';
export { BUILTIN_PROFILES, DEFAULT_PROFILE_ID, resolveServerProfile } from './registry';
export { serverProfileSchema } from './schema';
export { detectServerProfile, type FingerprintReader } from './fingerprints';
export {
  getEquipStatCalculator,
  listEquipStatCalculatorIds,
  registerEquipStatCalculator,
} from './calculators/equipStats';

/** A profile's EXP multiplier, defaulting to 1 when it declares none. */
export function profileExpRate(profile: ServerProfile): number {
  return profile.rates.exp ?? 1;
}

/** Apply an EXP multiplier to a base value, preserving null. */
export function applyExpRate(rate: number, exp: number | null): number | null {
  if (exp === null) return null;
  return Math.round(exp * rate);
}

/**
 * Compute possible stat ranges for an equip's combat stats under the given
 * profile's calculator. Stats that are null, or that the calculator declines
 * to range, are omitted from the result.
 */
export function calculateEquipRanges(
  profile: ServerProfile,
  stats: EquipBaseStats,
): Partial<Record<EquipStatKey, EquipStatRange>> {
  const calc = getEquipStatCalculator(profile.systems.equipStatCalculation);
  if (!calc) return {};
  const out: Partial<Record<EquipStatKey, EquipStatRange>> = {};
  for (const key of EQUIP_STAT_KEYS) {
    const base = stats[key];
    if (base === null) continue;
    const range = calc.range(key, base);
    if (range) out[key] = range;
  }
  return out;
}
