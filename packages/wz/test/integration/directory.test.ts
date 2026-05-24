import { describe, it, expect, beforeAll } from 'vitest';
import { WzFile, WzMapleVersion, WzDirectory, WzImage } from '@tybys/wz';
import { Reader } from '@/io/Reader';
import { readHeader } from '@/file/header';
import { computeVersionHash } from '@/file/versionHash';
import { readDirectory, type WzDirNode } from '@/file/directory';
import { getKeystream } from '@/crypto/keystream';
import { hasLocalFixture, readFixture } from '../helpers/localFixtures';

const FIXTURES = ['Base.wz', 'String.wz'] as const;

interface FlatEntry {
  path: string;
  kind: 'dir' | 'image';
  offset: number;
  fileSize: number;
  checksum: number;
}

function flattenOurs(node: WzDirNode, base = ''): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const child of node.children) {
    const childPath = base ? `${base}/${child.name}` : child.name;
    out.push({
      path: childPath,
      kind: child.kind,
      offset: child.offset,
      fileSize: child.fileSize,
      checksum: child.checksum,
    });
    if (child.kind === 'dir') {
      out.push(...flattenOurs(child as WzDirNode, childPath));
    }
  }
  return out;
}

function flattenOracle(dir: WzDirectory, base = ''): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const img of dir.wzImages) {
    const path = base ? `${base}/${img.name}` : img.name;
    out.push({
      path,
      kind: 'image',
      offset: (img as unknown as { offset: number }).offset,
      fileSize: (img as unknown as { blockSize: number }).blockSize,
      checksum: (img as WzImage).checksum,
    });
  }
  for (const sub of dir.wzDirectories) {
    const path = base ? `${base}/${sub.name}` : sub.name;
    out.push({
      path,
      kind: 'dir',
      offset: (sub as unknown as { offset: number }).offset,
      fileSize: (sub as unknown as { blockSize: number }).blockSize,
      checksum: (sub as unknown as { checksum: number }).checksum,
    });
    out.push(...flattenOracle(sub, path));
  }
  return out;
}

const sortKey = (e: FlatEntry) => `${e.path}|${e.kind}`;

for (const fixture of FIXTURES) {
  const present = hasLocalFixture(fixture);
  describe.skipIf(!present)(`directory parity vs @tybys/wz (${fixture})`, () => {
    let ours: WzDirNode;
    let oracleFlat: FlatEntry[];

    beforeAll(async () => {
      const bytes = readFixture(fixture);
      const r = new Reader(bytes);
      const header = readHeader(r);
      // Borrow @tybys/wz's brute-forced version once, then run our pure
      // decoder; the parity check is purely on entry tables, not on the
      // brute-force algorithm itself (covered in header-and-version.test).
      const oracle = new WzFile(bytes as unknown as File, WzMapleVersion.GMS);
      (oracle as unknown as { name: string }).name = fixture;
      await oracle.parseWzFile();
      const mapleVersion = (oracle as unknown as { mapleStoryPatchVersion: number })
        .mapleStoryPatchVersion;
      const { hash } = computeVersionHash(mapleVersion);
      const keystream = await getKeystream('GMS');

      // Position the reader at the first byte after encVersion.
      ours = readDirectory({
        reader: new Reader(bytes, header.dataStart + 2),
        header,
        versionHash: hash,
        keystream,
        name: fixture,
      });

      oracleFlat = flattenOracle(oracle.wzDirectory!);
      oracle.dispose();
    });

    it('entry counts match', () => {
      const oursFlat = flattenOurs(ours);
      expect(oursFlat.length).toBe(oracleFlat.length);
    });

    it('entry names and kinds match (sorted)', () => {
      const oursFlat = flattenOurs(ours).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      const expected = [...oracleFlat].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      expect(oursFlat.map((e) => `${e.kind}:${e.path}`)).toEqual(
        expected.map((e) => `${e.kind}:${e.path}`),
      );
    });

    it('decrypted offsets match', () => {
      const ourByKey = new Map<string, FlatEntry>(
        flattenOurs(ours).map((e) => [sortKey(e), e]),
      );
      for (const ref of oracleFlat) {
        const ourEntry = ourByKey.get(sortKey(ref));
        expect(ourEntry, `missing entry for ${ref.path}`).toBeDefined();
        expect(ourEntry!.offset).toBe(ref.offset);
        expect(ourEntry!.fileSize).toBe(ref.fileSize);
        expect(ourEntry!.checksum).toBe(ref.checksum);
      }
    });
  });
}
