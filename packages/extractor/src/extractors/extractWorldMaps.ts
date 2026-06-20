import type { GameDataSource } from '../parser';
import {
  childToNumber,
  childToString,
  childToVector,
  indexChildrenByName,
  scalarToNumber,
} from './wzCoerce';
import type {
  WorldMapLinkRecord,
  WorldMapMarkerMapRecord,
  WorldMapMarkerRecord,
  WorldMapRecord,
} from '@scrolled/game-db/db';
import { createLogger } from '@scrolled/game-db/lib/logger';
import type { ProgressFn } from '@scrolled/game-db/lib/progress';

const log = createLogger('extract-world-maps');

export interface ExtractWorldMapsResult {
  worldMaps: WorldMapRecord[];
  markers: WorldMapMarkerRecord[];
  markerMaps: WorldMapMarkerMapRecord[];
  links: WorldMapLinkRecord[];
  skipped: { reason: string; path: string }[];
}

/**
 * Walk `Map.wz/WorldMap/WorldMap*.img` — the overview maps. Each image carries:
 *
 *   - `info/parentMap` — the world map to navigate up to (optional).
 *   - `BaseImg/0` — the background canvas; its `origin` vector anchors the
 *     origin-relative marker coordinates (`screen = origin + wz`).
 *   - `MapList/<index>` — clickable markers. Each has a `spot` vector, a
 *     `type`, optional `title`/`desc`, and a `mapNo` list grouping one or
 *     more map ids the marker represents.
 *
 * `MapLink` (links to other world maps) and `MapList/<index>/path` overlays
 * are deliberately ignored for now.
 *
 * Validation is forgiving: a missing background, missing `MapList`, or a
 * marker with no `mapNo` is recorded in `skipped` rather than failing the run.
 * Only a present-but-undecodable canvas throws (via `getIconPng`).
 */
export async function extractWorldMaps(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractWorldMapsResult> {
  const worldMaps: WorldMapRecord[] = [];
  const markers: WorldMapMarkerRecord[] = [];
  const markerMaps: WorldMapMarkerMapRecord[] = [];
  const links: WorldMapLinkRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const root = await source.listChildren('Map.wz/WorldMap');
  const imgs = root.filter((n) => /^WorldMap.*\.img$/.test(n.name));
  if (imgs.length === 0) {
    log.info('Map.wz/WorldMap absent or has no WorldMap*.img', {
      children: root.slice(0, 10).map((n) => n.name),
    });
    return { worldMaps, markers, markerMaps, links, skipped };
  }

  let processed = 0;
  for (const img of imgs) {
    const id = img.name.replace(/\.img$/, '');
    opts.onProgress?.({
      phase: 'Extracting world maps',
      current: processed,
      total: imgs.length,
      detail: id,
    });

    // `MapLink -> i -> link -> linkImg -> origin` is the deepest path read
    // (5 below the image), so cap there.
    const tree = await source.readImageTree(img.fullPath, {
      subtrees: ['info', 'BaseImg', 'MapList', 'MapLink'],
      maxDepth: 5,
    });
    if (!tree) {
      skipped.push({ reason: 'image parse failed', path: img.fullPath });
      processed += 1;
      continue;
    }
    const subs = indexChildrenByName(tree.children);

    const parentId = childToString(subs.get('info'), 'parentMap');

    // Background image + its origin. `BaseImg/0` is the canvas; `origin` is a
    // vector child sitting alongside the pixel data.
    let baseImageData: Uint8Array | null = null;
    let originX = 0;
    let originY = 0;
    const baseImg = subs.get('BaseImg');
    const baseImg0 = baseImg?.children.find((c) => c.name === '0');
    if (baseImg0) {
      const bytes = await source.getIconPng(baseImg0.fullPath);
      if (bytes && bytes.byteLength > 0) baseImageData = bytes;
      const origin = childToVector(baseImg0, 'origin');
      if (origin) {
        originX = origin.x;
        originY = origin.y;
      }
    }
    if (!baseImageData) {
      skipped.push({ reason: 'missing BaseImg/0', path: img.fullPath });
    }

    worldMaps.push({ id, parentId, baseImageData, originX, originY, sourcePath: img.fullPath });

    const mapList = subs.get('MapList');
    if (!mapList) {
      skipped.push({ reason: 'missing MapList', path: img.fullPath });
      processed += 1;
      continue;
    }

    for (const entry of mapList.children) {
      const markerIndex = Number(entry.name);
      if (!Number.isFinite(markerIndex)) continue;
      const markerId = `${id}:${markerIndex}`;
      const spot = childToVector(entry, 'spot');

      markers.push({
        id: markerId,
        worldMapId: id,
        markerIndex,
        wzX: spot?.x ?? 0,
        wzY: spot?.y ?? 0,
        type: childToNumber(entry, 'type'),
        title: childToString(entry, 'title'),
        description: childToString(entry, 'desc'),
      });

      const mapNo = entry.children.find((c) => c.name === 'mapNo');
      let mapCount = 0;
      if (mapNo) {
        for (const mn of mapNo.children) {
          const mapIndex = Number(mn.name);
          const mapId = scalarToNumber(mn.scalar);
          if (mapId === null || !Number.isFinite(mapIndex)) continue;
          markerMaps.push({ markerId, mapId, mapIndex });
          mapCount += 1;
        }
      }
      if (mapCount === 0) {
        skipped.push({ reason: 'marker has no mapNo', path: entry.fullPath });
      }
    }

    // MapLink: clickable region overlays that navigate to another world map.
    const mapLink = subs.get('MapLink');
    if (mapLink) {
      for (const entry of mapLink.children) {
        const linkIndex = Number(entry.name);
        if (!Number.isFinite(linkIndex)) continue;
        const link = entry.children.find((c) => c.name === 'link');
        const linkImg = link?.children.find((c) => c.name === 'linkImg');
        const targetWorldMapId = childToString(link, 'linkMap');
        if (!targetWorldMapId) {
          skipped.push({ reason: 'MapLink has no linkMap', path: entry.fullPath });
          continue;
        }
        if (!linkImg) {
          skipped.push({ reason: 'MapLink has no linkImg', path: entry.fullPath });
          continue;
        }
        const origin = childToVector(linkImg, 'origin');
        const bytes = await source.getIconPng(linkImg.fullPath);
        links.push({
          id: `${id}:${linkIndex}`,
          sourceWorldMapId: id,
          targetWorldMapId,
          linkIndex,
          tooltip: childToString(entry, 'toolTip'),
          imageData: bytes && bytes.byteLength > 0 ? bytes : null,
          originX: origin?.x ?? 0,
          originY: origin?.y ?? 0,
          z: childToNumber(linkImg, 'z') ?? 0,
        });
      }
    }

    processed += 1;
  }

  log.info('world map extraction complete', {
    worldMaps: worldMaps.length,
    markers: markers.length,
    markerMaps: markerMaps.length,
    links: links.length,
    skipped: skipped.length,
  });
  return { worldMaps, markers, markerMaps, links, skipped };
}
