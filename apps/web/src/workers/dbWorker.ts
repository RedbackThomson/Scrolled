/// <reference lib="WebWorker" />
import { expose } from 'comlink';
import { Sqlite } from '@/db/sqlite';
import { DbApi } from '@/db/queries';
import { createLogger, describeError } from '@/lib/logger';

const log = createLogger('db-worker');
log.info('db worker started');

class WorkerDb {
  private readonly api = new DbApi(new Sqlite());
  private opened: Promise<void> | null = null;

  private async ensureOpen() {
    if (!this.opened) {
      this.opened = this.api.open().then(
        () => undefined,
        (e) => {
          log.error('open failed', describeError(e));
          this.opened = null;
          throw e;
        },
      );
    }
    return this.opened;
  }

  async open() {
    await this.ensureOpen();
    return this.api.status();
  }
  async status() {
    await this.ensureOpen();
    return this.api.status();
  }
  async upsertItem(item: Parameters<DbApi['upsertItem']>[0]) {
    await this.ensureOpen();
    return this.api.upsertItem(item);
  }
  async upsertItems(items: Parameters<DbApi['upsertItems']>[0]) {
    await this.ensureOpen();
    return this.api.upsertItems(items);
  }
  async getItem(id: number) {
    await this.ensureOpen();
    return this.api.getItem(id);
  }
  async listItems(opts?: Parameters<DbApi['listItems']>[0]) {
    await this.ensureOpen();
    return this.api.listItems(opts);
  }
  async listItemCategories() {
    await this.ensureOpen();
    return this.api.listItemCategories();
  }
  async getItemIcon(id: number) {
    await this.ensureOpen();
    return this.api.getItemIcon(id);
  }
  async upsertEquip(equip: Parameters<DbApi['upsertEquip']>[0]) {
    await this.ensureOpen();
    return this.api.upsertEquip(equip);
  }
  async upsertEquips(equips: Parameters<DbApi['upsertEquips']>[0]) {
    await this.ensureOpen();
    return this.api.upsertEquips(equips);
  }
  async getEquip(id: number) {
    await this.ensureOpen();
    return this.api.getEquip(id);
  }
  async listEquips(opts?: Parameters<DbApi['listEquips']>[0]) {
    await this.ensureOpen();
    return this.api.listEquips(opts);
  }
  async listEquipSlots() {
    await this.ensureOpen();
    return this.api.listEquipSlots();
  }
  async listEquipTypes() {
    await this.ensureOpen();
    return this.api.listEquipTypes();
  }
  async getEquipIcon(id: number) {
    await this.ensureOpen();
    return this.api.getEquipIcon(id);
  }
  async upsertMobs(mobs: Parameters<DbApi['upsertMobs']>[0]) {
    await this.ensureOpen();
    return this.api.upsertMobs(mobs);
  }
  async getMobIcon(id: number) {
    await this.ensureOpen();
    return this.api.getMobIcon(id);
  }
  async getMob(id: number) {
    await this.ensureOpen();
    return this.api.getMob(id);
  }
  async listMobs(opts?: Parameters<DbApi['listMobs']>[0]) {
    await this.ensureOpen();
    return this.api.listMobs(opts);
  }
  async getMobDrops(mobId: number) {
    await this.ensureOpen();
    return this.api.getMobDrops(mobId);
  }
  async getMobMaps(mobId: number) {
    await this.ensureOpen();
    return this.api.getMobMaps(mobId);
  }
  async getItemDroppedBy(itemId: number) {
    await this.ensureOpen();
    return this.api.getItemDroppedBy(itemId);
  }
  async replaceMobDrops(drops: Parameters<DbApi['replaceMobDrops']>[0]) {
    await this.ensureOpen();
    return this.api.replaceMobDrops(drops);
  }
  async upsertNpcs(npcs: Parameters<DbApi['upsertNpcs']>[0]) {
    await this.ensureOpen();
    return this.api.upsertNpcs(npcs);
  }
  async getNpc(id: number) {
    await this.ensureOpen();
    return this.api.getNpc(id);
  }
  async listNpcs(opts?: Parameters<DbApi['listNpcs']>[0]) {
    await this.ensureOpen();
    return this.api.listNpcs(opts);
  }
  async getNpcMaps(id: number) {
    await this.ensureOpen();
    return this.api.getNpcMaps(id);
  }
  async getNpcIcon(id: number) {
    await this.ensureOpen();
    return this.api.getNpcIcon(id);
  }
  async upsertMaps(maps: Parameters<DbApi['upsertMaps']>[0]) {
    await this.ensureOpen();
    return this.api.upsertMaps(maps);
  }
  async getMap(id: number) {
    await this.ensureOpen();
    return this.api.getMap(id);
  }
  async getMapMinimap(id: number) {
    await this.ensureOpen();
    return this.api.getMapMinimap(id);
  }
  async listMaps(opts?: Parameters<DbApi['listMaps']>[0]) {
    await this.ensureOpen();
    return this.api.listMaps(opts);
  }
  async getMapNpcs(mapId: number) {
    await this.ensureOpen();
    return this.api.getMapNpcs(mapId);
  }
  async getMapMobs(mapId: number) {
    await this.ensureOpen();
    return this.api.getMapMobs(mapId);
  }
  async getMapPortals(mapId: number) {
    await this.ensureOpen();
    return this.api.getMapPortals(mapId);
  }
  async getMapMobSpawns(mapId: number) {
    await this.ensureOpen();
    return this.api.getMapMobSpawns(mapId);
  }
  async replaceMapLife(rows: Parameters<DbApi['replaceMapLife']>[0]) {
    await this.ensureOpen();
    return this.api.replaceMapLife(rows);
  }
  async listSearchEntries() {
    await this.ensureOpen();
    return this.api.listSearchEntries();
  }
  async getEntitySummariesByIds(
    entityType: Parameters<DbApi['getEntitySummariesByIds']>[0],
    ids: Parameters<DbApi['getEntitySummariesByIds']>[1],
  ) {
    await this.ensureOpen();
    return this.api.getEntitySummariesByIds(entityType, ids);
  }
  async upsertQuests(quests: Parameters<DbApi['upsertQuests']>[0]) {
    await this.ensureOpen();
    return this.api.upsertQuests(quests);
  }
  async getQuest(id: number) {
    await this.ensureOpen();
    return this.api.getQuest(id);
  }
  async listQuests(opts?: Parameters<DbApi['listQuests']>[0]) {
    await this.ensureOpen();
    return this.api.listQuests(opts);
  }
  async listQuestParents() {
    await this.ensureOpen();
    return this.api.listQuestParents();
  }
  async getQuestRequirements(questId: number) {
    await this.ensureOpen();
    return this.api.getQuestRequirements(questId);
  }
  async getQuestRewards(questId: number) {
    await this.ensureOpen();
    return this.api.getQuestRewards(questId);
  }
  async getNpcQuests(npcId: number) {
    await this.ensureOpen();
    return this.api.getNpcQuests(npcId);
  }
  async getItemQuests(itemId: number) {
    await this.ensureOpen();
    return this.api.getItemQuests(itemId);
  }
  async getMobQuests(mobId: number) {
    await this.ensureOpen();
    return this.api.getMobQuests(mobId);
  }
  async replaceQuestRelations(rows: Parameters<DbApi['replaceQuestRelations']>[0]) {
    await this.ensureOpen();
    return this.api.replaceQuestRelations(rows);
  }
  async recordDataset(input: Parameters<DbApi['recordDataset']>[0]) {
    await this.ensureOpen();
    return this.api.recordDataset(input);
  }
  async listDatasets() {
    await this.ensureOpen();
    return this.api.listDatasets();
  }
  async listLoadedFileNames() {
    await this.ensureOpen();
    return this.api.listLoadedFileNames();
  }
  async findFileByHash(hash: string) {
    await this.ensureOpen();
    return this.api.findFileByHash(hash);
  }
  async clearAllData() {
    await this.ensureOpen();
    return this.api.clearAllData();
  }
  async exportBytes() {
    await this.ensureOpen();
    return this.api.exportBytes();
  }
  async importBytes(bytes: Uint8Array) {
    await this.ensureOpen();
    return this.api.importBytes(bytes);
  }
}

expose(new WorkerDb());
