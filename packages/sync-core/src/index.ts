export type {
  ApplyResult,
  AssignedRevision,
  OutboxChange,
  ProtocolHandshake,
  PullResult,
  PushResult,
  ServerChange,
  SyncBackend,
  SyncChange,
  SyncEntity,
  SyncMeta,
  SyncOp,
  SyncProvider,
  SyncState,
  SyncStatus,
  SyncStatusListener,
  Unsubscribe,
} from './types';
export { INITIAL_SYNC_STATUS, SYNC_ENTITIES } from './types';

export {
  PROTOCOL_VERSION,
  protocolHandshakeSchema,
  pullResultSchema,
  pushResultSchema,
  serverChangeSchema,
  syncChangeSchema,
  syncEntitySchema,
  syncOpSchema,
  syncRecordMetaSchema,
} from './schemas';
export type { SyncRecordMeta } from './schemas';

export { resolveConflict } from './conflict';
export type { ConflictInput, ConflictWinner } from './conflict';

export { DEFAULT_SYNC_CONFIG, SyncEngine } from './engine';
export type { SyncEngineConfig, SyncEngineDeps } from './engine';

export { SyncAuthError, SyncError, SyncProtocolError, SyncTransientError } from './errors';

export { createMockSyncProvider, createMockSyncServer } from './mock';
export type { MockFault, MockSyncProviderOptions, MockSyncServer } from './mock';

// The React status context/hooks live on the `@scrolled/sync-core/react`
// subpath so non-React consumers (the engine, a worker, a Node test) can depend
// on the contract without pulling JSX into their compile.
