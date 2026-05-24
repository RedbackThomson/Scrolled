/// <reference lib="WebWorker" />
import { expose } from 'comlink';
import { UserDbApi } from '@/db/user/queries';
import type {
  AddMemberOptions,
  CollectionEntityType,
  CreateCollectionInput,
  EntityRef,
  UpdateCollectionPatch,
  UpdateMemberPatch,
} from '@/db/user/types';
import { createLogger, describeError } from '@/lib/logger';

const log = createLogger('user-db-worker');
log.info('user db worker started');

class WorkerUserDb {
  private readonly api = new UserDbApi();
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
  async listCollections() {
    await this.ensureOpen();
    return this.api.listCollections();
  }
  async getCollection(id: number) {
    await this.ensureOpen();
    return this.api.getCollection(id);
  }
  async createCollection(input: CreateCollectionInput) {
    await this.ensureOpen();
    return this.api.createCollection(input);
  }
  async updateCollection(id: number, patch: UpdateCollectionPatch) {
    await this.ensureOpen();
    return this.api.updateCollection(id, patch);
  }
  async deleteCollection(id: number) {
    await this.ensureOpen();
    return this.api.deleteCollection(id);
  }
  async listMembers(collectionId: number) {
    await this.ensureOpen();
    return this.api.listMembers(collectionId);
  }
  async addMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
    opts?: AddMemberOptions,
  ) {
    await this.ensureOpen();
    return this.api.addMember(collectionId, entityType, entityId, opts);
  }
  async removeMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
  ) {
    await this.ensureOpen();
    return this.api.removeMember(collectionId, entityType, entityId);
  }
  async updateMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
    patch: UpdateMemberPatch,
  ) {
    await this.ensureOpen();
    return this.api.updateMember(collectionId, entityType, entityId, patch);
  }
  async bulkAddMembers(collectionId: number, refs: readonly EntityRef[]) {
    await this.ensureOpen();
    return this.api.bulkAddMembers(collectionId, refs);
  }
  async bulkRemoveMembers(collectionId: number, refs: readonly EntityRef[]) {
    await this.ensureOpen();
    return this.api.bulkRemoveMembers(collectionId, refs);
  }
  async listMembershipsFor(entityType: CollectionEntityType, entityId: number) {
    await this.ensureOpen();
    return this.api.listMembershipsFor(entityType, entityId);
  }
}

expose(new WorkerUserDb());
