import type { Row, Sqlite } from '../sqlite';
import type { ChairRecord } from '../types';

interface ChairRow extends Row {
  item_id: number;
  recovery_hp: number | null;
  recovery_mp: number | null;
  frame_count: number;
  preview_data: Uint8Array;
  preview_width: number;
  preview_height: number;
}

function rowToChair(row: ChairRow): ChairRecord {
  return {
    itemId: row.item_id,
    recoveryHp: row.recovery_hp,
    recoveryMp: row.recovery_mp,
    frameCount: row.frame_count,
    previewData: row.preview_data,
    previewWidth: row.preview_width,
    previewHeight: row.preview_height,
  };
}

export function upsertChairRow(sql: Sqlite, chair: ChairRecord): void {
  sql.exec(
    `INSERT INTO chairs (
      item_id, recovery_hp, recovery_mp, frame_count,
      preview_data, preview_width, preview_height
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(item_id) DO UPDATE SET
      recovery_hp    = excluded.recovery_hp,
      recovery_mp    = excluded.recovery_mp,
      frame_count    = excluded.frame_count,
      preview_data   = excluded.preview_data,
      preview_width  = excluded.preview_width,
      preview_height = excluded.preview_height`,
    [
      chair.itemId,
      chair.recoveryHp,
      chair.recoveryMp,
      chair.frameCount,
      chair.previewData,
      chair.previewWidth,
      chair.previewHeight,
    ],
  );
}

export function upsertChairs(sql: Sqlite, chairs: ChairRecord[]): number {
  sql.transaction(() => {
    for (const c of chairs) upsertChairRow(sql, c);
  });
  return chairs.length;
}

export function getChair(sql: Sqlite, itemId: number): ChairRecord | null {
  const row = sql.selectObject<ChairRow>('SELECT * FROM chairs WHERE item_id = ?', [itemId]);
  return row ? rowToChair(row) : null;
}
