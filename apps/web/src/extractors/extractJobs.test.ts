// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractJobs, getBaseJobId } from './extractJobs';
import type { GameDataSource, WzNodeInfo } from '@/parser';

function makeSource(
  tree: Record<string, WzNodeInfo[]>,
  nodes: Record<string, WzNodeInfo>,
): GameDataSource {
  return {
    init: async () => {},
    load: async () => ({ loaded: [], errors: [] }),
    listFiles: async () => [],
    listChildren: async (path) => tree[path] ?? [],
    getNode: async (path) => nodes[path] ?? null,
    getIconPng: async () => null,
    readImageTree: async () => null,
    diagnose: async () => ({ log: [], aesSmokeTest: { ok: true }, loadedFiles: [] }),
    dispose: async () => {},
  };
}

function leaf(name: string, fullPath: string, scalar: string | number): WzNodeInfo {
  return {
    name,
    fullPath,
    kind: 'property',
    propertyKind: typeof scalar === 'string' ? 'string' : 'int',
    hasChildren: false,
    scalar,
  };
}

describe('getBaseJobId', () => {
  it('returns 0 for Beginner variants', () => {
    expect(getBaseJobId(0)).toBe(0);
    expect(getBaseJobId(1)).toBe(0);
    expect(getBaseJobId(99)).toBe(0);
  });

  it('returns the 100s root for advanced jobs', () => {
    expect(getBaseJobId(100)).toBe(100);
    expect(getBaseJobId(112)).toBe(100);
    expect(getBaseJobId(212)).toBe(200);
    expect(getBaseJobId(322)).toBe(300);
    expect(getBaseJobId(422)).toBe(400);
    expect(getBaseJobId(522)).toBe(500);
  });
});

describe('extractJobs', () => {
  it('reads names from the flat layout (String.wz/Job.img/<id> = "Hero")', async () => {
    const source = makeSource(
      {
        'String.wz/Job.img': [
          leaf('0', 'String.wz/Job.img/0', 'Beginner'),
          leaf('100', 'String.wz/Job.img/100', 'Warrior'),
          leaf('112', 'String.wz/Job.img/112', 'Hero'),
          leaf('522', 'String.wz/Job.img/522', 'Corsair'),
        ],
      },
      {},
    );
    const result = await extractJobs(source);
    expect(result.source).toBe('wz');
    expect(result.jobs).toEqual([
      { id: 0, name: 'Beginner', baseJobId: 0 },
      { id: 100, name: 'Warrior', baseJobId: 100 },
      { id: 112, name: 'Hero', baseJobId: 100 },
      { id: 522, name: 'Corsair', baseJobId: 500 },
    ]);
  });

  it('falls back to the nested name layout when the leaf has no scalar', async () => {
    const source = makeSource(
      {
        'String.wz/Job.img': [
          {
            name: '210',
            fullPath: 'String.wz/Job.img/210',
            kind: 'property',
            hasChildren: true,
          },
        ],
      },
      {
        'String.wz/Job.img/210/name': leaf('name', '', 'F/P Wizard'),
      },
    );
    const result = await extractJobs(source);
    expect(result.jobs).toEqual([{ id: 210, name: 'F/P Wizard', baseJobId: 200 }]);
  });

  it('records skipped entries when individual rows have no name', async () => {
    const source = makeSource(
      {
        'String.wz/Job.img': [
          leaf('0', 'String.wz/Job.img/0', 'Beginner'),
          {
            name: '999',
            fullPath: 'String.wz/Job.img/999',
            kind: 'property',
            hasChildren: false,
          },
        ],
      },
      {},
    );
    const result = await extractJobs(source);
    expect(result.source).toBe('wz');
    expect(result.jobs).toEqual([{ id: 0, name: 'Beginner', baseJobId: 0 }]);
    expect(result.skipped).toEqual([{ reason: 'no job name', path: 'String.wz/Job.img/999' }]);
  });

  it('falls back to the hardcoded job names when Job.img is absent', async () => {
    const source = makeSource({}, {});
    const result = await extractJobs(source);
    expect(result.source).toBe('fallback');
    // Just spot-check a few canonical entries — the full map is in domain/jobs.ts.
    const byId = new Map(result.jobs.map((j) => [j.id, j]));
    expect(byId.get(0)).toEqual({ id: 0, name: 'Beginner', baseJobId: 0 });
    expect(byId.get(112)).toEqual({ id: 112, name: 'Hero', baseJobId: 100 });
    expect(byId.get(212)).toEqual({ id: 212, name: 'F/P Arch Mage', baseJobId: 200 });
    expect(byId.get(522)).toEqual({ id: 522, name: 'Corsair', baseJobId: 500 });
    // Ordered by id ascending.
    expect(result.jobs[0].id).toBe(0);
    expect(result.jobs.every((j, i, arr) => i === 0 || j.id > arr[i - 1].id)).toBe(true);
  });

  it('falls back when Job.img exists but yields no usable entries', async () => {
    const source = makeSource(
      {
        'String.wz/Job.img': [
          {
            name: '999',
            fullPath: 'String.wz/Job.img/999',
            kind: 'property',
            hasChildren: false,
          },
        ],
      },
      {},
    );
    const result = await extractJobs(source);
    expect(result.source).toBe('fallback');
    expect(result.jobs.length).toBeGreaterThan(10);
    // The skipped record from the empty Job.img entry is preserved so
    // diagnostics can show the source was malformed before fallback kicked in.
    expect(result.skipped).toEqual([{ reason: 'no job name', path: 'String.wz/Job.img/999' }]);
  });

  it('ignores non-numeric children', async () => {
    const source = makeSource(
      {
        'String.wz/Job.img': [
          leaf('all', 'String.wz/Job.img/all', 'Anything'),
          leaf('100', 'String.wz/Job.img/100', 'Warrior'),
        ],
      },
      {},
    );
    const result = await extractJobs(source);
    expect(result.source).toBe('wz');
    expect(result.jobs).toEqual([{ id: 100, name: 'Warrior', baseJobId: 100 }]);
  });
});
