import type { GameDataSource, WzNodeInfo } from '@/parser';
import type { MapMobRecord, MapNpcRecord, MapPortalRecord, MapRecord } from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';

const log = createLogger('extract-maps');

export interface ExtractMapsResult {
  maps: MapRecord[];
  mapNpcs: MapNpcRecord[];
  mapMobs: MapMobRecord[];
  mapPortals: MapPortalRecord[];
  skipped: { reason: string; path: string }[];
}

/**
 * Walk `Map.wz/Map/Map<n>/<id>.img` for every map, plus pull localized names
 * out of the nested `String.wz/Map.img` structure.
 *
 * Each map image carries:
 *
 *   - `info/returnMap` / `forcedReturn` / `fieldLimit` / `mobRate`
 *   - `life/<n>` entries — NPCs (`type === 'n'`) and mob spawns (`type === 'm'`)
 *     with `id`, `x`, `y` (and an implicit count of 1 per entry; multiple
 *     entries with the same mob id roll up into a count).
 *   - `portal/<n>` entries — `pn` (name), `tm` (target map), `tn` (target
 *     portal), `x`, `y`.
 *
 * Backgrounds, footholds, and per-tile geometry are deliberately ignored.
 */
export async function extractMaps(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractMapsResult> {
  const maps: MapRecord[] = [];
  const mapNpcs: MapNpcRecord[] = [];
  const mapMobs: MapMobRecord[] = [];
  const mapPortals: MapPortalRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  // Find the actual map-image roots. Map.wz is organized as
  // `Map.wz/Map/Map0/`, `Map.wz/Map/Map1/`, … one bucket per ID prefix.
  const mapRoot = await source.listChildren('Map.wz/Map');
  if (mapRoot.length === 0) {
    log.debug('Map.wz/Map absent or empty');
    return { maps, mapNpcs, mapMobs, mapPortals, skipped };
  }
  const buckets = mapRoot.filter((n) => /^Map\d+$/.test(n.name));

  // Build a flat list of all map images first so we can report determinate
  // progress.
  const imgs: { id: number; node: WzNodeInfo; bucket: string }[] = [];
  for (const bucket of buckets) {
    opts.onProgress?.({ phase: 'Discovering maps', current: imgs.length, detail: bucket.name });
    const children = await source.listChildren(bucket.fullPath);
    for (const c of children) {
      const m = c.name.match(/^(\d+)\.img$/);
      if (m) imgs.push({ id: Number(m[1]), node: c, bucket: bucket.name });
    }
  }
  const total = imgs.length;
  log.info('discovery complete', { totalMaps: total });

  // Precompute String.wz map name candidates: String.wz/Map.img/<region>/<id>
  // — `region` is one of `henesys`, `magatia`, etc. There are dozens of
  // regions; rather than guessing per-id, walk String.wz once and build a
  // lookup keyed by id.
  const nameLookup = await buildMapNameLookup(source);

  let processed = 0;
  for (const { id, node, bucket } of imgs) {
    opts.onProgress?.({
      phase: 'Extracting maps',
      current: processed,
      total,
      detail: `${bucket} · ${id}`,
    });

    const infoPath = `${node.fullPath}/info`;
    const [returnMapN, forcedReturnN, fieldLimitN, mobRateN] = await Promise.all([
      scalarNumber(source, `${infoPath}/returnMap`),
      scalarNumber(source, `${infoPath}/forcedReturn`),
      scalarNumber(source, `${infoPath}/fieldLimit`),
      scalarNumber(source, `${infoPath}/mobRate`),
    ]);

    const strs = nameLookup.get(id);
    maps.push({
      id,
      name: strs?.mapName ?? null,
      streetName: strs?.streetName ?? null,
      returnMapId: returnMapN,
      forcedReturnMapId: forcedReturnN,
      fieldLimit: fieldLimitN,
      mobRate: mobRateN,
      sourcePath: node.fullPath,
    });

    // Life: NPCs and mob spawns at known positions.
    const lifeChildren = await source.listChildren(`${node.fullPath}/life`);
    const mobCounts = new Map<number, number>();
    for (const life of lifeChildren) {
      const [typeNode, idNode, xNode, yNode] = await Promise.all([
        source.getNode(`${life.fullPath}/type`),
        source.getNode(`${life.fullPath}/id`),
        source.getNode(`${life.fullPath}/x`),
        source.getNode(`${life.fullPath}/y`),
      ]);
      const type = typeof typeNode?.scalar === 'string' ? typeNode.scalar : null;
      const entityId = scalarToNumber(idNode?.scalar);
      if (entityId === null) continue;
      const x = scalarToNumber(xNode?.scalar);
      const y = scalarToNumber(yNode?.scalar);
      if (type === 'n') {
        mapNpcs.push({ mapId: id, npcId: entityId, x, y });
      } else if (type === 'm') {
        mobCounts.set(entityId, (mobCounts.get(entityId) ?? 0) + 1);
      }
    }
    for (const [mobId, count] of mobCounts) {
      mapMobs.push({ mapId: id, mobId, count });
    }

    // Portals.
    const portalChildren = await source.listChildren(`${node.fullPath}/portal`);
    for (const portal of portalChildren) {
      const [pnNode, tmNode, tnNode, xNode, yNode] = await Promise.all([
        source.getNode(`${portal.fullPath}/pn`),
        source.getNode(`${portal.fullPath}/tm`),
        source.getNode(`${portal.fullPath}/tn`),
        source.getNode(`${portal.fullPath}/x`),
        source.getNode(`${portal.fullPath}/y`),
      ]);
      const portalName = typeof pnNode?.scalar === 'string' ? pnNode.scalar : portal.name;
      if (!portalName) continue;
      mapPortals.push({
        mapId: id,
        portalName,
        targetMapId: scalarToNumber(tmNode?.scalar),
        targetPortal: typeof tnNode?.scalar === 'string' ? tnNode.scalar : null,
        x: scalarToNumber(xNode?.scalar),
        y: scalarToNumber(yNode?.scalar),
      });
    }

    processed += 1;
  }

  opts.onProgress?.({ phase: 'Extracting maps', current: processed, total });
  log.info('extraction complete', {
    maps: maps.length,
    mapNpcs: mapNpcs.length,
    mapMobs: mapMobs.length,
    mapPortals: mapPortals.length,
    skipped: skipped.length,
  });
  return { maps, mapNpcs, mapMobs, mapPortals, skipped };
}

interface MapStrings {
  mapName: string | null;
  streetName: string | null;
}

/**
 * Walk `String.wz/Map.img` once and build an id → { mapName, streetName }
 * lookup. The structure is `String.wz/Map.img/<region>/<id>/{mapName,
 * streetName}` — region buckets vary by client version.
 */
async function buildMapNameLookup(source: GameDataSource): Promise<Map<number, MapStrings>> {
  const lookup = new Map<number, MapStrings>();
  const regions = await source.listChildren('String.wz/Map.img');
  for (const region of regions) {
    const entries = await source.listChildren(region.fullPath);
    for (const entry of entries) {
      const m = entry.name.match(/^(\d+)$/);
      if (!m) continue;
      const id = Number(m[1]);
      const [nameNode, streetNode] = await Promise.all([
        source.getNode(`${entry.fullPath}/mapName`),
        source.getNode(`${entry.fullPath}/streetName`),
      ]);
      lookup.set(id, {
        mapName: typeof nameNode?.scalar === 'string' ? nameNode.scalar : null,
        streetName: typeof streetNode?.scalar === 'string' ? streetNode.scalar : null,
      });
    }
  }
  return lookup;
}

async function scalarNumber(source: GameDataSource, path: string): Promise<number | null> {
  const node = await source.getNode(path);
  return scalarToNumber(node?.scalar);
}

function scalarToNumber(scalar: string | number | null | undefined): number | null {
  if (typeof scalar === 'number') return scalar;
  if (typeof scalar === 'string') {
    const n = Number(scalar);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
