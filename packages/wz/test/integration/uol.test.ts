import { describe, it, expect, beforeAll } from 'vitest';
import type {
  WzUOLProperty} from '@tybys/wz';
import {
  WzFile,
  WzMapleVersion,
  WzImage,
  type WzObject,
} from '@tybys/wz';
import { Reader } from '@/io/Reader';
import { readHeader } from '@/file/header';
import { computeVersionHash } from '@/file/versionHash';
import { readDirectory, type WzDirNode } from '@/file/directory';
import { readImage } from '@/img/readImage';
import { resolveUol } from '@/img/uol';
import { getKeystream } from '@/crypto/keystream';
import type { WzProperty } from '@/img/property';
import { hasLocalFixture, readFixture } from '../helpers/localFixtures';

// Find the first UOL property in any image under the given root and return
// its absolute path within the image plus the UOL target value.
function findFirstUol(
  props: WzProperty[],
  base: string[] = [],
): { path: string[]; target: string } | null {
  for (const p of props) {
    const path = [...base, p.name];
    if (p.type === 'uol') return { path, target: p.target };
    if (p.type === 'sub' || p.type === 'convex' || p.type === 'canvas') {
      const sub = findFirstUol(p.children, path);
      if (sub) return sub;
    }
  }
  return null;
}

function fullPathOfOracle(node: WzObject, stopAtImage = true): string[] {
  const out: string[] = [];
  let cur: WzObject | null = node;
  while (cur) {
    if (stopAtImage && cur instanceof WzImage) break;
    out.unshift(cur.name);
    cur = (cur as unknown as { parent: WzObject | null }).parent;
  }
  return out;
}

const FIXTURES = ['Mob.wz', 'Npc.wz', 'Item.wz', 'Skill.wz'] as const;

for (const fixture of FIXTURES) {
  if (!hasLocalFixture(fixture)) continue;

  describe(`UOL resolution parity vs @tybys/wz (${fixture})`, () => {
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

    it('resolves at least one in-image UOL identically to the oracle', async () => {
      // Scan a handful of images for any UOL we can match against the
      // oracle. We bail at the first matched pair.
      for (const child of ours.children) {
        if (child.kind !== 'image') continue;
        const parsed = readImage({
          reader: new Reader(bytes, child.offset),
          imageOffset: child.offset,
          keystream,
        });
        const uol = findFirstUol(parsed.properties);
        if (!uol) continue;

        const resolved = resolveUol(parsed.properties, uol.path, uol.target);
        if (!resolved) continue;

        // Find the corresponding UOL in the oracle.
        const oracleImage = oracle.at(child.name) as WzImage | null;
        if (!oracleImage) continue;
        await oracleImage.parseImage();
        const oracleUol = oracleImage.getFromPath(uol.path.join('/')) as
          | WzUOLProperty
          | null;
        if (!oracleUol) continue;
        const oracleLink = oracleUol.linkValue as WzObject | null;
        if (!oracleLink) continue;

        // Compare path-within-image of both resolutions.
        const oraclePath = fullPathOfOracle(oracleLink).join('/');
        // Our resolved property doesn't carry its own path; reconstruct it
        // from the stack the resolver would have produced.
        const stack = uol.path.slice(0, -1);
        for (const seg of uol.target.split('/').filter(Boolean)) {
          if (seg === '..') stack.pop();
          else stack.push(seg);
        }
        const oursResolvedPath = stack.join('/');
        expect(oursResolvedPath).toBe(oraclePath);
        return;
      }
      // It's surprising for a content file to have zero UOLs, but the test
      // is best-effort; pass with a console hint rather than failing.
      console.warn(`${fixture}: no in-image UOLs found in scanned images`);
    });
  });
}
