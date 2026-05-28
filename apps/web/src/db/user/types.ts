// Public types for the user-data DB layer.
//
// User data (collections, memberships) lives in a separate OPFS SQLite file
// from the parsed game data so it survives WZ re-imports and exports
// independently. These types cross the worker boundary, so they must be
// structured-cloneable.

import type { EntityKind } from '../types';
import type { CollectionsExportJson, ImportConflictMode, ImportReport } from './collectionsJson';

export type CollectionEntityType = Extract<
  EntityKind,
  'item' | 'equip' | 'mob' | 'npc' | 'map' | 'quest'
>;

export const COLLECTION_ENTITY_TYPES = [
  'item',
  'equip',
  'mob',
  'npc',
  'map',
  'quest',
] as const satisfies readonly CollectionEntityType[];

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

/** A row in the `ui_prefs` key-value table. Value is an opaque JSON
 *  string; the consumer parses + validates it with its own schema. */
export interface UiPrefRecord {
  key: string;
  value: string;
  updatedAt: number;
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
  bulkAddMembers(collectionId: number, refs: readonly EntityRef[]): Promise<BulkAddResult>;
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

  /** UI preference read; null when the key has never been written. */
  getUiPref(key: string): Promise<UiPrefRecord | null>;
  /** Insert or update a UI preference. Value is the consumer's already-
   *  serialized JSON string. */
  setUiPref(key: string, value: string): Promise<UiPrefRecord>;
  /** All rows — used by the JSON export. */
  listUiPrefs(): Promise<UiPrefRecord[]>;
  deleteUiPref(key: string): Promise<void>;

  /** Serialize the live user.sqlite3 to a Uint8Array. */
  exportBytes(): Promise<Uint8Array>;
  /** Replace the live user.sqlite3 with the given bytes. Migrations run
   *  afterwards so an older export gets brought up to current. */
  importBytes(bytes: Uint8Array): Promise<{ backend: 'opfs' | 'memory'; schemaVersion: number }>;
}
