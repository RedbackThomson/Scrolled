// The provider-agnostic sync contract (docs/sync_design.md §8). The core app is
// sync-AWARE — it reads a status and consumes the engine — but never aware of
// *how* the wire is implemented. Concrete providers (mock, Supabase, a
// self-hosted server) implement `SyncProvider`; only the bootstrap layer
// chooses one. Nothing here imports a network SDK.

/** The user-owned record kinds that participate in sync. Mirrors the
 *  `SyncEntity` union the user-DB outbox emits (apps/web/src/db/user). */
export type SyncEntity =
  | 'collection'
  | 'collection_member'
  | 'collection_group'
  | 'pinned_search'
  | 'user_setting'
  | 'recent';

export const SYNC_ENTITIES = [
  'collection',
  'collection_member',
  'collection_group',
  'pinned_search',
  'user_setting',
  'recent',
] as const satisfies readonly SyncEntity[];

export type SyncOp = 'upsert' | 'delete';

/**
 * One logical change on the wire. `payload` is the record snapshot at write
 * time, validated with zod at the boundary (`schemas.ts`) before it is trusted.
 * `baseRevision` is the revision the edit was based on — the server accepts the
 * write only if it still matches, otherwise it reports a 409 conflict.
 */
export interface SyncChange {
  entity: SyncEntity;
  uuid: string;
  op: SyncOp;
  payload: unknown;
  baseRevision: number;
  /** Stable key for at-least-once retry dedup (Stripe-style idempotency). */
  idempotency: string;
}

/** A change the server has accepted: it carries the assigned monotonic
 *  `revision` and the per-account total-order `serverSeq`. */
export interface ServerChange extends SyncChange {
  revision: number;
  serverSeq: number;
}

export interface PushResult {
  /** Accepted changes, with the revision + seq the server assigned each. */
  applied: { uuid: string; revision: number; serverSeq: number }[];
  /** Rejected changes (stale `baseRevision`), each with the server's current
   *  record so the client can resolve the conflict and re-push. */
  conflicts: { uuid: string; remote: SyncChange & { revision: number } }[];
}

export interface PullResult {
  changes: ServerChange[];
  /** Cursor to pass to the next `pull`. */
  nextCursor: number;
  /** True while a paginated bootstrap still has changes beyond this page. */
  hasMore: boolean;
}

export interface ProtocolHandshake {
  protocolVersion: number;
  /** Lowest client protocol version the server still accepts. */
  minClientRevision: number;
}

export type Unsubscribe = () => void;

export interface SyncProvider {
  /** Push a batch; the server assigns revisions/seqs and reports conflicts. */
  push(changes: SyncChange[]): Promise<PushResult>;
  /** Pull all changes after `cursor`, paginated. */
  pull(cursor: number): Promise<PullResult>;
  /** Live "there are new changes, pull now" doorbell. May be a no-op. */
  subscribe(onPoke: () => void): Unsubscribe;
  /** Protocol/compat handshake; lets the server reject incompatible clients. */
  hello(): Promise<ProtocolHandshake>;
}

// -- engine ↔ worker boundary -------------------------------------------------

/** An outbox row drained for pushing: a `SyncChange` plus its local `seq`. */
export interface OutboxChange extends SyncChange {
  seq: number;
}

/** The server identity + cursor the engine needs to drive a sync cycle. */
export interface SyncMeta {
  serverSeq: number;
  deviceId: string;
  /** Whose data this DB currently holds; null before the first sign-in. */
  accountId: string | null;
}

/** The revision + seq the server assigned an accepted change, fed back to the
 *  worker so the live row's `revision` tracks the server's. */
export interface AssignedRevision {
  uuid: string;
  revision: number;
  serverSeq: number;
}

/** Outcome of applying a remote batch: the TanStack query-key roots that
 *  changed, so the engine can invalidate exactly those. */
export interface ApplyResult {
  /** Query-key roots to invalidate, e.g. `['user','collections']`. */
  invalidatedKeys: string[][];
  /** New cursor after applying (the highest `serverSeq` seen). */
  serverSeq: number;
}

/**
 * The worker-side surface the engine drives over comlink. Abstracted here so
 * `sync-core` stays free of comlink, SQLite, and the app's UserDbApi shape —
 * the app provides a thin adapter binding these to `UserDbApi`.
 */
export interface SyncBackend {
  drainOutbox(limit: number): Promise<OutboxChange[]>;
  markOutboxSynced(seqs: number[], assigned: AssignedRevision[]): Promise<void>;
  applyRemoteChanges(batch: ServerChange[]): Promise<ApplyResult>;
  getSyncMeta(): Promise<SyncMeta>;
}

// -- status -------------------------------------------------------------------

export type SyncState =
  | 'idle' // signed out / not started
  | 'syncing' // a push/pull cycle is in flight
  | 'synced' // up to date, nothing pending
  | 'offline' // a network error backed us off; will retry
  | 'error'; // a non-retryable error (e.g. session expired, incompatible)

/**
 * Why the last cycle failed, so the UI can offer the right next step without
 * parsing the error message. `transient` pairs with `offline`; `auth` and
 * `protocol` pair with `error` (session expired → re-auth; client too old →
 * refresh). Null when healthy.
 */
export type SyncErrorKind = 'transient' | 'auth' | 'protocol';

export interface SyncStatus {
  state: SyncState;
  /** Wall-clock ms of the last fully-successful cycle; null if never. */
  lastSyncedAt: number | null;
  /** Outbox rows still awaiting a successful push. */
  pendingChanges: number;
  /** Human-readable last error; null when healthy. */
  error: string | null;
  /** Machine-readable error category for UI branching; null when healthy. */
  errorKind: SyncErrorKind | null;
}

export const INITIAL_SYNC_STATUS: SyncStatus = {
  state: 'idle',
  lastSyncedAt: null,
  pendingChanges: 0,
  error: null,
  errorKind: null,
};

export type SyncStatusListener = (status: SyncStatus) => void;
