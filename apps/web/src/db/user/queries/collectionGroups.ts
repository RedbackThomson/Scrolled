// User-defined groups inside a collection, plus the cross-bucket member
// move logic that powers drag-and-drop on the detail page.
//
// The default group is *implicit*: a `group_id IS NULL` row on
// `collection_members`. It never appears as a row in `collection_groups`.
// Positions are dense within `(collection_id, group_id)` so a manual
// reorder always re-densifies the bucket(s) it touches.

import type { Sqlite, Row } from '@scrolled/game-db/db/sqlite';
import type {
  CollectionEntityType,
  CollectionGroup,
} from '../types';
import { rowToGroup } from './rowMappers';
import { recordDelete, recordUpsert } from './sync';

const MEMBER_WHERE = 'collection_id = ? AND entity_type = ? AND entity_id = ?';

export function listGroups(db: Sqlite, collectionId: number): CollectionGroup[] {
  const rows = db.selectObjects<Row>(
    `SELECT id, collection_id, name, position, created_at, updated_at
     FROM collection_groups
     WHERE collection_id = ?
     ORDER BY position ASC, name COLLATE NOCASE ASC`,
    [collectionId],
  );
  return rows.map(rowToGroup);
}

export function createGroup(
  db: Sqlite,
  collectionId: number,
  rawName: string,
): CollectionGroup {
  const name = rawName.trim();
  if (!name) throw new Error('Group name is required');

  const id = db.transaction(() => {
    const nextPos =
      db.selectValue<number>(
        `SELECT COALESCE(MAX(position), -1) + 1
         FROM collection_groups
         WHERE collection_id = ?`,
        [collectionId],
      ) ?? 0;
    const now = Date.now();
    db.exec(
      `INSERT INTO collection_groups
         (collection_id, name, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [collectionId, name, nextPos, now, now],
    );
    const newId = db.selectValue<number>('SELECT last_insert_rowid()') ?? 0;
    recordUpsert(db, 'collection_group', 'id = ?', [newId]);
    return newId;
  });

  const row = db.selectObject<Row>(
    `SELECT id, collection_id, name, position, created_at, updated_at
     FROM collection_groups WHERE id = ?`,
    [id],
  );
  if (!row) throw new Error(`Failed to load created group ${id}`);
  return rowToGroup(row);
}

export function renameGroup(
  db: Sqlite,
  groupId: number,
  rawName: string,
): CollectionGroup {
  const name = rawName.trim();
  if (!name) throw new Error('Group name is required');
  const now = Date.now();
  db.transaction(() => {
    db.exec(`UPDATE collection_groups SET name = ?, updated_at = ? WHERE id = ?`, [
      name,
      now,
      groupId,
    ]);
    recordUpsert(db, 'collection_group', 'id = ?', [groupId]);
  });
  const row = db.selectObject<Row>(
    `SELECT id, collection_id, name, position, created_at, updated_at
     FROM collection_groups WHERE id = ?`,
    [groupId],
  );
  if (!row) throw new Error(`Group ${groupId} not found after rename`);
  return rowToGroup(row);
}

/**
 * Delete a group. Members are moved into the default (implicit) group,
 * appended to its tail in their existing relative order. We do this
 * *before* the DELETE so we can compute clean target positions —
 * `ON DELETE SET NULL` on the FK would otherwise leave the moved-in
 * rows holding their old positions, which can collide with the
 * default group's existing positions.
 */
export function deleteGroup(db: Sqlite, groupId: number): void {
  db.transaction(() => {
    const collectionId = db.selectValue<number>(
      `SELECT collection_id FROM collection_groups WHERE id = ?`,
      [groupId],
    );
    if (collectionId == null) return;

    const affected = db.selectObjects<Row>(
      `SELECT entity_type, entity_id
       FROM collection_members
       WHERE collection_id = ? AND group_id = ?
       ORDER BY position ASC, added_at ASC`,
      [collectionId, groupId],
    );

    const defaultTail =
      db.selectValue<number>(
        `SELECT COALESCE(MAX(position), -1) + 1
         FROM collection_members
         WHERE collection_id = ? AND group_id IS NULL`,
        [collectionId],
      ) ?? 0;

    affected.forEach((row, i) => {
      db.exec(
        `UPDATE collection_members
           SET group_id = NULL, position = ?
         WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
        [defaultTail + i, collectionId, String(row.entity_type), Number(row.entity_id)],
      );
      recordUpsert(db, 'collection_member', MEMBER_WHERE, [
        collectionId,
        String(row.entity_type),
        Number(row.entity_id),
      ]);
    });

    recordDelete(db, 'collection_group', 'id = ?', [groupId]);
    db.exec(`DELETE FROM collection_groups WHERE id = ?`, [groupId]);
  });
}

/**
 * Persist a new ordering of groups (top → bottom).
 */
export function reorderGroups(
  db: Sqlite,
  collectionId: number,
  orderedGroupIds: readonly number[],
): void {
  if (orderedGroupIds.length === 0) return;
  const now = Date.now();
  db.transaction(() => {
    orderedGroupIds.forEach((id, index) => {
      db.exec(
        `UPDATE collection_groups
           SET position = ?, updated_at = ?
         WHERE id = ? AND collection_id = ?`,
        [index, now, id, collectionId],
      );
      recordUpsert(db, 'collection_group', 'id = ? AND collection_id = ?', [id, collectionId]);
    });
  });
}

/**
 * Move a member to `(targetGroupId, targetIndex)`. Handles both
 * within-bucket reorders (same source and destination group) and
 * cross-bucket moves. Re-densifies positions in any bucket touched.
 *
 * `targetGroupId === null` means the default (implicit) group.
 * `targetIndex` is 0-based in the destination bucket *after* the source
 * row has been removed.
 */
export function moveMember(
  db: Sqlite,
  collectionId: number,
  entityType: CollectionEntityType,
  entityId: number,
  targetGroupId: number | null,
  targetIndex: number,
): void {
  db.transaction(() => {
    const current = db.selectObject<Row>(
      `SELECT group_id, position FROM collection_members
       WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
      [collectionId, entityType, entityId],
    );
    if (!current) {
      throw new Error(
        `Member (${entityType}, ${entityId}) not found in collection ${collectionId}`,
      );
    }
    const sourceGroupId = current.group_id == null ? null : Number(current.group_id);

    // Temporarily park the moving row at position -1 so we can re-pack
    // both buckets without colliding with it.
    db.exec(
      `UPDATE collection_members
         SET position = -1
       WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
      [collectionId, entityType, entityId],
    );

    redensify(db, collectionId, sourceGroupId);
    if (sameGroup(sourceGroupId, targetGroupId)) {
      // Re-densifying may have shifted the position values, but the
      // moving row sits at -1 so it's still excluded. Insert it at
      // targetIndex by shifting the destination tail up.
      shiftUp(db, collectionId, targetGroupId, targetIndex);
    } else {
      redensify(db, collectionId, targetGroupId);
      shiftUp(db, collectionId, targetGroupId, targetIndex);
    }

    // Move the parked row into the target bucket at the requested index.
    if (targetGroupId == null) {
      db.exec(
        `UPDATE collection_members
           SET group_id = NULL, position = ?
         WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
        [targetIndex, collectionId, entityType, entityId],
      );
    } else {
      db.exec(
        `UPDATE collection_members
           SET group_id = ?, position = ?
         WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
        [targetGroupId, targetIndex, collectionId, entityType, entityId],
      );
    }

    // Re-densify shifted sibling positions in both buckets, so every member
    // whose position changed is recorded — not just the dragged one.
    recordBucketMembers(db, collectionId, sourceGroupId);
    if (!sameGroup(sourceGroupId, targetGroupId)) {
      recordBucketMembers(db, collectionId, targetGroupId);
    }
  });
}

/** Append an outbox upsert for every live member in a (collection, group)
 *  bucket. Used after a reorder that re-densified positions. */
function recordBucketMembers(db: Sqlite, collectionId: number, groupId: number | null): void {
  const rows =
    groupId == null
      ? db.selectObjects<Row>(
          `SELECT entity_type, entity_id FROM collection_members
           WHERE collection_id = ? AND group_id IS NULL`,
          [collectionId],
        )
      : db.selectObjects<Row>(
          `SELECT entity_type, entity_id FROM collection_members
           WHERE collection_id = ? AND group_id = ?`,
          [collectionId, groupId],
        );
  for (const r of rows) {
    recordUpsert(db, 'collection_member', MEMBER_WHERE, [
      collectionId,
      String(r.entity_type),
      Number(r.entity_id),
    ]);
  }
}

function sameGroup(a: number | null, b: number | null): boolean {
  return a === b || (a == null && b == null);
}

/**
 * Walk a bucket in current position order and re-assign 0..n-1 positions.
 * Excludes any row currently parked at -1 (the moving row in
 * `moveMember`).
 */
function redensify(
  db: Sqlite,
  collectionId: number,
  groupId: number | null,
): void {
  const rows =
    groupId == null
      ? db.selectObjects<Row>(
          `SELECT entity_type, entity_id
           FROM collection_members
           WHERE collection_id = ? AND group_id IS NULL AND position >= 0
           ORDER BY position ASC, added_at ASC`,
          [collectionId],
        )
      : db.selectObjects<Row>(
          `SELECT entity_type, entity_id
           FROM collection_members
           WHERE collection_id = ? AND group_id = ? AND position >= 0
           ORDER BY position ASC, added_at ASC`,
          [collectionId, groupId],
        );
  rows.forEach((row, index) => {
    db.exec(
      `UPDATE collection_members
         SET position = ?
       WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
      [index, collectionId, String(row.entity_type), Number(row.entity_id)],
    );
  });
}

/**
 * Shift positions in a bucket up by one starting at `fromIndex`, so a
 * new row can slot in at `fromIndex` without collision. Skips rows
 * currently parked at -1.
 */
function shiftUp(
  db: Sqlite,
  collectionId: number,
  groupId: number | null,
  fromIndex: number,
): void {
  if (groupId == null) {
    db.exec(
      `UPDATE collection_members
         SET position = position + 1
       WHERE collection_id = ? AND group_id IS NULL
         AND position >= ? AND position >= 0`,
      [collectionId, fromIndex],
    );
  } else {
    db.exec(
      `UPDATE collection_members
         SET position = position + 1
       WHERE collection_id = ? AND group_id = ?
         AND position >= ? AND position >= 0`,
      [collectionId, groupId, fromIndex],
    );
  }
}
