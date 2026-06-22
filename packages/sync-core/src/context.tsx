import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SyncEngine } from './engine';
import { INITIAL_SYNC_STATUS, type SyncStatus } from './types';

interface SyncStatusContextValue {
  status: SyncStatus;
  /** Trigger a sync cycle now ("sync now"). No-op when no engine is mounted. */
  syncNow: () => Promise<void>;
}

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

interface SyncStatusProviderProps {
  /** The active engine, or null when sync is off (signed out / self-hosted). */
  engine: SyncEngine | null;
  children: ReactNode;
}

/**
 * Mirrors the engine's status into React state and exposes it through context.
 * When `engine` is null the status stays idle and `syncNow` is inert, so the
 * provider is free to mount unconditionally — display code consumes
 * `useSyncStatus()` without ever branching on "is sync configured".
 */
export function SyncStatusProvider({ engine, children }: SyncStatusProviderProps) {
  const [status, setStatus] = useState<SyncStatus>(
    () => engine?.getStatus() ?? INITIAL_SYNC_STATUS,
  );

  useEffect(() => {
    if (!engine) {
      setStatus(INITIAL_SYNC_STATUS);
      return;
    }
    return engine.subscribeStatus(setStatus);
  }, [engine]);

  const value = useMemo<SyncStatusContextValue>(
    () => ({
      status,
      syncNow: () => engine?.syncNow() ?? Promise.resolve(),
    }),
    [engine, status],
  );

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

/** Current sync status plus the "sync now" action. Returns an inert idle value
 *  when no `SyncStatusProvider` is mounted, so it never throws. */
export function useSyncStatus(): SyncStatusContextValue {
  return (
    useContext(SyncStatusContext) ?? {
      status: INITIAL_SYNC_STATUS,
      syncNow: () => Promise.resolve(),
    }
  );
}
