// Public query surface for the user-data SQLite file.
//
// `UserDbApi` is a thin facade over the per-domain modules (collections,
// pinnedSearches). It owns the Sqlite handle and lifecycle; each method
// delegates to a free function so the comlink passthrough in
// `workers/userDbWorker.ts` keeps a stable, uniform shape.

import { Sqlite } from '../../sqlite';
import { USER_MIGRATIONS } from '../migrations';
import type { CollectionsExportJson, ImportConflictMode, ImportReport } from '../collectionsJson';
import type {
  AddMemberOptions,
  BulkAddResult,
  CollectionEntityType,
  CollectionMember,
  CollectionRecord,
  CreateCollectionInput,
  CreatePinnedSearchInput,
  EntityRef,
  MembershipBadge,
  PinnedSearchRecord,
  UiPrefRecord,
  UpdateCollectionPatch,
  UpdateMemberPatch,
  UpdatePinnedSearchPatch,
  UserDatabase,
  UserDbStatus,
} from '../types';
import * as collections from './collections';
import * as pinned from './pinnedSearches';
import * as uiPrefs from './uiPrefs';

const USER_OPFS_FILENAME = '/user.sqlite3';
const USER_POOL_NAME = 'scrolled-user-db-pool';

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
    return {
      schemaVersion,
      backend: this.db.backend,
      fallbackReason: this.db.fallbackReason,
      counts: { collections: collectionsCount, members, pinnedSearches },
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

  async bulkAddMembers(collectionId: number, refs: readonly EntityRef[]): Promise<BulkAddResult> {
    return collections.bulkAddMembers(this.db, collectionId, refs);
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

  // -- ui prefs ---------------------------------------------------------------

  async getUiPref(key: string): Promise<UiPrefRecord | null> {
    return uiPrefs.getUiPref(this.db, key);
  }

  async setUiPref(key: string, value: string): Promise<UiPrefRecord> {
    return uiPrefs.setUiPref(this.db, key, value);
  }

  async listUiPrefs(): Promise<UiPrefRecord[]> {
    return uiPrefs.listUiPrefs(this.db);
  }

  async deleteUiPref(key: string): Promise<void> {
    uiPrefs.deleteUiPref(this.db, key);
  }

  // -- raw bytes --------------------------------------------------------------

  async exportBytes(): Promise<Uint8Array> {
    return this.db.exportBytes();
  }

  async importBytes(
    bytes: Uint8Array,
  ): Promise<{ backend: 'opfs' | 'memory'; schemaVersion: number }> {
    return this.db.importBytes(bytes);
  }
}
