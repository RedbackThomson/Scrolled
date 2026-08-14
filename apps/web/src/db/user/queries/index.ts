// Public query surface for the user-data SQLite file.
//
// `UserDbApi` is a thin facade over the per-domain modules (collections,
// pinnedSearches). It owns the Sqlite handle and lifecycle; each method
// delegates to a free function so the comlink passthrough in
// `workers/userDbWorker.ts` keeps a stable, uniform shape.

import { Sqlite } from '@scrolled/game-db/db/sqlite';
import { USER_OPFS_FILENAME, USER_POOL_NAME } from '../../opfsNamespace';
import { USER_MIGRATIONS } from '../migrations';
import type { CollectionsExportJson, ImportConflictMode, ImportReport } from '../collectionsJson';
import type {
  AddMemberOptions,
  BulkAddResult,
  CollectionEntityType,
  CollectionGroup,
  CollectionMember,
  CollectionRecord,
  CreateCollectionInput,
  CreatePinnedSearchInput,
  EntityRef,
  MembershipBadge,
  PinnedSearchRecord,
  RecentEntityRecord,
  RecentQueryRecord,
  UpdateCollectionPatch,
  UpdateMemberPatch,
  UpdatePinnedSearchPatch,
  UserDatabase,
  UserDbStatus,
  UserSettingRecord,
} from '../types';
import type { EntityKind } from '@scrolled/game-db/db/types';
import type {
  ApplyResult,
  OutboxChange,
  SyncEntity,
  SyncMeta,
  TaggedRow,
} from '@scrolled/sync-core';
import type { BootstrapAction } from './sync';
import * as collections from './collections';
import * as collectionGroups from './collectionGroups';
import * as pinned from './pinnedSearches';
import * as userSettings from './userSettings';
import * as recents from './recents';
import * as sync from './sync';

export class UserDbApi implements UserDatabase {
  constructor(
    private readonly db: Sqlite = new Sqlite({
      opfsFilename: USER_OPFS_FILENAME,
      poolName: USER_POOL_NAME,
      migrations: USER_MIGRATIONS,
      logTag: 'user',
    }),
  ) {}

  async open(): Promise<UserDbStatus> {
    await this.db.open();
    return this.status();
  }

  async status(): Promise<UserDbStatus> {
    const schemaVersion = this.db.selectValue<number>('SELECT MAX(version) FROM _migrations') ?? 0;
    const collectionsCount = this.db.selectValue<number>('SELECT COUNT(*) FROM collections') ?? 0;
    const members = this.db.selectValue<number>('SELECT COUNT(*) FROM collection_members') ?? 0;
    const pinnedSearches = this.db.selectValue<number>('SELECT COUNT(*) FROM pinned_searches') ?? 0;
    const outbox = this.db.selectValue<number>('SELECT COUNT(*) FROM sync_outbox') ?? 0;
    return {
      schemaVersion,
      backend: this.db.backend,
      fallbackReason: this.db.fallbackReason,
      fallbackDetail: this.db.fallbackDetail,
      counts: { collections: collectionsCount, members, pinnedSearches, outbox },
    };
  }

  // -- collections ------------------------------------------------------------

  async listCollections(): Promise<CollectionRecord[]> {
    return collections.listCollections(this.db);
  }

  async createCollection(input: CreateCollectionInput): Promise<CollectionRecord> {
    return collections.createCollection(this.db, input);
  }

  async getCollection(id: number): Promise<CollectionRecord | null> {
    return collections.getCollection(this.db, id);
  }

  async updateCollection(id: number, patch: UpdateCollectionPatch): Promise<CollectionRecord> {
    return collections.updateCollection(this.db, id, patch);
  }

  async deleteCollection(id: number): Promise<void> {
    collections.deleteCollection(this.db, id);
  }

  async setCollectionPinned(id: number, pinned: boolean): Promise<CollectionRecord> {
    return collections.setCollectionPinned(this.db, id, pinned);
  }

  // -- groups -----------------------------------------------------------------

  async listGroups(collectionId: number): Promise<CollectionGroup[]> {
    return collectionGroups.listGroups(this.db, collectionId);
  }

  async createGroup(collectionId: number, name: string): Promise<CollectionGroup> {
    return collectionGroups.createGroup(this.db, collectionId, name);
  }

  async renameGroup(groupId: number, name: string): Promise<CollectionGroup> {
    return collectionGroups.renameGroup(this.db, groupId, name);
  }

  async deleteGroup(groupId: number): Promise<void> {
    collectionGroups.deleteGroup(this.db, groupId);
  }

  async reorderGroups(
    collectionId: number,
    orderedGroupIds: readonly number[],
  ): Promise<void> {
    collectionGroups.reorderGroups(this.db, collectionId, orderedGroupIds);
  }

  async moveMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
    targetGroupId: number | null,
    targetIndex: number,
  ): Promise<void> {
    collectionGroups.moveMember(
      this.db,
      collectionId,
      entityType,
      entityId,
      targetGroupId,
      targetIndex,
    );
  }

  // -- members ----------------------------------------------------------------

  async listMembers(collectionId: number): Promise<CollectionMember[]> {
    return collections.listMembers(this.db, collectionId);
  }

  async addMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
    opts: AddMemberOptions = {},
  ): Promise<void> {
    collections.addMember(this.db, collectionId, entityType, entityId, opts);
  }

  async removeMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
  ): Promise<void> {
    collections.removeMember(this.db, collectionId, entityType, entityId);
  }

  async updateMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
    patch: UpdateMemberPatch,
  ): Promise<void> {
    collections.updateMember(this.db, collectionId, entityType, entityId, patch);
  }

  async bulkAddMembers(
    collectionId: number,
    refs: readonly EntityRef[],
    groupId: number | null = null,
  ): Promise<BulkAddResult> {
    return collections.bulkAddMembers(this.db, collectionId, refs, groupId);
  }

  async bulkRemoveMembers(collectionId: number, refs: readonly EntityRef[]): Promise<void> {
    collections.bulkRemoveMembers(this.db, collectionId, refs);
  }

  async listMembershipsFor(
    entityType: CollectionEntityType,
    entityId: number,
  ): Promise<MembershipBadge[]> {
    return collections.listMembershipsFor(this.db, entityType, entityId);
  }

  async exportCollectionJson(id: number): Promise<CollectionsExportJson> {
    return collections.exportCollectionJson(this.db, id);
  }

  async exportAllJson(): Promise<CollectionsExportJson> {
    return collections.exportAllJson(this.db);
  }

  async importJson(payload: unknown, conflict: ImportConflictMode): Promise<ImportReport> {
    return collections.importJson(this.db, payload, conflict);
  }

  // -- pinned searches --------------------------------------------------------

  async listPinnedSearches(): Promise<PinnedSearchRecord[]> {
    return pinned.listPinnedSearches(this.db);
  }

  async getPinnedSearch(id: number): Promise<PinnedSearchRecord | null> {
    return pinned.getPinnedSearch(this.db, id);
  }

  async createPinnedSearch(input: CreatePinnedSearchInput): Promise<PinnedSearchRecord> {
    return pinned.createPinnedSearch(this.db, input);
  }

  async updatePinnedSearch(
    id: number,
    patch: UpdatePinnedSearchPatch,
  ): Promise<PinnedSearchRecord> {
    return pinned.updatePinnedSearch(this.db, id, patch);
  }

  async deletePinnedSearch(id: number): Promise<void> {
    pinned.deletePinnedSearch(this.db, id);
  }

  // -- user settings ----------------------------------------------------------

  async getUserSetting(key: string): Promise<UserSettingRecord | null> {
    return userSettings.getUserSetting(this.db, key);
  }

  async setUserSetting(key: string, value: string): Promise<UserSettingRecord> {
    return userSettings.setUserSetting(this.db, key, value);
  }

  async listUserSettings(): Promise<UserSettingRecord[]> {
    return userSettings.listUserSettings(this.db);
  }

  async deleteUserSetting(key: string): Promise<void> {
    userSettings.deleteUserSetting(this.db, key);
  }

  // -- recents ----------------------------------------------------------------

  async listRecentEntities(): Promise<RecentEntityRecord[]> {
    return recents.listRecentEntities(this.db) as RecentEntityRecord[];
  }

  async listRecentQueries(): Promise<RecentQueryRecord[]> {
    return recents.listRecentQueries(this.db);
  }

  async trackRecentEntity(
    entity: EntityKind,
    id: number,
    name: string,
    viewedAt?: number,
  ): Promise<void> {
    recents.trackRecentEntity(this.db, entity, id, name, viewedAt);
  }

  async trackRecentQuery(query: string, ranAt?: number): Promise<void> {
    recents.trackRecentQuery(this.db, query, ranAt);
  }

  async clearRecents(kind: 'entity' | 'query'): Promise<void> {
    recents.clearRecents(this.db, kind);
  }

  // -- sync --------------------------------------------------------------------

  async getSyncMeta(): Promise<SyncMeta> {
    return sync.getSyncMeta(this.db);
  }

  async detachSyncAccount(): Promise<void> {
    sync.detachSyncAccount(this.db);
  }

  async setSyncCursor(cursor: string): Promise<void> {
    sync.setCursor(this.db, cursor);
  }

  async pendingSyncCount(): Promise<number> {
    return sync.pendingCount(this.db);
  }

  async bootstrapSyncAccount(accountId: string): Promise<BootstrapAction> {
    return sync.bootstrapSyncAccount(this.db, accountId);
  }

  async drainOutbox(limit: number): Promise<OutboxChange[]> {
    return sync.drainOutbox(this.db, limit);
  }

  async markOutboxSynced(seqs: number[], applied: { key: string; seq: number }[]): Promise<void> {
    sync.markOutboxSynced(this.db, seqs, applied);
  }

  async applyRemoteRows(rows: TaggedRow[]): Promise<ApplyResult> {
    return sync.applyRemoteRows(this.db, rows);
  }

  async replaceAllFromSnapshot(rows: TaggedRow[]): Promise<ApplyResult> {
    return sync.replaceAllFromSnapshot(this.db, rows);
  }

  async rekeyLocal(entity: SyncEntity, fromKey: string, toKey: string): Promise<void> {
    sync.rekeyLocal(this.db, entity, fromKey, toKey);
  }

  async exportBytes(): Promise<Uint8Array> {
    return this.db.exportBytes();
  }

  async importBytes(
    bytes: Uint8Array,
  ): Promise<{ backend: 'opfs' | 'memory'; schemaVersion: number }> {
    return this.db.importBytes(bytes);
  }
}
