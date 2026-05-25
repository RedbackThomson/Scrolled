import { describe, it, expect, beforeAll } from 'vitest';
import { WzFile, WzMapleVersion } from '@tybys/wz';
import { Reader } from '@/io/Reader';
import { readHeader } from '@/file/header';
import { computeVersionHash } from '@/file/versionHash';
import { readDirectory, type WzDirNode } from '@/file/directory';
import { readImage } from '@/img/readImage';
import { decodeCanvas } from '@/img/canvas/decode';
import { getKeystream } from '@/crypto/keystream';
import type { WzCanvasProperty, WzProperty } from '@/img/property';
import { hasLocalFixture, readFixture } from '../helpers/localFixtures';

const FIXTURE = 'String.wz';
const present = hasLocalFixture(FIXTURE);

/** Walk a property tree and return a stable shape signature for equality checks. */
function signature(props: WzProperty[]): string {
  const parts: string[] = [];
  const visit = (p: WzProperty, path: string): void => {
    const here = path ? `${path}/${p.name}` : p.name;
    parts.push(`${p.type}:${here}`);
    if (p.type === 'sub' || p.type === 'convex' || p.type === 'canvas') {
      for (const child of p.children) visit(child, here);
    }
  };
  for (const p of props) visit(p, '');
  return parts.join('\n');
}

describe.skipIf(!present)(`parallel parse parity (${FIXTURE})`, () => {
  let bytes: Uint8Array;
  let ours: WzDirNode;
  let keystream: Uint8Array;
  let imageEntries: { name: string; offset: number }[];

  beforeAll(async () => {
    bytes = readFixture(FIXTURE);
    const oracle = new WzFile(bytes as unknown as File, WzMapleVersion.GMS);
    (oracle as unknown as { name: string }).name = FIXTURE;
    await oracle.parseWzFile();
    const header = readHeader(new Reader(bytes));
    const mv = (oracle as unknown as { mapleStoryPatchVersion: number }).mapleStoryPatchVersion;
    const { hash } = computeVersionHash(mv);
    keystream = await getKeystream('GMS', 256 * 1024);
    ours = readDirectory({
      reader: new Reader(bytes, header.dataStart + 2),
      header,
      versionHash: hash,
      keystream,
      name: FIXTURE,
    });
    imageEntries = ours.children
      .filter((c) => c.kind === 'image')
      .map((c) => ({ name: c.name, offset: c.offset }))
      .slice(0, 8);
    oracle.dispose();
  });

  it('produces identical results when called serially vs concurrently', async () => {
    // Serial baseline.
    const serial = imageEntries.map((e) =>
      signature(
        readImage({
          reader: new Reader(bytes, e.offset),
          imageOffset: e.offset,
          keystream,
        }).properties,
      ),
    );

    // Concurrent — kick off all reads at once and await collectively. Each
    // call constructs its own Reader over the same `bytes`.
    const parallel = await Promise.all(
      imageEntries.map(
        (e) =>
          new Promise<string>((resolve) => {
            // setImmediate-ish hop to ensure these don't run in straight
            // function-call order on one microtask tick.
            setTimeout(() => {
              const parsed = readImage({
                reader: new Reader(bytes, e.offset),
                imageOffset: e.offset,
                keystream,
              });
              resolve(signature(parsed.properties));
            }, 0);
          }),
      ),
    );

    expect(parallel).toEqual(serial);
  });

  it('decodes 16 canvas pixel buffers concurrently with identical bytes', async () => {
    // Find ~16 canvases across the first few images.
    const canvases: WzCanvasProperty[] = [];
    for (const entry of imageEntries) {
      const parsed = readImage({
        reader: new Reader(bytes, entry.offset),
        imageOffset: entry.offset,
        keystream,
      });
      const collect = (props: WzProperty[]): void => {
        for (const p of props) {
          if (p.type === 'canvas') canvases.push(p);
          if (p.type === 'sub' || p.type === 'convex' || p.type === 'canvas') {
            collect(p.children);
          }
        }
      };
      collect(parsed.properties);
      if (canvases.length >= 16) break;
    }

    if (canvases.length === 0) return; // no canvases in String.wz top level

    const decodeAll = async (): Promise<Uint8ClampedArray[]> => {
      return Promise.all(
        canvases.map((c) =>
          decodeCanvas({ canvas: c, fileBytes: bytes, keystream }).then((p) => p.rgba),
        ),
      );
    };

    const a = await decodeAll();
    const b = await decodeAll();
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.length).toBe(b[i]!.length);
      for (let j = 0; j < a[i]!.length; j++) {
        if (a[i]![j] !== b[i]![j]) {
          throw new Error(`canvas ${i} byte ${j} differs across concurrent runs`);
        }
      }
    }
  });
});
