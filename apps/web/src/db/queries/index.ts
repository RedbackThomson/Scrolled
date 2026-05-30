// Public query surface for the game-data SQLite file.
//
// `DbApi` is a thin facade over the per-entity modules (items, equips, mobs,
// npcs, maps, quests) plus the cross-cutting search/datasets/meta modules. It
// owns the Sqlite handle and lifecycle; each method delegates to a free
// function so the comlink passthrough in `workers/dbWorker.ts` stays a stable,
// uniform surface.

import type { Sqlite } from '../sqlite';
import type {
  CategoryCount,
  DatasetFileRef,
  DatasetRecord,
  DbStatus,
  EntityKind,
  EntitySummary,
  EquipJobCount,
  ExtractorResultRecord,
  EquipRecord,
  ItemRecord,
  JobRecord,
  LevelBandCount,
  ListOptsBase,
  MapMobRecord,
  MapMobSpawnRecord,
  MapMobSpawnWithName,
  MapMobWithName,
  MapNpcRecord,
  MapNpcWithName,
  MapPortalRecord,
  MapPortalWithName,
  MapRecord,
  MobDropRecord,
  MobDropWithName,
  MobMapAppearance,
  MobRecord,
  NpcRecord,
  GameDatabase,
  PageResult,
  QuestChainDetail,
  QuestChainListRow,
  QuestChainRecord,
  QuestRecord,
  QuestRequirementRecord,
  QuestRequirementWithName,
  QuestRewardRecord,
  QuestRewardWithName,
  QuestSummary,
  SearchEntry,
  SkillLevelRecord,
  SkillPrerequisiteRecord,
  SkillPrerequisiteWithName,
  SkillRecord,
} from '../types';
import * as items from './items';
import * as equips from './equips';
import * as mobs from './mobs';
import * as npcs from './npcs';
import * as maps from './maps';
import * as quests from './quests';
import * as questChains from './questChains';
import * as jobs from './jobs';
import * as skills from './skills';
import * as search from './search';
import * as datasets from './datasets';
import {
  clearAllData,
  countOf,
  getMeta,
  getServerProfile,
  markPendingRebuild,
  setServerProfile,
} from './meta';

export { gameDataPreMigrateReset } from './meta';

export class DbApi implements GameDatabase {
  constructor(private readonly sql: Sqlite) {}

  async open(): Promise<DbStatus> {
    const result = await this.sql.open();
    if (result.didDestructiveReset) markPendingRebuild(this.sql);
    return this.status();
  }

  async status(): Promise<DbStatus> {
    const schemaVersion = Number(this.sql.selectValue('SELECT MAX(version) FROM _migrations') ?? 0);
    // A missing/non-numeric key reads as 0 — below the minimum supported
    // revision, so a pre-tracking database is flagged for reinitialization.
    const dataRevision = Number(getMeta(this.sql, 'data_revision') ?? 0) || 0;
    // Set when open()/importBytes destructively cleared an incompatible cache.
    // Distinguishes "library was wiped, must rebuild" from a genuine first run,
    // since both leave empty tables. Cleared by the next successful run.
    const pendingRebuild = getMeta(this.sql, 'pending_rebuild') === '1';
    return {
      schemaVersion,
      dataRevision,
      pendingRebuild,
      backend: this.sql.backend,
      fallbackReason: this.sql.fallbackReason,
      counts: {
        items: countOf(this.sql, 'items'),
        equips: countOf(this.sql, 'equips'),
        mobs: countOf(this.sql, 'mobs'),
        npcs: countOf(this.sql, 'npcs'),
        maps: countOf(this.sql, 'maps'),
        quests: countOf(this.sql, 'quests'),
        questChains: countOf(this.sql, 'quest_chains'),
        skills: countOf(this.sql, 'skills'),
        jobs: countOf(this.sql, 'jobs'),
        datasets: countOf(this.sql, 'datasets'),
      },
    };
  }

  // -- items ------------------------------------------------------------------

  async upsertItem(item: ItemRecord): Promise<void> {
    items.upsertItem(this.sql, item);
  }

  async upsertItems(list: ItemRecord[]): Promise<number> {
    return items.upsertItems(this.sql, list);
  }

  async getItem(id: number): Promise<ItemRecord | null> {
    return items.getItem(this.sql, id);
  }

  async getItemIcon(id: number): Promise<Uint8Array | null> {
    return items.getItemIcon(this.sql, id);
  }

  async listItems(
    opts: ListOptsBase & { category?: string } = {},
  ): Promise<PageResult<ItemRecord>> {
    return items.listItems(this.sql, opts);
  }

  async listItemCategories(): Promise<string[]> {
    return items.listItemCategories(this.sql);
  }

  async listItemCategoryCounts(limit?: number): Promise<CategoryCount[]> {
    return items.listItemCategoryCounts(this.sql, limit);
  }

  // -- equips -----------------------------------------------------------------

  async upsertEquip(equip: EquipRecord): Promise<void> {
    equips.upsertEquip(this.sql, equip);
  }

  async upsertEquips(list: EquipRecord[]): Promise<number> {
    return equips.upsertEquips(this.sql, list);
  }

  async getEquip(id: number): Promise<EquipRecord | null> {
    return equips.getEquip(this.sql, id);
  }

  async getEquipIcon(id: number): Promise<Uint8Array | null> {
    return equips.getEquipIcon(this.sql, id);
  }

  async listEquips(
    opts: ListOptsBase & { slot?: string; kind?: 'equip' | 'weapon' } = {},
  ): Promise<PageResult<EquipRecord>> {
    return equips.listEquips(this.sql, opts);
  }

  async listEquipSlots(): Promise<string[]> {
    return equips.listEquipSlots(this.sql);
  }

  async listEquipTypes(): Promise<string[]> {
    return equips.listEquipTypes(this.sql);
  }

  async listEquipSlotCounts(limit?: number): Promise<CategoryCount[]> {
    return equips.listEquipSlotCounts(this.sql, limit);
  }

  async listEquipJobCounts(): Promise<EquipJobCount[]> {
    return equips.listEquipJobCounts(this.sql);
  }

  // -- mobs -------------------------------------------------------------------

  async upsertMobs(list: MobRecord[]): Promise<number> {
    return mobs.upsertMobs(this.sql, list);
  }

  async getMobIcon(id: number): Promise<Uint8Array | null> {
    return mobs.getMobIcon(this.sql, id);
  }

  async getMob(id: number): Promise<MobRecord | null> {
    return mobs.getMob(this.sql, id);
  }

  async listMobs(opts: ListOptsBase = {}): Promise<PageResult<MobRecord>> {
    return mobs.listMobs(this.sql, opts);
  }

  async listMobLevelBandCounts(bandSize?: number): Promise<LevelBandCount[]> {
    return mobs.listMobLevelBandCounts(this.sql, bandSize);
  }

  async listMobLevelBucketCounts(): Promise<CategoryCount[]> {
    return mobs.listMobLevelBucketCounts(this.sql);
  }

  async getMobDrops(mobId: number): Promise<MobDropWithName[]> {
    return mobs.getMobDrops(this.sql, mobId);
  }

  async getItemDroppedBy(
    itemId: number,
  ): Promise<{ mobId: number; name: string; level: number | null }[]> {
    return mobs.getItemDroppedBy(this.sql, itemId);
  }

  async getMobMaps(mobId: number): Promise<MobMapAppearance[]> {
    return mobs.getMobMaps(this.sql, mobId);
  }

  async replaceMobDrops(drops: MobDropRecord[]): Promise<void> {
    mobs.replaceMobDrops(this.sql, drops);
  }

  // -- npcs -------------------------------------------------------------------

  async upsertNpcs(list: NpcRecord[]): Promise<number> {
    return npcs.upsertNpcs(this.sql, list);
  }

  async getNpc(id: number): Promise<NpcRecord | null> {
    return npcs.getNpc(this.sql, id);
  }

  async getNpcIcon(id: number): Promise<Uint8Array | null> {
    return npcs.getNpcIcon(this.sql, id);
  }

  async listNpcs(opts: ListOptsBase = {}): Promise<PageResult<NpcRecord>> {
    return npcs.listNpcs(this.sql, opts);
  }

  async getNpcMaps(npcId: number): Promise<MapRecord[]> {
    return npcs.getNpcMaps(this.sql, npcId);
  }

  // -- maps -------------------------------------------------------------------

  async upsertMaps(list: MapRecord[]): Promise<number> {
    return maps.upsertMaps(this.sql, list);
  }

  async getMap(id: number): Promise<MapRecord | null> {
    return maps.getMap(this.sql, id);
  }

  async getMapMinimap(id: number): Promise<Uint8Array | null> {
    return maps.getMapMinimap(this.sql, id);
  }

  async listMaps(opts: ListOptsBase = {}): Promise<PageResult<MapRecord>> {
    return maps.listMaps(this.sql, opts);
  }

  async listMapStreetCounts(limit?: number): Promise<CategoryCount[]> {
    return maps.listMapStreetCounts(this.sql, limit);
  }

  async getMapNpcs(mapId: number): Promise<MapNpcWithName[]> {
    return maps.getMapNpcs(this.sql, mapId);
  }

  async getMapMobs(mapId: number): Promise<MapMobWithName[]> {
    return maps.getMapMobs(this.sql, mapId);
  }

  async getMapPortals(mapId: number): Promise<MapPortalWithName[]> {
    return maps.getMapPortals(this.sql, mapId);
  }

  async getMapMobSpawns(mapId: number): Promise<MapMobSpawnWithName[]> {
    return maps.getMapMobSpawns(this.sql, mapId);
  }

  async replaceMapLife(rows: {
    npcs: MapNpcRecord[];
    mobs: MapMobRecord[];
    portals: MapPortalRecord[];
    mobSpawns: MapMobSpawnRecord[];
  }): Promise<void> {
    maps.replaceMapLife(this.sql, rows);
  }

  // -- quests -----------------------------------------------------------------

  async upsertQuests(list: QuestRecord[]): Promise<number> {
    return quests.upsertQuests(this.sql, list);
  }

  async getQuest(id: number): Promise<QuestRecord | null> {
    return quests.getQuest(this.sql, id);
  }

  async listQuests(
    opts: ListOptsBase & { parent?: string } = {},
  ): Promise<PageResult<QuestRecord>> {
    return quests.listQuests(this.sql, opts);
  }

  async listQuestParents(): Promise<string[]> {
    return quests.listQuestParents(this.sql);
  }

  async listQuestLevelBandCounts(bandSize?: number): Promise<LevelBandCount[]> {
    return quests.listQuestLevelBandCounts(this.sql, bandSize);
  }

  async getQuestRequirements(questId: number): Promise<QuestRequirementWithName[]> {
    return quests.getQuestRequirements(this.sql, questId);
  }

  async getQuestRewards(questId: number): Promise<QuestRewardWithName[]> {
    return quests.getQuestRewards(this.sql, questId);
  }

  async getNpcQuests(npcId: number): Promise<QuestSummary[]> {
    return quests.getNpcQuests(this.sql, npcId);
  }

  async getItemQuests(itemId: number): Promise<QuestSummary[]> {
    return quests.getItemQuests(this.sql, itemId);
  }

  async getItemRewardingQuests(itemId: number): Promise<QuestSummary[]> {
    return quests.getItemRewardingQuests(this.sql, itemId);
  }

  async getMobQuests(mobId: number): Promise<QuestSummary[]> {
    return quests.getMobQuests(this.sql, mobId);
  }

  async replaceQuestRelations(rows: {
    requirements: QuestRequirementRecord[];
    rewards: QuestRewardRecord[];
  }): Promise<void> {
    quests.replaceQuestRelations(this.sql, rows);
  }

  // -- quest chains -----------------------------------------------------------

  async computeAndStoreQuestChains(): Promise<number> {
    return questChains.computeAndStoreQuestChains(this.sql);
  }

  async getQuestChain(id: number): Promise<QuestChainDetail | null> {
    return questChains.getQuestChain(this.sql, id);
  }

  async listQuestChains(
    opts: ListOptsBase & { parent?: string } = {},
  ): Promise<PageResult<QuestChainListRow>> {
    return questChains.listQuestChains(this.sql, opts);
  }

  async listQuestChainParents(): Promise<string[]> {
    return questChains.listQuestChainParents(this.sql);
  }

  async getChainForQuest(questId: number): Promise<QuestChainRecord | null> {
    return questChains.getChainForQuest(this.sql, questId);
  }

  // -- jobs -------------------------------------------------------------------

  async upsertJobs(list: JobRecord[]): Promise<number> {
    return jobs.upsertJobs(this.sql, list);
  }

  async getJob(id: number): Promise<JobRecord | null> {
    return jobs.getJob(this.sql, id);
  }

  async listJobs(): Promise<JobRecord[]> {
    return jobs.listJobs(this.sql);
  }

  // -- skills -----------------------------------------------------------------

  async upsertSkills(list: SkillRecord[]): Promise<number> {
    return skills.upsertSkills(this.sql, list);
  }

  async getSkill(id: number): Promise<SkillRecord | null> {
    return skills.getSkill(this.sql, id);
  }

  async getSkillIcon(id: number): Promise<Uint8Array | null> {
    return skills.getSkillIcon(this.sql, id);
  }

  async listSkills(opts: ListOptsBase = {}): Promise<PageResult<SkillRecord>> {
    return skills.listSkills(this.sql, opts);
  }

  async getSkillLevels(skillId: number): Promise<SkillLevelRecord[]> {
    return skills.getSkillLevels(this.sql, skillId);
  }

  async getSkillPrerequisites(skillId: number): Promise<SkillPrerequisiteWithName[]> {
    return skills.getSkillPrerequisites(this.sql, skillId);
  }

  async getSkillsRequiring(skillId: number): Promise<SkillPrerequisiteWithName[]> {
    return skills.getSkillsRequiring(this.sql, skillId);
  }

  async getSkillQuests(skillId: number): Promise<QuestSummary[]> {
    return skills.getSkillQuests(this.sql, skillId);
  }

  async replaceSkillRelations(rows: {
    levels: SkillLevelRecord[];
    prerequisites: SkillPrerequisiteRecord[];
  }): Promise<void> {
    skills.replaceSkillRelations(this.sql, rows);
  }

  // -- search / datasets ------------------------------------------------------

  async listSearchEntries(): Promise<SearchEntry[]> {
    return search.listSearchEntries(this.sql);
  }

  async getEntitySummariesByIds(
    entityType: EntityKind,
    ids: readonly number[],
  ): Promise<EntitySummary[]> {
    return search.getEntitySummariesByIds(this.sql, entityType, ids);
  }

  async recordDataset(input: {
    label: string;
    wzVersion: string;
    sourceKind?: 'wz' | 'img';
    files: DatasetFileRef[];
    notes?: string;
    totalMs?: number;
    ok?: boolean;
    extractors?: ExtractorResultRecord[];
  }): Promise<DatasetRecord> {
    return datasets.recordDataset(this.sql, input);
  }

  async listDatasets(): Promise<DatasetRecord[]> {
    return datasets.listDatasets(this.sql);
  }

  async listLoadedFileNames(): Promise<string[]> {
    return datasets.listLoadedFileNames(this.sql);
  }

  async findFileByHash(hash: string): Promise<DatasetFileRef | null> {
    return datasets.findFileByHash(this.sql, hash);
  }

  // -- lifecycle / meta -------------------------------------------------------

  async exportBytes(): Promise<Uint8Array> {
    return this.sql.exportBytes();
  }

  async importBytes(
    bytes: Uint8Array,
  ): Promise<{ backend: 'opfs' | 'memory'; schemaVersion: number }> {
    const result = await this.sql.importBytes(bytes);
    // An incompatible backup gets cleared on import too; flag the rebuild so
    // the UI explains it instead of dropping the user into a blank wiki.
    if (result.didDestructiveReset) markPendingRebuild(this.sql);
    return { backend: result.backend, schemaVersion: result.schemaVersion };
  }

  async getServerProfile(): Promise<string> {
    return getServerProfile(this.sql);
  }

  async setServerProfile(profileId: string): Promise<void> {
    setServerProfile(this.sql, profileId);
  }

  async clearAllData(): Promise<void> {
    clearAllData(this.sql);
  }
}
