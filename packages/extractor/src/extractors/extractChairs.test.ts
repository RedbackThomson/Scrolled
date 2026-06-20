// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractChairs, type ChairImageOps } from './extractChairs';
import type { GameDataSource, WzNodeInfo } from '../parser';

function makeSource(
  tree: Record<string, WzNodeInfo[]>,
  nodes: Record<string, WzNodeInfo>,
  icons: Record<string, Uint8Array> = {},
): GameDataSource {
  return {
    init: async () => {},
    load: async () => ({ loaded: [], errors: [] }),
    listFiles: async () => [],
    listChildren: async (path) => tree[path] ?? [],
    getNode: async (path) => nodes[path] ?? null,
    getIconPng: async (path) => icons[path] ?? null,
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
 * Image ops stub that avoids the browser image APIs entirely. The "decoded"
 * frame's RGBA buffer is sized from the bytes' length (used by the test as a
 * cheap way to encode per-frame dimensions); the "encoded" animation just
 * concatenates a recognizable WebP-shaped prefix with frame-count metadata
 * so the test can assert structure without parsing real WebP.
 */
function makeOps(frameSize: { width: number; height: number }): ChairImageOps {
  return {
    async decodePngFrame(_bytes) {
      return {
        rgba: new Uint8ClampedArray(frameSize.width * frameSize.height * 4),
        width: frameSize.width,
        height: frameSize.height,
      };
    },
    async encodeAnimation(frames) {
      // RIFF/WEBP prefix + frame count, so the assertion below can read it.
      const out = new Uint8Array(16);
      out.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
      out.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
      out[12] = frames.length;
      return {
        data: out,
        width: frames[0]?.width ?? 0,
        height: frames[0]?.height ?? 0,
      };
    },
  };
}

describe('extractChairs', () => {
  it('produces a chair record per Install item that carries an /effect subtree', async () => {
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
        [
          'Item.wz/Install/0301.img/3010000/effect/0/delay',
          propNode('delay', '', 120),
        ],
        [
          'Item.wz/Install/0301.img/3010000/effect/1/origin',
          propNode('origin', '', '36,48', 'vector'),
        ],
        [
          'Item.wz/Install/0301.img/3010000/effect/1/delay',
          propNode('delay', '', 80),
        ],
        stringName(3010000, 'Relaxer'),
      ]),
      {
        'Item.wz/Install/0301.img/3010000/effect/0': new Uint8Array([1, 2, 3]),
        'Item.wz/Install/0301.img/3010000/effect/1': new Uint8Array([4, 5, 6]),
      },
    );

    const result = await extractChairs(source, { ops: makeOps({ width: 64, height: 64 }) });

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
    // Stub-encoder marker
    expect(chair.previewData.byteLength).toBeGreaterThan(12);
    expect(String.fromCharCode(...chair.previewData.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...chair.previewData.subarray(8, 12))).toBe('WEBP');
  });

  it('sorts frame indices numerically (so 10 follows 9, not 1)', async () => {
    const source = makeSource(
      {
        'Item.wz/Install': [imageNode('0301.img', 'Item.wz/Install/0301.img')],
        'Item.wz/Install/0301.img': [
          imageNode('3010000', 'Item.wz/Install/0301.img/3010000'),
        ],
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
        'Item.wz/Install/0301.img/3010000/effect/0': new Uint8Array([0]),
        'Item.wz/Install/0301.img/3010000/effect/1': new Uint8Array([0]),
        'Item.wz/Install/0301.img/3010000/effect/2': new Uint8Array([0]),
        'Item.wz/Install/0301.img/3010000/effect/10': new Uint8Array([0]),
      },
    );

    const result = await extractChairs(source, { ops: makeOps({ width: 8, height: 8 }) });
    expect(result.chairs[0]!.frameCount).toBe(4);
  });

  it('skips chairs whose item has no localized name (matches extractItems)', async () => {
    // The /effect subtree exists, but String.wz has no name for 3010099 —
    // extractItems would skip the item, so extractChairs must too, else the
    // FK from chairs.item_id → items.id fails on upsert.
    const source = makeSource(
      {
        'Item.wz/Install': [imageNode('0301.img', 'Item.wz/Install/0301.img')],
        'Item.wz/Install/0301.img': [
          imageNode('3010099', 'Item.wz/Install/0301.img/3010099'),
        ],
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
      {
        'Item.wz/Install/0301.img/3010099/effect/0': new Uint8Array([0]),
      },
    );

    const result = await extractChairs(source, { ops: makeOps({ width: 8, height: 8 }) });
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
        'Item.wz/Install/0301.img': [
          imageNode('3010777', 'Item.wz/Install/0301.img/3010777'),
        ],
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
        [
          'Item.wz/Install/0301.img/3010777/effect/0/delay',
          propNode('delay', '', 150),
        ],
        stringName(3010777, 'UOL Chair'),
      ]),
      {
        'Item.wz/Install/0301.img/3010777/effect/0': new Uint8Array([0]),
        // The UOL itself; getIconPng follows it transparently in production.
        'Item.wz/Install/0301.img/3010777/effect/1': new Uint8Array([0]),
      },
    );

    let lastFrames: { width: number; height: number }[] = [];
    const ops: ChairImageOps = {
      async decodePngFrame() {
        return { rgba: new Uint8ClampedArray(64 * 64 * 4), width: 64, height: 64 };
      },
      async encodeAnimation(frames) {
        lastFrames = frames.map((f) => ({ width: f.width, height: f.height }));
        return { data: new Uint8Array(16), width: frames[0]!.width, height: frames[0]!.height };
      },
    };

    const result = await extractChairs(source, { ops });
    expect(result.chairs).toHaveLength(1);
    expect(result.chairs[0]!.frameCount).toBe(2);
    // If origin defaulted to (0,0), the bounding box would expand to 64+40=104
    // wide × 64+60=124 tall. With the UOL resolved correctly to (40,60), both
    // frames share the same origin, so the canvas stays 64×64.
    expect(lastFrames).toEqual([
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
