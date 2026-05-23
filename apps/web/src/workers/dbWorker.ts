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
  async getEquipIcon(id: number) {
    await this.ensureOpen();
    return this.api.getEquipIcon(id);
  }
  async upsertMobs(mobs: Parameters<DbApi['upsertMobs']>[0]) {
    await this.ensureOpen();
    return this.api.upsertMobs(mobs);
  }
  async getMob(id: number) {
    await this.ensureOpen();
    return this.api.getMob(id);
  }
  async listMobs(opts?: Parameters<DbApi['listMobs']>[0]) {
    await this.ensureOpen();
    return this.api.listMobs(opts);
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
  async upsertMaps(maps: Parameters<DbApi['upsertMaps']>[0]) {
    await this.ensureOpen();
    return this.api.upsertMaps(maps);
  }
  async getMap(id: number) {
    await this.ensureOpen();
    return this.api.getMap(id);
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
  async replaceMapLife(rows: Parameters<DbApi['replaceMapLife']>[0]) {
    await this.ensureOpen();
    return this.api.replaceMapLife(rows);
  }
  async listSearchEntries() {
    await this.ensureOpen();
    return this.api.listSearchEntries();
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
}

expose(new WorkerDb());
