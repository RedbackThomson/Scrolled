// Public types for the user-data DB layer.
//
// User data (collections, memberships) lives in a separate OPFS SQLite file
// from the parsed game data so it survives WZ re-imports and exports
// independently. These types cross the worker boundary, so they must be
// structured-cloneable.

import type { EntityKind } from '../types';

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

export interface UserDbStatus {
  schemaVersion: number;
  backend: 'opfs' | 'memory';
  counts: {
    collections: number;
    members: number;
  };
}

/**
 * Boundary contract for the user DB. Phase B surface.
 */
export interface UserDatabase {
  open(): Promise<UserDbStatus>;
  status(): Promise<UserDbStatus>;

  listCollections(): Promise<CollectionRecord[]>;
  getCollection(id: number): Promise<CollectionRecord | null>;
  createCollection(input: CreateCollectionInput): Promise<CollectionRecord>;
  updateCollection(id: number, patch: UpdateCollectionPatch): Promise<CollectionRecord>;
  deleteCollection(id: number): Promise<void>;

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
}
