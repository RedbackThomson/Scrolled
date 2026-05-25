import { describe, it, expect, beforeAll } from 'vitest';
import type { WzImage } from '@tybys/wz';
import {
  WzFile,
  WzMapleVersion,
  WzSubProperty,
  WzConvexProperty,
  WzCanvasProperty,
  WzVectorProperty,
  WzUOLProperty,
  WzStringProperty,
  WzIntProperty,
  WzShortProperty,
  WzLongProperty,
  WzFloatProperty,
  WzDoubleProperty,
  WzNullProperty,
  type WzObject,
} from '@tybys/wz';
import { Reader } from '@/io/Reader';
import { readHeader } from '@/file/header';
import { computeVersionHash } from '@/file/versionHash';
import { readDirectory, type WzDirNode } from '@/file/directory';
import { readImage } from '@/img/readImage';
import type { WzProperty } from '@/img/property';
import { getKeystream } from '@/crypto/keystream';
import { hasLocalFixture, readFixture } from '../helpers/localFixtures';

const FIXTURE = 'String.wz';

interface OursWalk {
  path: string;
  type: string;
  value?: string | number | bigint;
  vector?: { x: number; y: number };
  uolTarget?: string;
}

interface OracleWalk {
  path: string;
  type: string;
  value?: string | number | bigint;
  vector?: { x: number; y: number };
  uolTarget?: string;
}

function walkOurs(props: WzProperty[], base: string, out: OursWalk[]): void {
  for (const p of props) {
    const path = base ? `${base}/${p.name}` : p.name;
    switch (p.type) {
      case 'null':
        out.push({ path, type: 'null' });
        break;
      case 'short':
      case 'int':
      case 'float':
      case 'double':
        out.push({ path, type: p.type, value: p.value });
        break;
      case 'long':
        out.push({ path, type: 'long', value: p.value });
        break;
      case 'string':
        out.push({ path, type: 'string', value: p.value });
        break;
      case 'vector':
        out.push({ path, type: 'vector', vector: { x: p.x, y: p.y } });
        break;
      case 'uol':
        out.push({ path, type: 'uol', uolTarget: p.target });
        break;
      case 'sub':
      case 'convex':
        out.push({ path, type: p.type });
        walkOurs(p.children, path, out);
        break;
      case 'canvas':
      case 'sound':
      case 'lua':
        out.push({ path, type: p.type });
        if (p.type === 'canvas') walkOurs(p.children, path, out);
        break;
    }
  }
}

function classifyOracle(p: WzObject): string {
  if (p instanceof WzNullProperty) return 'null';
  if (p instanceof WzShortProperty) return 'short';
  if (p instanceof WzIntProperty) return 'int';
  if (p instanceof WzLongProperty) return 'long';
  if (p instanceof WzFloatProperty) return 'float';
  if (p instanceof WzDoubleProperty) return 'double';
  if (p instanceof WzStringProperty) return 'string';
  if (p instanceof WzVectorProperty) return 'vector';
  if (p instanceof WzUOLProperty) return 'uol';
  if (p instanceof WzCanvasProperty) return 'canvas';
  if (p instanceof WzConvexProperty) return 'convex';
  if (p instanceof WzSubProperty) return 'sub';
  // Sound (WzBinaryProperty), Lua, etc.
  return p.constructor.name
    .replace(/^Wz/, '')
    .replace(/Property$/, '')
    .toLowerCase();
}

function walkOracle(props: Iterable<WzObject>, base: string, out: OracleWalk[]): void {
  for (const p of props) {
    const path = base ? `${base}/${p.name}` : p.name;
    const type = classifyOracle(p);
    const entry: OracleWalk = { path, type };
    if (
      p instanceof WzShortProperty ||
      p instanceof WzIntProperty ||
      p instanceof WzFloatProperty ||
      p instanceof WzDoubleProperty
    ) {
      entry.value = (p as unknown as { value: number }).value;
    } else if (p instanceof WzLongProperty) {
      entry.value = (p as unknown as { value: bigint }).value;
    } else if (p instanceof WzStringProperty) {
      entry.value = (p as unknown as { value: string }).value;
    } else if (p instanceof WzVectorProperty) {
      const v = p as unknown as { x: { value: number }; y: { value: number } };
      entry.vector = { x: v.x.value, y: v.y.value };
    } else if (p instanceof WzUOLProperty) {
      entry.uolTarget = (p as unknown as { value: string }).value;
    }
    out.push(entry);
    const children = (p as unknown as { wzProperties?: Iterable<WzObject> }).wzProperties;
    if (children && (type === 'sub' || type === 'convex' || type === 'canvas')) {
      walkOracle(children, path, out);
    }
  }
}

const present = hasLocalFixture(FIXTURE);

describe.skipIf(!present)(`property-tree parity vs @tybys/wz (${FIXTURE})`, () => {
  let oracle: WzFile;
  let ours: WzDirNode;
  let bytes: Uint8Array;
  let keystream: Uint8Array;

  beforeAll(async () => {
    bytes = readFixture(FIXTURE);
    oracle = new WzFile(bytes as unknown as File, WzMapleVersion.GMS);
    (oracle as unknown as { name: string }).name = FIXTURE;
    await oracle.parseWzFile();
    const r = new Reader(bytes);
    const header = readHeader(r);
    const mapleVersion = (oracle as unknown as { mapleStoryPatchVersion: number })
      .mapleStoryPatchVersion;
    const { hash } = computeVersionHash(mapleVersion);
    keystream = await getKeystream('GMS', 256 * 1024);
    ours = readDirectory({
      reader: new Reader(bytes, header.dataStart + 2),
      header,
      versionHash: hash,
      keystream,
      name: FIXTURE,
    });
  });

  const imagesToCheck = ['Eqp.img', 'Cash.img', 'Consume.img', 'Etc.img', 'Ins.img', 'Pet.img'];
  for (const imgName of imagesToCheck) {
    it(`walks ${imgName} identically to @tybys/wz`, async () => {
      const entry = ours.children.find((c) => c.name === imgName);
      expect(entry, `missing image ${imgName} from our directory`).toBeDefined();
      if (!entry || entry.kind !== 'image') return;

      // Our walk.
      const parsed = readImage({
        reader: new Reader(bytes, entry.offset),
        imageOffset: entry.offset,
        keystream,
      });
      const oursWalk: OursWalk[] = [];
      walkOurs(parsed.properties, '', oursWalk);

      // Oracle walk.
      const oracleImage = oracle.at(imgName) as WzImage | null;
      expect(oracleImage).toBeDefined();
      await oracleImage!.parseImage();
      const oracleWalk: OracleWalk[] = [];
      walkOracle(oracleImage!.wzProperties, '', oracleWalk);

      expect(oursWalk.length).toBe(oracleWalk.length);

      // Compare path-by-path (both walks are in insertion order — both
      // implementations honour the on-disk order).
      for (let i = 0; i < oursWalk.length; i++) {
        const a = oursWalk[i]!;
        const b = oracleWalk[i]!;
        expect(`${a.path}|${a.type}`).toBe(`${b.path}|${b.type}`);
        if (a.value !== undefined || b.value !== undefined) {
          expect(a.value).toEqual(b.value);
        }
        if (a.vector || b.vector) expect(a.vector).toEqual(b.vector);
        if (a.uolTarget || b.uolTarget) expect(a.uolTarget).toEqual(b.uolTarget);
      }
    });
  }
});
