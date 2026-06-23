// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractMobs } from './extractMobs';
import type { GameDataSource, WzNodeInfo, WzNodeTree } from '../parser';

/**
 * Reconstruct a depth-2 `String.wz/<X>.img` tree (`<id>/<field>` leaves) from
 * the flat `nodes` map so the string-index builders, which read via
 * `readImageTree`, see the same data the per-leaf fixtures declare.
 */
function synthImageTree(nodes: Record<string, WzNodeInfo>, path: string): WzNodeTree | null {
  const prefix = `${path}/`;
  const byId = new Map<string, WzNodeTree[]>();
  for (const [key, info] of Object.entries(nodes)) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length).split('/');
    if (rest.length !== 2) continue;
    const [id, field] = rest;
    const leaves = byId.get(id!) ?? [];
    leaves.push({ ...info, name: field!, fullPath: key, children: [] });
    byId.set(id!, leaves);
  }
  if (byId.size === 0) return null;
  return {
    name: path.split('/').pop()!,
    fullPath: path,
    kind: 'image',
    hasChildren: true,
    children: [...byId.entries()].map(([id, leaves]) => ({
      name: id,
      fullPath: `${path}/${id}`,
      kind: 'property',
      propertyKind: 'sub',
      hasChildren: true,
      children: leaves,
    })),
  };
}

/**
 * Synthetic raw-tree stub of the WZ surface the mob extractor reads.
 * Models `Mob.wz/<id>.img/info/...` plus `String.wz/Mob.img/<id>/name`
 * and the drop list at `String.wz/MonsterBook.img/<id>/reward/<idx>`.
 *
 * We only implement the GameDataSource methods extractMobs actually
 * calls — everything else throws so a regression that adds new reads is
 * loud instead of silently passing.
 */
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
    getIconRgba: async () => null,
    readImageTree: async (path) => synthImageTree(nodes, path),
    diagnose: async () => ({ log: [], aesSmokeTest: { ok: true }, loadedFiles: [] }),
    dispose: async () => {},
  };
}

function leaf(name: string, fullPath: string, scalar: string | number): WzNodeInfo {
  return { name, fullPath, kind: 'property', propertyKind: 'int', hasChildren: false, scalar };
}

describe('extractMobs', () => {
  it('walks MonsterBook.img/<id>/reward to surface drops alongside base stats', async () => {
    // Two mobs:
    //   100100 has three drops (an item + an equip + an item)
    //   100101 has no MonsterBook entry → no drops
    const source = makeSource(
      {
        'Mob.wz': [
          { name: '0100100.img', fullPath: 'Mob.wz/0100100.img', kind: 'image', hasChildren: true },
          { name: '0100101.img', fullPath: 'Mob.wz/0100101.img', kind: 'image', hasChildren: true },
        ],
        'String.wz/MonsterBook.img/100100/reward': [
          leaf('0', 'String.wz/MonsterBook.img/100100/reward/0', 2000004),
          leaf('1', 'String.wz/MonsterBook.img/100100/reward/1', 1302000),
          leaf('2', 'String.wz/MonsterBook.img/100100/reward/2', 2000005),
        ],
        'String.wz/MonsterBook.img/100101/reward': [],
      },
      {
        'Mob.wz/0100100.img/info/level': leaf('level', '', 5),
        'Mob.wz/0100100.img/info/maxHP': leaf('maxHP', '', 80),
        'Mob.wz/0100100.img/info/maxMP': leaf('maxMP', '', 0),
        'Mob.wz/0100100.img/info/exp': leaf('exp', '', 12),
        'Mob.wz/0100100.img/info/boss': leaf('boss', '', 0),
        'String.wz/Mob.img/100100/name': {
          name: 'name',
          fullPath: 'String.wz/Mob.img/100100/name',
          kind: 'property',
          propertyKind: 'string',
          hasChildren: false,
          scalar: 'Snail',
        },
        'Mob.wz/0100101.img/info/level': leaf('level', '', 7),
        'Mob.wz/0100101.img/info/maxHP': leaf('maxHP', '', 100),
        'Mob.wz/0100101.img/info/maxMP': leaf('maxMP', '', 0),
        'Mob.wz/0100101.img/info/exp': leaf('exp', '', 20),
        'Mob.wz/0100101.img/info/boss': leaf('boss', '', 0),
        'String.wz/Mob.img/100101/name': {
          name: 'name',
          fullPath: 'String.wz/Mob.img/100101/name',
          kind: 'property',
          propertyKind: 'string',
          hasChildren: false,
          scalar: 'Blue Snail',
        },
      },
    );

    const result = await extractMobs(source);

    expect(result.mobs.map((m) => m.name).sort()).toEqual(['Blue Snail', 'Snail']);
    expect(result.drops).toEqual([
      { mobId: 100100, itemId: 2000004 },
      { mobId: 100100, itemId: 1302000 },
      { mobId: 100100, itemId: 2000005 },
    ]);
  });

  it('coerces string-typed reward scalars to numbers and drops invalid entries', async () => {
    const source = makeSource(
      {
        'Mob.wz': [
          { name: '0200000.img', fullPath: 'Mob.wz/0200000.img', kind: 'image', hasChildren: true },
        ],
        'String.wz/MonsterBook.img/200000/reward': [
          leaf('0', '', '2000004'),
          leaf('1', '', 'not a number'),
          leaf('2', '', 0),
          leaf('3', '', 1302000),
        ],
      },
      {
        'Mob.wz/0200000.img/info/level': leaf('level', '', 1),
        'Mob.wz/0200000.img/info/maxHP': leaf('maxHP', '', 1),
        'Mob.wz/0200000.img/info/maxMP': leaf('maxMP', '', 0),
        'Mob.wz/0200000.img/info/exp': leaf('exp', '', 1),
        'Mob.wz/0200000.img/info/boss': leaf('boss', '', 0),
        'String.wz/Mob.img/200000/name': {
          name: 'name',
          fullPath: '',
          kind: 'property',
          propertyKind: 'string',
          hasChildren: false,
          scalar: 'Slime',
        },
      },
    );

    const result = await extractMobs(source);

    expect(result.drops).toEqual([
      { mobId: 200000, itemId: 2000004 },
      { mobId: 200000, itemId: 1302000 },
    ]);
  });

  it('returns an empty drops array when Mob.wz is absent', async () => {
    const source = makeSource({ 'Mob.wz': [] }, {});
    const result = await extractMobs(source);
    expect(result.mobs).toEqual([]);
    expect(result.drops).toEqual([]);
  });
});
