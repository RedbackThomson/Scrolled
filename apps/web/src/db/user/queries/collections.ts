import type { Sqlite, Row } from '../../sqlite';
import {
  COLLECTIONS_JSON_VERSION,
  collectionsExportSchema,
  type CollectionBundleJson,
  type CollectionsExportJson,
  type ImportConflictMode,
  type ImportReport,
} from '../collectionsJson';
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
} from '../types';
import { rowToCollection, rowToMember } from './rowMappers';
import { listPinnedSearches } from './pinnedSearches';
import { listUiPrefs, setUiPref } from './uiPrefs';

export function listCollections(db: Sqlite): CollectionRecord[] {
  // Pinned collections come first in the order chosen on the home page; the
  // rest sort by name. `pinned_position` NULLs are placed last so re-pinning
  // a collection with no position assigned (shouldn't happen, but guard
  // against it) still lands at the end of the pinned grid.
  const rows = db.selectObjects<Row>(`
    SELECT
      c.id,
      c.name,
      c.description,
      c.color,
      c.icon,
      c.pinned,
      c.pinned_position,
      c.created_at,
      c.updated_at,
      COUNT(m.entity_id) AS member_count
    FROM collections c
    LEFT JOIN collection_members m ON m.collection_id = c.id
    GROUP BY c.id
    ORDER BY c.pinned DESC,
             CASE WHEN c.pinned_position IS NULL THEN 1 ELSE 0 END,
             c.pinned_position ASC,
             c.name COLLATE NOCASE ASC
  `);
  return rows.map(rowToCollection);
}

export function createCollection(db: Sqlite, input: CreateCollectionInput): CollectionRecord {
  const name = input.name.trim();
  if (!name) throw new Error('Collection name is required');
  const now = Date.now();
  const id = db.transaction(() => {
    db.exec(
      `INSERT INTO collections (name, description, color, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, input.description ?? null, input.color ?? null, input.icon ?? null, now, now],
    );
    return db.selectValue<number>('SELECT last_insert_rowid()') ?? 0;
  });
  const created = db.selectObject<Row>(
    `SELECT c.id, c.name, c.description, c.color, c.icon,
            c.pinned, c.pinned_position,
            c.created_at, c.updated_at,
            0 AS member_count
     FROM collections c WHERE c.id = ?`,
    [id],
  );
  if (!created) throw new Error(`Failed to load created collection ${id}`);
  return rowToCollection(created);
}

export function getCollection(db: Sqlite, id: number): CollectionRecord | null {
  const row = db.selectObject<Row>(
    `SELECT c.id, c.name, c.description, c.color, c.icon,
            c.pinned, c.pinned_position,
            c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM collection_members m WHERE m.collection_id = c.id) AS member_count
     FROM collections c WHERE c.id = ?`,
    [id],
  );
  return row ? rowToCollection(row) : null;
}

/**
 * Pin or unpin a collection. Pinning appends to the end of the pinned grid
 * (max(pinned_position) + 1). Unpinning sets pinned = 0 and clears the
 * position so the next pin starts fresh.
 *
 * Wrapped in a transaction because the MAX(...) read and the UPDATE must
 * see the same snapshot — otherwise two concurrent pin operations could
 * end up with the same position.
 */
export function setCollectionPinned(
  db: Sqlite,
  id: number,
  pinned: boolean,
): CollectionRecord {
  db.transaction(() => {
    if (pinned) {
      const nextPos =
        (db.selectValue<number>(
          'SELECT COALESCE(MAX(pinned_position), -1) + 1 FROM collections WHERE pinned = 1',
        ) ?? 0);
      db.exec(
        `UPDATE collections
            SET pinned = 1, pinned_position = ?, updated_at = ?
          WHERE id = ?`,
        [nextPos, Date.now(), id],
      );
    } else {
      db.exec(
        `UPDATE collections
            SET pinned = 0, pinned_position = NULL, updated_at = ?
          WHERE id = ?`,
        [Date.now(), id],
      );
    }
  });
  const updated = getCollection(db, id);
  if (!updated) throw new Error(`Collection ${id} not found after pin update`);
  return updated;
}

export function updateCollection(
  db: Sqlite,
  id: number,
  patch: UpdateCollectionPatch,
): CollectionRecord {
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
    const existing = getCollection(db, id);
    if (!existing) throw new Error(`Collection ${id} not found`);
    return existing;
  }
  sets.push('updated_at = ?');
  params.push(Date.now());
  params.push(id);
  db.exec(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?`, params);
  const updated = getCollection(db, id);
  if (!updated) throw new Error(`Collection ${id} not found after update`);
  return updated;
}

export function deleteCollection(db: Sqlite, id: number): void {
  // ON DELETE CASCADE on collection_members removes member rows.
  db.exec('DELETE FROM collections WHERE id = ?', [id]);
}

export function listMembers(db: Sqlite, collectionId: number): CollectionMember[] {
  const rows = db.selectObjects<Row>(
    `SELECT collection_id, entity_type, entity_id, note, quantity, done, added_at
     FROM collection_members
     WHERE collection_id = ?
     ORDER BY entity_type ASC, added_at ASC`,
    [collectionId],
  );
  return rows.map(rowToMember);
}

export function addMember(
  db: Sqlite,
  collectionId: number,
  entityType: CollectionEntityType,
  entityId: number,
  opts: AddMemberOptions = {},
): void {
  db.exec(
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

export function removeMember(
  db: Sqlite,
  collectionId: number,
  entityType: CollectionEntityType,
  entityId: number,
): void {
  db.exec(
    `DELETE FROM collection_members
     WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
    [collectionId, entityType, entityId],
  );
}

export function updateMember(
  db: Sqlite,
  collectionId: number,
  entityType: CollectionEntityType,
  entityId: number,
  patch: UpdateMemberPatch,
): void {
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
  db.exec(
    `UPDATE collection_members SET ${sets.join(', ')}
     WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
    params,
  );
}

export function bulkAddMembers(
  db: Sqlite,
  collectionId: number,
  refs: readonly EntityRef[],
): BulkAddResult {
  if (refs.length === 0) return { added: 0, skipped: 0 };
  let added = 0;
  let skipped = 0;
  const now = Date.now();
  db.transaction(() => {
    for (const ref of refs) {
      const before =
        db.selectValue<number>(
          `SELECT 1 FROM collection_members
           WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
          [collectionId, ref.entityType, ref.entityId],
        ) ?? null;
      if (before !== null) {
        skipped++;
        continue;
      }
      db.exec(
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

export function bulkRemoveMembers(
  db: Sqlite,
  collectionId: number,
  refs: readonly EntityRef[],
): void {
  if (refs.length === 0) return;
  db.transaction(() => {
    for (const ref of refs) {
      db.exec(
        `DELETE FROM collection_members
         WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
        [collectionId, ref.entityType, ref.entityId],
      );
    }
  });
}

export function listMembershipsFor(
  db: Sqlite,
  entityType: CollectionEntityType,
  entityId: number,
): MembershipBadge[] {
  const rows = db.selectObjects<Row>(
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

export function exportCollectionJson(db: Sqlite, id: number): CollectionsExportJson {
  const bundle = buildBundle(db, id);
  if (!bundle) throw new Error(`Collection ${id} not found`);
  return {
    version: COLLECTIONS_JSON_VERSION,
    kind: 'collection',
    collection: bundle,
  };
}

export function exportAllJson(db: Sqlite): CollectionsExportJson {
  const ids = db
    .selectObjects<{ id: number }>('SELECT id FROM collections ORDER BY name COLLATE NOCASE ASC')
    .map((r) => r.id);
  const bundles: CollectionBundleJson[] = [];
  for (const id of ids) {
    const b = buildBundle(db, id);
    if (b) bundles.push(b);
  }
  const pinned = listPinnedSearches(db);
  const prefs = listUiPrefs(db);
  return {
    version: COLLECTIONS_JSON_VERSION,
    kind: 'all',
    collections: bundles,
    pinnedSearches: pinned.map((p) => ({
      name: p.name,
      entity: p.entity,
      params: p.params,
    })),
    uiPrefs: prefs.map((p) => ({ key: p.key, value: p.value })),
  };
}

export function importJson(
  db: Sqlite,
  payload: unknown,
  conflict: ImportConflictMode,
): ImportReport {
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
    importedUiPrefs: 0,
  };

  db.transaction(() => {
    for (const bundle of bundles) {
      const existingId = findCollectionIdByName(db, bundle.name);

      if (existingId === null) {
        // Fresh import — no conflict.
        const newId = insertCollection(db, bundle);
        insertBundleMembers(db, newId, bundle, report);
        report.createdCollections++;
        report.importedNames.push(bundle.name);
        continue;
      }

      if (conflict === 'skip') {
        report.skippedCollections++;
        continue;
      }

      if (conflict === 'merge') {
        insertBundleMembers(db, existingId, bundle, report);
        report.mergedCollections++;
        report.importedNames.push(bundle.name);
        continue;
      }

      // rename
      const newName = uniqueImportedName(db, bundle.name);
      const newId = insertCollection(db, { ...bundle, name: newName });
      insertBundleMembers(db, newId, bundle, report);
      report.renamedCollections++;
      report.importedNames.push(newName);
    }

    if (parsed.kind === 'all' && parsed.pinnedSearches) {
      const now = Date.now();
      for (const pinned of parsed.pinnedSearches) {
        const existing = db.selectValue<number>('SELECT 1 FROM pinned_searches WHERE name = ?', [
          pinned.name,
        ]);
        if (existing != null) {
          report.skippedPinnedSearches++;
          continue;
        }
        db.exec(
          `INSERT INTO pinned_searches (name, entity, params_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [pinned.name, pinned.entity, JSON.stringify(pinned.params), now, now],
        );
        report.importedPinnedSearches++;
      }
    }

    if (parsed.kind === 'all' && parsed.uiPrefs) {
      // UI prefs overwrite on key collision — the import file represents
      // the user's most recently-snapshotted desktop, and a partial
      // backup is more useful than refusing to apply settings.
      for (const pref of parsed.uiPrefs) {
        setUiPref(db, pref.key, pref.value);
        report.importedUiPrefs++;
      }
    }
  });

  return report;
}

// -- helpers -----------------------------------------------------------------

function buildBundle(db: Sqlite, id: number): CollectionBundleJson | null {
  const c = db.selectObject<Row>(
    `SELECT name, description, color, icon, pinned, pinned_position
     FROM collections WHERE id = ?`,
    [id],
  );
  if (!c) return null;
  const members = db.selectObjects<Row>(
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
    pinned: Number(c.pinned ?? 0) === 1,
    pinnedPosition: c.pinned_position == null ? null : Number(c.pinned_position),
    members: members.map((m) => ({
      entityType: String(m.entity_type) as CollectionEntityType,
      entityId: Number(m.entity_id),
      note: m.note == null ? null : String(m.note),
      quantity: m.quantity == null ? null : Number(m.quantity),
      done: Number(m.done) === 1,
    })),
  };
}

function findCollectionIdByName(db: Sqlite, name: string): number | null {
  const id = db.selectValue<number>('SELECT id FROM collections WHERE name = ?', [name]);
  return id == null ? null : Number(id);
}

/**
 * Resolve a unique destination name for `rename` conflicts. Tries
 * "<name> (imported)" first, then "<name> (imported 2)" and so on.
 * Stops at a sensible ceiling so a runaway loop on broken data can't
 * lock up the worker.
 */
function uniqueImportedName(db: Sqlite, name: string): string {
  const base = `${name} (imported)`;
  if (findCollectionIdByName(db, base) === null) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${name} (imported ${i})`;
    if (findCollectionIdByName(db, candidate) === null) return candidate;
  }
  throw new Error(`Could not find a unique name for "${name}"`);
}

function insertCollection(db: Sqlite, bundle: CollectionBundleJson): number {
  const now = Date.now();
  // The bundle carries its own pinned flag, but we derive a fresh
  // `pinned_position` from the live DB so an import always appends to the
  // end of the pinned grid rather than colliding with positions already
  // taken by existing collections.
  const pinned = bundle.pinned ? 1 : 0;
  const nextPos = pinned
    ? (db.selectValue<number>(
        'SELECT COALESCE(MAX(pinned_position), -1) + 1 FROM collections WHERE pinned = 1',
      ) ?? 0)
    : null;
  db.exec(
    `INSERT INTO collections
       (name, description, color, icon, pinned, pinned_position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bundle.name,
      bundle.description ?? null,
      bundle.color ?? null,
      bundle.icon ?? null,
      pinned,
      nextPos,
      now,
      now,
    ],
  );
  const id = db.selectValue<number>('SELECT last_insert_rowid()');
  if (id == null) throw new Error('Failed to read inserted collection id');
  return Number(id);
}

function insertBundleMembers(
  db: Sqlite,
  collectionId: number,
  bundle: CollectionBundleJson,
  report: ImportReport,
): void {
  const now = Date.now();
  for (const m of bundle.members) {
    const exists =
      db.selectValue<number>(
        `SELECT 1 FROM collection_members
         WHERE collection_id = ? AND entity_type = ? AND entity_id = ?`,
        [collectionId, m.entityType, m.entityId],
      ) ?? null;
    if (exists !== null) {
      report.skippedMembers++;
      continue;
    }
    db.exec(
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
