// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { Sqlite } from '../sqlite';
import { DbApi } from './index';
import type { MapPortalRecord, MapRecord } from '../types';

function makeMap(id: number, name: string | null): MapRecord {
  return {
    id,
    name,
    streetName: null,
    returnMapId: null,
    forcedReturnMapId: null,
    fieldLimit: null,
    mobRate: null,
    minimapPath: null,
    minimapData: null,
    minimapCenterX: null,
    minimapCenterY: null,
    minimapWidth: null,
    minimapHeight: null,
    minimapMag: null,
    mapMark: null,
    sourcePath: `Map.wz/${id}.img`,
  };
}

function portal(mapId: number, idx: number, portalName: string, targetMapId: number | null): MapPortalRecord {
  return {
    mapId,
    idx,
    portalName,
    targetMapId,
    targetPortal: null,
    x: null,
    y: null,
    portalType: null,
    script: null,
  };
}

describe('getMapPortalsInto (reverse portal lookup)', () => {
  let db: DbApi;

  beforeEach(async () => {
    db = new DbApi(new Sqlite({ logTag: 'portal-into-test' }));
    await db.open();
    await db.upsertMaps([
      makeMap(100, 'Ellinia'),
      makeMap(200, 'Henesys'),
      makeMap(300, 'Sleepywood'),
      makeMap(400, null),
    ]);
    await db.replaceMapLife({
      npcs: [],
      mobs: [],
      mobSpawns: [],
      portals: [
        { ...portal(200, 0, 'west00', 300), targetPortal: 'east00' },
        { ...portal(100, 0, 'east00', 300), targetPortal: 'west00' },
        portal(400, 0, 'in00', 300), // unnamed source map
        portal(300, 0, 'tp', 300), // self-reference — not a way in from elsewhere
        portal(100, 1, 'out', 200), // targets a different map
      ],
    });
  });

  it('returns every portal on another map that targets this one', async () => {
    const into = await db.getMapPortalsInto(300);
    expect(into.map((p) => p.mapId)).toEqual([100, 200, 400]);
    expect(into.some((p) => p.mapId === 300)).toBe(false); // self excluded
    expect(into.some((p) => p.portalName === 'out')).toBe(false); // wrong target excluded
  });

  it('joins the source map name and orders unnamed sources last', async () => {
    const into = await db.getMapPortalsInto(300);
    expect(into.map((p) => p.sourceMapName)).toEqual(['Ellinia', 'Henesys', null]);
    expect(into[0]).toMatchObject({ mapId: 100, portalName: 'east00', targetPortal: 'west00' });
  });

  it('returns an empty list when nothing leads into the map', async () => {
    expect(await db.getMapPortalsInto(999)).toEqual([]);
  });
});
