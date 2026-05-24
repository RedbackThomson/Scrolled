import type { GameDataSource, WzNodeInfo, WzNodeTree } from '@/parser';
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
    return { maps, mapNpcs, mapMobs, mapPortals, skipped };
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
    const tree = await source.readImageTree(node.fullPath, {
      subtrees: ['info', 'life', 'portal'],
      maxDepth: 3,
    });
    if (!tree) {
      skipped.push({ reason: 'image parse failed', path: node.fullPath });
      processed += 1;
      continue;
    }

    const subs = indexByName(tree.children);

    const infoTree = subs.get('info');
    const strs = nameLookup.get(id);
    maps.push({
      id,
      name: strs?.mapName ?? null,
      streetName: strs?.streetName ?? null,
      returnMapId: numberOf(infoTree, 'returnMap'),
      forcedReturnMapId: numberOf(infoTree, 'forcedReturn'),
      fieldLimit: numberOf(infoTree, 'fieldLimit'),
      mobRate: numberOf(infoTree, 'mobRate'),
      sourcePath: node.fullPath,
    });

    // Life: NPCs and mob spawns at known positions.
    const lifeTree = subs.get('life');
    if (lifeTree) {
      const mobCounts = new Map<number, number>();
      for (const life of lifeTree.children) {
        const type = stringOf(life, 'type');
        const entityId = numberOf(life, 'id');
        if (entityId === null) continue;
        const x = numberOf(life, 'x');
        const y = numberOf(life, 'y');
        if (type === 'n') {
          mapNpcs.push({ mapId: id, npcId: entityId, x, y });
        } else if (type === 'm') {
          mobCounts.set(entityId, (mobCounts.get(entityId) ?? 0) + 1);
        }
      }
      for (const [mobId, count] of mobCounts) {
        mapMobs.push({ mapId: id, mobId, count });
      }
    }

    // Portals.
    const portalTree = subs.get('portal');
    if (portalTree) {
      for (const portal of portalTree.children) {
        const portalName = stringOf(portal, 'pn') ?? portal.name;
        if (!portalName) continue;
        mapPortals.push({
          mapId: id,
          portalName,
          targetMapId: numberOf(portal, 'tm'),
          targetPortal: stringOf(portal, 'tn'),
          x: numberOf(portal, 'x'),
          y: numberOf(portal, 'y'),
        });
      }
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
        mapName: stringOf(entry, 'mapName'),
        streetName: stringOf(entry, 'streetName'),
      });
    }
  }
  return lookup;
}

function indexByName(nodes: WzNodeTree[]): Map<string, WzNodeTree> {
  const out = new Map<string, WzNodeTree>();
  for (const n of nodes) out.set(n.name, n);
  return out;
}

function scalarOf(parent: WzNodeTree | undefined, name: string): unknown {
  if (!parent) return undefined;
  for (const child of parent.children) {
    if (child.name === name) return child.scalar;
  }
  return undefined;
}

function stringOf(parent: WzNodeTree | undefined, name: string): string | null {
  const v = scalarOf(parent, name);
  return typeof v === 'string' ? v : null;
}

function numberOf(parent: WzNodeTree | undefined, name: string): number | null {
  const v = scalarOf(parent, name);
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
