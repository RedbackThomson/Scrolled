// CRUD for the synced `user_settings` key-value table (docs/sync_design.md §6.2).
//
// Replaces the old `ui_prefs` table: same opaque-JSON-string contract (every
// consumer validates the parsed shape with its own zod schema, so a malformed
// value resolves to `null` rather than crashing the worker), but each row now
// carries the sync columns and every write funnels the outbox via the helpers
// in `./sync`.

import type { Sqlite, Row } from '@scrolled/game-db/db/sqlite';
import { recordDelete, recordUpsert } from './sync';

export interface UserSettingRow {
  key: string;
  value: string;
  updatedAt: number;
}

export function getUserSetting(db: Sqlite, key: string): UserSettingRow | null {
  const row = db.selectObject<Row>(
    'SELECT key, value, updated_at FROM user_settings WHERE key = ?',
    [key],
  );
  if (!row) return null;
  return {
    key: String(row.key),
    value: String(row.value),
    updatedAt: Number(row.updated_at),
  };
}

export function setUserSetting(db: Sqlite, key: string, value: string): UserSettingRow {
  const now = Date.now();
  db.transaction(() => {
    db.exec(
      `INSERT INTO user_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET
         value      = excluded.value,
         updated_at = excluded.updated_at`,
      [key, value, now],
    );
    recordUpsert(db, 'user_setting', 'key = ?', [key]);
  });
  return { key, value, updatedAt: now };
}

export function listUserSettings(db: Sqlite): UserSettingRow[] {
  const rows = db.selectObjects<Row>(
    'SELECT key, value, updated_at FROM user_settings ORDER BY key',
  );
  return rows.map((r) => ({
    key: String(r.key),
    value: String(r.value),
    updatedAt: Number(r.updated_at),
  }));
}

export function deleteUserSetting(db: Sqlite, key: string): void {
  db.transaction(() => {
    recordDelete(db, 'user_setting', 'key = ?', [key]);
    db.exec('DELETE FROM user_settings WHERE key = ?', [key]);
  });
}
