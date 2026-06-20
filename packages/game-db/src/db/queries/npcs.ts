import type { Sqlite } from '../sqlite';
import type { ListOptsBase, MapRecord, NpcRecord, PageResult } from '../types';
import {
  NPC_ORDER,
  NPC_ORDER_DEFAULT,
  clampLimit,
  clampOffset,
  resolveOrder,
} from './shared/order';
import { NPC_FILTER, applyFilters } from './shared/filters';
import { rowToMap, rowToNpc, type MapRow, type NpcRow } from './shared/rowMappers';

export function upsertNpcs(sql: Sqlite, npcs: NpcRecord[]): number {
  sql.transaction(() => {
    for (const n of npcs) {
      sql.exec(
        `INSERT INTO npcs (id, name, description, icon_path, icon_data, source_path)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name        = excluded.name,
           description = excluded.description,
           icon_path   = excluded.icon_path,
           icon_data   = COALESCE(excluded.icon_data, npcs.icon_data),
           source_path = excluded.source_path`,
        [n.id, n.name, n.description, n.iconPath, n.iconData, n.sourcePath],
      );
    }
  });
  return npcs.length;
}

export function getNpc(sql: Sqlite, id: number): NpcRecord | null {
  const row = sql.selectObject<NpcRow>('SELECT * FROM npcs WHERE id = ?', [id]);
  return row ? rowToNpc(row) : null;
}

export function getNpcIcon(sql: Sqlite, id: number): Uint8Array | null {
  const row = sql.selectObject<{ icon_data: Uint8Array | null }>(
    'SELECT icon_data FROM npcs WHERE id = ?',
    [id],
  );
  return row?.icon_data ?? null;
}

export function listNpcs(sql: Sqlite, opts: ListOptsBase = {}): PageResult<NpcRecord> {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const order = resolveOrder(NPC_ORDER, NPC_ORDER_DEFAULT, opts.orderBy, opts.dir);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.search?.trim()) {
    where.push('name LIKE ?');
    params.push(`%${opts.search.trim()}%`);
  }
  applyFilters(NPC_FILTER, opts.filters, where, params);
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return sql.transaction(() => {
    const total = Number(
      sql.selectValue(
        `SELECT COUNT(*) FROM npcs ${clause}`,
        params.length > 0 ? params : undefined,
      ) ?? 0,
    );
    const rows = sql
      .selectObjects<NpcRow>(
        `SELECT id, name, description, icon_path, NULL AS icon_data, source_path
         FROM npcs ${clause}
         ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )
      .map(rowToNpc);
    return { rows, total };
  });
}

export function getNpcMaps(sql: Sqlite, npcId: number): MapRecord[] {
  return sql
    .selectObjects<MapRow>(
      `SELECT DISTINCT m.id, m.name, m.street_name, m.return_map_id, m.forced_return_map_id,
              m.field_limit, m.mob_rate, m.minimap_path, NULL AS minimap_data,
              m.minimap_center_x, m.minimap_center_y, m.minimap_width, m.minimap_height,
              m.minimap_mag, m.source_path
       FROM maps m
       JOIN map_npcs mn ON mn.map_id = m.id
       WHERE mn.npc_id = ?
       ORDER BY m.name`,
      [npcId],
    )
    .map(rowToMap);
}
