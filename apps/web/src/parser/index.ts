// Parser layer (web app surface).
//
// Re-exports the engine parser from @scrolled/extractor and adds the
// browser-only Worker pool + comlink client that live in this app.

export type {
  DataSourceKind,
  Diagnostics,
  GameDataSource,
  LoadFileSpec,
  LoadResult,
  WzMapleVersionName,
  WzNodeInfo,
  WzNodeKind,
  WzNodeTree,
  WzPropertyKind,
} from '@scrolled/extractor/parser';
export {
  WzDataSource,
  ImgDataSource,
  ensureWzInit,
  getAesSmokeTestResult,
} from '@scrolled/extractor/parser';
export { getParserClient, terminateParserClient, type ParserWorkerApi } from './client';
export {
  getPoolWorker,
  terminatePool,
  poolHasWorker,
  POOL_WORKER_NAMES,
  POOL_WORKER_FILES,
  WORKER_EXTRACTORS,
  type PoolWorkerName,
} from './pool';
