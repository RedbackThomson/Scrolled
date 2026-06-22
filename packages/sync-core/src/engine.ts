// The sync engine (docs/sync_design.md §8): a small state machine that runs on
// the main thread as a coordinator. It awaits network and comlink — no heavy
// CPU — so it does not violate "heavy work in a Worker". Per cycle it drains the
// outbox and pushes, pulls remote changes and applies them in the worker,
// invalidates the affected TanStack query keys, and publishes status. Network
// faults back off without ever blocking local writes.

import {
  INITIAL_SYNC_STATUS,
  type ApplyResult,
  type ServerChange,
  type SyncBackend,
  type SyncChange,
  type SyncEntity,
  type SyncProvider,
  type SyncStatus,
  type SyncStatusListener,
  type Unsubscribe,
} from './types';
import { pullResultSchema, pushResultSchema, PROTOCOL_VERSION } from './schemas';
import { SyncAuthError, SyncProtocolError } from './errors';

export interface SyncEngineConfig {
  /** Fast-lane debounce after a settings/collection mutation. */
  pushDebounceMs: number;
  /** Lazy-lane debounce; recents-only churn waits this long. */
  recentsDebounceMs: number;
  /** Safety tick in case the realtime doorbell dropped. */
  safetyTickMs: number;
  /** Max rows per push batch. */
  pushLimit: number;
  /** Backoff base and ceiling for transient faults. */
  backoffBaseMs: number;
  backoffMaxMs: number;
  /** Hard-delete local soft-tombstones older than this (§10). */
  tombstoneRetentionMs: number;
}

export const DEFAULT_SYNC_CONFIG: SyncEngineConfig = {
  pushDebounceMs: 1_000,
  recentsDebounceMs: 12_000,
  safetyTickMs: 60_000,
  pushLimit: 200,
  backoffBaseMs: 1_000,
  backoffMaxMs: 60_000,
  tombstoneRetentionMs: 90 * 24 * 60 * 60 * 1_000, // 90 days
};

export interface SyncEngineDeps {
  provider: SyncProvider;
  backend: SyncBackend;
  /** Invalidate the given TanStack query-key roots on the main thread. */
  invalidate: (keys: string[][]) => void;
  /** Ask identity for a fresh token after a 401; null when it can't. */
  getAccessToken?: () => Promise<string | null>;
  config?: Partial<SyncEngineConfig>;
  /** Injectable clock for deterministic `lastSyncedAt` in tests. */
  now?: () => number;
  /** Injectable jitter source; defaults to `Math.random`. */
  random?: () => number;
}

type Reason = 'start' | 'mutation' | 'poke' | 'manual' | 'tick';

const FAST_LANE_ENTITIES: ReadonlySet<SyncEntity> = new Set([
  'collection',
  'collection_member',
  'collection_group',
  'pinned_search',
  'user_setting',
]);

export class SyncEngine {
  private readonly provider: SyncProvider;
  private readonly backend: SyncBackend;
  private readonly invalidate: (keys: string[][]) => void;
  private readonly getAccessToken?: () => Promise<string | null>;
  private readonly cfg: SyncEngineConfig;
  private readonly now: () => number;
  private readonly random: () => number;

  private status: SyncStatus = INITIAL_SYNC_STATUS;
  private readonly listeners = new Set<SyncStatusListener>();

  private started = false;
  private running = false;
  /** A trigger arrived mid-cycle; run one more cycle when this one finishes. */
  private rerun = false;
  private failures = 0;
  /** The protocol handshake is verified once per engine, lazily on first cycle. */
  private protocolChecked = false;

  private unsubscribePoke: Unsubscribe | null = null;
  private fastTimer: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyTimer: ReturnType<typeof setInterval> | null = null;
  private backoffTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: SyncEngineDeps) {
    this.provider = deps.provider;
    this.backend = deps.backend;
    this.invalidate = deps.invalidate;
    this.getAccessToken = deps.getAccessToken;
    this.cfg = { ...DEFAULT_SYNC_CONFIG, ...deps.config };
    this.now = deps.now ?? Date.now;
    this.random = deps.random ?? Math.random;
  }

  // -- status -----------------------------------------------------------------

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribeStatus(listener: SyncStatusListener): Unsubscribe {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) listener(this.status);
  }

  // -- lifecycle --------------------------------------------------------------

  /** Begin syncing: handshake, subscribe to the doorbell, kick a first cycle,
   *  and arm the safety tick. Idempotent. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.unsubscribePoke = this.provider.subscribe(() => this.requestSync('poke'));
    this.safetyTimer = setInterval(() => {
      void this.gcTombstones();
      this.requestSync('tick');
    }, this.cfg.safetyTickMs);
    this.requestSync('start');
  }

  /** Stop syncing and release timers/subscriptions. The outbox is untouched —
   *  local writes keep accumulating and resume on the next `start`. */
  stop(): void {
    this.started = false;
    this.unsubscribePoke?.();
    this.unsubscribePoke = null;
    this.clearTimers();
    this.setStatus({ state: 'idle' });
  }

  private clearTimers(): void {
    if (this.fastTimer) clearTimeout(this.fastTimer);
    if (this.slowTimer) clearTimeout(this.slowTimer);
    if (this.safetyTimer) clearInterval(this.safetyTimer);
    if (this.backoffTimer) clearTimeout(this.backoffTimer);
    this.fastTimer = this.slowTimer = this.backoffTimer = null;
    this.safetyTimer = null;
  }

  // -- triggers ---------------------------------------------------------------

  /**
   * Note that local data changed. Settings/collection edits drain on the fast
   * lane (debounced); recents-only churn waits for the lazy lane so view spam
   * doesn't dominate traffic.
   */
  notifyLocalChange(entities: readonly SyncEntity[]): void {
    if (!this.started) return;
    const fast = entities.some((e) => FAST_LANE_ENTITIES.has(e));
    if (fast) {
      if (this.fastTimer) clearTimeout(this.fastTimer);
      this.fastTimer = setTimeout(() => {
        this.fastTimer = null;
        this.requestSync('mutation');
      }, this.cfg.pushDebounceMs);
    } else if (!this.slowTimer) {
      this.slowTimer = setTimeout(() => {
        this.slowTimer = null;
        this.requestSync('mutation');
      }, this.cfg.recentsDebounceMs);
    }
  }

  /** Schedule a cycle now (collapsing concurrent triggers into one rerun). */
  requestSync(_reason: Reason = 'manual'): void {
    if (!this.started) return;
    void this.run();
  }

  /** Run one cycle immediately and resolve when it finishes. The "sync now"
   *  action and the test entrypoint. */
  async syncNow(): Promise<void> {
    await this.run();
  }

  /** Reclaim local soft-tombstones older than the retention window. Best-effort
   *  on the safety tick; a failure never disrupts a sync cycle. */
  private async gcTombstones(): Promise<void> {
    if (!this.backend.gcTombstones) return;
    try {
      await this.backend.gcTombstones(this.now() - this.cfg.tombstoneRetentionMs);
    } catch {
      // ignore; retried on the next tick
    }
  }

  // -- the cycle --------------------------------------------------------------

  private async run(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    this.setStatus({ state: 'syncing' });
    try {
      await this.cycle();
      this.failures = 0;
      this.setStatus({ state: 'synced', lastSyncedAt: this.now(), error: null, errorKind: null });
    } catch (err) {
      this.handleFailure(err);
    } finally {
      this.running = false;
      if (this.rerun) {
        this.rerun = false;
        void this.run();
      }
    }
  }

  private async cycle(): Promise<void> {
    await this.ensureProtocol();
    await this.pushPhase();
    await this.pullPhase();
  }

  /**
   * Verify the wire contract before the first push/pull. A client below the
   * server's `minClientRevision` throws a non-retryable `SyncProtocolError`
   * (surfaced as "please update"); a transient `hello()` fault falls through to
   * the normal backoff, so the gate retries on the next cycle and offline use is
   * never blocked. Verified once — handshakes don't change mid-session.
   */
  private async ensureProtocol(): Promise<void> {
    if (this.protocolChecked) return;
    const handshake = await this.provider.hello();
    if (handshake.minClientRevision > PROTOCOL_VERSION) {
      throw new SyncProtocolError('A newer app version is required to sync. Refresh to update.');
    }
    this.protocolChecked = true;
  }

  private async pushPhase(): Promise<void> {
    // Drain → push → ack, looping until the outbox is empty. Conflicts are
    // applied through the same `applyRemoteChanges` path as a pull: if the
    // local edit wins it re-emerges with a fresh `base_revision` and the next
    // drain re-pushes it; if it loses, its outbox entry is dropped.
    for (let guard = 0; guard < 1000; guard++) {
      const batch = await this.backend.drainOutbox(this.cfg.pushLimit);
      if (batch.length === 0) {
        this.setStatus({ pendingChanges: 0 });
        return;
      }
      this.setStatus({ pendingChanges: batch.length });

      // The provider's return is already typed `PushResult`; validate its shape
      // at the boundary (it may be a remote server) but keep the typed value.
      const result = await this.provider.push(batch.map(toWireChange));
      pushResultSchema.parse(result);

      if (result.applied.length > 0) {
        const seqs = batch
          .filter((b) => result.applied.some((a) => a.uuid === b.uuid))
          .map((b) => b.seq);
        await this.backend.markOutboxSynced(
          seqs,
          result.applied.map((a) => ({
            uuid: a.uuid,
            revision: a.revision,
            serverSeq: a.serverSeq,
          })),
        );
      }

      if (result.conflicts.length > 0) {
        const remotes: ServerChange[] = result.conflicts.map((c) => ({
          ...c.remote,
          // A 409 carries no seq; pass 0 so the cursor never moves backward —
          // the subsequent pull re-delivers it with its real seq.
          serverSeq: 0,
        }));
        await this.applyAndInvalidate(remotes);
      } else if (result.applied.length === 0) {
        // Neither applied nor conflicted: nothing actionable, avoid spinning.
        return;
      }
    }
  }

  private async pullPhase(): Promise<void> {
    for (let guard = 0; guard < 1000; guard++) {
      const meta = await this.backend.getSyncMeta();
      const result = await this.provider.pull(meta.serverSeq);
      pullResultSchema.parse(result);
      if (result.rebootstrapRequired) {
        // Our cursor is past the server's GC horizon (§15): discard local synced
        // state and loop to re-pull from 0 rather than miss GC'd deletes.
        const keys = await this.backend.rebootstrap();
        if (keys.length > 0) this.invalidate(keys);
        continue;
      }
      if (result.changes.length > 0) {
        await this.applyAndInvalidate(result.changes);
      }
      if (!result.hasMore) return;
    }
  }

  private async applyAndInvalidate(changes: ServerChange[]): Promise<ApplyResult> {
    const result = await this.backend.applyRemoteChanges(changes);
    if (result.invalidatedKeys.length > 0) this.invalidate(result.invalidatedKeys);
    return result;
  }

  // -- failure handling -------------------------------------------------------

  private handleFailure(err: unknown): void {
    if (err instanceof SyncProtocolError) {
      this.setStatus({ state: 'error', error: err.message, errorKind: 'protocol' });
      return;
    }
    if (err instanceof SyncAuthError) {
      void this.tryRefreshAndRetry(err);
      return;
    }
    // Treat everything else as transient: back off and retry.
    const message = err instanceof Error ? err.message : String(err);
    this.failures += 1;
    this.setStatus({ state: 'offline', error: message, errorKind: 'transient' });
    this.scheduleBackoff();
  }

  private async tryRefreshAndRetry(err: SyncAuthError): Promise<void> {
    const token = this.getAccessToken ? await this.getAccessToken().catch(() => null) : null;
    if (token) {
      this.requestSync('manual');
    } else {
      this.setStatus({ state: 'error', error: err.message, errorKind: 'auth' });
    }
  }

  private scheduleBackoff(): void {
    if (!this.started || this.backoffTimer) return;
    const exp = Math.min(
      this.cfg.backoffBaseMs * 2 ** (this.failures - 1),
      this.cfg.backoffMaxMs,
    );
    const delay = exp / 2 + this.random() * (exp / 2); // full-ish jitter
    this.backoffTimer = setTimeout(() => {
      this.backoffTimer = null;
      this.requestSync('tick');
    }, delay);
  }
}

function toWireChange(change: SyncChange): SyncChange {
  return {
    entity: change.entity,
    uuid: change.uuid,
    op: change.op,
    payload: change.payload,
    baseRevision: change.baseRevision,
    idempotency: change.idempotency,
  };
}

/** Re-export so the bootstrap shim can compare against the server handshake. */
export { PROTOCOL_VERSION };
