import { useUserSetting } from '@/hooks/useUserSetting';
import {
  DEFAULT_MAGIC_STATS,
  MAGIC_STATS_KEY,
  magicStatsSchema,
  type MagicStats,
} from './magicStats';

export interface UseMagicStatsResult {
  value: MagicStats;
  set: (next: MagicStats) => Promise<void>;
  reset: () => Promise<void>;
  loading: boolean;
  /** True once there's enough to compute — a spell and a non-zero INT. */
  configured: boolean;
}

export function useMagicStats(): UseMagicStatsResult {
  const pref = useUserSetting(MAGIC_STATS_KEY, magicStatsSchema, DEFAULT_MAGIC_STATS);
  const value = pref.value;
  return {
    value,
    set: pref.set,
    reset: pref.reset,
    loading: pref.query.isPending,
    configured: value.skillId !== null && value.totalInt > 0,
  };
}
