// A small state machine coordinating the local outbox and the remote store. It
// runs on the main thread because it only awaits network and comlink; the SQLite
// work happens behind `SyncBackend`. Network faults back off and never block
// local writes.

import {
  INITIAL_SYNC_STATUS,
  SYNC_ENTITIES,
  type OutboxChange,
  type SyncBackend,
  type SyncEntity,
  type SyncProvider,
  type SyncStatus,
  type SyncStatusListener,
  type Unsubscribe,
} from './types';
import { fetchPageSchema, upsertResultSchema, PROTOCOL_VERSION } from './schemas';
import { resolveCollisions } from './rekey';
import { SyncAuthError, SyncError, SyncProtocolError } from './errors';

export interface SyncEngineConfig {
  pushDebounceMs: number;
  /** Recents churn on every page view, so it gets a slower lane. */
  recentsDebounceMs: number;
  /** Safety tick in case the doorbell dropped. */
  safetyTickMs: number;
  pushLimit: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  /**
   * How far behind the stored cursor to start each pull. Covers rows committed
   * out of timestamp order; re-delivery is harmless because applying is an
   * idempotent upsert.
   */
  cursorOverlapMs: number;
  /** Tombstones older than this are reaped, so a cursor older than it cannot be
   *  trusted for a delta pull and forces a full reconcile. */
  tombstoneRetentionMs: number;
}

export const DEFAULT_SYNC_CONFIG: SyncEngineConfig = {
  pushDebounceMs: 1_000,
  recentsDebounceMs: 12_000,
  safetyTickMs: 60_000,
  pushLimit: 200,
  backoffBaseMs: 1_000,
  backoffMaxMs: 60_000,
  cursorOverlapMs: 5 * 60_000,
  tombstoneRetentionMs: 90 * 24 * 60 * 60 * 1_000,
};

export interface SyncEngineDeps {
  provider: SyncProvider;
  backend: SyncBackend;
  invalidate: (keys: string[][]) => void;
  /** Ask identity for a fresh token after a 401; null when it can't. */
  getAccessToken?: () => Promise<string | null>;
  config?: Partial<SyncEngineConfig>;
  now?: () => number;
  random?: () => number;
}

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
  /** A trigger arrived mid-cycle; run once more when this cycle finishes. */
  private rerun = false;
  private failures = 0;
  private protocolChecked = false;
  private deviceId = '';
  /** Incremented to abandon in-flight work; see `resync`. */
  private generation = 0;
  /** Set by `resync()`; the next cycle replaces local state from a snapshot. */
  private reconcilePending = false;

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

  start(): void {
    if (this.started) return;
    this.started = true;
    this.unsubscribePoke = this.provider.subscribe((originDevice) => {
      if (originDevice && originDevice === this.deviceId) return;
      this.requestSync();
    });
    this.safetyTimer = setInterval(() => {
      void this.gcTombstones();
      this.requestSync();
    }, this.cfg.safetyTickMs);
    this.requestSync();
  }

  /** The outbox is untouched, so local writes keep accumulating and resume on
   *  the next `start`. */
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

  notifyLocalChange(entities: readonly SyncEntity[]): void {
    if (!this.started) return;
    const fast = entities.some((e) => FAST_LANE_ENTITIES.has(e));
    if (fast) {
      if (this.fastTimer) clearTimeout(this.fastTimer);
      this.fastTimer = setTimeout(() => {
        this.fastTimer = null;
        this.requestSync();
      }, this.cfg.pushDebounceMs);
    } else if (!this.slowTimer) {
      this.slowTimer = setTimeout(() => {
        this.slowTimer = null;
        this.requestSync();
      }, this.cfg.recentsDebounceMs);
    }
  }

  requestSync(): void {
    if (!this.started) return;
    void this.run();
  }

  async syncNow(): Promise<void> {
    await this.run();
  }

  /**
   * Discard local state and rebuild it from the remote store. The escape hatch
   * when a device has diverged; also used after restoring a backup.
   *
   * Bumps the generation so a cycle already in flight abandons its remaining
   * work — the device that needs this most is the one whose cycle is not
   * finishing, and waiting for it to end would strand the user.
   */
  async resync(): Promise<void> {
    this.reconcilePending = true;
    this.generation += 1;
    await this.run();
  }

  /** True when a newer request has superseded the work `gen` belongs to. */
  private superseded(gen: number): boolean {
    return this.generation !== gen;
  }

  private async gcTombstones(): Promise<void> {
    try {
      await this.provider.gcTombstones(
        new Date(this.now() - this.cfg.tombstoneRetentionMs).toISOString(),
      );
    } catch {
      // Best-effort; retried on the next tick.
    }
  }

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
      this.setStatus({
        state: 'synced',
        lastSyncedAt: this.now(),
        pendingChanges: await this.backend.pendingCount(),
        error: null,
        errorKind: null,
      });
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

  private async ensureProtocol(): Promise<void> {
    if (this.protocolChecked) return;
    const handshake = await this.provider.hello();
    if (handshake.minClientRevision > PROTOCOL_VERSION) {
      throw new SyncProtocolError('A newer app version is required to sync. Refresh to update.');
    }
    this.protocolChecked = true;
  }

  private async pushPhase(): Promise<void> {
    const gen = this.generation;
    for (let guard = 0; guard < 1000; guard++) {
      if (this.superseded(gen)) return;
      const batch = await this.backend.drainOutbox(this.cfg.pushLimit);
      if (batch.length === 0) {
        this.setStatus({ pendingChanges: 0 });
        return;
      }
      this.setStatus({ pendingChanges: await this.backend.pendingCount() });

      let progressed = false;

      // Parents first: the remote store rejects a member whose collection it has
      // not seen, so ordering here is what keeps that from happening.
      for (const entity of SYNC_ENTITIES) {
        const forEntity = batch.filter((c) => c.entity === entity);
        if (forEntity.length === 0) continue;

        const result = await this.provider.upsert(
          entity,
          forEntity.map((c) => c.row),
        );
        upsertResultSchema.parse(result);

        if (result.applied.length > 0) {
          const acked = new Set(result.applied.map((a) => a.key));
          // Progress is the queue shrinking. A write the server accepted but
          // that stayed queued would otherwise be re-sent on every pass.
          const removed = await this.backend.markOutboxSynced(
            forEntity.filter((c) => acked.has(c.key)).map((c) => c.seq),
            result.applied,
          );
          if (removed > 0) progressed = true;
        }

        if (result.nameCollisions.length > 0) {
          // Re-drain rather than continuing: children still queued reference the
          // key we just abandoned.
          if (await resolveCollisions(this.provider, this.backend, result)) {
            progressed = true;
            break;
          }
        }
      }

      // Nothing landed and nothing rekeyed: retrying the same batch would spin.
      if (!progressed) return;
    }
    // Falling out of the loop means the queue kept re-offering work it could not
    // clear. Surfacing it beats spinning silently while the UI reads "syncing".
    throw new SyncError('Sync could not drain pending changes; they will be retried.');
  }

  private async pullPhase(): Promise<void> {
    const meta = await this.backend.getSyncMeta();
    this.deviceId = meta.deviceId;

    if (this.reconcilePending || this.cursorTooOld(meta.cursor)) {
      this.reconcilePending = false;
      await this.reconcile();
      return;
    }

    let cursor = overlap(meta.cursor, this.cfg.cursorOverlapMs);
    const gen = this.generation;
    for (let guard = 0; guard < 1000; guard++) {
      if (this.superseded(gen)) return;
      const page = await this.provider.fetchSince(cursor);
      fetchPageSchema.parse(page);

      if (page.rows.length > 0) {
        const result = await this.backend.applyRemoteRows(page.rows);
        if (result.invalidatedKeys.length > 0) this.invalidate(result.invalidatedKeys);
        if (page.cursor > meta.cursor) await this.backend.setCursor(page.cursor);
        cursor = page.cursor;
      }
      if (page.complete) return;
    }
    throw new SyncError('Sync could not reach the end of the change feed.');
  }

  /** A cursor older than the tombstone window may have missed reaped deletes, so
   *  a delta pull could silently keep rows the account no longer has. */
  private cursorTooOld(cursor: string): boolean {
    if (!cursor) return false;
    const at = Date.parse(cursor);
    if (Number.isNaN(at)) return true;
    return at < this.now() - this.cfg.tombstoneRetentionMs;
  }

  private async reconcile(): Promise<void> {
    const rows = await this.provider.fetchAll();
    const result = await this.backend.replaceAllFromSnapshot(rows);
    if (result.invalidatedKeys.length > 0) this.invalidate(result.invalidatedKeys);
    const newest = rows.reduce((max, r) => (r.serverTime > max ? r.serverTime : max), '');
    if (newest) await this.backend.setCursor(newest);
  }

  private handleFailure(err: unknown): void {
    if (err instanceof SyncProtocolError) {
      this.setStatus({ state: 'error', error: err.message, errorKind: 'protocol' });
      return;
    }
    if (err instanceof SyncAuthError) {
      void this.tryRefreshAndRetry(err);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    this.failures += 1;
    this.setStatus({ state: 'offline', error: message, errorKind: 'transient' });
    this.scheduleBackoff();
  }

  private async tryRefreshAndRetry(err: SyncAuthError): Promise<void> {
    const token = this.getAccessToken ? await this.getAccessToken().catch(() => null) : null;
    if (token) {
      this.requestSync();
    } else {
      this.setStatus({ state: 'error', error: err.message, errorKind: 'auth' });
    }
  }

  private scheduleBackoff(): void {
    if (!this.started || this.backoffTimer) return;
    const exp = Math.min(this.cfg.backoffBaseMs * 2 ** (this.failures - 1), this.cfg.backoffMaxMs);
    const delay = exp / 2 + this.random() * (exp / 2);
    this.backoffTimer = setTimeout(() => {
      this.backoffTimer = null;
      this.requestSync();
    }, delay);
  }
}

function overlap(cursor: string, overlapMs: number): string | null {
  if (!cursor) return null;
  const at = Date.parse(cursor);
  if (Number.isNaN(at)) return null;
  return new Date(Math.max(0, at - overlapMs)).toISOString();
}

export { PROTOCOL_VERSION };

export type { OutboxChange };
