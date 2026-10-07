import type { Sqlite, Row } from '@scrolled/game-db/db/sqlite';
import type {
  CreatePinnedSearchInput,
  PinnedSearchRecord,
  UpdatePinnedSearchPatch,
} from '../types';
import { rowToPinnedSearch } from './rowMappers';
import { recordDelete, recordUpsert } from './sync';

export function listPinnedSearches(db: Sqlite): PinnedSearchRecord[] {
  const rows = db.selectObjects<Row>(
    `SELECT id, name, entity, params_json, icon, color, position, pinned, created_at, updated_at
     FROM pinned_searches
     ORDER BY entity,
              CASE WHEN position IS NULL THEN 1 ELSE 0 END,
              position ASC,
              name COLLATE NOCASE ASC`,
  );
  return rows.map(rowToPinnedSearch);
}

export function getPinnedSearch(db: Sqlite, id: number): PinnedSearchRecord | null {
  const row = db.selectObject<Row>(
    `SELECT id, name, entity, params_json, icon, color, position, pinned, created_at, updated_at
     FROM pinned_searches WHERE id = ?`,
    [id],
  );
  return row ? rowToPinnedSearch(row) : null;
}

export function createPinnedSearch(db: Sqlite, input: CreatePinnedSearchInput): PinnedSearchRecord {
  const name = input.name.trim();
  if (!name) throw new Error('Pinned search name is required');
  const now = Date.now();
  const id = db.transaction(() => {
    // New searches go to the end of their scope's shelf.
    const position =
      db.selectValue<number>(
        'SELECT COALESCE(MAX(position), -1) + 1 FROM pinned_searches WHERE entity = ?',
        [input.entity],
      ) ?? 0;
    db.exec(
      `INSERT INTO pinned_searches
         (name, entity, params_json, icon, color, position, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        input.entity,
        JSON.stringify(input.params ?? {}),
        input.icon ?? null,
        input.color ?? null,
        position,
        input.pinned ? 1 : 0,
        now,
        now,
      ],
    );
    const newId = db.selectValue<number>('SELECT last_insert_rowid()') ?? 0;
    recordUpsert(db, 'pinned_search', 'id = ?', [newId]);
    return newId;
  });
  const row = db.selectObject<Row>(
    `SELECT id, name, entity, params_json, icon, color, position, pinned, created_at, updated_at
     FROM pinned_searches WHERE id = ?`,
    [id],
  );
  if (!row) throw new Error('Failed to load created pinned search');
  return rowToPinnedSearch(row);
}

export function updatePinnedSearch(
  db: Sqlite,
  id: number,
  patch: UpdatePinnedSearchPatch,
): PinnedSearchRecord {
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
  if (patch.icon !== undefined) {
    sets.push('icon = ?');
    params.push(patch.icon);
  }
  if (patch.color !== undefined) {
    sets.push('color = ?');
    params.push(patch.color);
  }
  if (patch.pinned !== undefined) {
    sets.push('pinned = ?');
    params.push(patch.pinned ? 1 : 0);
  }
  if (sets.length === 0) {
    const existing = getPinnedSearch(db, id);
    if (!existing) throw new Error(`Pinned search ${id} not found`);
    return existing;
  }
  sets.push('updated_at = ?');
  params.push(Date.now());
  params.push(id);
  db.transaction(() => {
    db.exec(`UPDATE pinned_searches SET ${sets.join(', ')} WHERE id = ?`, params);
    recordUpsert(db, 'pinned_search', 'id = ?', [id]);
  });
  const updated = getPinnedSearch(db, id);
  if (!updated) throw new Error(`Pinned search ${id} not found after update`);
  return updated;
}

export function deletePinnedSearch(db: Sqlite, id: number): void {
  db.transaction(() => {
    recordDelete(db, 'pinned_search', 'id = ?', [id]);
    db.exec('DELETE FROM pinned_searches WHERE id = ?', [id]);
  });
}

export function reorderPinnedSearches(db: Sqlite, ids: readonly number[]): void {
  const now = Date.now();
  db.transaction(() => {
    ids.forEach((id, position) => {
      db.exec('UPDATE pinned_searches SET position = ?, updated_at = ? WHERE id = ?', [
        position,
        now,
        id,
      ]);
      recordUpsert(db, 'pinned_search', 'id = ?', [id]);
    });
  });
}
