import type { Sqlite, Row } from '../sqlite';
import type {
  ListOptsBase,
  MapMobRecord,
  MapMobSpawnRecord,
  MapMobSpawnWithName,
  MapMobWithName,
  MapNpcRecord,
  MapNpcWithName,
  MapPortalRecord,
  MapPortalWithName,
  MapRecord,
  PageResult,
} from '../types';
import {
  MAP_ORDER,
  MAP_ORDER_DEFAULT,
  clampLimit,
  clampOffset,
  resolveOrder,
} from './shared/order';
import { MAP_FILTER, applyFilters } from './shared/filters';
import { rowToMap, type MapRow } from './shared/rowMappers';

export function upsertMaps(sql: Sqlite, maps: MapRecord[]): number {
  sql.transaction(() => {
    for (const m of maps) {
      sql.exec(
        `INSERT INTO maps (
          id, name, street_name, return_map_id, forced_return_map_id,
          field_limit, mob_rate, minimap_path, minimap_data,
          minimap_center_x, minimap_center_y, minimap_width, minimap_height,
          minimap_mag, source_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name                 = excluded.name,
          street_name          = excluded.street_name,
          return_map_id        = excluded.return_map_id,
          forced_return_map_id = excluded.forced_return_map_id,
          field_limit          = excluded.field_limit,
          mob_rate             = excluded.mob_rate,
          minimap_path         = excluded.minimap_path,
          minimap_data         = COALESCE(excluded.minimap_data, maps.minimap_data),
          minimap_center_x     = COALESCE(excluded.minimap_center_x, maps.minimap_center_x),
          minimap_center_y     = COALESCE(excluded.minimap_center_y, maps.minimap_center_y),
          minimap_width        = COALESCE(excluded.minimap_width, maps.minimap_width),
          minimap_height       = COALESCE(excluded.minimap_height, maps.minimap_height),
          minimap_mag          = COALESCE(excluded.minimap_mag, maps.minimap_mag),
          source_path          = excluded.source_path`,
        [
          m.id,
          m.name,
          m.streetName,
          m.returnMapId,
          m.forcedReturnMapId,
          m.fieldLimit,
          m.mobRate,
          m.minimapPath,
          m.minimapData,
          m.minimapCenterX,
          m.minimapCenterY,
          m.minimapWidth,
          m.minimapHeight,
          m.minimapMag,
          m.sourcePath,
        ],
      );
    }
  });
  return maps.length;
}

export function getMap(sql: Sqlite, id: number): MapRecord | null {
  const row = sql.selectObject<MapRow>('SELECT * FROM maps WHERE id = ?', [id]);
  return row ? rowToMap(row) : null;
}

export function getMapMinimap(sql: Sqlite, id: number): Uint8Array | null {
  const row = sql.selectObject<{ minimap_data: Uint8Array | null }>(
    'SELECT minimap_data FROM maps WHERE id = ?',
    [id],
  );
  return row?.minimap_data ?? null;
}

export function listMaps(sql: Sqlite, opts: ListOptsBase = {}): PageResult<MapRecord> {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const order = resolveOrder(MAP_ORDER, MAP_ORDER_DEFAULT, opts.orderBy, opts.dir);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.search?.trim()) {
    where.push('(name LIKE ? OR street_name LIKE ?)');
    const q = `%${opts.search.trim()}%`;
    params.push(q, q);
  }
  applyFilters(MAP_FILTER, opts.filters, where, params);
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return sql.transaction(() => {
    const total = Number(
      sql.selectValue(
        `SELECT COUNT(*) FROM maps ${clause}`,
        params.length > 0 ? params : undefined,
      ) ?? 0,
    );
    const rows = sql
      .selectObjects<MapRow>(
        `SELECT id, name, street_name, return_map_id, forced_return_map_id,
                field_limit, mob_rate, minimap_path, NULL AS minimap_data,
                minimap_center_x, minimap_center_y, minimap_width, minimap_height,
                minimap_mag, source_path
         FROM maps ${clause}
         ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )
      .map(rowToMap);
    return { rows, total };
  });
}

export function getMapNpcs(sql: Sqlite, mapId: number): MapNpcWithName[] {
  return sql.selectObjects<MapNpcWithName & Row>(
    `SELECT mn.map_id AS mapId, mn.npc_id AS npcId, mn.x, mn.y, n.name
     FROM map_npcs mn LEFT JOIN npcs n ON n.id = mn.npc_id
     WHERE mn.map_id = ?
     ORDER BY n.name`,
    [mapId],
  );
}

export function getMapMobs(sql: Sqlite, mapId: number): MapMobWithName[] {
  return sql.selectObjects<MapMobWithName & Row>(
    `SELECT mm.map_id AS mapId, mm.mob_id AS mobId, mm.count, m.name, m.level
     FROM map_mobs mm LEFT JOIN mobs m ON m.id = mm.mob_id
     WHERE mm.map_id = ?
     ORDER BY m.level NULLS LAST, m.name`,
    [mapId],
  );
}

export function getMapPortals(sql: Sqlite, mapId: number): MapPortalWithName[] {
  return sql
    .selectObjects<{
      map_id: number;
      idx: number;
      portal_name: string;
      target_map_id: number | null;
      target_portal: string | null;
      x: number | null;
      y: number | null;
      portal_type: number | null;
      script: string | null;
      target_map_name: string | null;
    }>(
      `SELECT mp.map_id, mp.idx, mp.portal_name, mp.target_map_id, mp.target_portal,
              mp.x, mp.y, mp.portal_type, mp.script, tm.name AS target_map_name
       FROM map_portals mp
       LEFT JOIN maps tm ON tm.id = mp.target_map_id
       WHERE mp.map_id = ?
       ORDER BY mp.idx`,
      [mapId],
    )
    .map((r) => ({
      mapId: r.map_id,
      idx: r.idx,
      portalName: r.portal_name,
      targetMapId: r.target_map_id,
      targetPortal: r.target_portal,
      x: r.x,
      y: r.y,
      portalType: r.portal_type,
      script: r.script,
      targetMapName: r.target_map_name,
    }));
}

export function getMapMobSpawns(sql: Sqlite, mapId: number): MapMobSpawnWithName[] {
  return sql.selectObjects<MapMobSpawnWithName & Row>(
    `SELECT ms.map_id AS mapId, ms.mob_id AS mobId, ms.x, ms.y, m.name, m.level
     FROM map_mob_spawns ms LEFT JOIN mobs m ON m.id = ms.mob_id
     WHERE ms.map_id = ?
     ORDER BY m.level NULLS LAST, m.name`,
    [mapId],
  );
}

export function replaceMapLife(
  sql: Sqlite,
  rows: {
    npcs: MapNpcRecord[];
    mobs: MapMobRecord[];
    portals: MapPortalRecord[];
    mobSpawns: MapMobSpawnRecord[];
  },
): void {
  // Collect distinct map IDs across every table so we wipe their previous
  // rows before reinserting. Avoids stale entries when a map is
  // re-extracted with different NPC/mob/portal sets.
  const mapIds = new Set<number>();
  for (const r of rows.npcs) mapIds.add(r.mapId);
  for (const r of rows.mobs) mapIds.add(r.mapId);
  for (const r of rows.portals) mapIds.add(r.mapId);
  for (const r of rows.mobSpawns) mapIds.add(r.mapId);
  sql.transaction(() => {
    for (const id of mapIds) {
      sql.exec('DELETE FROM map_npcs        WHERE map_id = ?', [id]);
      sql.exec('DELETE FROM map_mobs        WHERE map_id = ?', [id]);
      sql.exec('DELETE FROM map_portals     WHERE map_id = ?', [id]);
      sql.exec('DELETE FROM map_mob_spawns  WHERE map_id = ?', [id]);
    }
    for (const r of rows.npcs) {
      sql.exec('INSERT OR REPLACE INTO map_npcs (map_id, npc_id, x, y) VALUES (?, ?, ?, ?)', [
        r.mapId,
        r.npcId,
        r.x,
        r.y,
      ]);
    }
    for (const r of rows.mobs) {
      sql.exec('INSERT OR REPLACE INTO map_mobs (map_id, mob_id, count) VALUES (?, ?, ?)', [
        r.mapId,
        r.mobId,
        r.count,
      ]);
    }
    for (const r of rows.portals) {
      sql.exec(
        `INSERT OR REPLACE INTO map_portals (map_id, idx, portal_name, target_map_id, target_portal, x, y, portal_type, script)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.mapId,
          r.idx,
          r.portalName,
          r.targetMapId,
          r.targetPortal,
          r.x,
          r.y,
          r.portalType,
          r.script,
        ],
      );
    }
    for (const r of rows.mobSpawns) {
      sql.exec('INSERT INTO map_mob_spawns (map_id, mob_id, x, y) VALUES (?, ?, ?, ?)', [
        r.mapId,
        r.mobId,
        r.x,
        r.y,
      ]);
    }
  });
}
