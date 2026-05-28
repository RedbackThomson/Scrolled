// CRUD for the generic `ui_prefs` key-value table.
//
// Values are stored as opaque JSON strings — every consumer is expected to
// validate the parsed shape with its own zod schema. Keeping the row level
// dumb means a malformed value never crashes the worker, just resolves to
// `null` on the read side.

import type { Sqlite, Row } from '../../sqlite';

export interface UiPrefRow {
  key: string;
  value: string;
  updatedAt: number;
}

export function getUiPref(db: Sqlite, key: string): UiPrefRow | null {
  const row = db.selectObject<Row>(
    'SELECT key, value, updated_at FROM ui_prefs WHERE key = ?',
    [key],
  );
  if (!row) return null;
  return {
    key: String(row.key),
    value: String(row.value),
    updatedAt: Number(row.updated_at),
  };
}

export function setUiPref(db: Sqlite, key: string, value: string): UiPrefRow {
  const now = Date.now();
  db.exec(
    `INSERT INTO ui_prefs (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET
       value      = excluded.value,
       updated_at = excluded.updated_at`,
    [key, value, now],
  );
  return { key, value, updatedAt: now };
}

export function listUiPrefs(db: Sqlite): UiPrefRow[] {
  const rows = db.selectObjects<Row>(
    'SELECT key, value, updated_at FROM ui_prefs ORDER BY key',
  );
  return rows.map((r) => ({
    key: String(r.key),
    value: String(r.value),
    updatedAt: Number(r.updated_at),
  }));
}

export function deleteUiPref(db: Sqlite, key: string): void {
  db.exec('DELETE FROM ui_prefs WHERE key = ?', [key]);
}
