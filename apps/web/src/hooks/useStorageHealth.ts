import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDbClient } from '@/db';
import { getUserDbClient } from '@/db/user';

export interface StorageFailure {
  /** Which store fell back to memory, in user-facing terms. */
  label: string;
  reason: string;
  detail: string | null;
}

export interface StorageHealth {
  /** True once both status queries have settled — gate UI on this first. */
  resolved: boolean;
  /** True when either store opened in-memory instead of on-device. */
  unavailable: boolean;
  failures: StorageFailure[];
}

/**
 * Reports whether on-device storage actually worked. Both DBs open OPFS-first
 * and silently fall back to an in-memory engine; that fallback means anything
 * loaded is lost on reload, which we treat as a hard error worth blocking on.
 * The two status queries share their keys with the rest of the app, so this is
 * just another observer, not extra work.
 */
export function useStorageHealth(): StorageHealth {
  const db = useMemo(() => getDbClient(), []);
  const userDb = useMemo(() => getUserDbClient(), []);
  const gameQ = useQuery({ queryKey: ['db', 'status'], queryFn: () => db.status() });
  const userQ = useQuery({ queryKey: ['user', 'status'], queryFn: () => userDb.status() });

  return useMemo<StorageHealth>(() => {
    const resolved = !!gameQ.data && !!userQ.data;
    const failures: StorageFailure[] = [];
    if (gameQ.data && gameQ.data.backend !== 'opfs') {
      failures.push({
        label: 'Game data',
        reason: gameQ.data.fallbackReason ?? 'On-device storage is unavailable.',
        detail: gameQ.data.fallbackDetail,
      });
    }
    if (userQ.data && userQ.data.backend !== 'opfs') {
      failures.push({
        label: 'Collections and settings',
        reason: userQ.data.fallbackReason ?? 'On-device storage is unavailable.',
        detail: userQ.data.fallbackDetail,
      });
    }
    return { resolved, unavailable: failures.length > 0, failures };
  }, [gameQ.data, userQ.data]);
}
