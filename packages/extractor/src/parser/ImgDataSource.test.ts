import { describe, it, expect } from 'vitest';
import { detectImageVersion, getKeystream } from '@scrolled/wz';
import { ImgDataSource } from './ImgDataSource';
import { buildImgDataset } from './imgTree';
import type { LoadFileSpec } from './types';
import { buildSyntheticImg, syntheticImgFile, type SynProp } from '../../test/helpers/syntheticImg';

const ZERO_KEYSTREAM = new Uint8Array(256 * 1024); // BMS / unencrypted

const ICON_BGRA = new Uint8Array([10, 20, 30, 255]); // 1x1 pixel, BGRA

const FILES: { relPath: string; props: SynProp[] }[] = [
  {
    relPath: 'String/Mob.img',
    props: [{ type: 'sub', name: '100100', children: [{ type: 'string', name: 'name', value: 'Snail' }] }],
  },
  {
    relPath: 'Item/Consume/0200/02000000.img',
    props: [
      {
        type: 'sub',
        name: 'info',
        children: [
          { type: 'int', name: 'price', value: 1000 },
          { type: 'canvas', name: 'icon', width: 1, height: 1, bgra: ICON_BGRA },
        ],
      },
    ],
  },
  {
    relPath: 'Mob/0100100.img',
    props: [{ type: 'sub', name: 'info', children: [{ type: 'int', name: 'level', value: 1 }] }],
  },
];

function loadSpecs(): LoadFileSpec[] {
  return FILES.map((f) => ({ name: f.relPath, source: syntheticImgFile(f.relPath, f.props, ZERO_KEYSTREAM) }));
}

async function makeSource(): Promise<ImgDataSource> {
  const src = new ImgDataSource();
  await src.init('BMS');
  await src.load(loadSpecs());
  return src;
}

describe('buildImgDataset', () => {
  it('maps top-level folders to logical <Folder>.wz roots', () => {
    const ds = buildImgDataset([
      { relPath: 'Item/Consume/0200/02000000.img', source: 'x' },
      { relPath: 'String/Mob.img', source: 'y' },
    ]);
    expect([...ds.roots.keys()].sort()).toEqual(['Item.wz', 'String.wz']);
    const item = ds.roots.get('Item.wz')!;
    expect([...item.children.keys()]).toEqual(['Consume']);
    const img = item.children.get('Consume')!.children.get('0200')!.children.get('02000000.img')!;
    expect(img.kind).toBe('image');
    expect(img.source).toBe('x');
  });

  it('ignores entries with no folder or a non-.img leaf', () => {
    const ds = buildImgDataset([
      { relPath: 'loose.img', source: 'a' }, // no folder
      { relPath: 'Item/readme.txt', source: 'b' }, // not .img
    ]);
    expect(ds.roots.size).toBe(0);
  });
});

describe('ImgDataSource', () => {
  it('lists logical files after load', async () => {
    const src = await makeSource();
    const files = await src.listFiles();
    expect(files.map((f) => f.name).sort()).toEqual(['Item.wz', 'Mob.wz', 'String.wz']);
    expect(files.every((f) => f.kind === 'file' && f.hasChildren)).toBe(true);
  });

  it('navigates directories with the same logical paths as WZ', async () => {
    const src = await makeSource();
    expect((await src.listChildren('Item.wz')).map((c) => c.name)).toEqual(['Consume']);
    const consume = await src.listChildren('Item.wz/Consume/0200');
    expect(consume).toHaveLength(1);
    expect(consume[0]).toMatchObject({ name: '02000000.img', kind: 'image' });
  });

  it('reads scalar properties inside an image', async () => {
    const src = await makeSource();
    const price = await src.getNode('Item.wz/Consume/0200/02000000.img/info/price');
    expect(price).toMatchObject({ propertyKind: 'int', scalar: 1000 });
    const name = await src.getNode('String.wz/Mob.img/100100/name');
    expect(name).toMatchObject({ propertyKind: 'string', scalar: 'Snail' });
  });

  it('returns a full image subtree via readImageTree', async () => {
    const src = await makeSource();
    const tree = await src.readImageTree('Mob.wz/0100100.img');
    expect(tree).not.toBeNull();
    const info = tree!.children.find((c) => c.name === 'info');
    expect(info?.children.map((c) => c.name)).toEqual(['level']);
  });

  it('readImageTree returns null for a non-image path', async () => {
    const src = await makeSource();
    expect(await src.readImageTree('Item.wz/Consume')).toBeNull();
  });

  it('decodes a canvas property to PNG with correct dimensions', async () => {
    const src = await makeSource();
    const png = await src.getIconPng('Item.wz/Consume/0200/02000000.img/info/icon');
    expect(png).not.toBeNull();
    // PNG signature.
    expect([...png!.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // IHDR width/height (big-endian at offsets 16 and 20).
    const dv = new DataView(png!.buffer, png!.byteOffset);
    expect(dv.getUint32(16)).toBe(1);
    expect(dv.getUint32(20)).toBe(1);
  });
});

describe('detectImageVersion', () => {
  it('detects an unencrypted (BMS) image', async () => {
    const bytes = buildSyntheticImg(FILES[0]!.props, ZERO_KEYSTREAM);
    const result = await detectImageVersion(bytes);
    expect(result?.version).toBe('BMS');
  });

  it('detects a GMS-encrypted image', async () => {
    const gms = await getKeystream('GMS', 256 * 1024);
    const bytes = buildSyntheticImg(FILES[0]!.props, gms);
    const result = await detectImageVersion(bytes);
    expect(result?.version).toBe('GMS');
  });

  it('returns null for non-image garbage', async () => {
    const garbage = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a]);
    expect(await detectImageVersion(garbage)).toBeNull();
  });
});
