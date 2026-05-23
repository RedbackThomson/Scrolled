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
  async clearAllData() {
    await this.ensureOpen();
    return this.api.clearAllData();
  }
}

expose(new WorkerDb());
