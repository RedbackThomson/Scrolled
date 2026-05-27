import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDbClient } from '@/db';
import {
  applyExpRate,
  calculateEquipRanges,
  profileExpRate,
  resolveServerProfile,
  type EquipBaseStats,
  type EquipStatKey,
  type EquipStatRange,
  type ServerProfile,
} from '@/serverProfiles';

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
  const profileIdQ = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => client.getServerProfile(),
  });

  const profile = useMemo(() => resolveServerProfile(profileIdQ.data), [profileIdQ.data]);
  const expRate = profileExpRate(profile);

  return {
    ready: !!profileIdQ.data,
    profile,
    expRate,
    applyExp: (exp) => applyExpRate(expRate, exp),
    equipRanges: (stats) => calculateEquipRanges(profile, stats),
  };
}

/** Mutation to persist the selected server profile by id. */
export function useSetServerProfile() {
  const client = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      await client.setServerProfile(profileId);
      return profileId;
    },
    onSuccess: (profileId) => {
      queryClient.setQueryData(QUERY_KEY, profileId);
      // EXP- and stat-dependent views read the profile at render time; nudge
      // cached entity queries so already-mounted detail/list pages refresh.
      queryClient.invalidateQueries({ queryKey: ['db'] });
    },
  });
}
