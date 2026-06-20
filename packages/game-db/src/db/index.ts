// Game database engine — public surface.
//
// Record types, the data-revision contract, the SQLite wrapper, and the
// `DbApi` query implementation. The comlink-wrapped client that talks to the
// DB worker lives in the web app (`apps/web/src/db/client.ts`).

export * from './types';
export {
  CURRENT_DATA_REVISION,
  MINIMUM_SUPPORTED_DATA_REVISION,
  evaluateDataState,
  type DataState,
} from './dataVersion';
export {
  Sqlite,
  type Backend,
  type OpenResult,
  type PreMigrateContext,
  type SqliteOptions,
  type Row,
} from './sqlite';
export { DbApi, gameDataPreMigrateReset } from './queries';
export {
  evaluateGameDataImport,
  evaluateDatasetImport,
  type GameDataImportDecision,
  type GameDataBlockKind,
} from './importCompat';
