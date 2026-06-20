// Database layer (web app surface).
//
// Re-exports the engine db surface (record types, data-revision contract,
// Sqlite, DbApi) from @scrolled/extractor and adds the comlink-wrapped client
// that talks to the DB worker. The worker owns the SQLite-WASM engine and OPFS
// persistence.

export * from '@scrolled/game-db/db';
export { getDbClient, terminateDbClient } from './client';
