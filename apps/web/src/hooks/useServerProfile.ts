import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDbClient } from '@/db';
import { getUserDbClient } from '@/db/user';
import {
  applyExpRate,
  calculateEquipRanges,
  profileExpRate,
  resolveServerProfile,
  type EquipBaseStats,
  type EquipStatKey,
  type EquipStatRange,
  type ServerProfile,
} from '@scrolled/game-db/serverProfiles';
import { resolveActiveServerProfile, setActiveServerProfileId } from '@/lib/serverProfileResolution';

const QUERY_KEY = ['db', 'server-profile'] as const;

export interface ServerProfileState {
  /** True once the persisted selection has loaded. */
  ready: boolean;
  /** The active profile (falls back to the baseline before load). */
  profile: ServerProfile;
  /** The active profile's EXP multiplier. */
  expRate: number;
  /** Apply the EXP rate to a base value, preserving null. */
  applyExp: (exp: number | null) => number | null;
  /** Possible stat ranges for an equip's combat stats under the active profile. */
  equipRanges: (stats: EquipBaseStats) => Partial<Record<EquipStatKey, EquipStatRange>>;
}

export function useServerProfile(): ServerProfileState {
  const client = useMemo(() => getDbClient(), []);
  const userClient = useMemo(() => getUserDbClient(), []);
  const profileQ = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => resolveActiveServerProfile(client, userClient),
  });

  const profile = profileQ.data ?? resolveServerProfile(undefined);
  const expRate = profileExpRate(profile);

  return {
    ready: !!profileQ.data,
    profile,
    expRate,
    applyExp: (exp) => applyExpRate(expRate, exp),
    equipRanges: (stats) => calculateEquipRanges(profile, stats),
  };
}

/** Mutation to persist the selected server profile by id (generic mode). */
export function useSetServerProfile() {
  const userClient = useMemo(() => getUserDbClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      await setActiveServerProfileId(userClient, profileId);
      return profileId;
    },
    onSuccess: () => {
      // The profile query resolves a full ServerProfile (preferring inline
      // config), so invalidate rather than seeding it with the bare id. EXP- and
      // stat-dependent views read the profile at render time, so nudge cached
      // entity queries too — this covers both.
      queryClient.invalidateQueries({ queryKey: ['db'] });
    },
  });
}
