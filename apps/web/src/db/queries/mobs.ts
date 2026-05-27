import type { Sqlite } from '../sqlite';
import type {
  ListOptsBase,
  MobDropRecord,
  MobDropWithName,
  MobMapAppearance,
  MobRecord,
  PageResult,
} from '../types';
import {
  MOB_ORDER,
  MOB_ORDER_DEFAULT,
  clampLimit,
  clampOffset,
  resolveOrder,
} from './shared/order';
import { MOB_FILTER, applyFilters } from './shared/filters';
import { rowToMap, rowToMob, type MapRow, type MobRow } from './shared/rowMappers';

export function upsertMobs(sql: Sqlite, mobs: MobRecord[]): number {
  sql.transaction(() => {
    for (const m of mobs) {
      sql.exec(
        `INSERT INTO mobs (
          id, name, level, hp, mp, exp, is_boss,
          element_attack, element_defenses_json, icon_path, icon_data, source_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name                  = excluded.name,
          level                 = excluded.level,
          hp                    = excluded.hp,
          mp                    = excluded.mp,
          exp                   = excluded.exp,
          is_boss               = excluded.is_boss,
          element_attack        = excluded.element_attack,
          element_defenses_json = excluded.element_defenses_json,
          icon_path             = excluded.icon_path,
          -- Preserve a previously-decoded icon when this run produced
          -- none (e.g. transient decode failure on one mob).
          icon_data             = COALESCE(excluded.icon_data, mobs.icon_data),
          source_path           = excluded.source_path`,
        [
          m.id,
          m.name,
          m.level,
          m.hp,
          m.mp,
          m.exp,
          m.isBoss ? 1 : 0,
          m.elementAttack,
          m.elementDefensesJson,
          m.iconPath,
          m.iconData,
          m.sourcePath,
        ],
      );
    }
  });
  return mobs.length;
}

export function getMobIcon(sql: Sqlite, id: number): Uint8Array | null {
  const row = sql.selectObject<{ icon_data: Uint8Array | null }>(
    'SELECT icon_data FROM mobs WHERE id = ?',
    [id],
  );
  return row?.icon_data ?? null;
}

export function getMob(sql: Sqlite, id: number): MobRecord | null {
  const row = sql.selectObject<MobRow>('SELECT * FROM mobs WHERE id = ?', [id]);
  return row ? rowToMob(row) : null;
}

export function listMobs(sql: Sqlite, opts: ListOptsBase = {}): PageResult<MobRecord> {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const order = resolveOrder(MOB_ORDER, MOB_ORDER_DEFAULT, opts.orderBy, opts.dir);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.search?.trim()) {
    where.push('name LIKE ?');
    params.push(`%${opts.search.trim()}%`);
  }
  applyFilters(MOB_FILTER, opts.filters, where, params);
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  // Skip icon_data — fetched separately via getMobIcon for the rows
  // the UI ends up rendering, so we don't drag MBs into every list call.
  return sql.transaction(() => {
    const total = Number(
      sql.selectValue(
        `SELECT COUNT(*) FROM mobs ${clause}`,
        params.length > 0 ? params : undefined,
      ) ?? 0,
    );
    const rows = sql
      .selectObjects<MobRow>(
        `SELECT id, name, level, hp, mp, exp, is_boss, element_attack,
                element_defenses_json, icon_path, NULL AS icon_data, source_path
         FROM mobs ${clause}
         ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )
      .map(rowToMob);
    return { rows, total };
  });
}

export function getMobDrops(sql: Sqlite, mobId: number): MobDropWithName[] {
  // item_id can match either items.id or equips.id; coalesce a single
  // name + entity kind so the UI can route the link to the right page.
  return sql
    .selectObjects<{
      mob_id: number;
      item_id: number;
      item_name: string | null;
      equip_name: string | null;
    }>(
      `SELECT d.mob_id, d.item_id, i.name AS item_name, e.name AS equip_name
       FROM mob_drops d
       LEFT JOIN items  i ON i.id = d.item_id
       LEFT JOIN equips e ON e.id = d.item_id
       WHERE d.mob_id = ?
       ORDER BY COALESCE(i.name, e.name) NULLS LAST, d.item_id`,
      [mobId],
    )
    .map((r) => ({
      mobId: r.mob_id,
      itemId: r.item_id,
      itemName: r.item_name ?? r.equip_name,
      entity: r.item_name ? 'item' : r.equip_name ? 'equip' : null,
    }));
}

export function getItemDroppedBy(
  sql: Sqlite,
  itemId: number,
): { mobId: number; name: string; level: number | null }[] {
  return sql
    .selectObjects<{ mob_id: number; name: string; level: number | null }>(
      `SELECT d.mob_id, m.name, m.level
       FROM mob_drops d INNER JOIN mobs m ON m.id = d.mob_id
       WHERE d.item_id = ?
       ORDER BY m.level NULLS LAST, m.name`,
      [itemId],
    )
    .map((r) => ({ mobId: r.mob_id, name: r.name, level: r.level }));
}

export function getMobMaps(sql: Sqlite, mobId: number): MobMapAppearance[] {
  return sql
    .selectObjects<MapRow & { spawn_count: number | null }>(
      `SELECT m.id, m.name, m.street_name, m.return_map_id, m.forced_return_map_id,
              m.field_limit, m.mob_rate, m.minimap_path, NULL AS minimap_data,
              m.minimap_center_x, m.minimap_center_y, m.minimap_width, m.minimap_height,
              m.minimap_mag, m.source_path,
              mm.count AS spawn_count
       FROM maps m
       JOIN map_mobs mm ON mm.map_id = m.id
       WHERE mm.mob_id = ?
       ORDER BY m.name`,
      [mobId],
    )
    .map((r) => ({ ...rowToMap(r), spawnCount: r.spawn_count }));
}

export function replaceMobDrops(sql: Sqlite, drops: MobDropRecord[]): void {
  // Collect distinct mob IDs so we delete their prior drop rows before
  // reinserting; mirrors `replaceMapLife`'s approach.
  const mobIds = new Set<number>();
  for (const d of drops) mobIds.add(d.mobId);
  sql.transaction(() => {
    for (const id of mobIds) {
      sql.exec('DELETE FROM mob_drops WHERE mob_id = ?', [id]);
    }
    for (const d of drops) {
      sql.exec('INSERT OR REPLACE INTO mob_drops (mob_id, item_id) VALUES (?, ?)', [
        d.mobId,
        d.itemId,
      ]);
    }
  });
}
