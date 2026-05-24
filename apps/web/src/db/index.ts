// Database layer.
//
// Public surface: types + a comlink-wrapped client that talks to the DB
// worker. The worker owns the SQLite-WASM engine and OPFS persistence.

export type {
  DatasetFileRef,
  DatasetRecord,
  DbStatus,
  ExtractorResultRecord,
  EntityKind,
  EquipRecord,
  GameDatabase,
  ItemRecord,
  MapMobRecord,
  MapMobWithName,
  MapNpcRecord,
  MapNpcWithName,
  MapPortalRecord,
  MapRecord,
  MobRecord,
  NpcRecord,
  QuestRecord,
  QuestRequirementRecord,
  QuestRequirementWithName,
  QuestRewardRecord,
  QuestRewardWithName,
  QuestSummary,
  SearchEntry,
} from './types';
export { getDbClient, terminateDbClient } from './client';
