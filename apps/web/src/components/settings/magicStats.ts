import { z } from 'zod';

export const MAGIC_STATS_KEY = 'customization.magicStats';

// A magic user's loadout for the "min magic to one-hit" calculation. Weapon and
// spell are stored as IDs — their base power, element, hit count and elemental
// bonus are looked up from the dataset when the calculation runs, so they stay
// correct across dataset updates.
export const magicStatsSchema = z.object({
  totalInt: z.number().int().min(0),
  characterLevel: z.number().int().min(1),
  weaponId: z.number().int().positive().nullable(),
  skillId: z.number().int().positive().nullable(),
  skillLevel: z.number().int().min(1),
  /** Element Amplification as a percentage (100 = none). */
  amplificationPct: z.number().min(0),
});

export type MagicStats = z.infer<typeof magicStatsSchema>;

export const DEFAULT_MAGIC_STATS: MagicStats = {
  totalInt: 0,
  characterLevel: 1,
  weaponId: null,
  skillId: null,
  skillLevel: 1,
  amplificationPct: 100,
};
