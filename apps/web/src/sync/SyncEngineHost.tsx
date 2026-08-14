import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import {
  SyncEngine,
  type SyncBackend,
  type SyncEntity,
  type SyncProvider,
} from '@scrolled/sync-core';
import { SyncStatusProvider } from '@scrolled/sync-core/react';
import { useCurrentUser, useIdentity } from '@scrolled/identity-core/react';
import { getUserDbClient } from '@/db/user';
import { OUTBOX_DOORBELL_CHANNEL, type OutboxDoorbellMessage } from '@/db/user/syncDoorbell';
import { useSyncEpoch } from '@/stores/syncEpoch';

/** Every tab mounts this host, but they share one user DB, so only the tab
 *  holding this lock may drain the outbox. */
const ENGINE_LOCK = 'scrolled-sync-engine';

interface SyncEngineHostProps {
  /** The chosen transport, or null when sync is off (signed-out config or a
   *  self-hosted build). Null keeps the host inert. */
  provider: SyncProvider | null;
  queryClient: QueryClient;
  children: ReactNode;
}

/**
 * Owns the `SyncEngine` lifecycle. It starts the engine once the session is
 * authenticated and the engine lock is held, and stops it when either goes away.
 *
 * Remote changes invalidate the same TanStack keys local mutations already do,
 * so display components need no changes of their own.
 */
export function SyncEngineHost({ provider, queryClient, children }: SyncEngineHostProps) {
  const session = useCurrentUser();
  const { getAccessToken } = useIdentity();
  const [engine, setEngine] = useState<SyncEngine | null>(null);

  // Read the latest token thunk via a ref so a token refresh (which mints a new
  // session object) doesn't tear the engine down and rebuild it.
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  const authenticated = session.isAuthenticated;
  const accountId = session.userId;
  const epoch = useSyncEpoch((s) => s.epoch);

  useEffect(() => {
    if (!provider || !authenticated) {
      setEngine(null);
      return;
    }

    let cancelled = false;
    let started: SyncEngine | null = null;
    let channel: BroadcastChannel | null = null;
    let releaseLock: (() => void) | null = null;

    const teardown = () => {
      channel?.close();
      channel = null;
      started?.stop();
      started = null;
      releaseLock?.();
      releaseLock = null;
    };

    const run = async () => {
      const userDb = getUserDbClient();

      try {
        const action = await userDb.bootstrapSyncAccount(accountId);
        // An account switch discarded the previous account's rows; drop their
        // cached queries so the UI doesn't show stale data until the pull lands.
        if (action === 'reset') {
          void queryClient.invalidateQueries({ queryKey: ['user'] });
          void queryClient.invalidateQueries({ queryKey: ['recents'] });
        }
      } catch (err) {
        if (!cancelled) console.error('[sync] account bootstrap failed', err);
        return;
      }
      if (cancelled) return;

      const backend: SyncBackend = {
        drainOutbox: (limit) => userDb.drainOutbox(limit),
        markOutboxSynced: (seqs, applied) => userDb.markOutboxSynced(seqs, applied),
        applyRemoteRows: (rows) => userDb.applyRemoteRows(rows),
        replaceAllFromSnapshot: (rows) => userDb.replaceAllFromSnapshot(rows),
        rekeyLocal: (entity, fromKey, toKey) => userDb.rekeyLocal(entity, fromKey, toKey),
        getSyncMeta: () => userDb.getSyncMeta(),
        setCursor: (cursor) => userDb.setSyncCursor(cursor),
        pendingCount: () => userDb.pendingSyncCount(),
      };

      const e = new SyncEngine({
        provider,
        backend,
        invalidate: (keys) => {
          for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
        },
        getAccessToken: () => getAccessTokenRef.current(),
      });

      const doorbell = new BroadcastChannel(OUTBOX_DOORBELL_CHANNEL);
      doorbell.onmessage = (event: MessageEvent<OutboxDoorbellMessage>) => {
        const entity = event.data?.entity;
        if (entity) e.notifyLocalChange([entity as SyncEntity]);
      };

      // Assign before the cancellation check so a teardown racing this point
      // still tears down what was created.
      started = e;
      channel = doorbell;
      if (cancelled) {
        teardown();
        return;
      }

      e.start();
      setEngine(e);

      // Hold until this tab is torn down; another tab takes over on release.
      await new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
    };

    void withEngineLock(run, () => cancelled);

    return () => {
      cancelled = true;
      teardown();
      setEngine(null);
    };
  }, [provider, authenticated, accountId, queryClient, epoch]);

  return <SyncStatusProvider engine={engine}>{children}</SyncStatusProvider>;
}

/** Runs `task` while holding the engine lock. Without Web Locks every tab runs
 *  its own engine, which is the pre-existing behaviour rather than a regression. */
async function withEngineLock(task: () => Promise<void>, cancelled: () => boolean): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    await task();
    return;
  }
  await navigator.locks.request(ENGINE_LOCK, async () => {
    if (cancelled()) return;
    await task();
  });
}
