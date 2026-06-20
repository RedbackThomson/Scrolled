import { describe, it, expect } from 'vitest';
import { ImgDataSource } from '../parser/ImgDataSource';
import type { LoadFileSpec } from '../parser';
import { extractMobs } from './extractMobs';
import { syntheticImgFile, type SynProp } from '../../test/helpers/syntheticImg';

// Proves extractor parity: a real extractor, unchanged, produces the same kind
// of records against a folder of standalone .img files because the IMG data
// source exposes identical logical paths (Mob.wz/<id>.img, String.wz/Mob.img/…).
const ZERO = new Uint8Array(256 * 1024); // BMS / unencrypted

const FILES: { relPath: string; props: SynProp[] }[] = [
  {
    relPath: 'Mob/0100100.img',
    props: [
      {
        type: 'sub',
        name: 'info',
        children: [
          { type: 'int', name: 'level', value: 5 },
          { type: 'int', name: 'maxHP', value: 100 },
          { type: 'int', name: 'exp', value: 10 },
          { type: 'int', name: 'boss', value: 0 },
        ],
      },
    ],
  },
  {
    relPath: 'String/Mob.img',
    props: [
      { type: 'sub', name: '100100', children: [{ type: 'string', name: 'name', value: 'Snail' }] },
    ],
  },
];

describe('extractMobs against an IMG dataset', () => {
  it('produces a named mob record from .img files', async () => {
    const src = new ImgDataSource();
    await src.init('BMS');
    const specs: LoadFileSpec[] = FILES.map((f) => ({
      name: f.relPath,
      source: syntheticImgFile(f.relPath, f.props, ZERO),
    }));
    await src.load(specs);

    const result = await extractMobs(src);
    expect(result.skipped).toEqual([]);
    expect(result.mobs).toHaveLength(1);
    expect(result.mobs[0]).toMatchObject({
      id: 100100,
      name: 'Snail',
      level: 5,
      hp: 100,
      exp: 10,
      isBoss: false,
    });
  });
});
