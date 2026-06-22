// Public types for the user-data DB layer.
//
// User data (collections, memberships) lives in a separate OPFS SQLite file
// from the parsed game data so it survives WZ re-imports and exports
// independently. These types cross the worker boundary, so they must be
// structured-cloneable.

import type { EntityKind } from '@scrolled/game-db/db/types';
import type {
  ApplyResult,
  AssignedRevision,
  OutboxChange,
  ServerChange,
  SyncMeta,
} from '@scrolled/sync-core';
import type { BootstrapAction } from './queries/sync';
import type { CollectionsExportJson, ImportConflictMode, ImportReport } from './collectionsJson';

export type CollectionEntityType = Extract<
  EntityKind,
  'item' | 'equip' | 'mob' | 'npc' | 'map' | 'quest' | 'questChain' | 'skill'
>;

export const COLLECTION_ENTITY_TYPES = [
  'item',
  'equip',
  'mob',
  'npc',
  'map',
  'quest',
  'questChain',
  'skill',
] as const satisfies readonly CollectionEntityType[];

/**
 * Linear-backlog-style display options persisted per collection. Each
 * collection remembers its preferred grouping axes, sort key, and
 * direction so revisits land on the same view.
 *
 * `grouping` is the OUTER axis; `subgrouping` is the INNER axis nested
 * inside it. `'none'` means flat for that level. When `sortKey` is
 * `'manual'`, drag-and-drop reorders are honored via `position`; any
 * other sort sources its order from the named member field.
 */
export type CollectionGrouping = 'none' | 'group' | 'type';
export type CollectionSortKey = 'manual' | 'name' | 'added' | 'done' | 'quantity';
export type CollectionSortDir = 'asc' | 'desc';

export const COLLECTION_GROUPINGS = ['none', 'group', 'type'] as const satisfies readonly CollectionGrouping[];
export const COLLECTION_SORT_KEYS = ['manual', 'name', 'added', 'done', 'quantity'] as const satisfies readonly CollectionSortKey[];
export const COLLECTION_SORT_DIRS = ['asc', 'desc'] as const satisfies readonly CollectionSortDir[];

export interface CollectionRecord {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  /** Lucide icon name; nullable so the UI can fall back to a default. */
  icon: string | null;
  createdAt: number;
  updatedAt: number;
  /** Surfaced by `listCollections` for the sidebar / index page. */
  memberCount: number;
  /** Pinned to the home page. */
  pinned: boolean;
  /** Sort key within the pinned grid; null when unpinned. */
  pinnedPosition: number | null;
  /** Outer grouping axis on the detail page. */
  grouping: CollectionGrouping;
  /** Inner (nested) grouping axis on the detail page. */
  subgrouping: CollectionGrouping;
  /** Sort key applied within the innermost bucket. */
  sortKey: CollectionSortKey;
  /** Sort direction applied alongside `sortKey`. */
  sortDir: CollectionSortDir;
}

/**
 * A named, user-defined group inside a single collection. The default
 * group is *implicit* — represented by `group_id IS NULL` on members,
 * never materialized as a row here.
 */
export interface CollectionGroup {
  id: number;
  collectionId: number;
  name: string;
  /** Order within the collection's group list (0-based, dense). */
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionMember {
  collectionId: number;
  entityType: CollectionEntityType;
  entityId: number;
  note: string | null;
  /** Target count for farming/tracker use cases. Null when not used. */
  quantity: number | null;
  done: boolean;
  addedAt: number;
  /** Owning group; null means the default (implicit) group. */
  groupId: number | null;
  /** Order within (collectionId, groupId). 0-based, dense. */
  position: number;
}

export interface CreateCollectionInput {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface AddMemberOptions {
  note?: string | null;
  quantity?: number | null;
  done?: boolean;
  /**
   * Target group for the new row. Null (or omitted) lands it in the
   * default implicit group. Ignored on conflict — re-adding an existing
   * member preserves its current group and position so manual ordering
   * isn't disturbed; use {@link UserDatabase.moveMember} to relocate.
   */
  groupId?: number | null;
}

export interface UpdateMemberPatch {
  note?: string | null;
  quantity?: number | null;
  done?: boolean;
}

export interface UpdateCollectionPatch {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  grouping?: CollectionGrouping;
  subgrouping?: CollectionGrouping;
  sortKey?: CollectionSortKey;
  sortDir?: CollectionSortDir;
}

export interface EntityRef {
  entityType: CollectionEntityType;
  entityId: number;
}

/**
 * Per-collection membership info for a single entity. Carries both the
 * collection's display fields (name/icon/color) and the membership-row's
 * own state (note/quantity/done), so the picker can show and edit member
 * metadata in-place without a second query. The badge strip ignores the
 * member fields and uses only the display ones.
 */
export interface MembershipBadge {
  collectionId: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  note: string | null;
  quantity: number | null;
  done: boolean;
}

export interface BulkAddResult {
  added: number;
  skipped: number;
}

/** A user-saved listing filter (entity + URL params). Replayed by navigating
 *  to `<listing>?<params>`. */
export interface PinnedSearchRecord {
  id: number;
  name: string;
  entity: CollectionEntityType;
  /** URL search params for the target listing (e.g. f_level_min=50, q=foo). */
  params: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePinnedSearchInput {
  name: string;
  entity: CollectionEntityType;
  params: Record<string, string>;
}

export interface UpdatePinnedSearchPatch {
  name?: string;
  params?: Record<string, string>;
}

/** A row in the synced `user_settings` key-value table. Value is an opaque
 *  JSON string; the consumer parses + validates it with its own schema. */
export interface UserSettingRecord {
  key: string;
  value: string;
  updatedAt: number;
}

/** A recently-viewed entity, newest first. `name` is a local display label
 *  resolved from the game DB; it is not part of the sync contract. */
export interface RecentEntityRecord {
  entity: EntityKind;
  id: number;
  name: string;
  viewedAt: number;
}

/** A recent search query, newest first. */
export interface RecentQueryRecord {
  query: string;
  ranAt: number;
}

export interface UserDbStatus {
  schemaVersion: number;
  backend: 'opfs' | 'memory';
  /**
   * Short, user-facing explanation of why the in-memory fallback was used.
   * Null when `backend === 'opfs'` or when no fallback diagnosis is
   * available.
   */
  fallbackReason: string | null;
  counts: {
    collections: number;
    members: number;
    pinnedSearches: number;
    /** Pending local changes awaiting sync (docs/sync_design.md). */
    outbox: number;
  };
}

/**
 * Boundary contract for the user DB.
 */
export interface UserDatabase {
  open(): Promise<UserDbStatus>;
  status(): Promise<UserDbStatus>;

  listCollections(): Promise<CollectionRecord[]>;
  getCollection(id: number): Promise<CollectionRecord | null>;
  createCollection(input: CreateCollectionInput): Promise<CollectionRecord>;
  updateCollection(id: number, patch: UpdateCollectionPatch): Promise<CollectionRecord>;
  deleteCollection(id: number): Promise<void>;
  /** Pin or unpin a collection. Pinning appends to the end of the pinned
   *  grid; unpinning clears the position. */
  setCollectionPinned(id: number, pinned: boolean): Promise<CollectionRecord>;

  listGroups(collectionId: number): Promise<CollectionGroup[]>;
  createGroup(collectionId: number, name: string): Promise<CollectionGroup>;
  renameGroup(groupId: number, name: string): Promise<CollectionGroup>;
  deleteGroup(groupId: number): Promise<void>;
  /** Persist a new ordering of the collection's groups (top to bottom). */
  reorderGroups(collectionId: number, orderedGroupIds: readonly number[]): Promise<void>;
  /**
   * Move a member to a target group + position. `targetGroupId` may be
   * null for the default (implicit) group. `targetIndex` is 0-based;
   * pass `members.length` to drop at the end. Re-densifies positions in
   * both source and destination buckets in one transaction.
   */
  moveMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
    targetGroupId: number | null,
    targetIndex: number,
  ): Promise<void>;

  listMembers(collectionId: number): Promise<CollectionMember[]>;
  addMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
    opts?: AddMemberOptions,
  ): Promise<void>;
  removeMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
  ): Promise<void>;
  updateMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
    patch: UpdateMemberPatch,
  ): Promise<void>;
  /**
   * Insert many members. Existing rows (same entityType + entityId) are
   * skipped without touching their group/position. New rows land at the
   * tail of `groupId`'s bucket — pass `null` (or omit) for the default
   * implicit group.
   */
  bulkAddMembers(
    collectionId: number,
    refs: readonly EntityRef[],
    groupId?: number | null,
  ): Promise<BulkAddResult>;
  bulkRemoveMembers(collectionId: number, refs: readonly EntityRef[]): Promise<void>;

  /** Collections that contain the given (entityType, entityId). */
  listMembershipsFor(
    entityType: CollectionEntityType,
    entityId: number,
  ): Promise<MembershipBadge[]>;

  exportCollectionJson(id: number): Promise<CollectionsExportJson>;
  exportAllJson(): Promise<CollectionsExportJson>;
  importJson(payload: unknown, conflict: ImportConflictMode): Promise<ImportReport>;

  listPinnedSearches(): Promise<PinnedSearchRecord[]>;
  getPinnedSearch(id: number): Promise<PinnedSearchRecord | null>;
  createPinnedSearch(input: CreatePinnedSearchInput): Promise<PinnedSearchRecord>;
  updatePinnedSearch(id: number, patch: UpdatePinnedSearchPatch): Promise<PinnedSearchRecord>;
  deletePinnedSearch(id: number): Promise<void>;

  /** User setting read; null when the key has never been written. */
  getUserSetting(key: string): Promise<UserSettingRecord | null>;
  /** Insert or update a user setting. Value is the consumer's already-
   *  serialized JSON string. */
  setUserSetting(key: string, value: string): Promise<UserSettingRecord>;
  /** All rows — used by the JSON export. */
  listUserSettings(): Promise<UserSettingRecord[]>;
  deleteUserSetting(key: string): Promise<void>;

  /** Recently-viewed entities, newest first (capped). */
  listRecentEntities(): Promise<RecentEntityRecord[]>;
  /** Recent search queries, newest first (capped). */
  listRecentQueries(): Promise<RecentQueryRecord[]>;
  /** Record (or coalesce) a viewed entity. `viewedAt` defaults to now;
   *  pass an explicit timestamp when migrating historical data. */
  trackRecentEntity(
    entity: EntityKind,
    id: number,
    name: string,
    viewedAt?: number,
  ): Promise<void>;
  /** Record (or coalesce) a search query. */
  trackRecentQuery(query: string, ranAt?: number): Promise<void>;
  /** Clear all recents of one kind. */
  clearRecents(kind: 'entity' | 'query'): Promise<void>;

  /** Read the sync cursor/identity the engine needs (server_seq, device_id,
   *  account_id). */
  getSyncMeta(): Promise<SyncMeta>;
  /** Reconcile the local DB with a signing-in account before the first sync
   *  cycle (docs/sync_design.md §11): adopt anonymous data, reset on an account
   *  switch, or resume. Returns which path was taken. */
  bootstrapSyncAccount(accountId: string): Promise<BootstrapAction>;
  /** Next batch of pending local changes (wire-projected), oldest first. */
  drainOutbox(limit: number): Promise<OutboxChange[]>;
  /** Acknowledge pushed rows and stamp the server-assigned revisions. */
  markOutboxSynced(seqs: number[], assigned: AssignedRevision[]): Promise<void>;
  /** Apply a server-ordered remote batch in one transaction (conflict handler
   *  against pending edits, cursor advanced atomically). Returns the TanStack
   *  query-key roots to invalidate. */
  applyRemoteChanges(batch: ServerChange[]): Promise<ApplyResult>;

  /** Serialize the live user.sqlite3 to a Uint8Array. */
  exportBytes(): Promise<Uint8Array>;
  /** Replace the live user.sqlite3 with the given bytes. Migrations run
   *  afterwards so an older export gets brought up to current. */
  importBytes(bytes: Uint8Array): Promise<{ backend: 'opfs' | 'memory'; schemaVersion: number }>;
}
