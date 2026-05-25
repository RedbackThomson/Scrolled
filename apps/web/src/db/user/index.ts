// User-data DB layer.
//
// Separate from the game-data DB so it survives WZ re-imports and can be
// exported/managed independently. Public surface: types + a comlink-wrapped
// client that talks to the user DB worker.

export type {
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
  UpdateCollectionPatch,
  UpdateMemberPatch,
  UpdatePinnedSearchPatch,
  UserDatabase,
  UserDbStatus,
} from './types';
export type {
  CollectionBundleJson,
  CollectionMemberJson,
  CollectionsExportJson,
  ImportConflictMode,
  ImportReport,
  PinnedSearchJson,
} from './collectionsJson';
export { COLLECTIONS_JSON_VERSION } from './collectionsJson';
export { COLLECTION_ENTITY_TYPES } from './types';
export { getUserDbClient, terminateUserDbClient } from './client';
