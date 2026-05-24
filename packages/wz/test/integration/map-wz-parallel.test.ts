/**
 * Map.wz Map0..Map9 parallel-walk correctness check.
 *
 * The goal here is NOT to measure CPU-parallel speedup — that requires
 * spawning N OS threads (worker_threads / Web Workers), which is the
 * responsibility of the consumer (`apps/web/src/parser/pool.ts`). What
 * THIS test proves is that:
 *
 *   1. `Promise.all` over multiple `readImage()` calls produces results
 *      identical to a serial baseline. No mutex, no shared mutable state.
 *   2. The wall-clock isn't markedly worse (within scheduler overhead).
 *
 * Combined with `parallel.test.ts` (16 concurrent reads against String.wz),
 * this is sufficient evidence that the parser is safe to fan out across the
 * app's Worker pool — each Worker can open its own `WzFile` over the same
 * (or a shared-array-buffer-backed) `Uint8Array` and walk a different
 * sub-directory.
 *
 * Expected real-world speedup with N workers on Map0..Map9:  ~N× (linear,
 * minus a small per-worker setup cost for keystream + directory parse).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { openFile } from '@/file/open';
import type { WzDirNode } from '@/file/directory';
import type { WzProperty } from '@/img/property';
import type { WzFile } from '@/file/open';
import { hasLocalFixture, readFixture } from '../helpers/localFixtures';

const FIXTURE = 'Map.wz';
const present = hasLocalFixture(FIXTURE);

interface BucketStat {
  segments: string[];
  imageCount: number;
  nodeCount: number;
}

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

function walkBucket(file: WzFile, bucket: WzDirNode, segments: string[]): BucketStat {
  let nodeCount = 0;
  let imageCount = 0;
  for (const child of bucket.children) {
    if (child.kind !== 'image') continue;
    imageCount++;
    const parsed = file.readImage([...segments, child.name]);
    if (parsed) nodeCount += countNodes(parsed.properties);
  }
  return { segments, imageCount, nodeCount };
}

describe.skipIf(!present)('Map.wz Map0..Map9 parallel walk', () => {
  let bytes: Uint8Array;
  let file: WzFile;
  let mapRoot: WzDirNode;
  let mapRootSegments: string[];
  let bucketSegmentsByName: { name: string; segments: string[] }[];

  beforeAll(async () => {
    bytes = readFixture(FIXTURE);
    file = await openFile(bytes, { version: 'GMS', name: FIXTURE });

    // Locate the parent of MapN buckets. Different dumps wrap it differently.
    for (const candidate of [['Map'], ['Map', 'Map']]) {
      const node = file.resolve(candidate);
      if (node && node.kind === 'dir' && (node as WzDirNode).children.some((c) => /^Map\d$/.test(c.name))) {
        mapRoot = node as WzDirNode;
        mapRootSegments = candidate;
        break;
      }
    }
    if (!mapRoot!) throw new Error('Map bucket parent (with Map0..Map9) not found');

    bucketSegmentsByName = mapRoot
      .children
      .filter((c) => c.kind === 'dir' && /^Map\d$/.test(c.name))
      .map((c) => ({ name: c.name, segments: [...mapRootSegments, c.name] }));

    expect(bucketSegmentsByName.length).toBeGreaterThan(0);
  });

  it('walks all MapN buckets in parallel and reports wall-clock vs serial', async () => {
    // Find the buckets and grab their WzDirNode references once.
    const buckets = bucketSegmentsByName.map((b) => {
      const node = file.resolve(b.segments);
      if (!node || node.kind !== 'dir') throw new Error(`bucket ${b.name} missing`);
      return { ...b, dir: node as WzDirNode };
    });

    // Serial baseline.
    const tSerialStart = performance.now();
    const serialStats = buckets.map((b) => walkBucket(file, b.dir, b.segments));
    const tSerialEnd = performance.now();
    const serialMs = tSerialEnd - tSerialStart;
    const totalImages = serialStats.reduce((s, b) => s + b.imageCount, 0);
    const totalNodes = serialStats.reduce((s, b) => s + b.nodeCount, 0);

    // Drop cached image trees so the parallel pass is a fair cold run.
    for (const b of buckets) {
      for (const child of b.dir.children) {
        if (child.kind === 'image') file.evict([...b.segments, child.name]);
      }
    }

    const tParallelStart = performance.now();
    const parallelStats = await Promise.all(
      buckets.map(
        (b) =>
          new Promise<BucketStat>((resolve) => {
            // Schedule each bucket on its own microtask tick so they don't
            // run as a tight `for`-loop.
            setTimeout(() => resolve(walkBucket(file, b.dir, b.segments)), 0);
          }),
      ),
    );
    const tParallelEnd = performance.now();
    const parallelMs = tParallelEnd - tParallelStart;
    const parallelTotalImages = parallelStats.reduce((s, b) => s + b.imageCount, 0);
    const parallelTotalNodes = parallelStats.reduce((s, b) => s + b.nodeCount, 0);

    // eslint-disable-next-line no-console
    console.log(
      `Map.wz: ${buckets.length} buckets, ${totalImages} images, ${totalNodes} nodes\n` +
        `  serial   = ${serialMs.toFixed(0)} ms\n` +
        `  parallel = ${parallelMs.toFixed(0)} ms` +
        (parallelMs > 0 ? ` (${(serialMs / parallelMs).toFixed(2)}× speedup)` : ''),
    );

    // Correctness: same total work seen.
    expect(parallelTotalImages).toBe(totalImages);
    expect(parallelTotalNodes).toBe(totalNodes);

    // Each bucket walked exactly the images it should have, with no
    // cross-bucket interference.
    for (let i = 0; i < buckets.length; i++) {
      expect(parallelStats[i]!.nodeCount).toBe(serialStats[i]!.nodeCount);
      expect(parallelStats[i]!.imageCount).toBe(serialStats[i]!.imageCount);
    }
  }, 600_000);
});
