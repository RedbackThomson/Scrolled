import type { Row, Sqlite } from '../sqlite';
import type {
  WorldMapForMap,
  WorldMapMarkerMapRecord,
  WorldMapMarkerRecord,
  WorldMapMarkerWithMaps,
  WorldMapRecord,
} from '../types';

interface WorldMapRow extends Row {
  id: string;
  parent_id: string | null;
  base_image_data: Uint8Array | null;
  origin_x: number;
  origin_y: number;
  source_path: string;
}

function rowToWorldMap(r: WorldMapRow): WorldMapRecord {
  return {
    id: r.id,
    parentId: r.parent_id,
    baseImageData: r.base_image_data ?? null,
    originX: r.origin_x,
    originY: r.origin_y,
    sourcePath: r.source_path,
  };
}

export function upsertWorldMaps(sql: Sqlite, worldMaps: WorldMapRecord[]): number {
  sql.transaction(() => {
    for (const w of worldMaps) {
      sql.exec(
        `INSERT INTO world_maps (id, parent_id, base_image_data, origin_x, origin_y, source_path)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           parent_id       = excluded.parent_id,
           base_image_data = COALESCE(excluded.base_image_data, world_maps.base_image_data),
           origin_x        = excluded.origin_x,
           origin_y        = excluded.origin_y,
           source_path     = excluded.source_path`,
        [w.id, w.parentId, w.baseImageData, w.originX, w.originY, w.sourcePath],
      );
    }
  });
  return worldMaps.length;
}

/** Replace every marker of the touched world maps, then insert. Keeps the
 *  per-world-map marker set consistent across re-extraction. */
export function upsertWorldMapMarkers(sql: Sqlite, markers: WorldMapMarkerRecord[]): number {
  const worldMapIds = new Set(markers.map((m) => m.worldMapId));
  sql.transaction(() => {
    for (const id of worldMapIds) {
      sql.exec('DELETE FROM world_map_markers WHERE world_map_id = ?', [id]);
    }
    for (const m of markers) {
      sql.exec(
        `INSERT INTO world_map_markers
           (id, world_map_id, marker_index, wz_x, wz_y, type, title, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.worldMapId, m.markerIndex, m.wzX, m.wzY, m.type, m.title, m.description],
      );
    }
  });
  return markers.length;
}

/** Replace every map grouping of the touched markers, then insert. */
export function upsertWorldMapMarkerMaps(sql: Sqlite, rows: WorldMapMarkerMapRecord[]): number {
  const markerIds = new Set(rows.map((r) => r.markerId));
  sql.transaction(() => {
    for (const id of markerIds) {
      sql.exec('DELETE FROM world_map_marker_maps WHERE marker_id = ?', [id]);
    }
    for (const r of rows) {
      sql.exec(
        'INSERT OR REPLACE INTO world_map_marker_maps (marker_id, map_id, map_index) VALUES (?, ?, ?)',
        [r.markerId, r.mapId, r.mapIndex],
      );
    }
  });
  return rows.length;
}

export function getWorldMap(sql: Sqlite, id: string): WorldMapRecord | null {
  const row = sql.selectObject<WorldMapRow>('SELECT * FROM world_maps WHERE id = ?', [id]);
  return row ? rowToWorldMap(row) : null;
}

export function getWorldMapMarkers(sql: Sqlite, worldMapId: string): WorldMapMarkerWithMaps[] {
  const markers = sql.selectObjects<WorldMapMarkerRecord & Row>(
    `SELECT id, world_map_id AS worldMapId, marker_index AS markerIndex,
            wz_x AS wzX, wz_y AS wzY, type, title, description
       FROM world_map_markers
      WHERE world_map_id = ?
      ORDER BY marker_index`,
    [worldMapId],
  );
  const mapRows = sql.selectObjects<{ markerId: string; mapId: number } & Row>(
    `SELECT mm.marker_id AS markerId, mm.map_id AS mapId
       FROM world_map_marker_maps mm
       JOIN world_map_markers m ON m.id = mm.marker_id
      WHERE m.world_map_id = ?
      ORDER BY mm.map_index`,
    [worldMapId],
  );
  const byMarker = new Map<string, number[]>();
  for (const r of mapRows) {
    const list = byMarker.get(r.markerId) ?? [];
    list.push(r.mapId);
    byMarker.set(r.markerId, list);
  }
  return markers.map((m) => ({ ...m, mapIds: byMarker.get(m.id) ?? [] }));
}

export function findWorldMapsForMap(sql: Sqlite, mapId: number): WorldMapForMap[] {
  return sql.selectObjects<WorldMapForMap & Row>(
    `SELECT m.world_map_id AS worldMapId, mm.marker_id AS markerId, m.title AS markerTitle
       FROM world_map_marker_maps mm
       JOIN world_map_markers m ON m.id = mm.marker_id
      WHERE mm.map_id = ?
      ORDER BY m.world_map_id, m.marker_index`,
    [mapId],
  );
}
