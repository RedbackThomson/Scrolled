// Resolves the stored magic stats into a MagicLoadout by looking up the chosen
// spell's base power / element / hit count and the weapon's elemental bonus from
// the dataset. Mob-independent — callers pass the resolved loadout to
// `minMagicToOneShot` per mob.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDbClient } from '@/db';
import { decodeSkillElement } from '@scrolled/game-db/domain/skillElements';
import {
  weaponElementBonus,
  FOURTH_JOB_SPELL_MASTERY,
  type MagicLoadout,
} from '@scrolled/game-db/domain/magicDamage';
import type { ElementName } from '@scrolled/game-db/domain/mobElements';
import { useMagicStats } from './useMagicStats';

export interface ResolvedLoadout {
  loadout: MagicLoadout | null;
  weaponName: string | null;
  skillName: string | null;
  basePower: number | null;
  spellElement: ElementName | null;
  loading: boolean;
  configured: boolean;
  /** A spell is chosen but its selected level has no magic-attack value. */
  missingBasePower: boolean;
}

export function useMagicLoadout(): ResolvedLoadout {
  const stats = useMagicStats();
  const client = useMemo(() => getDbClient(), []);
  const { totalInt, skillId, skillLevel, weaponId, amplificationPct } = stats.value;

  const skillQ = useQuery({
    queryKey: ['db', 'skill', skillId],
    queryFn: () => client.getSkill(skillId as number),
    enabled: skillId !== null,
  });
  const levelsQ = useQuery({
    queryKey: ['db', 'skill', skillId, 'levels'],
    queryFn: () => client.getSkillLevels(skillId as number),
    enabled: skillId !== null,
  });
  const weaponQ = useQuery({
    queryKey: ['db', 'equip', weaponId],
    queryFn: () => client.getEquip(weaponId as number),
    enabled: weaponId !== null,
  });

  const loading =
    (skillId !== null && (skillQ.isLoading || levelsQ.isLoading)) ||
    (weaponId !== null && weaponQ.isLoading);

  return useMemo(() => {
    const spellElement = decodeSkillElement(skillQ.data?.element ?? null);
    const base = {
      weaponName: weaponQ.data?.name ?? null,
      skillName: skillQ.data?.name ?? null,
      spellElement,
      loading,
      configured: stats.configured,
    };
    if (!stats.configured || skillId === null || loading) {
      return { ...base, loadout: null, basePower: null, missingBasePower: false };
    }

    const levelRow = levelsQ.data?.find((l) => l.level === skillLevel) ?? null;
    const basePower = levelRow?.mad ?? null;
    if (basePower == null) {
      return { ...base, loadout: null, basePower: null, missingBasePower: true };
    }

    const loadout: MagicLoadout = {
      totalInt,
      basePower,
      masteryFraction: FOURTH_JOB_SPELL_MASTERY,
      amplificationFraction: amplificationPct / 100,
      wandBonus: weaponElementBonus(weaponQ.data ?? null, spellElement),
      spellElement,
      hits: levelRow?.hits ?? 1,
    };
    return { ...base, loadout, basePower, missingBasePower: false };
  }, [
    stats.configured,
    skillId,
    skillLevel,
    totalInt,
    amplificationPct,
    loading,
    skillQ.data,
    levelsQ.data,
    weaponQ.data,
  ]);
}
