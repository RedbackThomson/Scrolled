import type { Sqlite, Row } from '../../sqlite';
import type {
  CreatePinnedSearchInput,
  PinnedSearchRecord,
  UpdatePinnedSearchPatch,
} from '../types';
import { rowToPinnedSearch } from './rowMappers';

export function listPinnedSearches(db: Sqlite): PinnedSearchRecord[] {
  const rows = db.selectObjects<Row>(
    `SELECT id, name, entity, params_json, created_at, updated_at
     FROM pinned_searches
     ORDER BY name COLLATE NOCASE ASC`,
  );
  return rows.map(rowToPinnedSearch);
}

export function getPinnedSearch(db: Sqlite, id: number): PinnedSearchRecord | null {
  const row = db.selectObject<Row>(
    `SELECT id, name, entity, params_json, created_at, updated_at
     FROM pinned_searches WHERE id = ?`,
    [id],
  );
  return row ? rowToPinnedSearch(row) : null;
}

export function createPinnedSearch(db: Sqlite, input: CreatePinnedSearchInput): PinnedSearchRecord {
  const name = input.name.trim();
  if (!name) throw new Error('Pinned search name is required');
  const now = Date.now();
  db.exec(
    `INSERT INTO pinned_searches (name, entity, params_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [name, input.entity, JSON.stringify(input.params ?? {}), now, now],
  );
  const id = db.selectValue<number>('SELECT last_insert_rowid()') ?? 0;
  const row = db.selectObject<Row>(
    `SELECT id, name, entity, params_json, created_at, updated_at
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
  if (sets.length === 0) {
    const existing = getPinnedSearch(db, id);
    if (!existing) throw new Error(`Pinned search ${id} not found`);
    return existing;
  }
  sets.push('updated_at = ?');
  params.push(Date.now());
  params.push(id);
  db.exec(`UPDATE pinned_searches SET ${sets.join(', ')} WHERE id = ?`, params);
  const updated = getPinnedSearch(db, id);
  if (!updated) throw new Error(`Pinned search ${id} not found after update`);
  return updated;
}

export function deletePinnedSearch(db: Sqlite, id: number): void {
  db.exec('DELETE FROM pinned_searches WHERE id = ?', [id]);
}
