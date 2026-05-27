import type { EquipRecord } from '@/db';
import type { EquipStatKey } from '@/serverProfiles';

/**
 * The four primary character ability stats, in their fixed canonical display
 * order. STR → DEX → INT → LUK is an app-wide invariant: never reorder, and
 * derive any STR/DEX/INT/LUK rendering from this list rather than spelling the
 * order out at the call site, so the order can't drift between views.
 */
export const ABILITY_STATS = ['STR', 'DEX', 'INT', 'LUK'] as const;

export type AbilityStat = (typeof ABILITY_STATS)[number];

/** Keys of `EquipRecord` whose value is a nullable number. */
type NumericEquipKey = {
  [K in keyof EquipRecord]: EquipRecord[K] extends number | null ? K : never;
}[keyof EquipRecord];

/**
 * Each ability stat paired with its `EquipRecord` field for the requirement
 * value and the bonus value, in canonical order. Map over this to render the
 * four stats anywhere they appear together.
 */
export const ABILITY_STAT_FIELDS: readonly {
  label: AbilityStat;
  required: NumericEquipKey;
  inc: EquipStatKey;
}[] = [
  { label: 'STR', required: 'requiredStr', inc: 'incStr' },
  { label: 'DEX', required: 'requiredDex', inc: 'incDex' },
  { label: 'INT', required: 'requiredInt', inc: 'incInt' },
  { label: 'LUK', required: 'requiredLuk', inc: 'incLuk' },
];
