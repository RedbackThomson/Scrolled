export type {
  ApplyResult,
  FetchPage,
  NameCollidingEntity,
  OutboxChange,
  ProtocolHandshake,
  RemoteRow,
  SyncBackend,
  SyncEntity,
  SyncErrorKind,
  SyncMeta,
  SyncOp,
  SyncProvider,
  SyncState,
  SyncStatus,
  SyncStatusListener,
  SyncTable,
  TaggedRow,
  Unsubscribe,
  UpsertResult,
} from './types';
export {
  collidesByName,
  ENTITY_KEY_COLUMNS,
  ENTITY_TABLE,
  ENTITY_UNIQUE_NAME,
  INITIAL_SYNC_STATUS,
  SYNC_ENTITIES,
} from './types';

export {
  fetchPageSchema,
  protocolHandshakeSchema,
  PROTOCOL_VERSION,
  recordKey,
  remoteRowSchema,
  splitRecordKey,
  syncEntitySchema,
  syncOpSchema,
  taggedRowSchema,
  upsertResultSchema,
} from './schemas';

export { resolveCollisions, resolveNameCollision } from './rekey';
export type { NameCollision } from './rekey';

export { DEFAULT_SYNC_CONFIG, SyncEngine } from './engine';
export type { SyncEngineConfig, SyncEngineDeps } from './engine';

export { SyncAuthError, SyncError, SyncProtocolError, SyncTransientError } from './errors';

export { createMockSyncProvider, createMockSyncServer, MockForeignKeyError } from './mock';
export type { MockFault, MockSyncProviderOptions, MockSyncServer } from './mock';

// The React status context/hooks live on the `@scrolled/sync-core/react`
// subpath so non-React consumers can depend on the contract without pulling JSX
// into their compile.
