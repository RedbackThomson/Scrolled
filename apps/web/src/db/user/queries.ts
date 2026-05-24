// Domain query helpers for the user-data SQLite file.
//
// Phase A surface: status + listCollections + createCollection + addMember.
// Mirrors `db/queries.ts` shape so the worker passthrough stays uniform.

import { Sqlite, type Row } from '../sqlite';
import { USER_MIGRATIONS } from './migrations';
import type {
  AddMemberOptions,
  BulkAddResult,
  CollectionEntityType,
  CollectionMember,
  CollectionRecord,
  CreateCollectionInput,
  EntityRef,
  MembershipBadge,
  UpdateCollectionPatch,
  UpdateMemberPatch,
  UserDatabase,
  UserDbStatus,
} from './types';

const USER_OPFS_FILENAME = '/user.sqlite3';
const USER_POOL_NAME = 'mge-user-db-pool';

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
    const schemaVersion =
      this.db.selectValue<number>('SELECT MAX(version) FROM _migrations') ?? 0;
    const collections = this.db.selectValue<number>('SELECT COUNT(*) FROM collections') ?? 0;
    const members =
      this.db.selectValue<number>('SELECT COUNT(*) FROM collection_members') ?? 0;
    return {
      schemaVersion,
      backend: this.db.backend,
      counts: { collections, members },
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
        [
          name,
          input.description ?? null,
          input.color ?? null,
          input.icon ?? null,
          now,
          now,
        ],
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

  async bulkAddMembers(
    collectionId: number,
    refs: readonly EntityRef[],
  ): Promise<BulkAddResult> {
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

  async bulkRemoveMembers(
    collectionId: number,
    refs: readonly EntityRef[],
  ): Promise<void> {
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
