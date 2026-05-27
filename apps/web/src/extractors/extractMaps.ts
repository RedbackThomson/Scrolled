import type { GameDataSource, WzNodeInfo } from '@/parser';
import { childToNumber, childToString, indexChildrenByName } from './wzCoerce';
import type {
  MapMobRecord,
  MapMobSpawnRecord,
  MapNpcRecord,
  MapPortalRecord,
  MapRecord,
} from '@/db';
import { createLogger, describeError } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';

const log = createLogger('extract-maps');

export interface ExtractMapsResult {
  maps: MapRecord[];
  mapNpcs: MapNpcRecord[];
  mapMobs: MapMobRecord[];
  mapMobSpawns: MapMobSpawnRecord[];
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
 *
 * Each map fetches its entire `info`/`life`/`portal` subtree in a single
 * `readImageTree` call. That keeps the per-file mutex held for one
 * acquisition per map instead of ~135 (one per leaf property + listChildren
 * for life/portal). On a 60 k-map MapleRoyals dump that's the difference
 * between a few minutes and many tens of minutes.
 */
export async function extractMaps(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractMapsResult> {
  const maps: MapRecord[] = [];
  const mapNpcs: MapNpcRecord[] = [];
  const mapMobs: MapMobRecord[] = [];
  const mapMobSpawns: MapMobSpawnRecord[] = [];
  const mapPortals: MapPortalRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  // Find the actual map-image roots. Map.wz is organized as
  // `Map.wz/Map/Map0/`, `Map.wz/Map/Map1/`, … one bucket per ID prefix.
  const mapRoot = await source.listChildren('Map.wz/Map');
  if (mapRoot.length === 0) {
    const top = await source.listChildren('Map.wz');
    log.warn('Map.wz/Map absent or empty', {
      mapWzTopLevel: top.map((n) => `${n.name} (${n.kind})`),
      hint:
        top.length === 0
          ? 'Map.wz appears to have failed to load — check parser.load errors.'
          : 'Map.wz loaded but has no `Map` directory; layout may differ from v83.',
    });
    return { maps, mapNpcs, mapMobs, mapMobSpawns, mapPortals, skipped };
  }
  const buckets = mapRoot.filter((n) => /^Map\d+$/.test(n.name));
  if (buckets.length === 0) {
    log.warn('Map.wz/Map has children but none match Map\\d+', {
      sample: mapRoot.slice(0, 10).map((n) => n.name),
    });
  } else {
    log.info('Map.wz/Map bucket sample', {
      total: buckets.length,
      first: buckets[0]?.name,
    });
  }

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

  const nameLookup = await buildMapNameLookup(source);

  let processed = 0;
  for (const { id, node, bucket } of imgs) {
    opts.onProgress?.({
      phase: 'Extracting maps',
      current: processed,
      total,
      detail: `${bucket} · ${id}`,
    });

    // One mutex acquisition + one parseImage + one in-memory tree walk.
    // The maxDepth=3 is `image -> info/life/portal -> entries -> scalars`.
    // `miniMap` is included so we can detect whether a minimap canvas
    // exists without paying a separate path-resolution round-trip per
    // map (most maps don't have one).
    const tree = await source.readImageTree(node.fullPath, {
      subtrees: ['info', 'life', 'portal', 'miniMap'],
      maxDepth: 3,
    });
    if (!tree) {
      skipped.push({ reason: 'image parse failed', path: node.fullPath });
      processed += 1;
      continue;
    }

    const subs = indexChildrenByName(tree.children);

    const infoTree = subs.get('info');
    const strs = nameLookup.get(id);

    // Minimap canvas. Two layouts seen in the wild:
    //   A) `<map>/miniMap` is a sub-property whose `canvas` child is the
    //      WzCanvasProperty. PNG lives at `<map>/miniMap/canvas`.
    //   B) `<map>/miniMap` *is* the WzCanvasProperty directly. PNG
    //      lives at `<map>/miniMap` itself. MapleRoyals dumps appear
    //      to use this layout.
    // Probe via propertyKind so we pick the right path without
    // round-tripping through getIconPng twice.
    let minimapPath: string | null = null;
    let minimapData: Uint8Array | null = null;
    let minimapCenterX: number | null = null;
    let minimapCenterY: number | null = null;
    let minimapWidth: number | null = null;
    let minimapHeight: number | null = null;
    let minimapMag: number | null = null;
    const minimapTree = subs.get('miniMap');
    let minimapTry: string | null = null;
    if (minimapTree?.propertyKind === 'canvas') {
      minimapTry = minimapTree.fullPath;
    } else if (minimapTree) {
      const canvasChild = minimapTree.children.find((c) => c.propertyKind === 'canvas');
      if (canvasChild) minimapTry = canvasChild.fullPath;
    }
    if (minimapTry) {
      try {
        const bytes = await source.getIconPng(minimapTry);
        if (bytes && bytes.byteLength > 0) {
          minimapPath = minimapTry;
          minimapData = bytes;
        }
      } catch (e) {
        log.debug('minimap decode threw', { path: minimapTry, ...describeError(e) });
      }
    }
    if (minimapTree) {
      // Geometry scalars live alongside the canvas in both layouts (A: on
      // the `miniMap` parent; B: as siblings of `canvas` on `miniMap`
      // itself). Either way they're direct children of `minimapTree`.
      minimapCenterX = childToNumber(minimapTree, 'centerX');
      minimapCenterY = childToNumber(minimapTree, 'centerY');
      minimapWidth = childToNumber(minimapTree, 'width');
      minimapHeight = childToNumber(minimapTree, 'height');
      minimapMag = childToNumber(minimapTree, 'mag');
    }
    if (processed < 3 && minimapTree) {
      // Log layout for the first few maps so we can confirm which case
      // applies on this dump.
      log.info('minimap probe', {
        id,
        minimapKind: minimapTree.propertyKind ?? minimapTree.kind,
        minimapChildren: minimapTree.children.map((c) => `${c.name}:${c.propertyKind ?? c.kind}`),
        chosenPath: minimapTry,
      });
    }

    maps.push({
      id,
      name: strs?.mapName ?? null,
      streetName: strs?.streetName ?? null,
      returnMapId: childToNumber(infoTree, 'returnMap'),
      forcedReturnMapId: childToNumber(infoTree, 'forcedReturn'),
      fieldLimit: childToNumber(infoTree, 'fieldLimit'),
      mobRate: childToNumber(infoTree, 'mobRate'),
      minimapPath,
      minimapData,
      minimapCenterX,
      minimapCenterY,
      minimapWidth,
      minimapHeight,
      minimapMag,
      sourcePath: node.fullPath,
    });

    // Life: NPCs and mob spawns at known positions. We emit both the per-
    // spawn rows (one entry per `life/<n>` mob, with its coords) and the
    // aggregated count per mob id (for the detail-page list view).
    const lifeTree = subs.get('life');
    if (lifeTree) {
      const mobCounts = new Map<number, number>();
      for (const life of lifeTree.children) {
        const type = childToString(life, 'type');
        const entityId = childToNumber(life, 'id');
        if (entityId === null) continue;
        const x = childToNumber(life, 'x');
        const y = childToNumber(life, 'y');
        if (type === 'n') {
          mapNpcs.push({ mapId: id, npcId: entityId, x, y });
        } else if (type === 'm') {
          mobCounts.set(entityId, (mobCounts.get(entityId) ?? 0) + 1);
          mapMobSpawns.push({ mapId: id, mobId: entityId, x, y });
        }
      }
      for (const [mobId, count] of mobCounts) {
        mapMobs.push({ mapId: id, mobId, count });
      }
    }

    // Portals. The WZ child name is the numeric portal index (`portal/0`,
    // `portal/1`, …); we persist it as `idx` so maps with multiple portals
    // sharing a `pn` (e.g. several `sp` spawn points) don't collide on
    // insert and can still be addressed individually by the UI.
    const portalTree = subs.get('portal');
    if (portalTree) {
      for (const portal of portalTree.children) {
        const portalName = childToString(portal, 'pn') ?? portal.name;
        if (!portalName) continue;
        const idx = Number(portal.name);
        if (!Number.isFinite(idx)) continue;
        mapPortals.push({
          mapId: id,
          idx,
          portalName,
          targetMapId: childToNumber(portal, 'tm'),
          targetPortal: childToString(portal, 'tn'),
          x: childToNumber(portal, 'x'),
          y: childToNumber(portal, 'y'),
          portalType: childToNumber(portal, 'pt'),
          script: childToString(portal, 'script'),
        });
      }
    }

    processed += 1;
  }

  opts.onProgress?.({ phase: 'Extracting maps', current: processed, total });
  const withMinimaps = maps.filter((m) => m.minimapData !== null).length;
  log.info('extraction complete', {
    maps: maps.length,
    mapNpcs: mapNpcs.length,
    mapMobs: mapMobs.length,
    mapMobSpawns: mapMobSpawns.length,
    mapPortals: mapPortals.length,
    withMinimaps,
    skipped: skipped.length,
  });
  return { maps, mapNpcs, mapMobs, mapMobSpawns, mapPortals, skipped };
}

interface MapStrings {
  mapName: string | null;
  streetName: string | null;
}

/**
 * Walk `String.wz/Map.img` once and build an id → { mapName, streetName }
 * lookup. The structure is `String.wz/Map.img/<region>/<id>/{mapName,
 * streetName}` — region buckets vary by client version. Pulled in one
 * `readImageTree` call (~50 regions × ~100 ids × a few props each is
 * ~20 k nodes, still small) so we avoid thousands of per-leaf
 * `getNode` round-trips.
 */
async function buildMapNameLookup(source: GameDataSource): Promise<Map<number, MapStrings>> {
  const lookup = new Map<number, MapStrings>();
  const tree = await source.readImageTree('String.wz/Map.img', { maxDepth: 3 });
  if (!tree) {
    log.warn('String.wz/Map.img not found — map names will be empty');
    return lookup;
  }
  for (const region of tree.children) {
    for (const entry of region.children) {
      const m = entry.name.match(/^(\d+)$/);
      if (!m) continue;
      lookup.set(Number(m[1]), {
        mapName: childToString(entry, 'mapName'),
        streetName: childToString(entry, 'streetName'),
      });
    }
  }
  return lookup;
}
