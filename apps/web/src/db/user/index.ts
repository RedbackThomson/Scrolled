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
  EntityRef,
  MembershipBadge,
  UpdateCollectionPatch,
  UpdateMemberPatch,
  UserDatabase,
  UserDbStatus,
} from './types';
export { COLLECTION_ENTITY_TYPES } from './types';
export { getUserDbClient, terminateUserDbClient } from './client';
