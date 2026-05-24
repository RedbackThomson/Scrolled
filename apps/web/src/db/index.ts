// Database layer.
//
// Public surface: types + a comlink-wrapped client that talks to the DB
// worker. The worker owns the SQLite-WASM engine and OPFS persistence.

export type {
  ColumnFilter,
  StringFilterMode,
  DatasetFileRef,
  DatasetRecord,
  DbStatus,
  ExtractorResultRecord,
  EntityKind,
  EquipRecord,
  GameDatabase,
  ItemRecord,
  ListOptsBase,
  MapMobRecord,
  MapMobWithName,
  MapNpcRecord,
  MapNpcWithName,
  MapPortalRecord,
  MapRecord,
  MobRecord,
  NpcRecord,
  PageResult,
  QuestRecord,
  QuestRequirementRecord,
  QuestRequirementWithName,
  QuestRewardRecord,
  QuestRewardWithName,
  QuestSummary,
  SearchEntry,
  SortDir,
} from './types';
export { getDbClient, terminateDbClient } from './client';
