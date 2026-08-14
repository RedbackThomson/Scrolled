// The mutation chokepoint for sync.
//
// Every user-DB write funnels one of these helpers in alongside its data change,
// inside the same transaction, so the data write and its `sync_outbox` entry
// commit atomically. Deletes are captured before the caller hard-deletes the
// row, since the backend keeps a tombstone so other devices learn of the delete.
//
// Local rows keep their integer primary keys; `uuid` is the key the backend
// knows a collection, group or pinned search by. Members, settings and recents
// have no minted key at all — their natural key is their identity everywhere.

import type { Sqlite, Row } from '@scrolled/game-db/db/sqlite';
import type { SqlValue } from '@sqlite.org/sqlite-wasm';
import {
  recordKey,
  splitRecordKey,
  SYNC_ENTITIES,
  type ApplyResult,
  type OutboxChange,
  type RemoteRow,
  type SyncEntity,
  type SyncMeta,
  type TaggedRow,
} from '@scrolled/sync-core';

export type { SyncEntity };

type WhereParam = string | number;

const ENTITY_TABLE: Record<SyncEntity, string> = {
  collection: 'collections',
  collection_member: 'collection_members',
  collection_group: 'collection_groups',
  pinned_search: 'pinned_searches',
  user_setting: 'user_settings',
  recent: 'recents',
};

/** TanStack query-key root each entity feeds, so a remote apply invalidates the
 *  same views a local mutation would. */
const ENTITY_QUERY_KEY: Record<SyncEntity, string[]> = {
  collection: ['user', 'collections'],
  collection_member: ['user', 'collections'],
  collection_group: ['user', 'collections'],
  pinned_search: ['user', 'pinned'],
  user_setting: ['user', 'settings'],
  recent: ['recents'],
};

function mintId(db: Sqlite): string {
  return db.selectValue<string>('SELECT lower(hex(randomblob(16)))') ?? '';
}

type OutboxListener = (entity: SyncEntity) => void;
let outboxListener: OutboxListener | null = null;

export function setOutboxListener(listener: OutboxListener | null): void {
  outboxListener = listener;
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
  now: number,
): void {
  db.exec(
    `INSERT INTO sync_outbox (entity, uuid, op, payload, base_revision, created_at, idempotency)
     VALUES (?, ?, ?, ?, 0, ?, '')`,
    [entity, uuid, op, JSON.stringify(withParentKeys(db, entity, payload)), now],
  );
  outboxListener?.(entity);
}

/**
 * Resolve a child's parent keys while the parent row still exists. Deleting a
 * collection queues tombstones for its members and groups and then removes the
 * collection, so by the time the queue drains there is nothing left to look the
 * parent up from — without this the child's entry could never be sent.
 */
function withParentKeys(db: Sqlite, entity: SyncEntity, payload: Row): Row {
  if (entity === 'collection_group') {
    return { ...payload, collection_uuid: uuidOfId(db, 'collections', payload.collection_id) };
  }
  if (entity === 'collection_member') {
    return {
      ...payload,
      collection_uuid: uuidOfId(db, 'collections', payload.collection_id),
      group_uuid:
        payload.group_id == null ? null : uuidOfId(db, 'collection_groups', payload.group_id),
    };
  }
  return payload;
}

/**
 * Stamp the sync columns on a row the caller just inserted or updated and queue
 * it for push. `where` must identify a single row.
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
  const uuid =
    typeof before.uuid === 'string' && before.uuid.length > 0 ? before.uuid : mintId(db);
  const now = Date.now();
  db.exec(
    `UPDATE ${table}
        SET uuid = ?, updated_at = ?, origin_device = ?, deleted_at = NULL
      WHERE ${where}`,
    [uuid, now, deviceId(db), ...bind],
  );
  const snapshot = db.selectObject<Row>(`SELECT * FROM ${table} WHERE ${where}`, bind);
  if (snapshot) appendOutbox(db, entity, uuid, 'upsert', snapshot, now);
}

/** Capture a delete before the caller hard-deletes the row. */
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
  const now = Date.now();
  appendOutbox(db, entity, uuid, 'delete', { ...row, deleted_at: now }, now);
}

/**
 * Stamp rows a caller bulk-inserted without a sync identity. Used by the import
 * path, which writes many rows at once rather than through single-row mutations.
 * Must run inside the caller's transaction.
 */
export function recordNewRows(db: Sqlite, entity: SyncEntity): void {
  const table = ENTITY_TABLE[entity];
  const rowids = db
    .selectObjects<{ rowid: number }>(`SELECT rowid FROM ${table} WHERE uuid = ''`)
    .map((r) => Number(r.rowid));
  for (const rowid of rowids) recordUpsert(db, entity, 'rowid = ?', [rowid]);
}

// -- engine-facing surface ----------------------------------------------------

export function getSyncMeta(db: Sqlite): SyncMeta {
  const row = db.selectObject<Row>(
    'SELECT cursor, device_id, account_id FROM sync_cursor WHERE id = 1',
  );
  return {
    cursor: String(row?.cursor ?? ''),
    deviceId: String(row?.device_id ?? ''),
    accountId: row?.account_id == null ? null : String(row.account_id),
  };
}

/**
 * Forget which account this DB belongs to, without touching the data. Restoring
 * a backup drops in another install's cursor and queue, which would otherwise be
 * pushed as if it were ours; clearing them makes the next sign-in re-adopt the
 * restored rows instead.
 */
export function detachSyncAccount(db: Sqlite): void {
  db.transaction(() => {
    db.exec('DELETE FROM sync_outbox');
    db.exec(`UPDATE sync_cursor SET cursor = '', account_id = NULL WHERE id = 1`);
    for (const entity of SYNC_ENTITIES) {
      db.exec(`UPDATE ${ENTITY_TABLE[entity]} SET remote_seq = 0`);
    }
  });
}

export function setCursor(db: Sqlite, cursor: string): void {
  db.exec('UPDATE sync_cursor SET cursor = ? WHERE id = 1', [cursor]);
}

export function pendingCount(db: Sqlite): number {
  return db.selectValue<number>('SELECT COUNT(*) FROM sync_outbox') ?? 0;
}

/**
 * The next batch of pending changes, oldest first, collapsed to one entry per
 * record. Coalescing matters because a single reorder or bulk edit queues a row
 * per shifted sibling; only the final state is worth sending.
 *
 * The returned `seq` is the newest entry for that record, and `markOutboxSynced`
 * clears every entry sharing its key, so superseded entries are not left behind.
 */
export function drainOutbox(db: Sqlite, limit: number): OutboxChange[] {
  const rows = db.selectObjects<Row>(
    'SELECT seq, entity, uuid, op, payload FROM sync_outbox ORDER BY seq',
  );

  const latest = new Map<string, OutboxChange>();
  for (const r of rows) {
    const entity = String(r.entity) as SyncEntity;
    const stored = JSON.parse(String(r.payload)) as Row;
    const row = toRemoteRow(db, entity, stored, String(r.uuid));
    if (!row) continue;
    const change: OutboxChange = {
      seq: Number(r.seq),
      entity,
      key: recordKey(entity, row),
      op: String(r.op) as 'upsert' | 'delete',
      row,
    };
    latest.set(`${entity}:${change.key}`, change);
  }

  return [...latest.values()].sort((a, b) => a.seq - b.seq).slice(0, limit);
}

/**
 * Drop acked entries and record the backend `seq` each row now holds, so a later
 * pull recognises the row as already applied.
 */
export function markOutboxSynced(
  db: Sqlite,
  seqs: number[],
  applied: { key: string; seq: number }[],
): void {
  db.transaction(() => {
    for (const seq of seqs) {
      const row = db.selectObject<Row>('SELECT entity, uuid FROM sync_outbox WHERE seq = ?', [seq]);
      if (!row) continue;
      const entity = String(row.entity) as SyncEntity;
      // Clear superseded entries for the same record, not just this one.
      db.exec('DELETE FROM sync_outbox WHERE entity = ? AND uuid = ? AND seq <= ?', [
        entity,
        String(row.uuid),
        seq,
      ]);
    }
    for (const a of applied) {
      for (const entity of SYNC_ENTITIES) {
        const match = liveMatchByKey(entity, a.key);
        if (!match) continue;
        db.exec(`UPDATE ${match.table} SET remote_seq = ? WHERE ${match.where}`, [
          a.seq,
          ...match.params,
        ]);
      }
    }
  });
}

/**
 * Apply rows from the backend in one transaction, skipping any record with a
 * pending local edit — that push is about to overwrite it — and any row we
 * already hold at the same or a newer `seq`.
 */
export function applyRemoteRows(db: Sqlite, rows: TaggedRow[]): ApplyResult {
  const invalidated = new Set<string>();
  let applied = 0;

  db.transaction(() => {
    // Parents first so a member never lands before the collection it points at.
    for (const entity of SYNC_ENTITIES) {
      for (const tagged of rows) {
        if (tagged.entity !== entity) continue;
        if (!applyOne(db, tagged)) continue;
        applied += 1;
        invalidated.add(JSON.stringify(ENTITY_QUERY_KEY[entity]));
      }
    }
  });

  return {
    invalidatedKeys: [...invalidated].map((s) => JSON.parse(s) as string[]),
    applied,
  };
}

/**
 * Discard local synced state and rebuild it from a full backend snapshot. The
 * recovery path when a device has diverged; pending local changes are dropped
 * along with the rest, which is the trade for guaranteed agreement.
 */
export function replaceAllFromSnapshot(db: Sqlite, rows: TaggedRow[]): ApplyResult {
  db.transaction(() => {
    for (const entity of [...SYNC_ENTITIES].reverse()) {
      db.exec(`DELETE FROM ${ENTITY_TABLE[entity]}`);
    }
    db.exec('DELETE FROM sync_outbox');
    for (const entity of SYNC_ENTITIES) {
      for (const tagged of rows) {
        if (tagged.entity === entity) applyOne(db, tagged, { force: true });
      }
    }
  });

  const roots = new Set<string>();
  for (const key of Object.values(ENTITY_QUERY_KEY)) roots.add(JSON.stringify(key));
  return {
    invalidatedKeys: [...roots].map((s) => JSON.parse(s) as string[]),
    applied: rows.length,
  };
}

/**
 * Adopt the backend's key for a record this device minted under a different one,
 * re-pointing its children. Resolves a duplicate created by two devices naming
 * the same thing while offline.
 */
export function rekeyLocal(
  db: Sqlite,
  entity: SyncEntity,
  fromKey: string,
  toKey: string,
): void {
  const table = ENTITY_TABLE[entity];
  db.transaction(() => {
    // A local row may already carry the canonical key if the backend's version
    // arrived first; merging into it would need a member-level union, so keep
    // both rows and let the pull settle the survivor.
    const taken = db.selectValue(`SELECT 1 FROM ${table} WHERE uuid = ?`, [toKey]) != null;
    if (taken) return;

    db.exec(`UPDATE ${table} SET uuid = ?, remote_seq = 0 WHERE uuid = ?`, [toKey, fromKey]);
    db.exec('UPDATE sync_outbox SET uuid = ? WHERE entity = ? AND uuid = ?', [
      toKey,
      entity,
      fromKey,
    ]);
    // Queued children captured the old key when they were written; without this
    // they would be sent referencing a parent that no longer exists.
    const column = entity === 'collection' ? 'collection_uuid' : 'group_uuid';
    if (entity === 'collection' || entity === 'collection_group') {
      repointQueuedChildren(db, column, fromKey, toKey);
    }
  });
}

function repointQueuedChildren(
  db: Sqlite,
  column: string,
  fromKey: string,
  toKey: string,
): void {
  const rows = db.selectObjects<Row>('SELECT seq, payload FROM sync_outbox');
  for (const row of rows) {
    const payload = JSON.parse(String(row.payload)) as Row;
    if (payload[column] !== fromKey) continue;
    payload[column] = toKey;
    db.exec('UPDATE sync_outbox SET payload = ? WHERE seq = ?', [
      JSON.stringify(payload),
      Number(row.seq),
    ]);
  }
}

// -- bootstrap ----------------------------------------------------------------
//
// `sync_cursor.account_id` records whose data this DB holds. Called once when a
// session becomes authenticated:
//
// - resumed: already this account, nothing to do.
// - adopted: anonymous data with no prior account — queue every row so the
//   user's offline work merges with whatever the account already holds.
// - reset: a different account — discard local data so two users never mix.
//
// Signing out of the same account does not reset; local data stays for offline
// use and the engine simply stops.

export type BootstrapAction = 'resumed' | 'adopted' | 'reset';

export function bootstrapSyncAccount(db: Sqlite, accountId: string): BootstrapAction {
  const meta = getSyncMeta(db);
  if (meta.accountId === accountId) return 'resumed';

  if (meta.accountId == null) {
    db.transaction(() => {
      adoptLocalData(db);
      db.exec('UPDATE sync_cursor SET account_id = ? WHERE id = 1', [accountId]);
    });
    return 'adopted';
  }

  db.transaction(() => {
    for (const entity of [...SYNC_ENTITIES].reverse()) {
      db.exec(`DELETE FROM ${ENTITY_TABLE[entity]}`);
    }
    db.exec('DELETE FROM sync_outbox');
    db.exec("UPDATE sync_cursor SET cursor = '', account_id = ? WHERE id = 1", [accountId]);
  });
  return 'reset';
}

/** Queue every live row for push, parents first. Must run inside a transaction. */
function adoptLocalData(db: Sqlite): void {
  db.exec('DELETE FROM sync_outbox');
  const now = Date.now();
  for (const entity of SYNC_ENTITIES) {
    const table = ENTITY_TABLE[entity];
    const rows = db.selectObjects<Row>(`SELECT * FROM ${table} WHERE deleted_at IS NULL`);
    for (const row of rows) {
      const uuid = typeof row.uuid === 'string' ? row.uuid : '';
      appendOutbox(db, entity, uuid, 'upsert', row, now);
    }
  }
}

// -- apply internals ----------------------------------------------------------

interface LiveMatch {
  table: string;
  where: string;
  params: SqlValue[];
}

/** Returns false when the row was skipped as pending or stale. */
function applyOne(db: Sqlite, tagged: TaggedRow, opts?: { force: boolean }): boolean {
  const { entity, row, seq } = tagged;
  const match = liveMatchByRow(db, entity, row);
  if (!match) return false;

  if (!opts?.force) {
    if (hasPendingEdit(db, entity, row)) return false;
    const held = db.selectValue<number>(
      `SELECT remote_seq FROM ${match.table} WHERE ${match.where}`,
      match.params,
    );
    if (held != null && Number(held) >= seq) return false;
  }

  if (row.deleted_at != null) {
    const exists = db.selectValue(`SELECT 1 FROM ${match.table} WHERE ${match.where}`, match.params);
    if (exists == null) return false;
    db.exec(`DELETE FROM ${match.table} WHERE ${match.where}`, match.params);
    return true;
  }

  const cols = localColumns(db, entity, row, seq);
  if (!cols) return false;

  const exists =
    db.selectValue(`SELECT 1 FROM ${match.table} WHERE ${match.where}`, match.params) != null;
  if (exists) {
    const sets = Object.keys(cols)
      .map((c) => `${c} = ?`)
      .join(', ');
    db.exec(`UPDATE ${match.table} SET ${sets} WHERE ${match.where}`, [
      ...Object.values(cols),
      ...match.params,
    ]);
  } else {
    const names = Object.keys(cols);
    db.exec(
      `INSERT INTO ${match.table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
      Object.values(cols),
    );
  }
  return true;
}

function hasPendingEdit(db: Sqlite, entity: SyncEntity, row: RemoteRow): boolean {
  const rows = db.selectObjects<Row>(
    'SELECT uuid, payload FROM sync_outbox WHERE entity = ?',
    [entity],
  );
  const target = recordKey(entity, row);
  for (const r of rows) {
    const stored = JSON.parse(String(r.payload)) as Row;
    const asRemote = toRemoteRow(db, entity, stored, String(r.uuid));
    if (asRemote && recordKey(entity, asRemote) === target) return true;
  }
  return false;
}

/** Locate the local row a backend row corresponds to, resolving parent keys to
 *  local integer ids. Null when the parent is not present. */
function liveMatchByRow(db: Sqlite, entity: SyncEntity, row: RemoteRow): LiveMatch | null {
  switch (entity) {
    case 'collection':
      return { table: 'collections', where: 'uuid = ?', params: [str(row.key)] };
    case 'collection_group':
      return { table: 'collection_groups', where: 'uuid = ?', params: [str(row.key)] };
    case 'pinned_search':
      return { table: 'pinned_searches', where: 'uuid = ?', params: [str(row.key)] };
    case 'user_setting':
      return { table: 'user_settings', where: 'key = ?', params: [str(row.key)] };
    case 'recent':
      return {
        table: 'recents',
        where: 'kind = ? AND ref = ?',
        params: [str(row.kind), str(row.ref)],
      };
    case 'collection_member': {
      const collectionId = idOfUuid(db, 'collections', row.collection_key);
      if (collectionId == null) return null;
      return {
        table: 'collection_members',
        where: 'collection_id = ? AND entity_type = ? AND entity_id = ?',
        params: [collectionId, str(row.entity_type), num(row.entity_id)],
      };
    }
  }
}

/** Locate a local row from a coalesced record key, for ack bookkeeping. */
function liveMatchByKey(entity: SyncEntity, key: string): LiveMatch | null {
  const parts = splitRecordKey(key);
  switch (entity) {
    case 'collection':
      return { table: 'collections', where: 'uuid = ?', params: [parts[0]] };
    case 'collection_group':
      return { table: 'collection_groups', where: 'uuid = ?', params: [parts[0]] };
    case 'pinned_search':
      return { table: 'pinned_searches', where: 'uuid = ?', params: [parts[0]] };
    case 'user_setting':
      return { table: 'user_settings', where: 'key = ?', params: [parts[0]] };
    case 'recent':
      if (parts.length < 2) return null;
      return { table: 'recents', where: 'kind = ? AND ref = ?', params: [parts[0], parts[1]] };
    case 'collection_member':
      if (parts.length < 3) return null;
      return {
        table: 'collection_members',
        where:
          'collection_id = (SELECT id FROM collections WHERE uuid = ?) AND entity_type = ? AND entity_id = ?',
        params: [parts[0], parts[1], Number(parts[2])],
      };
  }
}

/** Backend row → local columns. Null when a referenced parent is absent. */
function localColumns(
  db: Sqlite,
  entity: SyncEntity,
  row: RemoteRow,
  seq: number,
): Record<string, SqlValue> | null {
  const sync: Record<string, SqlValue> = {
    remote_seq: seq,
    deleted_at: null,
    origin_device: str(row.origin_device),
  };

  switch (entity) {
    case 'collection':
      return {
        uuid: str(row.key),
        name: str(row.name),
        description: nstr(row.description),
        color: nstr(row.color),
        icon: nstr(row.icon),
        created_at: num(row.created_at),
        updated_at: num(row.updated_at),
        pinned: bit(row.pinned),
        pinned_position: nnum(row.pinned_position),
        grouping: str(row.grouping),
        subgrouping: str(row.subgrouping),
        sort_key: str(row.sort_key),
        sort_dir: str(row.sort_dir),
        ...sync,
      };
    case 'pinned_search':
      return {
        uuid: str(row.key),
        name: str(row.name),
        entity: str(row.entity),
        params_json: str(row.params_json),
        created_at: num(row.created_at),
        updated_at: num(row.updated_at),
        ...sync,
      };
    case 'collection_group': {
      const collectionId = idOfUuid(db, 'collections', row.collection_key);
      if (collectionId == null) return null;
      return {
        uuid: str(row.key),
        collection_id: collectionId,
        name: str(row.name),
        position: num(row.position),
        created_at: num(row.created_at),
        updated_at: num(row.updated_at),
        ...sync,
      };
    }
    case 'collection_member': {
      const collectionId = idOfUuid(db, 'collections', row.collection_key);
      if (collectionId == null) return null;
      return {
        collection_id: collectionId,
        entity_type: str(row.entity_type),
        entity_id: num(row.entity_id),
        note: nstr(row.note),
        quantity: nnum(row.quantity),
        done: bit(row.done),
        added_at: num(row.added_at),
        // A group that has not arrived yet leaves the member ungrouped; the next
        // pull carrying the group re-links it.
        group_id: row.group_key == null ? null : idOfUuid(db, 'collection_groups', row.group_key),
        position: num(row.position),
        updated_at: num(row.updated_at),
        ...sync,
      };
    }
    case 'user_setting':
      return {
        key: str(row.key),
        value: str(row.value),
        updated_at: num(row.updated_at),
        ...sync,
      };
    case 'recent':
      // `name` is a local display label and never leaves the device, so an
      // inserted row keeps NULL and an update leaves any local name alone.
      return {
        kind: str(row.kind),
        ref: str(row.ref),
        viewed_at: num(row.viewed_at),
        updated_at: num(row.updated_at),
        ...sync,
      };
  }
}

/** Local row → backend row: drop local-only columns and replace integer foreign
 *  keys with the parent's key. Null when the parent has vanished. */
function toRemoteRow(
  db: Sqlite,
  entity: SyncEntity,
  stored: Row,
  uuid: string,
): RemoteRow | null {
  const base: RemoteRow = {
    updated_at: num(stored.updated_at),
    origin_device: str(stored.origin_device),
    deleted_at: stored.deleted_at == null ? null : new Date(num(stored.deleted_at)).toISOString(),
  };

  switch (entity) {
    case 'collection':
      return {
        ...base,
        key: uuid,
        name: str(stored.name),
        description: nstr(stored.description),
        color: nstr(stored.color),
        icon: nstr(stored.icon),
        created_at: num(stored.created_at),
        pinned: !!num(stored.pinned),
        pinned_position: nnum(stored.pinned_position),
        grouping: str(stored.grouping),
        subgrouping: str(stored.subgrouping),
        sort_key: str(stored.sort_key),
        sort_dir: str(stored.sort_dir),
      };
    case 'pinned_search':
      return {
        ...base,
        key: uuid,
        name: str(stored.name),
        entity: str(stored.entity),
        params_json: str(stored.params_json),
        created_at: num(stored.created_at),
      };
    case 'collection_group': {
      const collectionKey = parentKey(db, stored, 'collection_uuid', 'collections', 'collection_id');
      if (collectionKey == null) return null;
      return {
        ...base,
        key: uuid,
        collection_key: collectionKey,
        name: str(stored.name),
        position: num(stored.position),
        created_at: num(stored.created_at),
      };
    }
    case 'collection_member': {
      const collectionKey = parentKey(db, stored, 'collection_uuid', 'collections', 'collection_id');
      if (collectionKey == null) return null;
      return {
        ...base,
        collection_key: collectionKey,
        entity_type: str(stored.entity_type),
        entity_id: num(stored.entity_id),
        group_key: parentKey(db, stored, 'group_uuid', 'collection_groups', 'group_id'),
        note: nstr(stored.note),
        quantity: nnum(stored.quantity),
        done: !!num(stored.done),
        added_at: num(stored.added_at),
        position: num(stored.position),
      };
    }
    case 'user_setting':
      return { ...base, key: str(stored.key), value: str(stored.value) };
    case 'recent':
      return {
        ...base,
        kind: str(stored.kind),
        ref: str(stored.ref),
        viewed_at: num(stored.viewed_at),
      };
  }
}

/** Prefer the key captured when the entry was queued; the live row may since
 *  have been deleted along with its parent. */
function parentKey(
  db: Sqlite,
  stored: Row,
  captured: string,
  table: string,
  idColumn: string,
): string | null {
  const fromCapture = stored[captured];
  if (typeof fromCapture === 'string' && fromCapture.length > 0) return fromCapture;
  if (stored[idColumn] == null) return null;
  return uuidOfId(db, table, stored[idColumn] as SqlValue);
}

function uuidOfId(db: Sqlite, table: string, id: SqlValue): string | null {
  if (id == null) return null;
  return db.selectValue<string>(`SELECT uuid FROM ${table} WHERE id = ?`, [id]);
}

function idOfUuid(db: Sqlite, table: string, uuid: unknown): number | null {
  if (uuid == null) return null;
  const v = db.selectValue<number>(`SELECT id FROM ${table} WHERE uuid = ?`, [String(uuid)]);
  return v == null ? null : Number(v);
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}
function nstr(v: unknown): string | null {
  return v == null ? null : String(v);
}
function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0);
}
function nnum(v: unknown): number | null {
  return v == null ? null : Number(v);
}
/** SQLite has no boolean type; the backend does. */
function bit(v: unknown): number {
  return v === true || v === 1 || v === '1' ? 1 : 0;
}
