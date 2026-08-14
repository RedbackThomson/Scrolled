// The provider-agnostic sync contract. The app is sync-aware but never aware of
// how the wire is implemented; concrete providers implement `SyncProvider` and
// only the bootstrap layer picks one. Nothing here imports a network SDK.

export type SyncEntity =
  | 'collection'
  | 'collection_member'
  | 'collection_group'
  | 'pinned_search'
  | 'user_setting'
  | 'recent';

/** Ordered so a record's parent always comes first. */
export const SYNC_ENTITIES = [
  'collection',
  'collection_group',
  'collection_member',
  'pinned_search',
  'user_setting',
  'recent',
] as const satisfies readonly SyncEntity[];

export const ENTITY_TABLE = {
  collection: 'sync_collections',
  collection_group: 'sync_collection_groups',
  collection_member: 'sync_collection_members',
  pinned_search: 'sync_pinned_searches',
  user_setting: 'sync_user_settings',
  recent: 'sync_recents',
} as const satisfies Record<SyncEntity, string>;

export type SyncTable = (typeof ENTITY_TABLE)[SyncEntity];

/**
 * The columns forming a record's identity, matching its primary key both
 * remotely and locally. Everything that has to decide "are these the same
 * record?" derives it from here, so the outbox, the apply path and the upsert
 * conflict target can never disagree.
 */
export const ENTITY_KEY_COLUMNS = {
  collection: ['key'],
  collection_group: ['key'],
  collection_member: ['collection_key', 'entity_type', 'entity_id'],
  pinned_search: ['key'],
  user_setting: ['key'],
  recent: ['kind', 'ref'],
} as const satisfies Record<SyncEntity, readonly string[]>;

/**
 * Entities with a user-visible unique name. A rejected insert on that column is
 * a merge signal, not an error: the record already exists under another key.
 */
export const ENTITY_UNIQUE_NAME = {
  collection: { column: 'name', scope: [] },
  collection_group: { column: 'name', scope: ['collection_key'] },
  pinned_search: { column: 'name', scope: [] },
} as const satisfies Partial<Record<SyncEntity, { column: string; scope: readonly string[] }>>;

export type NameCollidingEntity = keyof typeof ENTITY_UNIQUE_NAME;

export function collidesByName(entity: SyncEntity): entity is NameCollidingEntity {
  return entity in ENTITY_UNIQUE_NAME;
}

export type SyncOp = 'upsert' | 'delete';

/** A row in the remote store: plain column→value, no envelope. */
export type RemoteRow = Record<string, unknown>;

export interface TaggedRow {
  entity: SyncEntity;
  row: RemoteRow;
  /** Staleness comparator, stamped remotely. */
  seq: number;
  /** Pull cursor position, stamped remotely. */
  serverTime: string;
}

/** A local change awaiting push. A delete is an upsert setting `deleted_at`, so
 *  an offline device still learns of it on its next pull. */
export interface OutboxChange {
  seq: number;
  entity: SyncEntity;
  key: string;
  op: SyncOp;
  row: RemoteRow;
}

export interface UpsertResult {
  applied: { key: string; seq: number }[];
  /** The whole rejected row comes back so the resolver can rebuild the unique
   *  lookup — a group's name is only unique within its collection. */
  nameCollisions: { key: string; entity: SyncEntity; row: RemoteRow }[];
}

export interface FetchPage {
  rows: TaggedRow[];
  cursor: string;
  complete: boolean;
}

export interface ProtocolHandshake {
  protocolVersion: number;
  minClientRevision: number;
}

export type Unsubscribe = () => void;

/**
 * The remote store. Every method is a plain table operation, so anything that
 * can upsert by key and select by cursor can back sync.
 */
export interface SyncProvider {
  /** Conflict target is `ENTITY_KEY_COLUMNS[entity]`, making this idempotent —
   *  which is why there is no idempotency ledger. */
  upsert(entity: SyncEntity, rows: RemoteRow[]): Promise<UpsertResult>;
  /** Rows at or after `cursor`, across all tables. Null means everything. */
  fetchSince(cursor: string | null): Promise<FetchPage>;
  /** Every row the account holds, parents first. */
  fetchAll(): Promise<TaggedRow[]>;
  /** How a client learns the canonical key after a name collision. */
  findByUnique(entity: SyncEntity, where: RemoteRow): Promise<RemoteRow | null>;
  /** Client-driven because there is no server to schedule it. */
  gcTombstones(before: string): Promise<void>;
  /** `originDevice` lets a client ignore the echo of its own write. */
  subscribe(onPoke: (originDevice: string) => void): Unsubscribe;
  hello(): Promise<ProtocolHandshake>;
}

export interface SyncMeta {
  /** `server_time` of the newest row applied; '' before the first pull. */
  cursor: string;
  deviceId: string;
  /** Whose data this DB currently holds; null before the first sign-in. */
  accountId: string | null;
}

export interface ApplyResult {
  /** TanStack query-key roots to invalidate. */
  invalidatedKeys: string[][];
  applied: number;
}

/**
 * The worker-side surface the engine drives over comlink, abstracted so this
 * package stays free of comlink and SQLite.
 */
export interface SyncBackend {
  drainOutbox(limit: number): Promise<OutboxChange[]>;
  markOutboxSynced(seqs: number[], applied: { key: string; seq: number }[]): Promise<void>;
  /** Skips rows whose key has a pending local edit, or whose `seq` we hold. */
  applyRemoteRows(rows: TaggedRow[]): Promise<ApplyResult>;
  /** Discards local divergence and restores agreement with the remote store. */
  replaceAllFromSnapshot(rows: TaggedRow[]): Promise<ApplyResult>;
  /** Adopt the remote key for a record minted under a different one. */
  rekeyLocal(entity: SyncEntity, fromKey: string, toKey: string): Promise<void>;
  getSyncMeta(): Promise<SyncMeta>;
  setCursor(cursor: string): Promise<void>;
  pendingCount(): Promise<number>;
}

export type SyncState =
  | 'idle' // signed out / not started
  | 'syncing'
  | 'synced'
  | 'offline' // backed off after a network error; will retry
  | 'error'; // non-retryable, e.g. session expired

/** Lets the UI offer the right next step without parsing an error message. */
export type SyncErrorKind = 'transient' | 'auth' | 'protocol';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  pendingChanges: number;
  error: string | null;
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
