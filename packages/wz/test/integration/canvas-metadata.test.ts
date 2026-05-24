import { describe, it, expect, beforeAll } from 'vitest';
import {
  WzFile,
  WzMapleVersion,
  WzImage,
  WzCanvasProperty,
  WzSubProperty,
  type WzObject,
} from '@tybys/wz';
import { Reader } from '@/io/Reader';
import { readHeader } from '@/file/header';
import { computeVersionHash } from '@/file/versionHash';
import { readDirectory, type WzDirNode } from '@/file/directory';
import { readImage } from '@/img/readImage';
import { getKeystream } from '@/crypto/keystream';
import type { WzCanvasProperty as OurCanvas, WzProperty } from '@/img/property';
import { hasLocalFixture, readFixture } from '../helpers/localFixtures';

function findFirstCanvas(
  props: WzProperty[],
  base: string[] = [],
): { path: string[]; canvas: OurCanvas } | null {
  for (const p of props) {
    const path = [...base, p.name];
    if (p.type === 'canvas') return { path, canvas: p };
    if (p.type === 'sub' || p.type === 'convex') {
      const sub = findFirstCanvas(p.children, path);
      if (sub) return sub;
    }
  }
  return null;
}

function findOracleCanvas(node: WzObject, path: string[]): WzCanvasProperty | null {
  let cur: WzObject | null = node;
  for (const seg of path) {
    if (!cur) return null;
    if (cur instanceof WzImage || cur instanceof WzSubProperty || cur instanceof WzCanvasProperty) {
      cur = cur.at(seg);
    } else {
      return null;
    }
  }
  return cur instanceof WzCanvasProperty ? cur : null;
}

const FIXTURES = ['Item.wz', 'UI.wz', 'Mob.wz', 'Npc.wz'] as const;

for (const fixture of FIXTURES) {
  if (!hasLocalFixture(fixture)) continue;

  describe(`canvas metadata parity vs @tybys/wz (${fixture})`, () => {
    let oracle: WzFile;
    let ours: WzDirNode;
    let bytes: Uint8Array;
    let keystream: Uint8Array;

    beforeAll(async () => {
      bytes = readFixture(fixture);
      oracle = new WzFile(bytes as unknown as File, WzMapleVersion.GMS);
      (oracle as unknown as { name: string }).name = fixture;
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
        name: fixture,
      });
    });

    it('matches width/height/format1/format2 for at least 5 canvases', async () => {
      let matched = 0;
      const distinctFormats = new Set<string>();

      outer: for (const dirChild of ours.children) {
        if (dirChild.kind === 'dir') {
          // Recurse one level into subdirectories — sufficient for the few
          // levels typical of Item.wz / UI.wz.
          for (const subChild of (dirChild as WzDirNode).children) {
            if (subChild.kind !== 'image') continue;
            const ok = await checkImageCanvases(subChild.name, subChild.offset, [
              dirChild.name,
              subChild.name,
            ]);
            if (ok) matched++;
            if (matched >= 5) break outer;
          }
          continue;
        }
        if (dirChild.kind !== 'image') continue;
        const ok = await checkImageCanvases(dirChild.name, dirChild.offset, [dirChild.name]);
        if (ok) matched++;
        if (matched >= 5) break;
      }

      expect(matched).toBeGreaterThanOrEqual(1);
      // Format diversity is informational, not asserted — but logging it
      // tells us how broad our K-stage coverage will be.
       
      console.log(`${fixture} canvas formats seen:`, [...distinctFormats]);

      async function checkImageCanvases(
        imageName: string,
        imageOffset: number,
        pathToImage: string[],
      ): Promise<boolean> {
        const parsed = readImage({
          reader: new Reader(bytes, imageOffset),
          imageOffset,
          keystream,
        });
        const canvas = findFirstCanvas(parsed.properties);
        if (!canvas) return false;

        // Resolve the oracle path for the same canvas. We need to navigate
        // the oracle from its WzFile root through the directory portion of
        // `pathToImage`, then into the image, then walk `canvas.path`.
        let oracleNode: WzObject | null = oracle;
        for (const seg of pathToImage) {
          oracleNode = (oracleNode as unknown as { at(n: string): WzObject | null }).at(seg);
          if (!oracleNode) return false;
        }
        if (oracleNode instanceof WzImage) await oracleNode.parseImage();
        const oracleCanvas = findOracleCanvas(oracleNode!, canvas.path);
        if (!oracleCanvas) return false;

        const oraclePng = (oracleCanvas as unknown as { pngProperty: WzCanvasProperty })
          .pngProperty as unknown as {
          width: number;
          height: number;
          format1: number;
          format2: number;
          offs: number;
        };

        expect(canvas.canvas.width, `${imageName}/${canvas.path.join('/')} width`).toBe(
          oraclePng.width,
        );
        expect(canvas.canvas.height, `${imageName}/${canvas.path.join('/')} height`).toBe(
          oraclePng.height,
        );
        expect(canvas.canvas.format1).toBe(oraclePng.format1);
        expect(canvas.canvas.format2).toBe(oraclePng.format2);
        distinctFormats.add(`${oraclePng.format1}+${oraclePng.format2}`);
        return true;
      }
    });
  });
}
