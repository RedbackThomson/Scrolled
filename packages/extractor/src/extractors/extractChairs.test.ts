// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractChairs, type ChairImageOps } from './extractChairs';
import type { AnimFrame } from '../lib/apng';
import type { GameDataSource, WzNodeInfo } from '../parser';

function makeSource(
  tree: Record<string, WzNodeInfo[]>,
  nodes: Record<string, WzNodeInfo>,
  /** Path → frame pixel dimensions. Presence marks a decodable frame; the
   *  bytes are zero-filled since the tests only care about dimensions. */
  icons: Record<string, { width: number; height: number }> = {},
): GameDataSource {
  return {
    init: async () => {},
    load: async () => ({ loaded: [], errors: [] }),
    listFiles: async () => [],
    listChildren: async (path) => tree[path] ?? [],
    getNode: async (path) => nodes[path] ?? null,
    getIconPng: async () => null,
    getIconRgba: async (path) => {
      const size = icons[path];
      if (!size) return null;
      return {
        rgba: new Uint8ClampedArray(size.width * size.height * 4),
        width: size.width,
        height: size.height,
      };
    },
    readImageTree: async () => null,
    diagnose: async () => ({ log: [], aesSmokeTest: { ok: true }, loadedFiles: [] }),
    dispose: async () => {},
  };
}

function imageNode(name: string, fullPath: string): WzNodeInfo {
  return { name, fullPath, kind: 'image', hasChildren: true };
}

function propNode(
  name: string,
  fullPath: string,
  scalar: string | number | null = null,
  propertyKind: WzNodeInfo['propertyKind'] = 'int',
): WzNodeInfo {
  return { name, fullPath, kind: 'property', propertyKind, hasChildren: false, scalar };
}

function stringName(id: number, name: string): [string, WzNodeInfo] {
  return [
    `String.wz/Ins.img/${id}/name`,
    propNode('name', `String.wz/Ins.img/${id}/name`, name, 'string'),
  ];
}

/**
 * Encode stub that records the frames it was handed so a test can assert frame
 * dimensions without parsing real APNG bytes.
 */
function makeCapturingOps(): { ops: ChairImageOps; frames: () => AnimFrame[] } {
  let captured: AnimFrame[] = [];
  return {
    ops: {
      encodeAnimation(frames) {
        captured = frames;
        return { data: new Uint8Array(0), width: frames[0]?.width ?? 0, height: frames[0]?.height ?? 0 };
      },
    },
    frames: () => captured,
  };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function indexOfChunk(bytes: Uint8Array, type: string): number {
  for (let i = 0; i + 4 <= bytes.length; i++) {
    if (
      bytes[i] === type.charCodeAt(0) &&
      bytes[i + 1] === type.charCodeAt(1) &&
      bytes[i + 2] === type.charCodeAt(2) &&
      bytes[i + 3] === type.charCodeAt(3)
    ) {
      return i;
    }
  }
  return -1;
}

describe('extractChairs', () => {
  it('produces a chair record (real APNG) per Install item with an /effect subtree', async () => {
    // Two install items under group 0301:
    //   3010000 — chair with 2 frames + recoveryHP/MP
    //   3010001 — non-chair (no /effect) → should not produce a chair record
    const source = makeSource(
      {
        'Item.wz/Install': [imageNode('0301.img', 'Item.wz/Install/0301.img')],
        'Item.wz/Install/0301.img': [
          imageNode('3010000', 'Item.wz/Install/0301.img/3010000'),
          imageNode('3010001', 'Item.wz/Install/0301.img/3010001'),
        ],
        'Item.wz/Install/0301.img/3010000/info': [
          propNode('recoveryHP', '', 50),
          propNode('recoveryMP', '', 75),
        ],
        'Item.wz/Install/0301.img/3010000/effect': [
          imageNode('0', 'Item.wz/Install/0301.img/3010000/effect/0'),
          imageNode('1', 'Item.wz/Install/0301.img/3010000/effect/1'),
        ],
        'Item.wz/Install/0301.img/3010001/info': [],
      },
      Object.fromEntries([
        [
          'Item.wz/Install/0301.img/3010000/effect',
          imageNode('effect', 'Item.wz/Install/0301.img/3010000/effect'),
        ],
        [
          'Item.wz/Install/0301.img/3010000/effect/0/origin',
          propNode('origin', '', '32,48', 'vector'),
        ],
        ['Item.wz/Install/0301.img/3010000/effect/0/delay', propNode('delay', '', 120)],
        [
          'Item.wz/Install/0301.img/3010000/effect/1/origin',
          propNode('origin', '', '36,48', 'vector'),
        ],
        ['Item.wz/Install/0301.img/3010000/effect/1/delay', propNode('delay', '', 80)],
        stringName(3010000, 'Relaxer'),
      ]),
      {
        'Item.wz/Install/0301.img/3010000/effect/0': { width: 64, height: 64 },
        'Item.wz/Install/0301.img/3010000/effect/1': { width: 64, height: 64 },
      },
    );

    // No `ops` → real pure-JS APNG encoder runs end-to-end.
    const result = await extractChairs(source);

    expect(result.chairs).toHaveLength(1);
    const chair = result.chairs[0]!;
    expect(chair.itemId).toBe(3010000);
    expect(chair.recoveryHp).toBe(50);
    expect(chair.recoveryMp).toBe(75);
    expect(chair.frameCount).toBe(2);
    // Bounding box for two 64×64 frames at origins (32,48) and (36,48):
    // left=max(32,36)=36, right=max(64-32, 64-36)=32 → width 68
    // top=max(48,48)=48,  bottom=max(64-48,64-48)=16 → height 64
    expect(chair.previewWidth).toBe(68);
    expect(chair.previewHeight).toBe(64);
    // Real APNG: PNG signature, animation control chunk, and one frame control
    // chunk per frame.
    expect([...chair.previewData.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(indexOfChunk(chair.previewData, 'acTL')).toBeGreaterThan(0);
    expect(indexOfChunk(chair.previewData, 'fcTL')).toBeGreaterThan(0);
    expect(indexOfChunk(chair.previewData, 'IEND')).toBeGreaterThan(0);
  });

  it('sorts frame indices numerically (so 10 follows 9, not 1)', async () => {
    const source = makeSource(
      {
        'Item.wz/Install': [imageNode('0301.img', 'Item.wz/Install/0301.img')],
        'Item.wz/Install/0301.img': [imageNode('3010000', 'Item.wz/Install/0301.img/3010000')],
        'Item.wz/Install/0301.img/3010000/info': [],
        'Item.wz/Install/0301.img/3010000/effect': [
          imageNode('0', 'Item.wz/Install/0301.img/3010000/effect/0'),
          imageNode('1', 'Item.wz/Install/0301.img/3010000/effect/1'),
          imageNode('2', 'Item.wz/Install/0301.img/3010000/effect/2'),
          imageNode('10', 'Item.wz/Install/0301.img/3010000/effect/10'),
        ],
      },
      Object.fromEntries([
        [
          'Item.wz/Install/0301.img/3010000/effect',
          imageNode('effect', 'Item.wz/Install/0301.img/3010000/effect'),
        ],
        stringName(3010000, 'Relaxer'),
      ]),
      {
        'Item.wz/Install/0301.img/3010000/effect/0': { width: 8, height: 8 },
        'Item.wz/Install/0301.img/3010000/effect/1': { width: 8, height: 8 },
        'Item.wz/Install/0301.img/3010000/effect/2': { width: 8, height: 8 },
        'Item.wz/Install/0301.img/3010000/effect/10': { width: 8, height: 8 },
      },
    );

    const result = await extractChairs(source);
    expect(result.chairs[0]!.frameCount).toBe(4);
  });

  it('skips chairs whose item has no localized name (matches extractItems)', async () => {
    // The /effect subtree exists, but String.wz has no name for 3010099 —
    // extractItems would skip the item, so extractChairs must too, else the
    // FK from chairs.item_id → items.id fails on upsert.
    const source = makeSource(
      {
        'Item.wz/Install': [imageNode('0301.img', 'Item.wz/Install/0301.img')],
        'Item.wz/Install/0301.img': [imageNode('3010099', 'Item.wz/Install/0301.img/3010099')],
        'Item.wz/Install/0301.img/3010099/info': [],
        'Item.wz/Install/0301.img/3010099/effect': [
          imageNode('0', 'Item.wz/Install/0301.img/3010099/effect/0'),
        ],
      },
      {
        'Item.wz/Install/0301.img/3010099/effect': imageNode(
          'effect',
          'Item.wz/Install/0301.img/3010099/effect',
        ),
      },
      { 'Item.wz/Install/0301.img/3010099/effect/0': { width: 8, height: 8 } },
    );

    const result = await extractChairs(source);
    expect(result.chairs).toEqual([]);
    expect(result.skipped).toEqual([
      { reason: 'no localized name found', path: 'Item.wz/Install/0301.img/3010099' },
    ]);
  });

  it('follows UOL frame entries so origin/delay come from the target, not (0,0)/100', async () => {
    // Effect tree: /0 is a real frame with origin (40,60); /1 is a UOL → "0".
    // Before the fix, the UOL's origin would silently fall back to (0,0),
    // which composites that frame at the canvas anchor — a visible jump.
    const source = makeSource(
      {
        'Item.wz/Install': [imageNode('0301.img', 'Item.wz/Install/0301.img')],
        'Item.wz/Install/0301.img': [imageNode('3010777', 'Item.wz/Install/0301.img/3010777')],
        'Item.wz/Install/0301.img/3010777/info': [],
        'Item.wz/Install/0301.img/3010777/effect': [
          imageNode('0', 'Item.wz/Install/0301.img/3010777/effect/0'),
          {
            name: '1',
            fullPath: 'Item.wz/Install/0301.img/3010777/effect/1',
            kind: 'property',
            propertyKind: 'uol',
            hasChildren: false,
            scalar: '0',
          },
        ],
      },
      Object.fromEntries([
        [
          'Item.wz/Install/0301.img/3010777/effect',
          imageNode('effect', 'Item.wz/Install/0301.img/3010777/effect'),
        ],
        [
          'Item.wz/Install/0301.img/3010777/effect/0/origin',
          propNode('origin', '', '40,60', 'vector'),
        ],
        ['Item.wz/Install/0301.img/3010777/effect/0/delay', propNode('delay', '', 150)],
        stringName(3010777, 'UOL Chair'),
      ]),
      {
        'Item.wz/Install/0301.img/3010777/effect/0': { width: 64, height: 64 },
        // The UOL itself; getIconRgba follows it transparently in production.
        'Item.wz/Install/0301.img/3010777/effect/1': { width: 64, height: 64 },
      },
    );

    const { ops, frames } = makeCapturingOps();
    const result = await extractChairs(source, { ops });
    expect(result.chairs).toHaveLength(1);
    expect(result.chairs[0]!.frameCount).toBe(2);
    // If origin defaulted to (0,0), the bounding box would expand to 64+40=104
    // wide × 64+60=124 tall. With the UOL resolved correctly to (40,60), both
    // frames share the same origin, so the canvas stays 64×64.
    expect(frames().map((f) => ({ width: f.width, height: f.height }))).toEqual([
      { width: 64, height: 64 },
      { width: 64, height: 64 },
    ]);
  });

  it('returns an empty result when Item.wz/Install is absent', async () => {
    const source = makeSource({}, {});
    const result = await extractChairs(source);
    expect(result.chairs).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});
