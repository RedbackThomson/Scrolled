// Consumable-spec-specific structural maps: which `ConsumableSpecRecord` fields
// are timed buffs vs. cures, and how the monster-card defense codes decode. The
// reusable vocabulary they lean on lives in concept-specific modules —
// elements in `mobElements.ts`, ailments in `statusAilments.ts`, combat-stat
// names in `combatStats.ts` — so a name is defined once and shared.

import type { ConsumableSpecRecord } from '../db/types';
import { ELEMENT_NAMES, type ElementCode } from './mobElements';
import { COMBAT_STAT_LABELS } from './combatStats';
import { STATUS_AILMENT_NAMES, decodeStatusAilment } from './statusAilments';

/** Element a monster card's `defenseAtt` guards against (F/I/L/S). */
export function decodeDefenseAtt(code: string): string {
  return ELEMENT_NAMES[code as ElementCode] ?? code;
}

/** Status ailment a monster card's `defenseState` guards against. */
export function decodeDefenseState(code: string): string {
  return decodeStatusAilment(code);
}

/**
 * Timed stat-buff fields and their display labels. A flat field (`pad`) and its
 * percentage variant (`padRate`) share a label; `jump`/`luk` have no percentage
 * form, so `flat === rate`. Labels come from the shared combat-stat vocabulary.
 */
export interface StatBuffDef {
  flat: keyof ConsumableSpecRecord;
  rate: keyof ConsumableSpecRecord;
  label: string;
}

export const STAT_BUFF_LABELS: readonly StatBuffDef[] = [
  { flat: 'pad', rate: 'padRate', label: COMBAT_STAT_LABELS.pad },
  { flat: 'mad', rate: 'madRate', label: COMBAT_STAT_LABELS.mad },
  { flat: 'pdd', rate: 'pddRate', label: COMBAT_STAT_LABELS.pdd },
  { flat: 'mdd', rate: 'mddRate', label: COMBAT_STAT_LABELS.mdd },
  { flat: 'acc', rate: 'accRate', label: COMBAT_STAT_LABELS.acc },
  { flat: 'eva', rate: 'evaRate', label: COMBAT_STAT_LABELS.eva },
  { flat: 'speed', rate: 'speedRate', label: COMBAT_STAT_LABELS.speed },
  { flat: 'jump', rate: 'jump', label: COMBAT_STAT_LABELS.jump },
  { flat: 'luk', rate: 'luk', label: 'LUK' },
];

/** Cure-flag fields and the ailment each one removes. */
export interface CureFlagDef {
  field: keyof ConsumableSpecRecord;
  label: string;
}

export const CURE_FLAGS: readonly CureFlagDef[] = [
  { field: 'curse', label: STATUS_AILMENT_NAMES.C },
  { field: 'darkness', label: STATUS_AILMENT_NAMES.D },
  { field: 'poison', label: STATUS_AILMENT_NAMES.P },
  { field: 'seal', label: STATUS_AILMENT_NAMES.S },
  { field: 'weakness', label: STATUS_AILMENT_NAMES.W },
  { field: 'thaw', label: STATUS_AILMENT_NAMES.F },
];
