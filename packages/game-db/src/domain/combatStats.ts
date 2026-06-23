// Canonical display names for the secondary combat stats, keyed by their WZ
// short codes (the same codes appear in skill level tables and consumable
// buffs). One source of truth so "pad" always reads as "Weapon Attack" wherever
// it surfaces. Primary ability stats (STR/DEX/INT/LUK) live in `abilityStats.ts`.

export const COMBAT_STAT_LABELS = {
  pad: 'Weapon Attack',
  mad: 'Magic Attack',
  pdd: 'Weapon Defense',
  mdd: 'Magic Defense',
  acc: 'Accuracy',
  eva: 'Avoidability',
  speed: 'Speed',
  jump: 'Jump',
} as const;

export type CombatStatCode = keyof typeof COMBAT_STAT_LABELS;
