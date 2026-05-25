// Domain query helpers for the user-data SQLite file.
//
// Mirrors `db/queries.ts` shape so the worker passthrough stays uniform.

import { Sqlite, type Row } from '../sqlite';
import { USER_MIGRATIONS } from './migrations';
import {
  COLLECTIONS_JSON_VERSION,
  collectionsExportSchema,
  type CollectionBundleJson,
  type CollectionsExportJson,
  type ImportConflictMode,
  type ImportReport,
} from './collectionsJson';
import type {
  AddMemberOptions,
  BulkAddResult,
  CollectionEntityType,
  CollectionMember,
  CollectionRecord,
  CreateCollectionInput,
  CreatePinnedSearchInput,
  EntityRef,
  MembershipBadge,
  PinnedSearchRecord,
  UpdateCollectionPatch,
  UpdateMemberPatch,
  UpdatePinnedSearchPatch,
  UserDatabase,
  UserDbStatus,
} from './types';

const USER_OPFS_FILENAME = '/user.sqlite3';
const USER_POOL_NAME = 'mushex-user-db-pool';

export class UserDbApi implements UserDatabase {
  constructor(
    private readonly db: Sqlite = new Sqlite({
      opfsFilename: USER_OPFS_FILENAME,
      poolName: USER_POOL_NAME,
      migrations: USER_MIGRATIONS,
      logTag: 'user',
    }),
  ) {}

  async open(): Promise<UserDbStatus> {
    await this.db.open();
    return this.status();
  }

  async status(): Promise<UserDbStatus> {
    const schemaVersion = this.db.selectValue<number>('SELECT MAX(version) FROM _migrations') ?? 0;
    const collections = this.db.selectValue<number>('SELECT COUNT(*) FROM collections') ?? 0;
    const members = this.db.selectValue<number>('SELECT COUNT(*) FROM collection_members') ?? 0;
    const pinnedSearches = this.db.selectValue<number>('SELECT COUNT(*) FROM pinned_searches') ?? 0;
    return {
      schemaVersion,
      backend: this.db.backend,
      counts: { collections, members, pinnedSearches },
    };
  }

  async listCollections(): Promise<CollectionRecord[]> {
    const rows = this.db.selectObjects<Row>(`
      SELECT
        c.id,
        c.name,
        c.description,
        c.color,
        c.icon,
        c.created_at,
        c.updated_at,
        COUNT(m.entity_id) AS member_count
      FROM collections c
      LEFT JOIN collection_members m ON m.collection_id = c.id
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE ASC
    `);
    return rows.map(rowToCollection);
  }

  async createCollection(input: CreateCollectionInput): Promise<CollectionRecord> {
    const name = input.name.trim();
    if (!name) throw new Error('Collection name is required');
    const now = Date.now();
    const id = this.db.transaction(() => {
      this.db.exec(
        `INSERT INTO collections (name, description, color, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, input.description ?? null, input.color ?? null, input.icon ?? null, now, now],
      );
      return this.db.selectValue<number>('SELECT last_insert_rowid()') ?? 0;
    });
    const created = this.db.selectObject<Row>(
      `SELECT c.id, c.name, c.description, c.color, c.icon, c.created_at, c.updated_at,
              0 AS member_count
       FROM collections c WHERE c.id = ?`,
      [id],
    );
    if (!created) throw new Error(`Failed to load created collection ${id}`);
    return rowToCollection(created);
  }

  async getCollection(id: number): Promise<CollectionRecord | null> {
    const row = this.db.selectObject<Row>(
      `SELECT c.id, c.name, c.description, c.color, c.icon, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM collection_members m WHERE m.collection_id = c.id) AS member_count
       FROM collections c WHERE c.id = ?`,
      [id],
    );
    return row ? rowToCollection(row) : null;
  }

  async updateCollection(id: number, patch: UpdateCollectionPatch): Promise<CollectionRecord> {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error('Collection name is required');
      sets.push('name = ?');
      params.push(name);
    }
    if (patch.description !== undefined) {
      sets.push('description = ?');
      params.push(patch.description);
    }
    if (patch.color !== undefined) {
      sets.push('color = ?');
      params.push(patch.color);
    }
    if (patch.icon !== undefined) {
      sets.push('icon = ?');
      params.push(patch.icon);
    }
    if (sets.length === 0) {
      const existing = await this.getCollection(id);
      if (!existing) throw new Error(`Collection ${id} not found`);
      return existing;
    }
    sets.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);
    this.db.exec(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?`, params);
    const updated = await this.getCollection(id);
    if (!updated) throw new Error(`Collection ${id} not found after update`);
    return updated;
  }

  async deleteCollection(id: number): Promise<void> {
    // ON DELETE CASCADE on collection_members removes member rows.
    this.db.exec('DELETE FROM collections WHERE id = ?', [id]);
  }

  async listMembers(collectionId: number): Promise<CollectionMember[]> {
    const rows = this.db.selectObjects<Row>(
      `SELECT collection_id, entity_type, entity_id, note, quantity, done, added_at
       FROM collection_members
       WHERE collection_id = ?
       ORDER BY entity_type ASC, added_at ASC`,
      [collectionId],
    );
    return rows.map(rowToMember);
  }

  async addMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
    opts: AddMemberOptions = {},
  ): Promise<void> {
    this.db.exec(
      `INSERT INTO collection_members
         (collection_id, entity_type, entity_id, note, quantity, done, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (collection_id, entity_type, entity_id) DO UPDATE SET
         note     = excluded.note,
         quantity = excluded.quantity,
         done     = excluded.done`,
      [
        collectionId,
        entityType,
        entityId,
        opts.note ?? null,
        opts.quantity ?? null,
        opts.done ? 1 : 0,
        Date.now(),
      ],
    );
  }

  async removeMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
  ): Promise<void> {
    this.db.exec(
      `DELETE FROM collection_members
       WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
      [collectionId, entityType, entityId],
    );
  }

  async updateMember(
    collectionId: number,
    entityType: CollectionEntityType,
    entityId: number,
    patch: UpdateMemberPatch,
  ): Promise<void> {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    if (patch.note !== undefined) {
      sets.push('note = ?');
      params.push(patch.note);
    }
    if (patch.quantity !== undefined) {
      sets.push('quantity = ?');
      params.push(patch.quantity);
    }
    if (patch.done !== undefined) {
      sets.push('done = ?');
      params.push(patch.done ? 1 : 0);
    }
    if (sets.length === 0) return;
    params.push(collectionId, entityType, entityId);
    this.db.exec(
      `UPDATE collection_members SET ${sets.join(', ')}
       WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
      params,
    );
  }

  async bulkAddMembers(collectionId: number, refs: readonly EntityRef[]): Promise<BulkAddResult> {
    if (refs.length === 0) return { added: 0, skipped: 0 };
    let added = 0;
    let skipped = 0;
    const now = Date.now();
    this.db.transaction(() => {
      for (const ref of refs) {
        const before =
          this.db.selectValue<number>(
            `SELECT 1 FROM collection_members
             WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
            [collectionId, ref.entityType, ref.entityId],
          ) ?? null;
        if (before !== null) {
          skipped++;
          continue;
        }
        this.db.exec(
          `INSERT INTO collection_members
             (collection_id, entity_type, entity_id, note, quantity, done, added_at)
           VALUES (?, ?, ?, NULL, NULL, 0, ?)`,
          [collectionId, ref.entityType, ref.entityId, now],
        );
        added++;
      }
    });
    return { added, skipped };
  }

  async bulkRemoveMembers(collectionId: number, refs: readonly EntityRef[]): Promise<void> {
    if (refs.length === 0) return;
    this.db.transaction(() => {
      for (const ref of refs) {
        this.db.exec(
          `DELETE FROM collection_members
           WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
          [collectionId, ref.entityType, ref.entityId],
        );
      }
    });
  }

  async exportCollectionJson(id: number): Promise<CollectionsExportJson> {
    const bundle = this.buildBundle(id);
    if (!bundle) throw new Error(`Collection ${id} not found`);
    return {
      version: COLLECTIONS_JSON_VERSION,
      kind: 'collection',
      collection: bundle,
    };
  }

  async exportAllJson(): Promise<CollectionsExportJson> {
    const ids = this.db
      .selectObjects<{ id: number }>('SELECT id FROM collections ORDER BY name COLLATE NOCASE ASC')
      .map((r) => r.id);
    const bundles: CollectionBundleJson[] = [];
    for (const id of ids) {
      const b = this.buildBundle(id);
      if (b) bundles.push(b);
    }
    const pinned = await this.listPinnedSearches();
    return {
      version: COLLECTIONS_JSON_VERSION,
      kind: 'all',
      collections: bundles,
      pinnedSearches: pinned.map((p) => ({
        name: p.name,
        entity: p.entity,
        params: p.params,
      })),
    };
  }

  async importJson(payload: unknown, conflict: ImportConflictMode): Promise<ImportReport> {
    const parsed = collectionsExportSchema.parse(payload);
    const bundles: CollectionBundleJson[] =
      parsed.kind === 'collection' ? [parsed.collection] : parsed.collections;

    const report: ImportReport = {
      createdCollections: 0,
      mergedCollections: 0,
      renamedCollections: 0,
      skippedCollections: 0,
      addedMembers: 0,
      skippedMembers: 0,
      importedNames: [],
      importedPinnedSearches: 0,
      skippedPinnedSearches: 0,
    };

    this.db.transaction(() => {
      for (const bundle of bundles) {
        const existingId = this.findCollectionIdByName(bundle.name);

        if (existingId === null) {
          // Fresh import — no conflict.
          const newId = this.insertCollection(bundle);
          this.insertBundleMembers(newId, bundle, report);
          report.createdCollections++;
          report.importedNames.push(bundle.name);
          continue;
        }

        if (conflict === 'skip') {
          report.skippedCollections++;
          continue;
        }

        if (conflict === 'merge') {
          this.insertBundleMembers(existingId, bundle, report);
          report.mergedCollections++;
          report.importedNames.push(bundle.name);
          continue;
        }

        // rename
        const newName = this.uniqueImportedName(bundle.name);
        const newId = this.insertCollection({ ...bundle, name: newName });
        this.insertBundleMembers(newId, bundle, report);
        report.renamedCollections++;
        report.importedNames.push(newName);
      }

      if (parsed.kind === 'all' && parsed.pinnedSearches) {
        const now = Date.now();
        for (const pinned of parsed.pinnedSearches) {
          const existing = this.db.selectValue<number>(
            'SELECT 1 FROM pinned_searches WHERE name = ?',
            [pinned.name],
          );
          if (existing != null) {
            report.skippedPinnedSearches++;
            continue;
          }
          this.db.exec(
            `INSERT INTO pinned_searches (name, entity, params_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [pinned.name, pinned.entity, JSON.stringify(pinned.params), now, now],
          );
          report.importedPinnedSearches++;
        }
      }
    });

    return report;
  }

  async exportBytes(): Promise<Uint8Array> {
    return this.db.exportBytes();
  }

  async importBytes(
    bytes: Uint8Array,
  ): Promise<{ backend: 'opfs' | 'memory'; schemaVersion: number }> {
    return this.db.importBytes(bytes);
  }

  // -- helpers ---------------------------------------------------------------

  private buildBundle(id: number): CollectionBundleJson | null {
    const c = this.db.selectObject<Row>(
      'SELECT name, description, color, icon FROM collections WHERE id = ?',
      [id],
    );
    if (!c) return null;
    const members = this.db.selectObjects<Row>(
      `SELECT entity_type, entity_id, note, quantity, done
       FROM collection_members WHERE collection_id = ?
       ORDER BY entity_type ASC, added_at ASC`,
      [id],
    );
    return {
      name: String(c.name),
      description: c.description == null ? null : String(c.description),
      color: c.color == null ? null : String(c.color),
      icon: c.icon == null ? null : String(c.icon),
      members: members.map((m) => ({
        entityType: String(m.entity_type) as CollectionEntityType,
        entityId: Number(m.entity_id),
        note: m.note == null ? null : String(m.note),
        quantity: m.quantity == null ? null : Number(m.quantity),
        done: Number(m.done) === 1,
      })),
    };
  }

  private findCollectionIdByName(name: string): number | null {
    const id = this.db.selectValue<number>('SELECT id FROM collections WHERE name = ?', [name]);
    return id == null ? null : Number(id);
  }

  /**
   * Resolve a unique destination name for `rename` conflicts. Tries
   * "<name> (imported)" first, then "<name> (imported 2)" and so on.
   * Stops at a sensible ceiling so a runaway loop on broken data can't
   * lock up the worker.
   */
  private uniqueImportedName(name: string): string {
    const base = `${name} (imported)`;
    if (this.findCollectionIdByName(base) === null) return base;
    for (let i = 2; i < 1000; i++) {
      const candidate = `${name} (imported ${i})`;
      if (this.findCollectionIdByName(candidate) === null) return candidate;
    }
    throw new Error(`Could not find a unique name for "${name}"`);
  }

  private insertCollection(bundle: CollectionBundleJson): number {
    const now = Date.now();
    this.db.exec(
      `INSERT INTO collections (name, description, color, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        bundle.name,
        bundle.description ?? null,
        bundle.color ?? null,
        bundle.icon ?? null,
        now,
        now,
      ],
    );
    const id = this.db.selectValue<number>('SELECT last_insert_rowid()');
    if (id == null) throw new Error('Failed to read inserted collection id');
    return Number(id);
  }

  private insertBundleMembers(
    collectionId: number,
    bundle: CollectionBundleJson,
    report: ImportReport,
  ): void {
    const now = Date.now();
    for (const m of bundle.members) {
      const exists =
        this.db.selectValue<number>(
          `SELECT 1 FROM collection_members
           WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
          [collectionId, m.entityType, m.entityId],
        ) ?? null;
      if (exists !== null) {
        report.skippedMembers++;
        continue;
      }
      this.db.exec(
        `INSERT INTO collection_members
           (collection_id, entity_type, entity_id, note, quantity, done, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          collectionId,
          m.entityType,
          m.entityId,
          m.note ?? null,
          m.quantity ?? null,
          m.done ? 1 : 0,
          now,
        ],
      );
      report.addedMembers++;
    }
  }

  async listPinnedSearches(): Promise<PinnedSearchRecord[]> {
    const rows = this.db.selectObjects<Row>(
      `SELECT id, name, entity, params_json, created_at, updated_at
       FROM pinned_searches
       ORDER BY name COLLATE NOCASE ASC`,
    );
    return rows.map(rowToPinnedSearch);
  }

  async getPinnedSearch(id: number): Promise<PinnedSearchRecord | null> {
    const row = this.db.selectObject<Row>(
      `SELECT id, name, entity, params_json, created_at, updated_at
       FROM pinned_searches WHERE id = ?`,
      [id],
    );
    return row ? rowToPinnedSearch(row) : null;
  }

  async createPinnedSearch(input: CreatePinnedSearchInput): Promise<PinnedSearchRecord> {
    const name = input.name.trim();
    if (!name) throw new Error('Pinned search name is required');
    const now = Date.now();
    this.db.exec(
      `INSERT INTO pinned_searches (name, entity, params_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [name, input.entity, JSON.stringify(input.params ?? {}), now, now],
    );
    const id = this.db.selectValue<number>('SELECT last_insert_rowid()') ?? 0;
    const row = this.db.selectObject<Row>(
      `SELECT id, name, entity, params_json, created_at, updated_at
       FROM pinned_searches WHERE id = ?`,
      [id],
    );
    if (!row) throw new Error('Failed to load created pinned search');
    return rowToPinnedSearch(row);
  }

  async updatePinnedSearch(
    id: number,
    patch: UpdatePinnedSearchPatch,
  ): Promise<PinnedSearchRecord> {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error('Pinned search name is required');
      sets.push('name = ?');
      params.push(name);
    }
    if (patch.params !== undefined) {
      sets.push('params_json = ?');
      params.push(JSON.stringify(patch.params));
    }
    if (sets.length === 0) {
      const existing = await this.getPinnedSearch(id);
      if (!existing) throw new Error(`Pinned search ${id} not found`);
      return existing;
    }
    sets.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);
    this.db.exec(`UPDATE pinned_searches SET ${sets.join(', ')} WHERE id = ?`, params);
    const updated = await this.getPinnedSearch(id);
    if (!updated) throw new Error(`Pinned search ${id} not found after update`);
    return updated;
  }

  async deletePinnedSearch(id: number): Promise<void> {
    this.db.exec('DELETE FROM pinned_searches WHERE id = ?', [id]);
  }

  async listMembershipsFor(
    entityType: CollectionEntityType,
    entityId: number,
  ): Promise<MembershipBadge[]> {
    const rows = this.db.selectObjects<Row>(
      `SELECT c.id AS collection_id, c.name, c.description, c.icon, c.color,
              m.note, m.quantity, m.done
       FROM collections c
       INNER JOIN collection_members m ON m.collection_id = c.id
       WHERE m.entity_type = ? AND m.entity_id = ?
       ORDER BY c.name COLLATE NOCASE ASC`,
      [entityType, entityId],
    );
    return rows.map((r) => ({
      collectionId: Number(r.collection_id),
      name: String(r.name),
      description: r.description == null ? null : String(r.description),
      icon: r.icon == null ? null : String(r.icon),
      color: r.color == null ? null : String(r.color),
      note: r.note == null ? null : String(r.note),
      quantity: r.quantity == null ? null : Number(r.quantity),
      done: Number(r.done) === 1,
    }));
  }
}

function rowToMember(row: Row): CollectionMember {
  return {
    collectionId: Number(row.collection_id),
    entityType: String(row.entity_type) as CollectionEntityType,
    entityId: Number(row.entity_id),
    note: row.note == null ? null : String(row.note),
    quantity: row.quantity == null ? null : Number(row.quantity),
    done: Number(row.done) === 1,
    addedAt: Number(row.added_at),
  };
}

function rowToPinnedSearch(row: Row): PinnedSearchRecord {
  let params: Record<string, string> = {};
  const raw = row.params_json;
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        params = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
        );
      }
    } catch {
      params = {};
    }
  }
  return {
    id: Number(row.id),
    name: String(row.name),
    entity: String(row.entity) as CollectionEntityType,
    params,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToCollection(row: Row): CollectionRecord {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    color: row.color == null ? null : String(row.color),
    icon: row.icon == null ? null : String(row.icon),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    memberCount: Number(row.member_count ?? 0),
  };
}
