import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import {
  SyncEngine,
  PROTOCOL_VERSION,
  type SyncBackend,
  type SyncEntity,
  type SyncProvider,
} from '@scrolled/sync-core';
import { SyncStatusProvider } from '@scrolled/sync-core/react';
import { useCurrentUser, useIdentity } from '@scrolled/identity-core/react';
import { getUserDbClient } from '@/db/user';
import { OUTBOX_DOORBELL_CHANNEL, type OutboxDoorbellMessage } from '@/db/user/syncDoorbell';

interface SyncEngineHostProps {
  /** The chosen transport, or null when sync is off (signed-out config or a
   *  self-hosted build). Null keeps the host inert. */
  provider: SyncProvider | null;
  /** The app's TanStack client; remote changes invalidate keys through it. */
  queryClient: QueryClient;
  children: ReactNode;
}

/**
 * Owns the `SyncEngine` lifecycle on the main thread (docs/sync_design.md §13).
 * It starts the engine when the session becomes authenticated and stops it when
 * it goes anonymous, reconciling local data with the account first (bootstrap,
 * §11). Local mutations reach the engine through the worker→main outbox
 * doorbell; remote changes invalidate the same TanStack keys local mutations
 * already do, so display components update with no changes of their own (§9).
 *
 * Liveness here is the engine's 60s safety tick plus the post-mutation
 * debounce — no realtime yet (that is Phase 4). When `provider` is null the host
 * mounts an inert `SyncStatusProvider`, so `useSyncStatus()` stays safe to call
 * everywhere.
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

  useEffect(() => {
    if (!provider || !authenticated) {
      setEngine(null);
      return;
    }

    let cancelled = false;
    let started: SyncEngine | null = null;
    let channel: BroadcastChannel | null = null;

    void (async () => {
      const userDb = getUserDbClient();

      // Protocol handshake: a client too old for the server is told to upgrade
      // (Phase 5 surfaces this in the UI). A network failure here is non-fatal —
      // the engine's own cycle backs off — so offline use is never blocked.
      try {
        const handshake = await provider.hello();
        if (handshake.minClientRevision > PROTOCOL_VERSION) {
          if (!cancelled) {
            console.warn('[sync] client protocol is older than the server requires; sync paused');
          }
          return;
        }
      } catch {
        // ignore; a later cycle retries
      }
      if (cancelled) return;

      // Reconcile the local DB with this account before the first cycle: adopt
      // anonymous data, reset on an account switch, or resume (§11).
      try {
        await userDb.bootstrapSyncAccount(accountId);
      } catch (err) {
        if (!cancelled) console.error('[sync] account bootstrap failed', err);
        return;
      }
      if (cancelled) return;

      const backend: SyncBackend = {
        drainOutbox: (limit) => userDb.drainOutbox(limit),
        markOutboxSynced: (seqs, assigned) => userDb.markOutboxSynced(seqs, assigned),
        applyRemoteChanges: (batch) => userDb.applyRemoteChanges(batch),
        getSyncMeta: () => userDb.getSyncMeta(),
      };

      const e = new SyncEngine({
        provider,
        backend,
        invalidate: (keys) => {
          for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
        },
        getAccessToken: () => getAccessTokenRef.current(),
      });
      started = e;
      e.start();
      setEngine(e);

      // The user-DB worker rings this channel on every outbox append; route the
      // changed entity into the engine's fast/lazy drain lane.
      channel = new BroadcastChannel(OUTBOX_DOORBELL_CHANNEL);
      channel.onmessage = (event: MessageEvent<OutboxDoorbellMessage>) => {
        const entity = event.data?.entity;
        if (entity) e.notifyLocalChange([entity as SyncEntity]);
      };
    })();

    return () => {
      cancelled = true;
      channel?.close();
      started?.stop();
      setEngine(null);
    };
  }, [provider, authenticated, accountId, queryClient]);

  return <SyncStatusProvider engine={engine}>{children}</SyncStatusProvider>;
}
