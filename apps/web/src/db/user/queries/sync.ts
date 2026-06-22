// The mutation chokepoint for sync (docs/sync_design.md §6.6).
//
// Every user-DB write funnels one of these helpers in alongside its data
// change, inside the same transaction, so the data write and its `sync_outbox`
// entry commit atomically — no mutation can escape the outbox, and a crash
// can't leave the two inconsistent. The engine (a later phase) drains the
// outbox; here we only ever append to it. Nothing leaves the device.
//
// Deletes are captured as `op='delete'` outbox entries holding the record's
// uuid and a final snapshot; the live row is still hard-deleted by the caller,
// so reads and unique constraints are unaffected. The `deleted_at` column
// exists for the remote-apply/conflict path a later phase adds.

import type { Sqlite, Row } from '@scrolled/game-db/db/sqlite';

type WhereParam = string | number;

export type SyncEntity =
  | 'collection'
  | 'collection_member'
  | 'collection_group'
  | 'pinned_search'
  | 'user_setting'
  | 'recent';

const ENTITY_TABLE: Record<SyncEntity, string> = {
  collection: 'collections',
  collection_member: 'collection_members',
  collection_group: 'collection_groups',
  pinned_search: 'pinned_searches',
  user_setting: 'user_settings',
  recent: 'recents',
};

function mintId(db: Sqlite): string {
  return db.selectValue<string>('SELECT lower(hex(randomblob(16)))') ?? '';
}

/** This install's stable device id, minted by the v6 migration. */
export function deviceId(db: Sqlite): string {
  return db.selectValue<string>('SELECT device_id FROM sync_cursor WHERE id = 1') ?? '';
}

function appendOutbox(
  db: Sqlite,
  entity: SyncEntity,
  uuid: string,
  op: 'upsert' | 'delete',
  payload: Row,
  baseRevision: number,
  now: number,
): void {
  db.exec(
    `INSERT INTO sync_outbox (entity, uuid, op, payload, base_revision, created_at, idempotency)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entity, uuid, op, JSON.stringify(payload), baseRevision, now, mintId(db)],
  );
}

/**
 * Stamp the sync columns on a row the caller just inserted or updated, and
 * append an `upsert` to the outbox capturing the post-write snapshot. `where`
 * identifies the single affected row; its `params` are reused for the readback
 * and update. A no-op if the row is gone (defensive).
 */
export function recordUpsert(
  db: Sqlite,
  entity: SyncEntity,
  where: string,
  params: readonly WhereParam[],
): void {
  const table = ENTITY_TABLE[entity];
  const bind = [...params];
  const before = db.selectObject<Row>(`SELECT * FROM ${table} WHERE ${where}`, bind);
  if (!before) return;
  const base = Number(before.revision ?? 0);
  const uuid =
    typeof before.uuid === 'string' && before.uuid.length > 0 ? before.uuid : mintId(db);
  const now = Date.now();
  db.exec(
    `UPDATE ${table}
        SET uuid = ?, revision = ?, updated_at = ?, origin_device = ?, deleted_at = NULL
      WHERE ${where}`,
    [uuid, base + 1, now, deviceId(db), ...bind],
  );
  const snapshot = db.selectObject<Row>(`SELECT * FROM ${table} WHERE ${where}`, bind);
  if (snapshot) appendOutbox(db, entity, uuid, 'upsert', snapshot, base, now);
}

/**
 * Capture a `delete` for the row matched by `where` before the caller
 * hard-deletes it. A no-op if the row is already gone.
 */
export function recordDelete(
  db: Sqlite,
  entity: SyncEntity,
  where: string,
  params: readonly WhereParam[],
): void {
  const table = ENTITY_TABLE[entity];
  const bind = [...params];
  const row = db.selectObject<Row>(`SELECT * FROM ${table} WHERE ${where}`, bind);
  if (!row) return;
  const uuid = typeof row.uuid === 'string' ? row.uuid : '';
  const base = Number(row.revision ?? 0);
  const now = Date.now();
  appendOutbox(db, entity, uuid, 'delete', { ...row, deleted_at: now }, base, now);
}

/**
 * Sweep a table for rows the caller bulk-inserted without a sync identity
 * (uuid still `''`), stamp each, and enqueue an upsert. Used by the import
 * path, which writes many rows at once rather than through a single-row
 * mutation. Caller is responsible for running this inside its transaction.
 */
export function recordNewRows(db: Sqlite, entity: SyncEntity): void {
  const table = ENTITY_TABLE[entity];
  const rowids = db
    .selectObjects<{ rowid: number }>(`SELECT rowid FROM ${table} WHERE uuid = ''`)
    .map((r) => Number(r.rowid));
  for (const rowid of rowids) recordUpsert(db, entity, 'rowid = ?', [rowid]);
}
