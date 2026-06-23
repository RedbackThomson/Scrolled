// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractWorldMaps } from './extractWorldMaps';
import type { GameDataSource, WzNodeInfo, WzNodeTree } from '../parser';

// --- tiny WZ node builders for synthetic raw-tree fixtures ---------------

function sub(name: string, full: string, children: WzNodeTree[]): WzNodeTree {
  return {
    name,
    fullPath: full,
    kind: 'property',
    propertyKind: 'sub',
    hasChildren: children.length > 0,
    children,
  };
}
function canvas(name: string, full: string, children: WzNodeTree[]): WzNodeTree {
  return { name, fullPath: full, kind: 'property', propertyKind: 'canvas', hasChildren: true, children };
}
function int(name: string, full: string, value: number): WzNodeTree {
  return { name, fullPath: full, kind: 'property', propertyKind: 'int', hasChildren: false, scalar: value, children: [] };
}
function str(name: string, full: string, value: string): WzNodeTree {
  return { name, fullPath: full, kind: 'property', propertyKind: 'string', hasChildren: false, scalar: value, children: [] };
}
function vec(name: string, full: string, x: number, y: number): WzNodeTree {
  return { name, fullPath: full, kind: 'property', propertyKind: 'vector', hasChildren: false, scalar: `${x},${y}`, children: [] };
}
function image(name: string, full: string, children: WzNodeTree[]): WzNodeTree {
  return { name, fullPath: full, kind: 'image', hasChildren: true, children };
}

/**
 * Stub GameDataSource serving prebuilt image trees + base-image bytes.
 * Only the methods extractWorldMaps calls are implemented; the rest throw so
 * a new read shows up as a loud failure.
 */
function makeSource(
  children: Record<string, WzNodeInfo[]>,
  trees: Record<string, WzNodeTree>,
  pngPaths: Set<string>,
): GameDataSource {
  return {
    init: async () => {},
    load: async () => ({ loaded: [], errors: [] }),
    listFiles: async () => [],
    listChildren: async (path) => children[path] ?? [],
    getNode: async () => null,
    getIconPng: async (path) => (pngPaths.has(path) ? new Uint8Array([1, 2, 3]) : null),
    getIconRgba: async () => null,
    readImageTree: async (path) => trees[path] ?? null,
    diagnose: async () => ({ log: [], aesSmokeTest: { ok: true }, loadedFiles: [] }),
    dispose: async () => {},
  };
}

describe('extractWorldMaps', () => {
  it('extracts world maps, grouped markers, parent links, and skips', async () => {
    const root = 'Map.wz/WorldMap';
    const top = `${root}/WorldMap.img`;
    const child = `${root}/WorldMap000.img`;

    const topTree = image('WorldMap.img', top, [
      sub('info', `${top}/info`, []),
      sub('BaseImg', `${top}/BaseImg`, [
        canvas('0', `${top}/BaseImg/0`, [vec('origin', `${top}/BaseImg/0/origin`, 320, 235)]),
      ]),
      sub('MapList', `${top}/MapList`, [
        sub('0', `${top}/MapList/0`, [
          vec('spot', `${top}/MapList/0/spot`, -180, -76),
          int('type', `${top}/MapList/0/type`, 0),
          str('title', `${top}/MapList/0/title`, 'Henesys'),
          sub('mapNo', `${top}/MapList/0/mapNo`, [
            int('0', `${top}/MapList/0/mapNo/0`, 100000000),
            int('1', `${top}/MapList/0/mapNo/1`, 100000001),
          ]),
        ]),
        // No mapNo → recorded as skipped, but the marker is still emitted.
        sub('1', `${top}/MapList/1`, [
          vec('spot', `${top}/MapList/1/spot`, 50, 20),
          int('type', `${top}/MapList/1/type`, 1),
        ]),
      ]),
      sub('MapLink', `${top}/MapLink`, [
        sub('0', `${top}/MapLink/0`, [
          str('toolTip', `${top}/MapLink/0/toolTip`, 'To Victoria'),
          sub('link', `${top}/MapLink/0/link`, [
            str('linkMap', `${top}/MapLink/0/link/linkMap`, 'WorldMap000'),
            canvas('linkImg', `${top}/MapLink/0/link/linkImg`, [
              vec('origin', `${top}/MapLink/0/link/linkImg/origin`, 100, 50),
            ]),
          ]),
        ]),
      ]),
    ]);

    const childTree = image('WorldMap000.img', child, [
      sub('info', `${child}/info`, [str('parentMap', `${child}/info/parentMap`, 'WorldMap')]),
      // BaseImg/0 present but getIconPng returns null → missing-base skip.
      sub('BaseImg', `${child}/BaseImg`, [
        canvas('0', `${child}/BaseImg/0`, [vec('origin', `${child}/BaseImg/0/origin`, 0, 0)]),
      ]),
      sub('MapList', `${child}/MapList`, [
        sub('0', `${child}/MapList/0`, [
          vec('spot', `${child}/MapList/0/spot`, 10, 10),
          sub('mapNo', `${child}/MapList/0/mapNo`, [
            int('0', `${child}/MapList/0/mapNo/0`, 200000000),
          ]),
        ]),
      ]),
    ]);

    const source = makeSource(
      {
        [root]: [
          { name: 'WorldMap.img', fullPath: top, kind: 'image', hasChildren: true },
          { name: 'WorldMap000.img', fullPath: child, kind: 'image', hasChildren: true },
          // Non-matching sibling must be ignored.
          { name: 'WorldMap.img.bak', fullPath: `${root}/WorldMap.img.bak`, kind: 'image', hasChildren: true },
        ],
      },
      { [top]: topTree, [child]: childTree },
      new Set([`${top}/BaseImg/0`, `${top}/MapLink/0/link/linkImg`]),
    );

    const result = await extractWorldMaps(source);

    expect(result.worldMaps).toHaveLength(2);
    const wm = result.worldMaps.find((w) => w.id === 'WorldMap')!;
    expect(wm.parentId).toBeNull();
    expect([wm.originX, wm.originY]).toEqual([320, 235]);
    expect(wm.baseImageData).not.toBeNull();

    const wm000 = result.worldMaps.find((w) => w.id === 'WorldMap000')!;
    expect(wm000.parentId).toBe('WorldMap');
    expect(wm000.baseImageData).toBeNull();

    const henesys = result.markers.find((m) => m.id === 'WorldMap:0')!;
    expect(henesys.title).toBe('Henesys');
    expect([henesys.wzX, henesys.wzY]).toEqual([-180, -76]);
    expect(henesys.type).toBe(0);

    expect(result.markerMaps.filter((r) => r.markerId === 'WorldMap:0').map((r) => r.mapId)).toEqual([
      100000000, 100000001,
    ]);
    expect(result.markerMaps.filter((r) => r.markerId === 'WorldMap000:0').map((r) => r.mapId)).toEqual([
      200000000,
    ]);

    expect(result.skipped).toContainEqual({ reason: 'marker has no mapNo', path: `${top}/MapList/1` });
    expect(result.skipped).toContainEqual({ reason: 'missing BaseImg/0', path: child });

    expect(result.links).toHaveLength(1);
    const link = result.links[0]!;
    expect(link.id).toBe('WorldMap:0');
    expect(link.sourceWorldMapId).toBe('WorldMap');
    expect(link.targetWorldMapId).toBe('WorldMap000');
    expect(link.tooltip).toBe('To Victoria');
    expect([link.originX, link.originY]).toEqual([100, 50]);
    expect(link.imageData).not.toBeNull();
  });

  it('returns empty when WorldMap dir is absent', async () => {
    const source = makeSource({}, {}, new Set());
    const result = await extractWorldMaps(source);
    expect(result).toEqual({ worldMaps: [], markers: [], markerMaps: [], links: [], skipped: [] });
  });
});
