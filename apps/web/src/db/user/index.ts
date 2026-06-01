// User-data DB layer.
//
// Separate from the game-data DB so it survives WZ re-imports and can be
// exported/managed independently. Public surface: types + a comlink-wrapped
// client that talks to the user DB worker.

export type {
  AddMemberOptions,
  BulkAddResult,
  CollectionEntityType,
  CollectionGroup,
  CollectionGrouping,
  CollectionMember,
  CollectionRecord,
  CollectionSortDir,
  CollectionSortKey,
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
export {
  COLLECTION_ENTITY_TYPES,
  COLLECTION_GROUPINGS,
  COLLECTION_SORT_DIRS,
  COLLECTION_SORT_KEYS,
} from './types';
export { getUserDbClient, terminateUserDbClient } from './client';
