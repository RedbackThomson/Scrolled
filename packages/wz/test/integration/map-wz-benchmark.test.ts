import { describe, it, expect, beforeAll } from 'vitest';
import { WzFile, WzMapleVersion, WzDirectory, type WzImage } from '@tybys/wz';
import { openFile } from '@/file/open';
import type { WzDirNode } from '@/file/directory';
import type { WzProperty } from '@/img/property';
import { hasLocalFixture, readFixture } from '../helpers/localFixtures';

const FIXTURE = 'Map.wz';
const present = hasLocalFixture(FIXTURE);

describe.skipIf(!present)(`Map.wz walk benchmark vs @tybys/wz`, () => {
  let bytes: Uint8Array;

  beforeAll(() => {
    bytes = readFixture(FIXTURE);
  });

  it('walks Map/Map0 image bucket and reports wall-clock vs the oracle', async () => {
    const t0 = performance.now();
    const file = await openFile(bytes, { version: 'GMS', name: FIXTURE });
    const tOpen = performance.now();

    // Locate Map/Map/Map0 — the canonical low-id bucket. Some MapleRoyals
    // dumps include the wrapping "Map" twice (`Map.wz/Map/Map/Map0`),
    // others not. Probe both.
    const candidates = [
      ['Map', 'Map', 'Map0'],
      ['Map', 'Map0'],
    ];
    let mapBucket: WzDirNode | null = null;
    let bucketSegments: string[] = [];
    for (const segs of candidates) {
      const node = file.resolve(segs);
      if (node && node.kind === 'dir' && (node as WzDirNode).children.length > 0) {
        mapBucket = node as WzDirNode;
        bucketSegments = segs;
        break;
      }
    }
    expect(mapBucket, 'Map0 directory not found').not.toBeNull();
    if (!mapBucket) return;

    // Limit to the first 50 maps so the benchmark stays well under
    // vitest's timeout while still being statistically meaningful.
    const sample = mapBucket.children
      .filter(
        (
          c,
        ): c is {
          kind: 'image';
          name: string;
          offset: number;
          fileSize: number;
          checksum: number;
        } => c.kind === 'image',
      )
      .slice(0, 50);

    let nodeCount = 0;
    for (const imgEntry of sample) {
      const parsed = file.readImage([...bucketSegments, imgEntry.name]);
      if (!parsed) continue;
      nodeCount += countNodes(parsed.properties);
    }
    const tOurs = performance.now();

    // Oracle: same walk through @tybys/wz.
    const oracle = new WzFile(bytes as unknown as File, WzMapleVersion.GMS);
    (oracle as unknown as { name: string }).name = FIXTURE;
    await oracle.parseWzFile();
    const tOracleOpen = performance.now();

    let oracleBucket: unknown = oracle.wzDirectory;
    for (const seg of bucketSegments) {
      if (oracleBucket instanceof WzDirectory) {
        // The oracle lazy-parses subdirectories with checksum=0 — we have
        // to materialise them ourselves before navigating.
        if (oracleBucket.wzDirectories.size === 0 && oracleBucket.wzImages.size === 0) {
          await (oracleBucket as unknown as { parseDirectory(): Promise<void> }).parseDirectory();
        }
      }
      oracleBucket = (oracleBucket as { at(s: string): unknown }).at(seg);
      if (!oracleBucket) throw new Error(`oracle missing segment ${seg}`);
    }
    if (oracleBucket instanceof WzDirectory) {
      if (oracleBucket.wzDirectories.size === 0 && oracleBucket.wzImages.size === 0) {
        await (oracleBucket as unknown as { parseDirectory(): Promise<void> }).parseDirectory();
      }
    }
    const oracleImages = (oracleBucket as { wzImages: Set<WzImage> }).wzImages;
    const oracleSample = [...oracleImages].slice(0, 50);
    let oracleNodeCount = 0;
    for (const img of oracleSample) {
      await img.parseImage();
      oracleNodeCount += countOracleNodes(img.wzProperties);
    }
    const tOracle = performance.now();

    const oursMs = tOurs - tOpen;
    const oursTotalMs = tOurs - t0;
    const oracleMs = tOracle - tOracleOpen;

    console.log(
      `Map.wz benchmark (${sample.length} maps):\n` +
        `  @mushex/wz   open=${(tOpen - t0).toFixed(0)}ms  walk=${oursMs.toFixed(0)}ms  total=${oursTotalMs.toFixed(0)}ms  nodes=${nodeCount}\n` +
        `  @tybys/wz open=${(tOracleOpen - tOurs).toFixed(0)}ms  walk=${oracleMs.toFixed(0)}ms  nodes=${oracleNodeCount}`,
    );

    // Hard assertion: same number of property nodes (proves we walked the
    // same trees).
    expect(nodeCount).toBe(oracleNodeCount);

    oracle.dispose();
  }, 120_000);
});

function countNodes(props: WzProperty[]): number {
  let n = 0;
  for (const p of props) {
    n++;
    if (p.type === 'sub' || p.type === 'convex' || p.type === 'canvas') {
      n += countNodes(p.children);
    }
  }
  return n;
}

function countOracleNodes(props: Iterable<unknown>): number {
  let n = 0;
  for (const p of props) {
    n++;
    const children = (p as { wzProperties?: Iterable<unknown> | null }).wzProperties;
    if (children) n += countOracleNodes(children);
  }
  return n;
}
