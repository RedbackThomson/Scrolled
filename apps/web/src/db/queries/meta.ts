import type { Sqlite, PreMigrateContext } from '../sqlite';
import { MINIMUM_SUPPORTED_DATA_REVISION } from '../dataVersion';

export function getMeta(sql: Sqlite, key: string): string | null {
  const v = sql.selectValue('SELECT value FROM app_meta WHERE key = ?', [key]);
  return typeof v === 'string' ? v : null;
}

export function setMeta(sql: Sqlite, key: string, value: string): void {
  sql.exec('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [key, value]);
}

export function deleteMeta(sql: Sqlite, key: string): void {
  sql.exec('DELETE FROM app_meta WHERE key = ?', [key]);
}

export function markPendingRebuild(sql: Sqlite): void {
  setMeta(sql, 'pending_rebuild', '1');
}

export function countOf(sql: Sqlite, table: string): number {
  return Number(sql.selectValue(`SELECT COUNT(*) FROM ${table}`) ?? 0);
}

export function getServerProfile(sql: Sqlite): string {
  const row = sql.selectObject<{ profile_id: string }>(
    'SELECT profile_id FROM server_profile WHERE id = 1',
  );
  return row?.profile_id ?? 'vanilla-v83';
}

export function setServerProfile(sql: Sqlite, profileId: string): void {
  // Upsert, not UPDATE: a destructive reset wipes this singleton's row, and a
  // bare UPDATE would silently no-op and lose the user's selection.
  sql.exec('INSERT OR REPLACE INTO server_profile (id, profile_id, updated_at) VALUES (1, ?, ?)', [
    profileId,
    Date.now(),
  ]);
}

export function clearAllData(sql: Sqlite): void {
  sql.transaction(() => {
    // Order respects FK direction. No foreign keys are declared yet, but
    // keep the order stable for when we add them.
    const tables = [
      'quest_rewards',
      'quest_requirements',
      'mob_drops',
      'map_portals',
      'map_mobs',
      'map_npcs',
      'quests',
      'maps',
      'npcs',
      'mobs',
      'equips',
      'items',
      'assets',
      'extraction_extractors',
      'dataset_files',
      'datasets',
    ];
    for (const t of tables) sql.exec(`DELETE FROM ${t}`);
    // SQLite resets AUTOINCREMENT counters via the internal sequence table.
    sql.exec(`DELETE FROM sqlite_sequence WHERE name IN ('assets', 'datasets')`);
    // Drop the revision stamp and rebuild flag so a deliberately-cleared
    // library reverts to a clean first-run, not a stale revision or a
    // lingering "rebuild needed" prompt. Keep other app_meta keys.
    sql.exec(`DELETE FROM app_meta WHERE key IN ('data_revision', 'pending_rebuild')`);
  });
}

/**
 * Pre-migration destructive-reset decision for the game cache. Passed to
 * `Sqlite` as `resetBeforeMigrate`. If the stored data revision is below the
 * minimum this build can read and the library actually has data, clear it so
 * the breaking migration that follows applies to empty tables. A fresh DB
 * (no data) is a genuine first run and left alone. Reads defensively because
 * `app_meta` may not exist yet on a pre-tracking database.
 */
export function gameDataPreMigrateReset(ctx: PreMigrateContext): boolean {
  const hasMeta =
    ctx.selectValue("SELECT 1 FROM sqlite_master WHERE type='table' AND name='app_meta'") != null;
  const revision = hasMeta
    ? Number(
        ctx.selectValue<string>("SELECT value FROM app_meta WHERE key = 'data_revision'") ?? 0,
      ) || 0
    : 0;
  if (revision >= MINIMUM_SUPPORTED_DATA_REVISION) return false;
  if (!ctx.hasAnyUserData()) return false;
  ctx.clearAllUserData();
  return true;
}
