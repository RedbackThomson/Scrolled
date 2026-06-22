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
import type { SqlValue } from '@sqlite.org/sqlite-wasm';
import {
  resolveConflict,
  type ApplyResult,
  type AssignedRevision,
  type OutboxChange,
  type ServerChange,
  type SyncChange,
  type SyncEntity,
  type SyncMeta,
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

function mintId(db: Sqlite): string {
  return db.selectValue<string>('SELECT lower(hex(randomblob(16)))') ?? '';
}

// -- outbox doorbell ---------------------------------------------------------
//
// Every outbox append funnels through `appendOutbox`, so it is the single place
// to signal "local data changed, drain me." The worker registers a listener
// that rings a cross-context doorbell (a BroadcastChannel) the main-thread sync
// engine debounces into a push (docs/sync_design.md §13). Fires in every build;
// with no engine listening (signed out / self-hosted) it is a harmless no-op.

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
  baseRevision: number,
  now: number,
): void {
  db.exec(
    `INSERT INTO sync_outbox (entity, uuid, op, payload, base_revision, created_at, idempotency)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entity, uuid, op, JSON.stringify(payload), baseRevision, now, mintId(db)],
  );
  outboxListener?.(entity);
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

// === The engine-facing surface (docs/sync_design.md §8) =====================
//
// Phase 2 adds the worker methods the `sync-core` engine drives over comlink:
// drain the outbox to push, ack pushed rows, apply a remote batch (running the
// conflict handler against locally-pending rows, in one transaction, advancing
// the cursor atomically), and read the sync metadata. No network here — the
// engine owns the wire; this owns the SQLite.

/** TanStack query-key root each entity feeds, so a remote apply invalidates
 *  exactly the views that already react to local mutations of that entity. */
const ENTITY_QUERY_KEY: Record<SyncEntity, string[]> = {
  collection: ['user', 'collections'],
  collection_member: ['user', 'collections'],
  collection_group: ['user', 'collections'],
  pinned_search: ['user', 'pinned'],
  user_setting: ['user', 'settings'],
  recent: ['recents'],
};

/** Tables carrying a `uuid`, swept by `markOutboxSynced` to bump revisions. */
const SYNCED_TABLES = [
  'collections',
  'collection_members',
  'collection_groups',
  'pinned_searches',
  'user_settings',
  'recents',
] as const;

export function getSyncMeta(db: Sqlite): SyncMeta {
  const row = db.selectObject<Row>(
    'SELECT server_seq, device_id, account_id FROM sync_cursor WHERE id = 1',
  );
  return {
    serverSeq: Number(row?.server_seq ?? 0),
    deviceId: String(row?.device_id ?? ''),
    accountId: row?.account_id == null ? null : String(row.account_id),
  };
}

/**
 * The next batch of pending local changes, oldest first. Each row's stored
 * snapshot is projected to the *wire* shape: local-only columns are dropped
 * (`recents.name` — game-derived names never sync) and local integer foreign
 * keys are replaced by the parent's cross-device `uuid` (members/groups
 * reference their collection by uuid on the wire, §6.1).
 */
export function drainOutbox(db: Sqlite, limit: number): OutboxChange[] {
  const rows = db.selectObjects<Row>(
    `SELECT seq, entity, uuid, op, payload, base_revision, idempotency
       FROM sync_outbox ORDER BY seq LIMIT ?`,
    [limit],
  );
  return rows.map((r) => {
    const entity = String(r.entity) as SyncEntity;
    const stored = JSON.parse(String(r.payload)) as Row;
    return {
      seq: Number(r.seq),
      entity,
      uuid: String(r.uuid),
      op: String(r.op) as 'upsert' | 'delete',
      payload: toWirePayload(db, entity, stored),
      baseRevision: Number(r.base_revision),
      idempotency: String(r.idempotency),
    };
  });
}

/**
 * Acknowledge pushed rows: remove their outbox entries and advance each live
 * row's `revision` to the one the server assigned (matched by `uuid`), so the
 * next local edit pushes with the correct `base_revision`.
 */
export function markOutboxSynced(
  db: Sqlite,
  seqs: number[],
  assigned: AssignedRevision[],
): void {
  db.transaction(() => {
    for (const seq of seqs) db.exec('DELETE FROM sync_outbox WHERE seq = ?', [seq]);
    for (const a of assigned) {
      for (const table of SYNCED_TABLES) {
        db.exec(`UPDATE ${table} SET revision = ? WHERE uuid = ?`, [a.revision, a.uuid]);
      }
    }
  });
}

/**
 * Apply a batch of server-ordered remote changes in one transaction. For each
 * change: if a local edit for the same record is still pending, run the
 * conflict handler — remote-wins applies it and drops the pending edit;
 * local-wins rebases the pending edit so its re-push lands on top. With no
 * pending edit, apply when the remote revision is newer (idempotent on
 * re-delivery). The cursor advances to the highest seq seen, atomically with
 * the rows. Returns the query-key roots touched.
 */
export function applyRemoteChanges(db: Sqlite, batch: ServerChange[]): ApplyResult {
  const invalidated = new Set<string>();
  let cursor = getSyncMeta(db).serverSeq;
  db.transaction(() => {
    for (const change of batch) {
      applyOne(db, change);
      cursor = Math.max(cursor, change.serverSeq);
      invalidated.add(JSON.stringify(ENTITY_QUERY_KEY[change.entity]));
    }
    db.exec('UPDATE sync_cursor SET server_seq = ? WHERE id = 1', [cursor]);
  });
  return {
    invalidatedKeys: [...invalidated].map((s) => JSON.parse(s) as string[]),
    serverSeq: cursor,
  };
}

// === Bootstrap / "claim local data" (docs/sync_design.md §11) ===============
//
// `sync_cursor.account_id` records whose data this DB currently holds. The
// engine calls `bootstrapSyncAccount` once when a session becomes authenticated,
// before its first cycle, to reconcile the local DB with the account:
//
// - **resumed**: already this account — nothing to do, resume delta sync.
// - **adopted**: anonymous data, no prior account — claim it for the account by
//   enqueuing every live row as a fresh insert, so the user's offline work
//   converges with anything already on the server (server-side LWW merges).
// - **reset**: a *different* account — wipe the local user data (it belongs to
//   the other account and lives on the server) and pull this account from 0, so
//   two users' data never mix on one device.
//
// Signing out of the *same* account does NOT reset — local data stays for
// offline use; the engine just stops.

export type BootstrapAction = 'resumed' | 'adopted' | 'reset';

/** Order parents before children so the adopted outbox pushes — and a fresh
 *  device's pull applies — collections before their groups before their
 *  members (a child whose parent isn't present yet is skipped on apply). */
const ADOPTION_ORDER: readonly SyncEntity[] = [
  'collection',
  'collection_group',
  'collection_member',
  'pinned_search',
  'user_setting',
  'recent',
];

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
    for (const table of SYNCED_TABLES) db.exec(`DELETE FROM ${table}`);
    db.exec('DELETE FROM sync_outbox');
    db.exec('UPDATE sync_cursor SET server_seq = 0, account_id = ? WHERE id = 1', [accountId]);
  });
  return 'reset';
}

/**
 * Enqueue every live local row as a fresh insert for the account being adopted.
 * The anonymous-era outbox (intermediate edit history the server never saw) is
 * cleared first and collapsed into one `upsert` per record at `base_revision=0`,
 * so each lands as a new server record (or, for natural-key rows like settings,
 * conflicts cleanly against an existing one and resolves by LWW). Must run
 * inside the caller's transaction.
 */
function adoptLocalData(db: Sqlite): void {
  db.exec('DELETE FROM sync_outbox');
  const now = Date.now();
  for (const entity of ADOPTION_ORDER) {
    const table = ENTITY_TABLE[entity];
    const rows = db.selectObjects<Row>(`SELECT * FROM ${table} WHERE deleted_at IS NULL`);
    for (const row of rows) {
      const uuid = typeof row.uuid === 'string' ? row.uuid : '';
      if (!uuid) continue; // every persisted row carries a uuid; defensive
      appendOutbox(db, entity, uuid, 'upsert', row, 0, now);
    }
  }
}

// -- remote-apply internals --------------------------------------------------

function applyOne(db: Sqlite, change: ServerChange): void {
  const entity = change.entity;
  const pending = pendingOutboxFor(db, entity, change);

  if (pending.length > 0) {
    const local = outboxRowToChange(pending[pending.length - 1]);
    const winner = resolveConflict({ entity, local, remote: change });
    if (winner === 'remote') {
      applyRow(db, change);
      for (const p of pending) db.exec('DELETE FROM sync_outbox WHERE seq = ?', [p.seq]);
    } else {
      // Local wins: rebase the pending edit onto the server's revision so the
      // engine's re-push is accepted and lands on top.
      for (const p of pending) {
        db.exec('UPDATE sync_outbox SET base_revision = ? WHERE seq = ?', [change.revision, p.seq]);
      }
    }
    return;
  }

  const localRevision = liveRevision(db, entity, change);
  if (localRevision != null && change.revision <= localRevision) return; // already applied / stale
  applyRow(db, change);
}

interface OutboxRow {
  seq: number;
  entity: SyncEntity;
  uuid: string;
  op: 'upsert' | 'delete';
  payload: Row;
  baseRevision: number;
  idempotency: string;
}

function pendingOutboxFor(db: Sqlite, entity: SyncEntity, change: ServerChange): OutboxRow[] {
  const rows = db.selectObjects<Row>(
    `SELECT seq, uuid, op, payload, base_revision, idempotency
       FROM sync_outbox WHERE entity = ? ORDER BY seq`,
    [entity],
  );
  const remoteKey = matchKey(entity, asRow(change.payload), change.uuid);
  const out: OutboxRow[] = [];
  for (const r of rows) {
    const payload = JSON.parse(String(r.payload)) as Row;
    const uuid = String(r.uuid);
    if (matchKey(entity, payload, uuid) !== remoteKey) continue;
    out.push({
      seq: Number(r.seq),
      entity,
      uuid,
      op: String(r.op) as 'upsert' | 'delete',
      payload,
      baseRevision: Number(r.base_revision),
      idempotency: String(r.idempotency),
    });
  }
  return out;
}

function outboxRowToChange(row: OutboxRow): SyncChange {
  return {
    entity: row.entity,
    uuid: row.uuid,
    op: row.op,
    payload: row.payload,
    baseRevision: row.baseRevision,
    idempotency: row.idempotency,
  };
}

/**
 * The stable cross-device identity for matching a record. Records whose natural
 * key is user-editable (collection/group/member/pinned) key on the random
 * `uuid`; records with a stable natural key (a setting's `key`, a recent's
 * `kind`+`ref`) key on that, so two devices that minted the same row
 * independently still converge.
 */
function matchKey(entity: SyncEntity, payload: Row, uuid: string): string {
  switch (entity) {
    case 'user_setting':
      return `setting:${String(payload.key)}`;
    case 'recent':
      return `recent:${String(payload.kind)}:${String(payload.ref)}`;
    default:
      return `uuid:${uuid}`;
  }
}

/** The live row matched by `liveMatch`'s revision, or null if absent. */
function liveRevision(db: Sqlite, entity: SyncEntity, change: ServerChange): number | null {
  const { table, where, params } = liveMatch(entity, change);
  const v = db.selectValue<number>(`SELECT revision FROM ${table} WHERE ${where}`, params);
  return v == null ? null : Number(v);
}

interface LiveMatch {
  table: string;
  where: string;
  params: SqlValue[];
}

function liveMatch(entity: SyncEntity, change: ServerChange): LiveMatch {
  const p = asRow(change.payload);
  switch (entity) {
    case 'collection':
      return { table: 'collections', where: 'uuid = ?', params: [change.uuid] };
    case 'collection_group':
      return { table: 'collection_groups', where: 'uuid = ?', params: [change.uuid] };
    case 'collection_member':
      return { table: 'collection_members', where: 'uuid = ?', params: [change.uuid] };
    case 'pinned_search':
      return { table: 'pinned_searches', where: 'uuid = ?', params: [change.uuid] };
    case 'user_setting':
      return { table: 'user_settings', where: 'key = ?', params: [str(p.key)] };
    case 'recent':
      return { table: 'recents', where: 'kind = ? AND ref = ?', params: [str(p.kind), str(p.ref)] };
  }
}

function applyRow(db: Sqlite, change: ServerChange): void {
  if (change.op === 'delete') {
    applyDelete(db, change);
    return;
  }
  applyUpsert(db, change);
}

function applyDelete(db: Sqlite, change: ServerChange): void {
  const { table, where, params } = liveMatch(change.entity, change);
  const exists = db.selectValue(`SELECT 1 FROM ${table} WHERE ${where}`, params);
  if (exists == null) return; // we never held this row; nothing to tombstone
  const p = asRow(change.payload);
  const deletedAt = typeof p.deleted_at === 'number' ? p.deleted_at : Date.now();
  db.exec(
    `UPDATE ${table} SET deleted_at = ?, revision = ?, origin_device = ? WHERE ${where}`,
    [deletedAt, change.revision, str(p.origin_device), ...params],
  );
}

function applyUpsert(db: Sqlite, change: ServerChange): void {
  const cols = upsertColumns(db, change);
  if (!cols) return; // parent not present yet; a later batch/pull resolves it
  const { table, where, params } = liveMatch(change.entity, change);
  const exists = db.selectValue(`SELECT 1 FROM ${table} WHERE ${where}`, params) != null;
  if (exists) {
    const sets = Object.keys(cols)
      .map((c) => `${c} = ?`)
      .join(', ');
    db.exec(`UPDATE ${table} SET ${sets} WHERE ${where}`, [...Object.values(cols), ...params]);
  } else {
    const names = Object.keys(cols);
    const placeholders = names.map(() => '?').join(', ');
    db.exec(
      `INSERT INTO ${table} (${names.join(', ')}) VALUES (${placeholders})`,
      Object.values(cols),
    );
  }
}

/**
 * The column→value map written when applying a remote upsert. Sync columns are
 * stamped from the change; data columns come from the wire payload; member and
 * group foreign keys are resolved from the parent's uuid back to the local
 * integer id. Returns null when a referenced parent isn't present locally yet.
 */
function upsertColumns(db: Sqlite, change: ServerChange): Record<string, SqlValue> | null {
  const p = asRow(change.payload);
  const sync: Record<string, SqlValue> = {
    uuid: change.uuid,
    revision: change.revision,
    deleted_at: null,
    origin_device: str(p.origin_device),
  };

  switch (change.entity) {
    case 'collection':
      return {
        name: str(p.name),
        description: nstr(p.description),
        color: nstr(p.color),
        icon: nstr(p.icon),
        created_at: num(p.created_at),
        updated_at: num(p.updated_at),
        pinned: num(p.pinned),
        pinned_position: nnum(p.pinned_position),
        grouping: str(p.grouping),
        subgrouping: str(p.subgrouping),
        sort_key: str(p.sort_key),
        sort_dir: str(p.sort_dir),
        ...sync,
      };
    case 'pinned_search':
      return {
        name: str(p.name),
        entity: str(p.entity),
        params_json: str(p.params_json),
        created_at: num(p.created_at),
        updated_at: num(p.updated_at),
        ...sync,
      };
    case 'collection_group': {
      const collectionId = resolveByUuid(db, 'collections', p.collection_uuid);
      if (collectionId == null) return null;
      return {
        collection_id: collectionId,
        name: str(p.name),
        position: num(p.position),
        created_at: num(p.created_at),
        updated_at: num(p.updated_at),
        ...sync,
      };
    }
    case 'collection_member': {
      const collectionId = resolveByUuid(db, 'collections', p.collection_uuid);
      if (collectionId == null) return null;
      const groupId =
        p.group_uuid == null ? null : resolveByUuid(db, 'collection_groups', p.group_uuid);
      return {
        collection_id: collectionId,
        entity_type: str(p.entity_type),
        entity_id: num(p.entity_id),
        note: nstr(p.note),
        quantity: nnum(p.quantity),
        done: num(p.done),
        added_at: num(p.added_at),
        group_id: groupId,
        position: num(p.position),
        updated_at: num(p.updated_at),
        ...sync,
      };
    }
    case 'user_setting':
      return {
        key: str(p.key),
        value: str(p.value),
        updated_at: num(p.updated_at),
        ...sync,
      };
    case 'recent':
      // `name` is local-only and never on the wire; an inserted row keeps NULL
      // (the UI falls back to the ref) and an update leaves any local name be.
      return {
        kind: str(p.kind),
        ref: str(p.ref),
        viewed_at: num(p.viewed_at),
        updated_at: num(p.updated_at),
        ...sync,
      };
  }
}

/** Drop local-only columns and rewrite local foreign keys to parent uuids. */
function toWirePayload(db: Sqlite, entity: SyncEntity, stored: Row): Row {
  const p: Row = { ...stored };
  switch (entity) {
    case 'recent':
      delete p.name;
      break;
    case 'collection':
    case 'pinned_search':
      delete p.id;
      break;
    case 'collection_group': {
      const collectionUuid = uuidOf(db, 'collections', p.collection_id);
      delete p.id;
      delete p.collection_id;
      if (collectionUuid != null) p.collection_uuid = collectionUuid;
      break;
    }
    case 'collection_member': {
      const collectionUuid = uuidOf(db, 'collections', p.collection_id);
      const groupUuid = p.group_id == null ? null : uuidOf(db, 'collection_groups', p.group_id);
      delete p.collection_id;
      delete p.group_id;
      if (collectionUuid != null) p.collection_uuid = collectionUuid;
      p.group_uuid = groupUuid;
      break;
    }
    case 'user_setting':
      break;
  }
  return p;
}

function uuidOf(db: Sqlite, table: string, id: SqlValue): string | null {
  if (id == null) return null;
  return db.selectValue<string>(`SELECT uuid FROM ${table} WHERE id = ?`, [id]);
}

function resolveByUuid(db: Sqlite, table: string, uuid: SqlValue): number | null {
  if (uuid == null) return null;
  const v = db.selectValue<number>(`SELECT id FROM ${table} WHERE uuid = ?`, [String(uuid)]);
  return v == null ? null : Number(v);
}

// -- payload coercion (the wire payload is `unknown` until read here) --------

function asRow(payload: unknown): Row {
  return payload && typeof payload === 'object' ? (payload as Row) : {};
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
